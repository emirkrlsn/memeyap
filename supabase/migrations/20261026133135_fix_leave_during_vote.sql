-- Düzeltme: oylamada ekrandaki meme'in sahibi (ör. host) odadan ayrılınca leave_room
-- yabancı anahtar hatasıyla başarısız oluyordu. Oyuncu silinmeden önce odadaki ona ve
-- meme'ine ait referanslar temizlenir; ardından faz hemen ilerletilir (oylama sıradaki
-- meme'le sürer, herkes hazırsa meme oluşturma biter).
create or replace function private.remove_player(p_player_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  select room_id into v_room_id from public.players where id = p_player_id;
  if v_room_id is null then
    return;
  end if;

  perform 1 from public.rooms where id = v_room_id for update;
  update public.rooms
  set host_player_id = case when host_player_id = p_player_id then null else host_player_id end,
      current_vote_meme_id = case
        when current_vote_meme_id in (select id from public.memes where player_id = p_player_id)
        then null else current_vote_meme_id end
  where id = v_room_id;

  delete from public.players where id = p_player_id;

  if not exists (select 1 from public.players where room_id = v_room_id) then
    delete from public.rooms where id = v_room_id;
    return;
  end if;
  perform private.sweep_room(v_room_id);
  perform private.try_advance(v_room_id);
end;
$$;

revoke all on function private.remove_player(uuid) from public, anon, authenticated;
