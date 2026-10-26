-- Faz 5: aynı odayla tekrar oyna ve veri silme.
--
-- Silme kuralı (Açık karar 8): son oyuncu odadan çıkınca oda ve tüm verisi (oyuncular,
-- meme'ler, oylar) silinir; şablonlar kalır.
-- * "Odadan ayrıl" ile son oyuncu çıkınca: hemen.
-- * Herkes sekmeyi kapatırsa: 30 sn bağlantısız kalan oyuncu ayrılmış sayılır (Karar 9);
--   odada bağlı kimse kalmayınca pg_cron işi siler.

-- Oyuncuyu çıkarır; odada kimse kalmadıysa odayı siler, kaldıysa host devrini yapar.
create or replace function private.remove_player(p_player_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  delete from public.players where id = p_player_id returning room_id into v_room_id;
  if v_room_id is null then
    return;
  end if;
  if exists (select 1 from public.players where room_id = v_room_id) then
    perform private.sweep_room(v_room_id);
  else
    delete from public.rooms where id = v_room_id;
  end if;
end;
$$;

-- Bağlı (son 30 sn içinde heartbeat göndermiş) oyuncusu kalmayan odaları siler.
create function private.delete_abandoned_rooms()
returns void
language sql
set search_path = ''
as $$
  delete from public.rooms r
  where not exists (
    select 1
    from public.players p
    join private.player_heartbeats h on h.player_id = p.id
    where p.room_id = r.id and h.last_seen > now() - interval '30 seconds'
  );
$$;

-- Oyun bitince host aynı odayla yeni oyun açar: herkes lobiye döner, puanlar sıfırlanır,
-- önceki oyunun meme'leri ve oyları silinir.
create function public.restart_room()
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
  if v_room.status <> 'final' then
    raise exception 'GAME_NOT_OVER';
  end if;

  update public.rooms
  set status = 'lobby',
      current_round = 0,
      phase_ends_at = null,
      used_template_ids = '{}',
      vote_queue = '{}',
      current_vote_index = 0,
      current_vote_meme_id = null,
      finished_at = null,
      ended_early = false
  where id = v_room.id;

  delete from public.memes where room_id = v_room.id; -- oylar da silinir (cascade)

  update public.players
  set score = 0, active_from_round = 1, is_ready = false, rerolls_left = 0
  where room_id = v_room.id;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_room_id(), private.my_player_id() to authenticated;

revoke all on function public.restart_room() from public, anon;
grant execute on function public.restart_room() to authenticated;

select cron.schedule('delete-abandoned-rooms', '15 seconds', 'select private.delete_abandoned_rooms()');
