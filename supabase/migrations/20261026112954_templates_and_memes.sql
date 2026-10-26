-- Faz 2: şablonlar, meme'ler, pas hakkı, hazır olma ve faz ilerletme.
--
-- * Meme'ler görsel olarak değil, şablon + yazı kutuları (JSON) olarak saklanır.
-- * Kutu koordinatları görsel boyutuna oranla 0–1 arasıdır.
-- * Oyuncu sadece kendi meme'ini okuyabilir (oylamada sahiplik gizli kalsın diye).

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------

create type public.template_kind as enum ('image', 'gif');

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  source_name text not null,
  kind public.template_kind not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  default_boxes jsonb not null default '[]' check (jsonb_typeof(default_boxes) = 'array'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.memes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  round smallint not null,
  player_id uuid not null references public.players (id) on delete cascade,
  template_id uuid not null references public.templates (id),
  boxes jsonb not null default '[]',
  -- Süre bitiminde yazı içeriyorsa true olur ve oylamaya girer.
  is_submitted boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (room_id, round, player_id)
);
create index memes_player_id_idx on public.memes (player_id);
create index memes_template_id_idx on public.memes (template_id);

alter table public.players
  add column rerolls_left smallint not null default 0,
  add column is_ready boolean not null default false;

alter table public.rooms
  -- Bu oyunda dağıtılmış şablonlar (havuz bitene kadar tekrar edilmez).
  add column used_template_ids uuid[] not null default '{}',
  -- Oylanacak meme'ler, rastgele sırada.
  add column vote_queue uuid[] not null default '{}';

