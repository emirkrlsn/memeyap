-- Faz 3 sunucu kuralları testi: oylama, sahip gizliliği, puanlama, açıklama, ara sıralama
-- ve oyun sonu. Her şey sonunda geri alınır (bkz. supabase/tests/rooms.sql).
do $$
declare
  v_users uuid[] := array[]::uuid[];
  v_code text;
  v_room public.rooms;
  v_owner uuid;      -- oylanan meme'in sahibinin kullanıcı kimliği
  v_voters uuid[];   -- o meme'e oy verebilecek kullanıcılar
  v_info jsonb;
  v_count int;
  v_log text := '';
begin
  for i in 1..4 loop
    v_users := v_users || gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, is_anonymous)
    values (v_users[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);
  end loop;

  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  v_code := public.create_room('Ahmet');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  perform public.join_room(v_code, 'Bahar');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[3])::text, true);
  perform public.join_room(v_code, 'Can Boş');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  perform public.start_game();
  perform public.save_meme('[{"x": 0, "y": 0, "w": 1, "h": 0.2, "text": "Birinci yazı"}]');
  perform public.set_ready(true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  perform public.save_meme('[{"x": 0, "y": 0, "w": 1, "h": 0.2, "text": "İkinci yazı"}]');
  perform public.set_ready(true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[3])::text, true);
  perform public.set_ready(true);

  select * into v_room from public.rooms where code = v_code;
  if v_room.status <> 'voting' or cardinality(v_room.vote_queue) <> 2 then
    raise exception 'TEST FAILED: oylama başlamadı % %', v_room.status, cardinality(v_room.vote_queue);
  end if;
  if (select shown_at from public.memes where id = v_room.current_vote_meme_id) is null then
    raise exception 'TEST FAILED: shown_at';
  end if;

  -- 1) Oylamada sahip gizli; sahibi kendi meme'ine oy veremez.
  select p.user_id into v_owner from public.memes m join public.players p on p.id = m.player_id
  where m.id = v_room.current_vote_meme_id;
  select array_agg(u) into v_voters from unnest(v_users[1:3]) u where u <> v_owner;

  perform set_config('request.jwt.claims', json_build_object('sub', v_voters[1])::text, true);
  v_info := public.get_current_vote_meme();
  if (v_info ->> 'is_mine')::boolean or v_info -> 'reveal' <> 'null'::jsonb
    or v_info::text like '%' || (select username from public.players where user_id = v_owner) || '%'
    or v_info::text like '%' || (select id::text from public.players where user_id = v_owner) || '%' then
    raise exception 'TEST FAILED: oylamada sahip sızdı %', v_info;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);
  if not (public.get_current_vote_meme() ->> 'is_mine')::boolean then
    raise exception 'TEST FAILED: is_mine';
  end if;
  begin
    perform public.cast_vote('cok_begenildi');
    raise exception 'TEST FAILED: kendi meme''ine oy verdi';
  exception when others then
    if sqlerrm <> 'OWN_MEME' then raise exception 'TEST FAILED: kendi meme -> %', sqlerrm; end if;
  end;
  v_log := v_log || 'privacy ok; ';

  -- 2) Oylama sırasında katılan bu turda oy veremez.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[4])::text, true);
  perform public.join_room(v_code, 'Deniz Geç');
  begin
    perform public.cast_vote('berbat');
    raise exception 'TEST FAILED: geç katılan oy verdi';
  exception when others then
    if sqlerrm <> 'NOT_PLAYING' then raise exception 'TEST FAILED: geç katılan -> %', sqlerrm; end if;
  end;
  v_log := v_log || 'late joiner ok; ';

  -- 3) Herkes oy verince süre dolmadan açıklamaya geçilir; puan = oyların toplamı.
  perform set_config('request.jwt.claims', json_build_object('sub', v_voters[1])::text, true);
  perform public.cast_vote('begenilmedi');
  perform public.cast_vote('cok_begenildi'); -- oy değiştirilebilir
  if (select status from public.rooms where id = v_room.id) <> 'voting' then
    raise exception 'TEST FAILED: tek oyla erken geçildi';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_voters[2])::text, true);
  perform public.cast_vote('berbat');
  if (select status from public.rooms where id = v_room.id) <> 'reveal' then
    raise exception 'TEST FAILED: herkes oy verdi ama açıklanmadı';
  end if;
  v_info := public.get_current_vote_meme() -> 'reveal';
  if (v_info ->> 'points')::int <> 250
    or v_info ->> 'owner' <> (select username from public.players where user_id = v_owner)
    or (v_info -> 'distribution' ->> 'cok_begenildi')::int <> 1
    or (v_info -> 'distribution' ->> 'berbat')::int <> 1
    or (v_info -> 'distribution' ->> 'fena_degil')::int <> 0 then
    raise exception 'TEST FAILED: açıklama %', v_info;
  end if;
  if (select score from public.players where user_id = v_owner) <> 250 then
    raise exception 'TEST FAILED: sahibin puanı';
  end if;
  v_log := v_log || 'early reveal + scoring ok; ';

  -- 4) Oylar tablodan okunamaz.
  execute 'set local role authenticated';
  begin
    perform 1 from public.votes;
    raise exception 'TEST FAILED: oylar okunabildi';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- 5) Açıklama 45 sn sürer; sonra sıradaki meme oylanır.
  perform public.advance_phase();
  if (select status from public.rooms where id = v_room.id) <> 'reveal' then
    raise exception 'TEST FAILED: açıklama erken bitti';
  end if;
  update public.rooms set phase_ends_at = now() - interval '1 second' where id = v_room.id;
  perform public.advance_phase();
  select * into v_room from public.rooms where id = v_room.id;
  if v_room.status <> 'voting' or v_room.current_vote_index <> 1 then
    raise exception 'TEST FAILED: sıradaki meme %', v_room.status;
  end if;
  v_log := v_log || 'reveal timing ok; ';

  -- 6) Süre dolunca oy vermeyen otomatik "fena değil" (0) almış sayılır.
  select p.user_id into v_owner from public.memes m join public.players p on p.id = m.player_id
  where m.id = v_room.current_vote_meme_id;
  select array_agg(u) into v_voters from unnest(v_users[1:3]) u where u <> v_owner;
  perform set_config('request.jwt.claims', json_build_object('sub', v_voters[1])::text, true);
  perform public.cast_vote('begenildi');
  update public.rooms set phase_ends_at = now() - interval '3 seconds' where id = v_room.id;
  perform private.advance_due_rooms();
  v_info := public.get_current_vote_meme() -> 'reveal';
  if (v_info ->> 'points')::int <> 200 or (v_info -> 'distribution' ->> 'fena_degil')::int <> 1 then
    raise exception 'TEST FAILED: otomatik oy %', v_info;
  end if;
  select count(*) into v_count from public.votes v join public.players p on p.id = v.voter_player_id
  where p.user_id = v_voters[2] and v.is_auto and v.rating = 'fena_degil' and v.points = 0;
  if v_count <> 1 then raise exception 'TEST FAILED: otomatik oy kaydı'; end if;
  v_log := v_log || 'auto vote ok; ';

  -- 7) Son meme'den sonra ara sıralama; sonraki turu sadece host başlatır, geç katılan artık oynar.
  update public.rooms set phase_ends_at = now() - interval '1 second' where id = v_room.id;
  perform public.advance_phase();
  if (select status from public.rooms where id = v_room.id) <> 'round_results' then
    raise exception 'TEST FAILED: ara sıralama';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  begin
    perform public.next_round();
    raise exception 'TEST FAILED: host olmayan sonraki turu başlattı';
  exception when others then
    if sqlerrm <> 'NOT_HOST' then raise exception 'TEST FAILED: sonraki tur yetkisi -> %', sqlerrm; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  perform public.next_round();
  select * into v_room from public.rooms where id = v_room.id;
  if v_room.status <> 'creating' or v_room.current_round <> 2
    or (select count(*) from public.memes where room_id = v_room.id and round = 2) <> 4 then
    raise exception 'TEST FAILED: 2. tur';
  end if;
  v_log := v_log || 'round results + next round ok; ';

  -- 8) Son turun sonunda oyun biter.
  update public.rooms set current_round = total_rounds where id = v_room.id;
  perform private.end_round(v_room.id);
  select * into v_room from public.rooms where id = v_room.id;
  if v_room.status <> 'final' or v_room.finished_at is null or v_room.ended_early then
    raise exception 'TEST FAILED: son tur sonu';
  end if;
  v_log := v_log || 'last round ok; ';

  -- 9) Oyun sürerken bağlı oyuncu 3'ün altına düşerse oyun otomatik biter.
  update public.rooms set status = 'creating', finished_at = null where id = v_room.id;
  update private.player_heartbeats set last_seen = now() - interval '1 minute'
  where player_id in (select id from public.players where user_id in (v_users[3], v_users[4]));
  perform public.heartbeat();
  select * into v_room from public.rooms where id = v_room.id;
  if v_room.status <> 'final' or not v_room.ended_early then
    raise exception 'TEST FAILED: erken bitiş %', v_room.status;
  end if;
  v_log := v_log || 'ended early ok';

  raise exception 'TESTS PASSED: %', v_log;
end;
$$;
