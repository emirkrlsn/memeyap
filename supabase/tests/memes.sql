-- Faz 2 sunucu kuralları testi: şablon dağıtımı, pas hakkı, meme kaydetme, hazır olma
-- ve faz ilerletme. Her şey sonunda geri alınır (bkz. supabase/tests/rooms.sql).
do $$
declare
  v_users uuid[] := array[]::uuid[];
  v_code text;
  v_room public.rooms;
  v_meme public.memes;
  v_old_template uuid;
  v_count int;
  v_log text := '';
begin
  for i in 1..7 loop
    v_users := v_users || gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, is_anonymous)
    values (v_users[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);
  end loop;

  -- 3 oyunculu oda, oyun başlar.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  v_code := public.create_room('Birinci');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  perform public.join_room(v_code, 'İkinci');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[3])::text, true);
  perform public.join_room(v_code, 'Üçüncü');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  perform public.start_game();
  select * into v_room from public.rooms where code = v_code;

  -- 1) Herkes farklı şablon alır, pas hakları dolar.
  select count(distinct template_id) into v_count from public.memes where room_id = v_room.id and round = 1;
  if v_count <> 3 then raise exception 'TEST FAILED: farklı şablon sayısı %', v_count; end if;
  if cardinality(v_room.used_template_ids) <> 3 then raise exception 'TEST FAILED: kullanılan şablon listesi'; end if;
  if exists (select 1 from public.players where room_id = v_room.id and rerolls_left <> 3) then
    raise exception 'TEST FAILED: pas hakkı';
  end if;
  if (select jsonb_array_length(boxes) from public.memes where room_id = v_room.id limit 1) < 1 then
    raise exception 'TEST FAILED: varsayılan kutular';
  end if;
  v_log := v_log || 'assign ok; ';

  -- 2) Pas: yeni ve daha önce verilmemiş şablon gelir, hak azalır; hak bitince reddedilir.
  select template_id into v_old_template from public.memes
  where room_id = v_room.id and player_id = (select id from public.players where user_id = v_users[1]);
  for i in 1..3 loop
    perform public.reroll_template();
  end loop;
  select * into v_meme from public.memes
  where room_id = v_room.id and player_id = (select id from public.players where user_id = v_users[1]);
  if v_meme.template_id = v_old_template
    or (select rerolls_left from public.players where user_id = v_users[1]) <> 0
    or (select count(distinct t) from unnest((select used_template_ids from public.rooms where id = v_room.id)) t) <> 6 then
    raise exception 'TEST FAILED: pas';
  end if;
  begin
    perform public.reroll_template();
    raise exception 'TEST FAILED: hak bitince pas kabul edildi';
  exception when others then
    if sqlerrm <> 'NO_REROLLS_LEFT' then raise exception 'TEST FAILED: pas sınırı -> %', sqlerrm; end if;
  end;
  v_log := v_log || 'reroll ok; ';

  -- 3) Kaydetme: geçersiz kutular reddedilir, geçerliler temizlenerek kaydedilir.
  begin
    perform public.save_meme((select jsonb_agg(jsonb_build_object('x', 0, 'y', 0, 'w', 0.1, 'h', 0.1)) from generate_series(1, 7)));
    raise exception 'TEST FAILED: 7 kutu kabul edildi';
  exception when others then
    if sqlerrm <> 'INVALID_BOXES' then raise exception 'TEST FAILED: 7 kutu -> %', sqlerrm; end if;
  end;
  begin
    perform public.save_meme('[{"x": 0.5, "y": 0, "w": 0.8, "h": 0.2, "text": "taşan"}]');
    raise exception 'TEST FAILED: taşan kutu kabul edildi';
  exception when others then
    if sqlerrm <> 'INVALID_BOXES' then raise exception 'TEST FAILED: taşan kutu -> %', sqlerrm; end if;
  end;
  perform public.save_meme('[{"x": 0, "y": 0, "w": 1, "h": 0.2, "text": "Selam", "hack": true}]');
  if (select boxes from public.memes where id = v_meme.id)
     <> '[{"x": 0, "y": 0, "w": 1, "h": 0.2, "text": "Selam"}]'::jsonb then
    raise exception 'TEST FAILED: kaydedilen kutular %', (select boxes from public.memes where id = v_meme.id);
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  perform public.save_meme('[{"x": 0, "y": 0.8, "w": 1, "h": 0.2, "text": "Alt yazı"}]');
  v_log := v_log || 'save ok; ';

  -- 4) RLS: oyuncu sadece kendi meme'ini görür.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2], 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.memes;
  execute 'reset role';
  if v_count <> 1 then raise exception 'TEST FAILED: RLS memes gördü %', v_count; end if;
  v_log := v_log || 'rls ok; ';

  -- 5) Geç katılan bu turda meme alamaz.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[4])::text, true);
  perform public.join_room(v_code, 'Geç Kalan');
  begin
    perform public.save_meme('[]');
    raise exception 'TEST FAILED: geç katılan kaydetti';
  exception when others then
    if sqlerrm <> 'NOT_PLAYING' then raise exception 'TEST FAILED: geç katılan -> %', sqlerrm; end if;
  end;
  v_log := v_log || 'late joiner ok; ';

  -- 6) Herkes hazır olunca süre dolmadan oylamaya geçilir; boş meme oylamaya girmez.
  -- (Geç katılan bu turda oynamadığı için beklenmez.)
  for i in 1..3 loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_users[i])::text, true);
    perform public.set_ready(true);
  end loop;
  select * into v_room from public.rooms where id = v_room.id;
  if v_room.status <> 'voting' then raise exception 'TEST FAILED: herkes hazır ama durum %', v_room.status; end if;
  if cardinality(v_room.vote_queue) <> 2 then
    raise exception 'TEST FAILED: oylama kuyruğu %', cardinality(v_room.vote_queue);
  end if;
  if (select is_submitted from public.memes m join public.players p on p.id = m.player_id where p.user_id = v_users[3]) then
    raise exception 'TEST FAILED: boş meme gönderildi';
  end if;
  begin
    perform public.save_meme('[]');
    raise exception 'TEST FAILED: aşama bitince kayıt kabul edildi';
  exception when others then
    if sqlerrm <> 'PHASE_OVER' then raise exception 'TEST FAILED: aşama sonu -> %', sqlerrm; end if;
  end;
  v_log := v_log || 'all ready ok; ';

  -- 7) Süre: dolmadan ilerlemez, dolunca (+2 sn) hem advance_phase hem pg_cron işi ilerletir.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[5])::text, true);
  v_code := public.create_room('Beşinci');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[6])::text, true);
  perform public.join_room(v_code, 'Altıncı');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[7])::text, true);
  perform public.join_room(v_code, 'Yedinci');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[5])::text, true);
  perform public.start_game();
  perform public.save_meme('[{"x": 0, "y": 0, "w": 1, "h": 0.2, "text": "Yazdım"}]');
  perform public.advance_phase();
  if (select status from public.rooms where code = v_code) <> 'creating' then
    raise exception 'TEST FAILED: süre dolmadan ilerledi';
  end if;
  update public.rooms set phase_ends_at = now() - interval '1 second' where code = v_code;
  perform private.advance_due_rooms();
  if (select status from public.rooms where code = v_code) <> 'creating' then
    raise exception 'TEST FAILED: 2 sn tolerans beklenmedi';
  end if;
  update public.rooms set phase_ends_at = now() - interval '3 seconds' where code = v_code;
  perform private.advance_due_rooms();
  select * into v_room from public.rooms where code = v_code;
  if v_room.status <> 'voting' or cardinality(v_room.vote_queue) <> 1 then
    raise exception 'TEST FAILED: süre dolunca ilerleme % %', v_room.status, cardinality(v_room.vote_queue);
  end if;
  v_log := v_log || 'timeout ok';

  raise exception 'TESTS PASSED: %', v_log;
end;
$$;
