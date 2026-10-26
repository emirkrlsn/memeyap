-- Faz 3: oylama, sahip açıklama, puanlama, ara sıralama ve oyun sonu.
--
-- Akış: creating → (her meme için) voting 30 sn → reveal 45 sn → … →
--       round_results (host "sonraki tur" der) veya son turdan sonra final.
-- * Oylama sırasında meme'in sahibi gizlidir; sadece get_current_vote_meme ile, sahipsiz döner.
-- * Oylar tablodan okunamaz; dağılım sadece açıklama aşamasında RPC ile döner.
-- * Bağlı oyuncu sayısı 3'ün altına düşerse oyun otomatik biter.

create type public.vote_rating as enum (
  'cok_begenildi', 'begenildi', 'fena_degil', 'begenilmedi', 'berbat'
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references public.memes (id) on delete cascade,
  voter_player_id uuid not null references public.players (id) on delete cascade,
  rating public.vote_rating not null,
  points integer not null,
  -- Süre içinde oy vermeyen için otomatik "fena değil".
  is_auto boolean not null default false,
  created_at timestamptz not null default now(),
  unique (meme_id, voter_player_id)
);
create index votes_voter_player_id_idx on public.votes (voter_player_id);

alter table public.memes
  add column points integer not null default 0,
  -- Oylamada ekrana geldiği an (Faz 4: ancak bundan sonra herkes indirebilir).
  add column shown_at timestamptz;

alter table public.rooms
  add column current_vote_index smallint not null default 0,
  add column current_vote_meme_id uuid references public.memes (id) on delete set null,
  -- Oyuncu sayısı 3'ün altına düştüğü için erken bittiyse true.
  add column ended_early boolean not null default false;
create index rooms_current_vote_meme_id_idx on public.rooms (current_vote_meme_id);

-- Puan eşlemesi tek yer: src/lib/ratings.ts ile aynı olmalı (npm run test:db doğrular).
create function private.rating_points(p_rating public.vote_rating)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_rating
    when 'cok_begenildi' then 500
    when 'begenildi' then 200
    when 'fena_degil' then 0
    when 'begenilmedi' then -100
    when 'berbat' then -250
  end;
$$;

-- ---------------------------------------------------------------------------
-- Faz geçişleri
-- ---------------------------------------------------------------------------

