-- Faz 5 sunucu kuralları testi: aynı odayla tekrar oyna ve veri silme.
-- Her şey sonunda geri alınır (bkz. supabase/tests/rooms.sql).
do $$
declare
  v_users uuid[] := array[]::uuid[];
  v_code text;
  v_room public.rooms;
  v_log text := '';
begin
  for i in 1..6 loop
    v_users := v_users || gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, is_anonymous)
    values (v_users[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);
  end loop;

  -- Oyun oynanır ve biter.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  v_code := public.create_room('Temiz Bir');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  perform public.join_room(v_code, 'Temiz İki');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[3])::text, true);
  perform public.join_room(v_code, 'Temiz Üç');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  begin
    perform public.restart_room();
    raise exception 'TEST FAILED: oyun bitmeden yeniden başladı';
  exception when others then
    if sqlerrm <> 'GAME_NOT_OVER' then raise exception 'TEST FAILED: bitmeden -> %', sqlerrm; end if;
  end;
  perform public.start_game();
  for i in 1..3 loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_users[i])::text, true);
    perform public.save_meme(jsonb_build_array(jsonb_build_object('x', 0, 'y', 0, 'w', 1, 'h', 0.2, 'text', 'yazı')));
    perform public.set_ready(true);
  end loop;
  -- Oylama sürdükçe herkes "beğenildi" versin (kendi meme'ine oy veremez).
  while (select status from public.rooms where code = v_code) = 'voting' loop
    for j in 1..3 loop
      perform set_config('request.jwt.claims', json_build_object('sub', v_users[j])::text, true);
      begin
        perform public.cast_vote('begenildi');
      exception when others then
        if sqlerrm not in ('OWN_MEME', 'PHASE_OVER') then raise; end if;
      end;
    end loop;
  end loop;
  select * into v_room from public.rooms where code = v_code;
  if v_room.status <> 'round_results' then raise exception 'TEST FAILED: tur bitmedi %', v_room.status; end if;
  update public.rooms set status = 'final', finished_at = now() where id = v_room.id;

  -- 1) Aynı odayla tekrar oyna: sadece host; herkes lobide, puanlar ve meme'ler sıfır.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  begin
    perform public.restart_room();
    raise exception 'TEST FAILED: host olmayan yeniden başlattı';
  exception when others then
    if sqlerrm <> 'NOT_HOST' then raise exception 'TEST FAILED: yetki -> %', sqlerrm; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  perform public.restart_room();
  select * into v_room from public.rooms where id = v_room.id;
  if v_room.status <> 'lobby' or v_room.current_round <> 0 or v_room.code <> v_code
    or cardinality(v_room.used_template_ids) <> 0 or v_room.finished_at is not null
    or exists (select 1 from public.players where room_id = v_room.id and (score <> 0 or active_from_round <> 1))
    or exists (select 1 from public.memes where room_id = v_room.id)
    or (select count(*) from public.players where room_id = v_room.id) <> 3 then
    raise exception 'TEST FAILED: yeniden başlatma';
  end if;
  -- Aynı kodla yeni oyun başlar.
  perform public.start_game();
  if (select status from public.rooms where id = v_room.id) <> 'creating' then
    raise exception 'TEST FAILED: yeni oyun başlamadı';
  end if;
  v_log := v_log || 'restart ok; ';

  -- 2) Son oyuncu "odadan ayrıl" deyince oda ve tüm verisi hemen silinir.
  for i in 1..3 loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_users[i])::text, true);
    perform public.leave_room();
  end loop;
  if exists (select 1 from public.rooms where id = v_room.id)
    or exists (select 1 from public.memes where room_id = v_room.id)
    or exists (select 1 from public.players where room_id = v_room.id) then
    raise exception 'TEST FAILED: son oyuncu çıkınca silinmedi';
  end if;
  v_log := v_log || 'last leave ok; ';

  -- 3) Herkesin bağlantısı 30 sn'den uzun koparsa pg_cron işi odayı siler; biri bağlıysa silmez.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[4])::text, true);
  v_code := public.create_room('Kopan Bir');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[5])::text, true);
  perform public.join_room(v_code, 'Kopan İki');
  select * into v_room from public.rooms where code = v_code;
  update private.player_heartbeats set last_seen = now() - interval '1 minute'
  where player_id = (select id from public.players where user_id = v_users[4]);
  perform private.delete_abandoned_rooms();
  if not exists (select 1 from public.rooms where id = v_room.id) then
    raise exception 'TEST FAILED: bağlı oyuncu varken silindi';
  end if;
  update private.player_heartbeats set last_seen = now() - interval '1 minute'
  where player_id in (select id from public.players where room_id = v_room.id);
  perform private.delete_abandoned_rooms();
  if exists (select 1 from public.rooms where id = v_room.id)
    or exists (select 1 from public.players where room_id = v_room.id) then
    raise exception 'TEST FAILED: terk edilen oda silinmedi';
  end if;
  if not exists (select 1 from public.templates) then
    raise exception 'TEST FAILED: şablonlar silindi';
  end if;
  v_log := v_log || 'abandoned ok';

  raise exception 'TESTS PASSED: %', v_log;
end;
$$;
