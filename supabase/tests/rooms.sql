-- Faz 1 sunucu kuralları testi. Sahte kullanıcılar oluşturur, RPC'leri onların adına
-- çağırır ve sonunda her şeyi geri alır (veritabanında iz bırakmaz).
-- Çalıştırma: Supabase SQL Editor veya MCP execute_sql. Sonuç, hata mesajı olarak döner:
-- "TESTS PASSED ..." başarı, "TEST FAILED: ..." başarısızlık demektir.
do $$
declare
  v_users uuid[] := array[]::uuid[];
  v_code text;
  v_room public.rooms;
  v_err text;
  v_count int;
  v_log text := '';
begin
  for i in 1..17 loop
    v_users := v_users || gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, is_anonymous)
    values (v_users[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);
  end loop;

  -- 1) Oda oluşturma, kullanıcı adı kırpılır, oluşturan host olur.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1], 'role', 'authenticated')::text, true);
  v_code := public.create_room('  Emir ');
  select * into v_room from public.rooms where code = v_code;
  if v_code !~ '^[A-Z0-9]{6}$' then raise exception 'TEST FAILED: kod biçimi %', v_code; end if;
  if (select username from public.players where id = v_room.host_player_id) <> 'Emir' then
    raise exception 'TEST FAILED: host/kırpma';
  end if;
  v_log := v_log || 'create ok; ';

  -- 2) Aynı ad (farklı harf büyüklüğü) reddedilir, küçük harfli kod kabul edilir.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  begin
    perform public.join_room(lower(v_code), 'EMIR');
    raise exception 'TEST FAILED: aynı ad kabul edildi';
  exception when others then
    v_err := sqlerrm;
    if v_err <> 'USERNAME_TAKEN' then raise exception 'TEST FAILED: aynı ad -> %', v_err; end if;
  end;
  perform public.join_room(lower(v_code), 'Ayşe');
  v_log := v_log || 'duplicate name ok; ';

  -- 3) Geçersiz kod ve geçersiz kullanıcı adları.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[3])::text, true);
  begin
    perform public.join_room('ZZZZZZ', 'Zeynep');
    raise exception 'TEST FAILED: geçersiz kod kabul edildi';
  exception when others then
    if sqlerrm <> 'ROOM_NOT_FOUND' then raise exception 'TEST FAILED: geçersiz kod -> %', sqlerrm; end if;
  end;
  foreach v_err in array array['abc', 'onyedikarakterlik', E'ab\tcd', '    '] loop
    begin
      perform public.join_room(v_code, v_err);
      raise exception 'TEST FAILED: geçersiz ad kabul edildi: %', v_err;
    exception when others then
      if sqlerrm <> 'USERNAME_INVALID' then raise exception 'TEST FAILED: ad % -> %', v_err, sqlerrm; end if;
    end;
  end loop;
  perform public.join_room(v_code, 'Zey 😀 #1');
  v_log := v_log || 'validation ok; ';

  -- 4) Kapasite: 15 oyuncu dolar, 16. reddedilir.
  for i in 4..15 loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_users[i])::text, true);
    perform public.join_room(v_code, 'Oyuncu' || i);
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[16])::text, true);
  begin
    perform public.join_room(v_code, 'Oyuncu16');
    raise exception 'TEST FAILED: 16. oyuncu kabul edildi';
  exception when others then
    if sqlerrm <> 'ROOM_FULL' then raise exception 'TEST FAILED: kapasite -> %', sqlerrm; end if;
  end;
  v_log := v_log || 'capacity ok; ';

  -- Katılma sıraları farklı olsun (aynı işlemde now() hep aynı).
  update public.players p set joined_at = now() + (s.n || ' seconds')::interval
  from (select id, row_number() over (order by username = 'Emir' desc, username = 'Ayşe' desc, username) as n
        from public.players where room_id = v_room.id) s
  where p.id = s.id;

  -- 5) Ayarlar: sadece host, sadece geçerli değerler.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  begin
    perform public.update_settings(4, 120, 5);
    raise exception 'TEST FAILED: host olmayan ayar değiştirdi';
  exception when others then
    if sqlerrm <> 'NOT_HOST' then raise exception 'TEST FAILED: ayar yetkisi -> %', sqlerrm; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  begin
    perform public.update_settings(6, 90, 3);
    raise exception 'TEST FAILED: geçersiz ayar kabul edildi';
  exception when others then
    if sqlerrm <> 'INVALID_SETTINGS' then raise exception 'TEST FAILED: geçersiz ayar -> %', sqlerrm; end if;
  end;
  perform public.update_settings(4, 120, 5);
  select * into v_room from public.rooms where id = v_room.id;
  if (v_room.total_rounds, v_room.round_seconds, v_room.reroll_limit) <> (4, 120, 5) then
    raise exception 'TEST FAILED: ayarlar kaydedilmedi';
  end if;
  v_log := v_log || 'settings ok; ';

  -- 6) Host bağlantısı 30 sn'den uzun koparsa yetki en erken katılmış bağlı oyuncuya geçer.
  update private.player_heartbeats set last_seen = now() - interval '31 seconds'
  where player_id = v_room.host_player_id;
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[3])::text, true);
  perform public.heartbeat();
  select * into v_room from public.rooms where id = v_room.id;
  if (select username from public.players where id = v_room.host_player_id) <> 'Ayşe' then
    raise exception 'TEST FAILED: host devri -> %', (select username from public.players where id = v_room.host_player_id);
  end if;
  if (select is_connected from public.players where user_id = v_users[1]) then
    raise exception 'TEST FAILED: kopan oyuncu bağlı görünüyor';
  end if;
  -- Eski host geri dönünce bağlı olur ama yetki geri gitmez.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  perform public.heartbeat();
  if not (select is_connected from public.players where user_id = v_users[1])
    or (select host_player_id from public.rooms where id = v_room.id) <> v_room.host_player_id then
    raise exception 'TEST FAILED: geri dönüş';
  end if;
  v_log := v_log || 'host transfer ok; ';

  -- 7) Başlatma: sadece host; oyun başlayınca katılan bir sonraki turdan oynar.
  begin
    perform public.start_game();
    raise exception 'TEST FAILED: host olmayan başlattı';
  exception when others then
    if sqlerrm <> 'NOT_HOST' then raise exception 'TEST FAILED: başlatma yetkisi -> %', sqlerrm; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  perform public.start_game();
  select * into v_room from public.rooms where id = v_room.id;
  if v_room.status <> 'creating' or v_room.current_round <> 1 or v_room.phase_ends_at is null then
    raise exception 'TEST FAILED: oyun başlamadı';
  end if;
  -- Biri ayrılınca yer açılır; geç katılan 2. turdan oynar.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[15])::text, true);
  perform public.leave_room();
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[16])::text, true);
  perform public.join_room(v_code, 'Geççi');
  update public.players set joined_at = now() + interval '1 hour' where user_id = v_users[16];
  if (select active_from_round from public.players where user_id = v_users[16]) <> 2 then
    raise exception 'TEST FAILED: geç katılan turu';
  end if;
  v_log := v_log || 'start + late join ok; ';

  -- 8) Host ayrılırsa yetki hemen devredilir.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  perform public.leave_room();
  if (select username from public.players p join public.rooms r on r.host_player_id = p.id where r.id = v_room.id) <> 'Emir' then
    raise exception 'TEST FAILED: ayrılan host devri';
  end if;
  v_log := v_log || 'host leave ok; ';

  -- 9) RLS: başka odadaki kullanıcı bu odayı ve oyuncularını göremez; tablolara yazamaz.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[17], 'role', 'authenticated')::text, true);
  perform public.create_room('Yabancı');
  execute 'set local role authenticated';
  select count(*) into v_count from public.rooms;
  if v_count <> 1 then raise exception 'TEST FAILED: RLS rooms gördü %', v_count; end if;
  select count(*) into v_count from public.players;
  if v_count <> 1 then raise exception 'TEST FAILED: RLS players gördü %', v_count; end if;
  begin
    update public.players set score = 999;
    raise exception 'TEST FAILED: doğrudan yazma kabul edildi';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from private.player_heartbeats;
    raise exception 'TEST FAILED: heartbeat tablosu okunabildi';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  v_log := v_log || 'rls ok';

  raise exception 'TESTS PASSED: %', v_log;
end;
$$;
