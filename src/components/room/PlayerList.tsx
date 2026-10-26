import { MAX_PLAYERS } from "@/lib/game-rules";
import { cn } from "@/lib/cn";
import { strings } from "@/lib/strings";
import type { Player, Room } from "@/lib/supabase/use-room";

type Props = { room: Room; players: Player[]; me: Player };

export function PlayerList({ room, players, me }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline justify-between text-xl font-black">
        {strings.room.players}
        <span className="text-base text-ink-soft" data-testid="player-count">
          {strings.room.playerCount(players.length, MAX_PLAYERS)}
        </span>
      </h2>
      <ul className="flex flex-col gap-2" data-testid="player-list">
        {players.map((player) => {
          const isHost = player.id === room.host_player_id;
          return (
            <li
              key={player.id}
              data-testid="player"
              data-host={isHost || undefined}
              className={cn(
                "flex animate-pop-in items-center gap-3 rounded-2xl border-[3px] px-4 py-2.5 font-extrabold",
                player.id === me.id
                  ? "border-grape bg-grape/10"
                  : "border-ink/10 bg-white",
                !player.is_connected && "opacity-50",
              )}
            >
              <span
                className={cn(
                  "size-3 shrink-0 rounded-full",
                  player.is_connected ? "bg-mint" : "bg-coral",
                )}
                title={
                  player.is_connected ? undefined : strings.room.disconnected
                }
              />
              <span className="min-w-0 flex-1 truncate">
                {player.username}
                {player.id === me.id && (
                  <span className="ml-1.5 text-sm text-ink-soft">
                    ({strings.room.you})
                  </span>
                )}
              </span>
              {!player.is_connected && (
                <span className="text-xs text-coral-dark">
                  {strings.room.disconnected}
                </span>
              )}
              {isHost && (
                <span
                  className="rounded-full bg-sun px-2.5 py-0.5 text-xs"
                  aria-label={strings.room.host}
                >
                  👑 {strings.room.host}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
