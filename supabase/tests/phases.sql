-- Geçiş ekranları ve otomatik tur testi: 3 sn giriş, 15 sn oylama, 20 sn ara sıralama
-- ve sonraki turun kendiliğinden başlaması. Her şey sonunda geri alınır.
do $$
declare
  v_users uuid[] := array[]::uuid[];
  v_code text;
  v_room public.rooms;
  v_log text := '';
begin
  for i in 1..3 loop
    v_users := v_users || gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, is_anonymous)
    values (v_users[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  v_code := public.create_room('Geçiş Bir');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  perform public.join_room(v_code, 'Geçiş İki');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[3])::text, true);
  perform public.join_room(v_code, 'Geçiş Üç');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  perform public.start_game();

  -- 1) Oyun başlarken 3 sn giriş; tur süresi girişten sonra işler.
  select * into v_room from public.rooms where code = v_code;
  if v_room.phase_starts_at <> now() + interval '3 seconds'
    or v_room.phase_ends_at <> v_room.phase_starts_at + make_interval(secs => v_room.round_seconds) then
    raise exception 'TEST FAILED: oyun başlangıç girişi';
  end if;
  v_log := v_log || 'game intro ok; ';

  -- 2) Oylama: 3 sn giriş + 15 sn.
  for i in 1..3 loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_users[i])::text, true);
    perform public.save_meme(jsonb_build_array(jsonb_build_object('x', 0, 'y', 0, 'w', 1, 'h', 0.2, 'text', 'yazı')));
    perform public.set_ready(true);
  end loop;
  select * into v_room from public.rooms where code = v_code;
  if v_room.status <> 'voting'
    or v_room.phase_starts_at <> now() + interval '3 seconds'
    or v_room.phase_ends_at <> v_room.phase_starts_at + interval '15 seconds' then
    raise exception 'TEST FAILED: oylama girişi/süresi';
  end if;
  v_log := v_log || 'voting intro + 15s ok; ';

  -- 3) Oylamalar bitince ara sıralama 20 sn; süre dolunca sonraki tur kendiliğinden başlar.
  while (select status from public.rooms where code = v_code) = 'voting' loop
    update public.rooms set phase_ends_at = now() - interval '3 seconds' where code = v_code;
    perform private.advance_due_rooms();
  end loop;
  select * into v_room from public.rooms where code = v_code;
  if v_room.status <> 'round_results' or v_room.phase_ends_at <> now() + interval '20 seconds' then
    raise exception 'TEST FAILED: ara sıralama 20 sn';
  end if;
  perform private.advance_due_rooms();
  if (select status from public.rooms where code = v_code) <> 'round_results' then
    raise exception 'TEST FAILED: ara sıralama erken bitti';
  end if;
  update public.rooms set phase_ends_at = now() - interval '1 second' where code = v_code;
  perform private.advance_due_rooms();
  select * into v_room from public.rooms where code = v_code;
  if v_room.status <> 'creating' or v_room.current_round <> 2
    or v_room.phase_starts_at <> now() + interval '3 seconds' then
    raise exception 'TEST FAILED: otomatik sonraki tur %', v_room.status;
  end if;
  v_log := v_log || 'auto next round ok';

  raise exception 'TESTS PASSED: %', v_log;
end;
$$;
