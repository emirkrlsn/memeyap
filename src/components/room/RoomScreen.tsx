"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { HomeScreen } from "@/components/HomeScreen";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { errorMessage, strings } from "@/lib/strings";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  useRoom,
  type Player,
  type Room,
  type RoomState,
} from "@/lib/supabase/use-room";

import { MemeEditor } from "@/components/game/MemeEditor";

import { Lobby } from "./Lobby";
import { PlayerList } from "./PlayerList";

export function RoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { state, reload } = useRoom(code);
  useHostChangeToast(state);

  async function leave() {
    const { error } = await getSupabaseClient().rpc("leave_room");
    if (error) showToast(errorMessage(error), "error");
    router.push("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-4 py-6">
      <header className="flex w-full items-center justify-between gap-3">
        <Logo small />
        {state.status === "ready" && (
          <Button variant="ghost" onClick={leave}>
            {strings.room.leave}
          </Button>
        )}
      </header>

      {state.status === "loading" && (
        <p className="animate-pulse py-10 font-extrabold text-ink-soft">
          {strings.common.loading}
        </p>
      )}

      {(state.status === "not-member" || state.status === "error") && (
        <>
          <p className="text-center font-extrabold text-ink-soft">
            {strings.room.notFound}
          </p>
          <HomeScreen initialCode={code} onJoined={reload} />
        </>
      )}

      {state.status === "ready" && <GameView {...state} />}
    </main>
  );
}

type GameProps = { room: Room; players: Player[]; me: Player };

/** Odanın durumuna göre gösterilecek ekran. */
function GameView({ room, players, me }: GameProps) {
  if (room.status === "lobby") {
    return <Lobby room={room} players={players} me={me} />;
  }
  const spectating = me.active_from_round > room.current_round;
  if (room.status === "creating" && !spectating) {
    return <MemeEditor room={room} players={players} me={me} />;
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <Card
        className="flex flex-col items-center gap-2 text-center"
        data-testid="game-status"
      >
        {spectating ? (
          <>
            <h2 className="text-2xl font-black">{strings.room.spectating}</h2>
            <p className="font-bold text-ink-soft">
              {strings.room.spectatingDetail(me.active_from_round)}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-black">
              {strings.game.votingStarted}
            </h2>
            <p className="font-bold text-ink-soft">
              {strings.game.votingCount(room.vote_queue.length)}{" "}
              {strings.game.votingComingSoon}
            </p>
          </>
        )}
      </Card>
      <Card>
        <PlayerList room={room} players={players} me={me} />
      </Card>
    </div>
  );
}

/** Yönetici değişince herkese bildirim gösterir (ilk yüklemede değil). */
function useHostChangeToast(state: RoomState) {
  const { showToast } = useToast();
  const previousHostId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (state.status !== "ready") return;
    const hostId = state.room.host_player_id;
    const previous = previousHostId.current;
    previousHostId.current = hostId;
    if (previous === undefined || previous === hostId || !hostId) return;

    if (hostId === state.me.id) {
      showToast(strings.room.youAreHost, "success");
    } else {
      const host = state.players.find((player) => player.id === hostId);
      if (host) showToast(strings.room.newHost(host.username), "info");
    }
  }, [state, showToast]);
}
