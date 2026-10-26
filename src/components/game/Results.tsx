"use client";

import { useState } from "react";

import { DownloadAllButton } from "@/components/meme/DownloadButtons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatPoints, sortByScore } from "@/lib/scoreboard";
import { errorMessage, strings } from "@/lib/strings";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Player, Room } from "@/lib/supabase/use-room";

import { RoundMemes } from "./RoundMemes";

type Props = { room: Room; players: Player[]; me: Player };

/** Tur sonucu (round_results) ve oyun sonu (final): turun meme'leri puana göre sıralı, ardından genel sıralama. */
export function Results({ room, players, me }: Props) {
  const { showToast } = useToast();
  const [starting, setStarting] = useState(false);
  const isFinal = room.status === "final";
  const isHost = room.host_player_id === me.id;

  async function nextRound() {
    setStarting(true);
    const { error } = await getSupabaseClient().rpc("next_round");
    if (error) {
      showToast(errorMessage(error), "error");
      setStarting(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="animate-pop-in font-meme text-4xl text-grape uppercase">
          {isFinal
            ? strings.results.gameOver
            : strings.results.roundOver(room.current_round)}
        </h2>
        {isFinal && room.ended_early && (
          <p className="font-bold text-ink-soft">
            {strings.results.endedEarly}
          </p>
        )}
      </div>

      {isFinal && <DownloadAllButton room={room} />}

      <RoundMemes room={room} />

      <Card className="flex flex-col gap-3">
        <h3 className="text-xl font-black">
          {isFinal ? strings.results.finalStandings : strings.results.standings}
        </h3>
        <ol className="flex flex-col gap-2" data-testid="scoreboard">
          {sortByScore(players).map((player) => (
            <li
              key={player.id}
              data-testid="score-row"
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border-[3px] px-4 py-2.5 font-extrabold",
                player.id === me.id
                  ? "border-grape bg-grape/10"
                  : "border-ink/10 bg-white",
              )}
            >
              <span className="min-w-0 truncate">{player.username}</span>
              <span className="tabular-nums">
                {strings.results.points(formatPoints(player.score))}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {!isFinal &&
        (isHost ? (
          <Button
            size="lg"
            variant="success"
            fullWidth
            disabled={starting}
            onClick={nextRound}
          >
            {starting ? strings.common.loading : strings.results.nextRound}
          </Button>
        ) : (
          <p className="animate-pulse text-center font-extrabold text-ink-soft">
            {strings.results.waitingForHost}
          </p>
        ))}
    </div>
  );
}