-- Şablon görselleri: herkese açık okunur, sadece yükleme betiği (service role) yazar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('templates', 'templates', true, 10485760, array['image/webp', 'image/gif'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Yardımcı fonksiyonlar
-- ---------------------------------------------------------------------------

create function private.my_player_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.players where user_id = (select auth.uid());
$$;

-- Kutuları doğrular ve sadece bilinen alanları bırakır. En fazla 6 kutu.
create function private.validate_boxes(p_boxes jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_box jsonb;
  v_result jsonb := '[]';
  v_x numeric; v_y numeric; v_w numeric; v_h numeric;
begin
  if jsonb_typeof(p_boxes) is distinct from 'array' or jsonb_array_length(p_boxes) > 6 then
    raise exception 'INVALID_BOXES';
  end if;

  for v_box in select value from jsonb_array_elements(p_boxes) loop
    if jsonb_typeof(v_box) <> 'object'
      or jsonb_typeof(v_box -> 'x') <> 'number' or jsonb_typeof(v_box -> 'y') <> 'number'
      or jsonb_typeof(v_box -> 'w') <> 'number' or jsonb_typeof(v_box -> 'h') <> 'number'
      or jsonb_typeof(coalesce(v_box -> 'text', '""')) <> 'string'
      or char_length(coalesce(v_box ->> 'text', '')) > 200 then
      raise exception 'INVALID_BOXES';
    end if;
    v_x := (v_box ->> 'x')::numeric; v_y := (v_box ->> 'y')::numeric;
    v_w := (v_box ->> 'w')::numeric; v_h := (v_box ->> 'h')::numeric;
    if v_x < 0 or v_y < 0 or v_w <= 0 or v_h <= 0
      or v_x + v_w > 1.001 or v_y + v_h > 1.001 then
      raise exception 'INVALID_BOXES';
    end if;
    v_result := v_result || jsonb_build_object(
      'x', v_x, 'y', v_y, 'w', v_w, 'h', v_h, 'text', coalesce(v_box ->> 'text', '')
    );
  end loop;
  return v_result;
end;
$$;

-- Şablonun varsayılan kutularını boş yazılı meme kutularına çevirir.
create function private.boxes_from_template(p_template_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(box || '{"text": ""}'), '[]')
  from public.templates t, jsonb_array_elements(t.default_boxes) as box
  where t.id = p_template_id;
$$;

-- Oyuncuya verilecek şablonu seçer: önce bu oyunda hiç dağıtılmamışlar, havuz
-- bittiyse bu turda başkasında olmayanlar, o da yoksa herhangi biri.
-- Çağıran oda satırını kilitlemiş olmalı.
create function private.pick_template(p_room_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_template_id uuid;
begin
  select * into v_room from public.rooms where id = p_room_id;

  select id into v_template_id from public.templates
  where is_active and id <> all (v_room.used_template_ids)
  order by random() limit 1;

  if v_template_id is null then
    select t.id into v_template_id from public.templates t
    where t.is_active and not exists (
      select 1 from public.memes m
      where m.room_id = p_room_id and m.round = v_room.current_round and m.template_id = t.id
    )
    order by random() limit 1;
  end if;

  if v_template_id is null then
    select id into v_template_id from public.templates where is_active order by random() limit 1;
  end if;

  if v_template_id is null then
    raise exception 'NO_TEMPLATES';
  end if;

  update public.rooms set used_template_ids = array_append(used_template_ids, v_template_id)
  where id = p_room_id;
  return v_template_id;
end;
$$;

-- current_round için meme oluşturma aşamasını başlatır: süreyi kurar, pas haklarını
-- yeniler ve bu turda oynayan her oyuncuya farklı bir şablon dağıtır.
create function private.start_round(p_room_id uuid)
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
      vote_queue = '{}'
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

-- Süre (+2 sn tolerans) dolduysa ya da bağlı tüm aktif oyuncular hazırsa meme
-- oluşturmayı bitirir. Birden çok kez çağrılması güvenlidir.
create function private.try_advance(p_room_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_all_ready boolean;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.status is distinct from 'creating' then
    return;
  end if;

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
  set status = 'voting',
      phase_ends_at = null,
      vote_queue = coalesce((
        select array_agg(id order by random()) from public.memes
        where room_id = p_room_id and round = v_room.current_round and is_submitted
      ), '{}')
  where id = p_room_id;
end;
$$;

-- pg_cron yedeği: kimse bağlı değilken de süresi dolan turlar ilerlesin.
create function private.advance_due_rooms()
returns void
language sql
set search_path = ''
as $$
  select private.try_advance(id) from public.rooms
  where status = 'creating' and phase_ends_at + interval '2 seconds' <= now();
$$;

-- Oyuncunun bu turdaki meme'i (yoksa NOT_PLAYING). Oda satırını paylaşımlı kilitler ki
-- faz ilerlerken yapılan kayıt eski aşamaya yazılmasın.
create function private.my_current_meme(p_player public.players)
returns public.memes
language plpgsql
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_meme public.memes;
begin
  select * into v_room from public.rooms where id = p_player.room_id for share;
  if v_room.status <> 'creating' then
    raise exception 'PHASE_OVER';
  end if;
  select * into v_meme from public.memes
  where room_id = v_room.id and round = v_room.current_round and player_id = p_player.id;
  if not found then
    raise exception 'NOT_PLAYING';
  end if;
  return v_meme;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC'ler
-- ---------------------------------------------------------------------------

create or replace function public.start_game()
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
  set current_round = 1, used_template_ids = '{}'
  where id = v_room.id;
  perform private.start_round(v_room.id);
end;
$$;

create function public.reroll_template()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := private.current_player();
  v_meme public.memes;
  v_template_id uuid;
begin
  -- Pas hakkı ve şablon havuzu için odayı tamamen kilitle.
  perform 1 from public.rooms where id = v_player.room_id for update;
  v_meme := private.my_current_meme(v_player);
  if v_player.rerolls_left <= 0 then
    raise exception 'NO_REROLLS_LEFT';
  end if;

  v_template_id := private.pick_template(v_player.room_id);
  update public.memes
  set template_id = v_template_id,
      boxes = private.boxes_from_template(v_template_id),
      updated_at = now()
  where id = v_meme.id;
  update public.players
  set rerolls_left = rerolls_left - 1, is_ready = false
  where id = v_player.id;
  return v_template_id;
end;
$$;

create function public.save_meme(p_boxes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meme public.memes := private.my_current_meme(private.current_player());
begin
  update public.memes
  set boxes = private.validate_boxes(p_boxes), updated_at = now()
  where id = v_meme.id;
end;
$$;

create function public.set_ready(p_ready boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := private.current_player();
begin
  -- Önce özel kilit: aynı anda hazır olanlar paylaşımlı kilitten yükseltirken kilitlenmesin.
  perform 1 from public.rooms where id = v_player.room_id for update;
  perform private.my_current_meme(v_player);
  update public.players set is_ready = p_ready where id = v_player.id;
  perform private.try_advance(v_player.room_id);
end;
$$;

create function public.advance_phase()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.try_advance((private.current_player()).room_id);
end;
$$;

-- İstemci geri sayımı sunucu saatine göre düzeltsin.
create function public.server_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler ve RLS
-- ---------------------------------------------------------------------------

alter table public.templates enable row level security;
alter table public.memes enable row level security;

revoke all on public.templates, public.memes from anon, authenticated;
grant select on public.templates, public.memes to authenticated;

create policy "Şablonlar herkese açık" on public.templates
  for select to authenticated
  using (true);

create policy "Oyuncu sadece kendi meme'ini görür" on public.memes
  for select to authenticated
  using (player_id = (select private.my_player_id()));

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_room_id(), private.my_player_id() to authenticated;

revoke all on function
  public.reroll_template(),
  public.save_meme(jsonb),
  public.set_ready(boolean),
  public.advance_phase(),
  public.server_now()
from public, anon;
grant execute on function
  public.reroll_template(),
  public.save_meme(jsonb),
  public.set_ready(boolean),
  public.advance_phase(),
  public.server_now()
to authenticated;

-- ---------------------------------------------------------------------------
-- Zamanlanmış iş
-- ---------------------------------------------------------------------------

select cron.schedule('advance-due-rooms', '5 seconds', 'select private.advance_due_rooms()');