-- Turu bitirir: son turdaysa oyun biter, değilse ara sıralamaya geçilir.
create function private.end_round(p_room_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.rooms
  set status = case when current_round >= total_rounds then 'final' else 'round_results' end::public.room_status,
      finished_at = case when current_round >= total_rounds then now() end,
      phase_ends_at = null,
      current_vote_meme_id = null
  where id = p_room_id;
$$;

-- Kuyruktaki p_index'inci meme'in oylamasını başlatır (sahibi oyundan çıktıysa atlar).
create function private.start_vote(p_room_id uuid, p_index integer)
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
      phase_ends_at = now() + interval '30 seconds'
  where id = p_room_id;
end;
$$;

-- Oylamayı kapatır: oy vermeyenlere otomatik 0 puan, puanı sahibine ekler, açıklamaya geçer.
create function private.finish_vote(p_room_id uuid)
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
  if not found then
    -- Sahibi oyundan çıkmış: açıklanacak bir şey yok.
    perform private.start_vote(p_room_id, v_room.current_vote_index + 1);
    return;
  end if;

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

  update public.rooms
  set status = 'reveal', phase_ends_at = now() + interval '45 seconds'
  where id = p_room_id;
end;
$$;

-- Bu meme'e oy verebilecek bağlı herkes oy verdi mi?
create function private.voting_done(p_room_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not exists (
    select 1
    from public.rooms r
    join public.memes m on m.id = r.current_vote_meme_id
    join public.players p on p.room_id = r.id
    where r.id = p_room_id
      and p.active_from_round <= r.current_round
      and p.is_connected
      and p.id <> m.player_id
      and not exists (
        select 1 from public.votes v where v.meme_id = m.id and v.voter_player_id = p.id
      )
  );
$$;

-- Süresi dolan ya da erken bitme koşulu sağlanan fazı ilerletir. Tekrar çağrılması güvenlidir.
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

  elsif v_room.status = 'reveal' then
    if now() < v_room.phase_ends_at then
      return;
    end if;
    perform private.start_vote(p_room_id, v_room.current_vote_index + 1);
  end if;
end;
$$;

-- pg_cron yedeği: bağlantıları günceller (oyun erken bitebilir) ve süresi dolanları ilerletir.
create or replace function private.advance_due_rooms()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  for v_room_id in
    select id from public.rooms where status in ('creating', 'voting', 'reveal')
  loop
    perform private.sweep_room(v_room_id);
    perform private.try_advance(v_room_id);
  end loop;
end;
$$;

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
      phase_ends_at = now() + make_interval(secs => round_seconds),
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

-- Bağlantı durumları, host devri ve (oyun sürerken) 3 kişinin altına düşünce oyun sonu.
create or replace function private.sweep_room(p_room_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Aynı odada eşzamanlı süpürmeleri sıraya koy.
  perform 1 from public.rooms where id = p_room_id for update;

  update public.players p
  set is_connected = s.connected
  from (
    select p2.id, coalesce(h.last_seen > now() - interval '30 seconds', false) as connected
    from public.players p2
    left join private.player_heartbeats h on h.player_id = p2.id
    where p2.room_id = p_room_id
  ) s
  where p.id = s.id and p.is_connected is distinct from s.connected;

  update public.rooms r
  set host_player_id = (
    select p.id from public.players p
    where p.room_id = r.id and p.is_connected
    order by p.joined_at, p.id
    limit 1
  )
  where r.id = p_room_id
    and not exists (
      select 1 from public.players p where p.id = r.host_player_id and p.is_connected
    )
    and exists (
      select 1 from public.players p where p.room_id = r.id and p.is_connected
    );

  update public.rooms r
  set status = 'final',
      ended_early = true,
      finished_at = now(),
      phase_ends_at = null,
      current_vote_meme_id = null
  where r.id = p_room_id
    and r.status not in ('lobby', 'final')
    and (select count(*) from public.players p where p.room_id = r.id and p.is_connected) < 3;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC'ler
-- ---------------------------------------------------------------------------

create function public.cast_vote(p_rating public.vote_rating)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := private.current_player();
  v_room public.rooms;
  v_meme public.memes;
begin
  select * into v_room from public.rooms where id = v_player.room_id for update;
  if v_room.status <> 'voting' or now() >= v_room.phase_ends_at + interval '2 seconds' then
    raise exception 'PHASE_OVER';
  end if;
  if v_player.active_from_round > v_room.current_round then
    raise exception 'NOT_PLAYING';
  end if;
  select * into v_meme from public.memes where id = v_room.current_vote_meme_id;
  if v_meme.player_id = v_player.id then
    raise exception 'OWN_MEME';
  end if;

  insert into public.votes (meme_id, voter_player_id, rating, points)
  values (v_meme.id, v_player.id, p_rating, private.rating_points(p_rating))
  on conflict (meme_id, voter_player_id) do update
    set rating = excluded.rating, points = excluded.points, is_auto = false;

  perform private.try_advance(v_room.id);
end;
$$;

-- Oylamadaki meme. Oylama sırasında sahibi döndürülmez; açıklama aşamasında sahibi,
-- toplam puanı ve oy dağılımı da döner.
create function public.get_current_vote_meme()
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
  if v_room.status not in ('voting', 'reveal') then
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
    ),
    'reveal', case when v_room.status = 'reveal' then jsonb_build_object(
      'owner', (select username from public.players where id = v_meme.player_id),
      'points', v_meme.points,
      'distribution', (
        select jsonb_object_agg(r, (
          select count(*) from public.votes v where v.meme_id = v_meme.id and v.rating = r
        ))
        from unnest(enum_range(null::public.vote_rating)) as r
      )
    ) end
  );
end;
$$;

create function public.next_round()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := private.current_player();
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = v_player.room_id for update;
  if v_room.host_player_id is distinct from v_player.id then
    raise exception 'NOT_HOST';
  end if;
  if v_room.status <> 'round_results' then
    raise exception 'PHASE_OVER';
  end if;

  update public.rooms set current_round = current_round + 1 where id = v_room.id;
  perform private.start_round(v_room.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------

alter table public.votes enable row level security;
revoke all on public.votes from anon, authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_room_id(), private.my_player_id() to authenticated;

revoke all on function
  public.cast_vote(public.vote_rating),
  public.get_current_vote_meme(),
  public.next_round()
from public, anon;
grant execute on function
  public.cast_vote(public.vote_rating),
  public.get_current_vote_meme(),
  public.next_round()
to authenticated;
