-- Faz 4: oyun sonunda "Tümünü indir" için oyunun tüm oylanmış meme'leri.
-- Sadece oyun bittiğinde (final) döner; oylanmamış (ekrana gelmemiş) meme'ler hiç dönmez.
create function public.get_game_memes()
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
  if v_room.status <> 'final' then
    return null;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'meme_id', m.id,
        'round', m.round,
        'owner', p.username,
        'points', m.points,
        'boxes', m.boxes,
        'template', jsonb_build_object(
          'storage_path', t.storage_path,
          'width', t.width,
          'height', t.height,
          'kind', t.kind
        )
      )
      order by m.round, m.points desc, m.shown_at
    )
    from public.memes m
    join public.templates t on t.id = m.template_id
    left join public.players p on p.id = m.player_id
    where m.room_id = v_room.id and m.shown_at is not null
  ), '[]');
end;
$$;

revoke all on function public.get_game_memes() from public, anon;
grant execute on function public.get_game_memes() to authenticated;
