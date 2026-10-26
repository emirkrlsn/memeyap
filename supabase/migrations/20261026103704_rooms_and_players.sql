-- Faz 1: odalar, oyuncular, bağlantı takibi ve lobi RPC'leri.
--
-- Kurallar:
-- * Tablolara istemciden sadece okuma yapılır (RLS: kişi yalnızca kendi odasını görür).
-- * Her değişiklik aşağıdaki SECURITY DEFINER RPC'lerle yapılır; çağıran auth.uid() ile belirlenir.
-- * Bir kullanıcı aynı anda en fazla bir odada olabilir.
-- * Hata mesajları sabit kodlardır (ROOM_FULL vb.); Türkçe karşılıkları istemcide.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------

create type public.room_status as enum (
  'lobby', 'creating', 'voting', 'reveal', 'round_results', 'final'
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_player_id uuid,
  status public.room_status not null default 'lobby',
  total_rounds smallint not null default 3 check (total_rounds between 3 and 5),
  round_seconds smallint not null default 90 check (round_seconds in (60, 90, 120)),
  reroll_limit smallint not null default 3 check (reroll_limit between 3 and 8),
  current_round smallint not null default 0 check (current_round >= 0),
  phase_ends_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  username text not null check (
    username = btrim(username)
    and char_length(username) between 4 and 16
    and username !~ '[[:cntrl:]]'
  ),
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  -- Oyun sürerken katılan oyuncu bir sonraki turdan itibaren oynar.
  active_from_round smallint not null default 1,
  is_connected boolean not null default true
);

create unique index players_room_id_username_key on public.players (room_id, lower(username));
create index players_room_id_joined_at_idx on public.players (room_id, joined_at);

alter table public.rooms
  add constraint rooms_host_player_id_fkey
  foreign key (host_player_id) references public.players (id) on delete set null;
create index rooms_host_player_id_idx on public.rooms (host_player_id);

-- Son görülme zamanı ayrı tutulur: her heartbeat'te players tablosu güncellenseydi
-- Realtime tüm oyunculara gereksiz olay gönderirdi. players.is_connected sadece
-- durum değişince güncellenir.
create table private.player_heartbeats (
  player_id uuid primary key references public.players (id) on delete cascade,
  last_seen timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Yardımcı fonksiyonlar (dışarıya kapalı şema)
-- ---------------------------------------------------------------------------

-- RLS için: çağıranın bulunduğu oda.
create function private.my_room_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select room_id from public.players where user_id = (select auth.uid());
$$;

create function private.generate_room_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 1 + get_byte(b, i) % 36, 1), '')
  from extensions.gen_random_bytes(6) as b, generate_series(0, 5) as i;
$$;

