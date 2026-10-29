-- Geçiş ekranları ve otomatik tur geçişi.
--
-- * Her meme oluşturma ve oylama aşamasından önce 3 sn'lik giriş ekranı ("Oyun başlıyor",
--   "Oylama başlıyor", "Sıradaki meme"). Aşamanın asıl süresi rooms.phase_starts_at'ten
--   itibaren işler; giriş ekranı oyun süresinden yemez.
-- * Her meme için oylama süresi 15 sn (önce 30).
-- * Ara sıralama 20 sn gösterilir, sonra sonraki tur kendiliğinden başlar (host beklenmez).

alter table public.rooms add column phase_starts_at timestamptz;

create or replace function private.start_round(p_room_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_player_id uuid;
  v_template_id uuid;
begin
  update public.rooms
  set status = 'creating',
      phase_starts_at = now() + interval '3 seconds',
      phase_ends_at = now() + interval '3 seconds' + make_interval(secs => round_seconds),
      vote_queue = '{}',
      current_vote_index = 0,
      current_vote_meme_id = null
  where id = p_room_id
  returning * into v_room;

  update public.players
  set is_ready = false, rerolls_left = v_room.reroll_limit
  where room_id = p_room_id;

  for v_player_id in
    select id from public.players
    where room_id = p_room_id and active_from_round <= v_room.current_round
    order by joined_at
  loop
    v_template_id := private.pick_template(p_room_id);
    insert into public.memes (room_id, round, player_id, template_id, boxes)
    values (p_room_id, v_room.current_round, v_player_id, v_template_id,
            private.boxes_from_template(v_template_id));
  end loop;
end;
$$;

create or replace function private.start_vote(p_room_id uuid, p_index integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_queue uuid[];
  v_index integer := p_index;
begin
  select vote_queue into v_queue from public.rooms where id = p_room_id;
  while v_index < cardinality(v_queue)
    and not exists (select 1 from public.memes where id = v_queue[v_index + 1]) loop
    v_index := v_index + 1;
  end loop;

  if v_index >= cardinality(v_queue) then
    perform private.end_round(p_room_id);
    return;
  end if;

  update public.memes set shown_at = coalesce(shown_at, now()) where id = v_queue[v_index + 1];
  update public.rooms
  set status = 'voting',
      current_vote_index = v_index,
      current_vote_meme_id = v_queue[v_index + 1],
      phase_starts_at = now() + interval '3 seconds',
      phase_ends_at = now() + interval '3 seconds' + interval '15 seconds'
  where id = p_room_id;
end;
$$;

-- Tur sonu: son turdaysa oyun biter; değilse ara sıralama 20 sn gösterilir.
create or replace function private.end_round(p_room_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.rooms
  set status = case when current_round >= total_rounds then 'final' else 'round_results' end::public.room_status,
      finished_at = case when current_round >= total_rounds then now() end,
      phase_starts_at = null,
      phase_ends_at = case when current_round >= total_rounds then null else now() + interval '20 seconds' end,
      current_vote_meme_id = null
  where id = p_room_id;
$$;

create or replace function private.try_advance(p_room_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_all_ready boolean;
begin
  select * into v_room from public.rooms where id = p_room_id for update;

  if v_room.status = 'creating' then
    select bool_and(is_ready) into v_all_ready from public.players
    where room_id = p_room_id and active_from_round <= v_room.current_round and is_connected;
    if now() < v_room.phase_ends_at + interval '2 seconds' and not coalesce(v_all_ready, false) then
      return;
    end if;

    -- Hiç yazı girilmemiş meme oylamaya girmez; yazı girilmişse son hâliyle gönderilir.
    update public.memes m
    set is_submitted = exists (
      select 1 from jsonb_array_elements(m.boxes) as box where btrim(box ->> 'text') <> ''
    )
    where m.room_id = p_room_id and m.round = v_room.current_round;

    update public.rooms
    set vote_queue = coalesce((
          select array_agg(id order by random()) from public.memes
          where room_id = p_room_id and round = v_room.current_round and is_submitted
        ), '{}')
    where id = p_room_id;
    perform private.start_vote(p_room_id, 0);

  elsif v_room.status = 'voting' then
    if now() < v_room.phase_ends_at + interval '2 seconds' and not private.voting_done(p_room_id) then
      return;
    end if;
    perform private.finish_vote(p_room_id);

  elsif v_room.status = 'round_results' then
    if now() < v_room.phase_ends_at then
      return;
    end if;
    update public.rooms set current_round = current_round + 1 where id = p_room_id;
    perform private.start_round(p_room_id);
  end if;
end;
$$;

create or replace function private.advance_due_rooms()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  for v_room_id in
    select id from public.rooms where status in ('creating', 'voting', 'round_results')
  loop
    perform private.sweep_room(v_room_id);
    perform private.try_advance(v_room_id);
  end loop;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_room_id(), private.my_player_id() to authenticated;
