-- Faz 4 sunucu kuralları testi: indirilebilir meme'ler. Oylanmamış başka bir oyuncunun
-- meme'ine hiçbir yoldan erişilemez. Her şey sonunda geri alınır.
do $$
declare
  v_users uuid[] := array[]::uuid[];
  v_code text;
  v_room public.rooms;
  v_owner uuid;
  v_result jsonb;
  v_log text := '';
begin
  for i in 1..3 loop
    v_users := v_users || gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, is_anonymous)
    values (v_users[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);
  end loop;

  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  v_code := public.create_room('İndiren Bir');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2])::text, true);
  perform public.join_room(v_code, 'İndiren İki');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[3])::text, true);
  perform public.join_room(v_code, 'İndiren Üç');
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1])::text, true);
  perform public.start_game();
  for i in 1..3 loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_users[i])::text, true);
    perform public.save_meme(jsonb_build_array(jsonb_build_object('x', 0, 'y', 0, 'w', 1, 'h', 0.2, 'text', 'yazı ' || i)));
  end loop;

  -- 1) Meme oluşturma sırasında başkasının meme'ine hiçbir yoldan erişilemez.
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2], 'role', 'authenticated')::text, true);
  if public.get_game_memes() is not null or public.get_round_results() is not null
    or public.get_current_vote_meme() is not null then
    raise exception 'TEST FAILED: oluşturma sırasında meme döndü';
  end if;
  execute 'set local role authenticated';
  if (select count(*) from public.memes) <> 1 then
    raise exception 'TEST FAILED: tablodan başkasının meme''i okundu';
  end if;
  execute 'reset role';
  v_log := v_log || 'creating ok; ';

  -- 2) Oylama sırasında sadece ekrandaki meme (sahipsiz) alınabilir; sıradakiler alınamaz.
  for i in 1..3 loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_users[i])::text, true);
    perform public.set_ready(true);
  end loop;
  select * into v_room from public.rooms where code = v_code;
  select p.user_id into v_owner from public.memes m join public.players p on p.id = m.player_id
  where m.id = v_room.current_vote_meme_id;
  perform set_config('request.jwt.claims', json_build_object('sub', (select u from unnest(v_users) u where u <> v_owner limit 1))::text, true);
  if public.get_game_memes() is not null then
    raise exception 'TEST FAILED: oylama sırasında tüm meme''ler döndü';
  end if;
  if (public.get_current_vote_meme() ->> 'meme_id')::uuid <> v_room.current_vote_meme_id then
    raise exception 'TEST FAILED: ekrandaki meme';
  end if;
  if (select count(*) from public.memes where shown_at is not null and room_id = v_room.id) <> 1 then
    raise exception 'TEST FAILED: sadece ekrana gelen meme işaretli olmalı';
  end if;
  v_log := v_log || 'voting ok; ';

  -- 3) Oyun bitince: sadece oylanmış (ekrana gelmiş) meme'ler sahipleriyle döner.
  -- (Oyun 1. meme'nin oylaması sırasında biterse diğer ikisi hiç gösterilmemiştir.)
  update public.rooms set status = 'final', finished_at = now() where id = v_room.id;
  v_result := public.get_game_memes();
  if jsonb_array_length(v_result) <> 1
    or v_result #>> '{0,owner}' <> (select username from public.players where user_id = v_owner)
    or (v_result #>> '{0,round}')::int <> 1
    or v_result #>> '{0,template,storage_path}' is null then
    raise exception 'TEST FAILED: oyun sonu meme listesi %', v_result;
  end if;
  v_log := v_log || 'final ok';

  raise exception 'TESTS PASSED: %', v_log;
end;
$$;
