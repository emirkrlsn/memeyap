-- Heartbeat kaydı olmayan oyuncu da kopmuş sayılsın (önceden hep bağlı görünüyordu).
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
end;
$$;

revoke all on function private.sweep_room(uuid) from public, anon, authenticated;