create function private.normalize_username(p_username text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_username text := btrim(coalesce(p_username, ''));
begin
  if char_length(v_username) not between 4 and 16 or v_username ~ '[[:cntrl:]]' then
    raise exception 'USERNAME_INVALID';
  end if;
  return v_username;
end;
$$;

create function private.current_player()
returns public.players
language plpgsql
stable
set search_path = ''
as $$
declare
  v_player public.players;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_player from public.players where user_id = auth.uid();
  if not found then
    raise exception 'NOT_IN_ROOM';
  end if;
  return v_player;
end;
$$;

-- Bağlantı durumlarını günceller ve host bağlı değilse yetkiyi
-- en erken katılmış bağlı oyuncuya devreder.
create function private.sweep_room(p_room_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Aynı odada eşzamanlı süpürmeleri sıraya koy.
  perform 1 from public.rooms where id = p_room_id for update;

  update public.players p
  set is_connected = h.last_seen > now() - interval '30 seconds'
  from private.player_heartbeats h
  where h.player_id = p.id
    and p.room_id = p_room_id
    and p.is_connected is distinct from (h.last_seen > now() - interval '30 seconds');

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
end;
$$;

create function private.remove_player(p_player_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  delete from public.players where id = p_player_id returning room_id into v_room_id;
  if v_room_id is not null then
    perform private.sweep_room(v_room_id);
  end if;
end;
$$;

create function private.add_player(
  p_room_id uuid,
  p_username text,
  p_active_from_round smallint
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_player_id uuid;
begin
  if exists (
    select 1 from public.players
    where room_id = p_room_id and lower(username) = lower(p_username)
  ) then
    raise exception 'USERNAME_TAKEN';
  end if;

  insert into public.players (room_id, user_id, username, active_from_round)
  values (p_room_id, auth.uid(), p_username, p_active_from_round)
  returning id into v_player_id;

  insert into private.player_heartbeats (player_id) values (v_player_id);
  return v_player_id;
exception
  when unique_violation then
    raise exception 'USERNAME_TAKEN';
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC'ler
-- ---------------------------------------------------------------------------

create function public.create_room(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := private.normalize_username(p_username);
  v_room_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Önceki odadan çık (kullanıcı aynı anda tek odada olabilir).
  perform private.remove_player(p.id) from public.players p where p.user_id = auth.uid();

  loop
    v_code := private.generate_room_code();
    begin
      insert into public.rooms (code) values (v_code) returning id into v_room_id;
      exit;
    exception
      when unique_violation then
        -- Kod çakıştı, yenisini dene.
    end;
  end loop;

  update public.rooms
  set host_player_id = private.add_player(v_room_id, v_username, 1::smallint)
  where id = v_room_id;

  return v_code;
end;
$$;

create function public.join_room(p_code text, p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := private.normalize_username(p_username);
  v_room public.rooms;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Kilit: kapasite ve kullanıcı adı kontrolleri eşzamanlı katılımlarda da doğru kalsın.
  select * into v_room from public.rooms where code = upper(btrim(p_code)) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  -- Zaten bu odadaysa (ör. bağlantı koptu) olduğu yerden devam et.
  if exists (select 1 from public.players where room_id = v_room.id and user_id = auth.uid()) then
    return v_room.code;
  end if;

  perform private.remove_player(p.id) from public.players p where p.user_id = auth.uid();

  if (select count(*) from public.players where room_id = v_room.id) >= 15 then
    raise exception 'ROOM_FULL';
  end if;

  perform private.add_player(
    v_room.id,
    v_username,
    case when v_room.status = 'lobby' then 1 else v_room.current_round + 1 end::smallint
  );
  perform private.sweep_room(v_room.id);

  return v_room.code;
end;
$$;

create function public.leave_room()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.remove_player((private.current_player()).id);
end;
$$;

create function public.heartbeat()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := private.current_player();
begin
  insert into private.player_heartbeats (player_id, last_seen)
  values (v_player.id, now())
  on conflict (player_id) do update set last_seen = excluded.last_seen;

  perform private.sweep_room(v_player.room_id);
end;
$$;

create function public.update_settings(
  p_total_rounds integer,
  p_round_seconds integer,
  p_reroll_limit integer
)
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
  if v_room.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED';
  end if;
  if p_total_rounds not between 3 and 5
    or p_round_seconds not in (60, 90, 120)
    or p_reroll_limit not between 3 and 8 then
    raise exception 'INVALID_SETTINGS';
  end if;

  update public.rooms
  set total_rounds = p_total_rounds,
      round_seconds = p_round_seconds,
      reroll_limit = p_reroll_limit
  where id = v_room.id;
end;
$$;

create function public.start_game()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := private.current_player();
  v_room public.rooms;
begin
  perform private.sweep_room(v_player.room_id);

  select * into v_room from public.rooms where id = v_player.room_id for update;
  if v_room.host_player_id is distinct from v_player.id then
    raise exception 'NOT_HOST';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED';
  end if;
  if (select count(*) from public.players where room_id = v_room.id and is_connected) < 3 then
    raise exception 'NOT_ENOUGH_PLAYERS';
  end if;

  update public.rooms
  set status = 'creating',
      current_round = 1,
      phase_ends_at = now() + make_interval(secs => v_room.round_seconds)
  where id = v_room.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler ve RLS
-- ---------------------------------------------------------------------------

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table private.player_heartbeats enable row level security;

revoke all on public.rooms, public.players from anon, authenticated;
revoke all on private.player_heartbeats from public, anon, authenticated;
grant select on public.rooms, public.players to authenticated;

create policy "Oyuncular kendi odalarını görür" on public.rooms
  for select to authenticated
  using (id = (select private.my_room_id()));

create policy "Oyuncular odalarındaki oyuncuları görür" on public.players
  for select to authenticated
  using (room_id = (select private.my_room_id()));

-- RLS politikası my_room_id()'yi çağıranın yetkisiyle çalıştırır.
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_room_id() to authenticated;

revoke all on function
  public.create_room(text),
  public.join_room(text, text),
  public.leave_room(),
  public.heartbeat(),
  public.update_settings(integer, integer, integer),
  public.start_game()
from public, anon;
grant execute on function
  public.create_room(text),
  public.join_room(text, text),
  public.leave_room(),
  public.heartbeat(),
  public.update_settings(integer, integer, integer),
  public.start_game()
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.rooms, public.players;
