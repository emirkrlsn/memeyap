-- Meme'ler artık tek tek açıklanmıyor (45 sn'lik bekleme yok): oylama biten meme'den sonra
-- hemen sıradakine geçilir; sahipler, puanlar ve oy dağılımları tur sonunda tek sayfada,
-- puana göre sıralı gösterilir (get_round_results). 'reveal' durumu artık kullanılmıyor.

create or replace function private.finish_vote(p_room_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_meme public.memes;
  v_points integer;
begin
  select * into v_room from public.rooms where id = p_room_id;
  select * into v_meme from public.memes where id = v_room.current_vote_meme_id;

  if found then
    insert into public.votes (meme_id, voter_player_id, rating, points, is_auto)
    select v_meme.id, p.id, 'fena_degil', private.rating_points('fena_degil'), true
    from public.players p
    where p.room_id = p_room_id
      and p.active_from_round <= v_room.current_round
      and p.id <> v_meme.player_id
    on conflict (meme_id, voter_player_id) do nothing;

    select coalesce(sum(points), 0) into v_points from public.votes where meme_id = v_meme.id;
    update public.memes set points = v_points where id = v_meme.id;
    update public.players set score = score + v_points where id = v_meme.player_id;
  end if;

  perform private.start_vote(p_room_id, v_room.current_vote_index + 1);
end;
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
    select id from public.rooms where status in ('creating', 'voting')
  loop
    perform private.sweep_room(v_room_id);
    perform private.try_advance(v_room_id);
  end loop;
end;
$$;

-- Oylamadaki meme (sahibi döndürülmez).
create or replace function public.get_current_vote_meme()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.players := private.current_player();
  v_room public.rooms;
  v_meme public.memes;
  v_template public.templates;
begin
  select * into v_room from public.rooms where id = v_player.room_id;
  if v_room.status <> 'voting' then
    return null;
  end if;
  select * into v_meme from public.memes where id = v_room.current_vote_meme_id;
  if not found then
    return null;
  end if;
  select * into v_template from public.templates where id = v_meme.template_id;

  return jsonb_build_object(
    'meme_id', v_meme.id,
    'index', v_room.current_vote_index + 1,
    'total', cardinality(v_room.vote_queue),
    'template', jsonb_build_object(
      'storage_path', v_template.storage_path,
      'width', v_template.width,
      'height', v_template.height,
      'kind', v_template.kind
    ),
    'boxes', v_meme.boxes,
    'is_mine', v_meme.player_id = v_player.id,
    'my_rating', (
      select rating from public.votes
      where meme_id = v_meme.id and voter_player_id = v_player.id and not is_auto
    ),
    'votes_cast', (select count(*) from public.votes where meme_id = v_meme.id and not is_auto),
    'voters', (
      select count(*) from public.players
      where room_id = v_room.id and active_from_round <= v_room.current_round
        and id <> v_meme.player_id
    )
  );
end;
$$;

-- Tur sonucu: bu turda oylanan meme'ler puana göre sıralı, sahibi ve oy dağılımıyla.
-- Sadece tur bittikten sonra (round_results / final) döner.
create function public.get_round_results()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.players := private.current_player();
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = v_player.room_id;
  if v_room.status not in ('round_results', 'final') then
    return null;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'meme_id', m.id,
        'owner', p.username,
        'points', m.points,
        'boxes', m.boxes,
        'template', jsonb_build_object(
          'storage_path', t.storage_path,
          'width', t.width,
          'height', t.height,
          'kind', t.kind
        ),
        'distribution', (
          select jsonb_object_agg(r, (
            select count(*) from public.votes v where v.meme_id = m.id and v.rating = r
          ))
          from unnest(enum_range(null::public.vote_rating)) as r
        )
      )
      order by m.points desc, array_position(v_room.vote_queue, m.id)
    )
    from public.memes m
    join public.templates t on t.id = m.template_id
    left join public.players p on p.id = m.player_id
    where m.room_id = v_room.id
      and m.round = v_room.current_round
      and m.shown_at is not null
  ), '[]');
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_room_id(), private.my_player_id() to authenticated;

revoke all on function public.get_round_results() from public, anon;
grant execute on function public.get_round_results() to authenticated;
