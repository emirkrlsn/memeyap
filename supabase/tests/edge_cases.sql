-- Faz 6 uç durumlar: host'un oylama ortasında ayrılması, tur sonucunda katılan oyuncu.
-- Her şey sonunda geri alınır (bkz. supabase/tests/rooms.sql).
do $$
declare
  v_users uuid[] := array[]::uuid[];
  v_code text;
  v_room public.rooms;
  v_host_meme uuid;
  v_guard int := 0;
  v_log text := '';
begin
  for i in 1..5 loop
    v_users := v_users || gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, is_anonymous)
    values (v_users[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);
  end loop;

  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  v_code := public.create_room('Uç Host');
  for i in 2..4 loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_users[i])::text, true);
    perform public.join_room(v_code, 'Uç Oyuncu ' || i);
  end loop;
  -- Katılma sırası belli olsun (aynı işlemde now() hep aynı).
  update public.players p set joined_at = now() + (s.n || ' seconds')::interval
  from (select id, row_number() over (order by username) as n from public.players
        where room_id = (select id from public.rooms where code = v_code)) s
  where p.id = s.id;

  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  perform public.start_game();
  for i in 1..4 loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_users[i])::text, true);
    perform public.save_meme(jsonb_build_array(jsonb_build_object('x', 0, 'y', 0, 'w', 1, 'h', 0.2, 'text', 'yazı ' || i)));
    perform public.set_ready(true);
  end loop;
  select * into v_room from public.rooms where code = v_code;
  if v_room.status <> 'voting' or cardinality(v_room.vote_queue) <> 4 then
    raise exception 'TEST FAILED: oylama başlamadı';
  end if;
  select m.id into v_host_meme from public.memes m join public.players p on p.id = m.player_id
  where p.user_id = v_users[1];
  -- En zor durum: host ayrılırken ekranda oylanan meme host'unki olsun.
  update public.rooms
  set vote_queue = array[v_host_meme] || array_remove(vote_queue, v_host_meme),
      current_vote_index = 0,
      current_vote_meme_id = v_host_meme
  where id = v_room.id;

  -- 1) Host oylama ortasında ayrılır: yetki en erken katılan bağlı oyuncuya geçer,
  -- oyun sürer (3 bağlı oyuncu kaldı) ve host'un meme'i kuyruktan atlanır.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  perform public.leave_room();
  select * into v_room from public.rooms where code = v_code;
  if v_room.status <> 'voting'
    or (select username from public.players where id = v_room.host_player_id) <> 'Uç Oyuncu 2' then
    raise exception 'TEST FAILED: host ayrılınca % / %', v_room.status,
      (select username from public.players where id = v_room.host_player_id);
  end if;
  -- Kalanlar oy versin; kuyrukta host'un (silinmiş) meme'i varsa atlanmalı.
  while (select status from public.rooms where code = v_code) = 'voting' and v_guard < 20 loop
    v_guard := v_guard + 1;
    for i in 2..4 loop
      perform set_config('request.jwt.claims', json_build_object('sub', v_users[i])::text, true);
      begin
        perform public.cast_vote('begenildi');
      exception when others then
        if sqlerrm not in ('OWN_MEME', 'PHASE_OVER') then raise; end if;
      end;
    end loop;
  end loop;
  select * into v_room from public.rooms where code = v_code;
  if v_room.status <> 'round_results' then
    raise exception 'TEST FAILED: oylama bitmedi %', v_room.status;
  end if;
  if exists (select 1 from public.memes where id = v_host_meme) then
    raise exception 'TEST FAILED: ayrılan host''un meme''i kaldı';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  if jsonb_array_length(public.get_round_results()) <> 3 then
    raise exception 'TEST FAILED: tur sonucunda 3 meme olmalı';
  end if;
  v_log := v_log || 'host leaves mid-voting ok; ';

  -- 2) Tur sonucu ekranındayken katılan, yeni host'un başlattığı sonraki turda oynar.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[5])::text, true);
  perform public.join_room(v_code, 'Sonradan Gelen');
  if (select active_from_round from public.players where user_id = v_users[5]) <> 2 then
    raise exception 'TEST FAILED: tur sonucunda katılan';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  perform public.next_round();
  if not exists (
    select 1 from public.memes m join public.players p on p.id = m.player_id
    where p.user_id = v_users[5] and m.round = 2
  ) then
    raise exception 'TEST FAILED: sonradan gelen 2. turda meme almadı';
  end if;
  v_log := v_log || 'late join at round results ok';

  raise exception 'TESTS PASSED: %', v_log;
end;
$$;
