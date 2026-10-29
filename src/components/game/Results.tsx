"use client";

import { useEffect, useState } from "react";

import { DownloadAllButton } from "@/components/meme/DownloadButtons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatPoints, rankByScore } from "@/lib/scoreboard";
import { playSound } from "@/lib/sound";
import { errorMessage, strings } from "@/lib/strings";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useSecondsLeft } from "@/lib/supabase/server-clock";
import { useAdvanceWhenDue } from "@/lib/supabase/use-advance";
import type { Player, Room } from "@/lib/supabase/use-room";

import { RoundMemes } from "./RoundMemes";

type Props = { room: Room; players: Player[]; me: Player };

/**
 * Tur sonucu (round_results): turun meme'leri puana göre sıralı, altında ara sıralama.
 * Oyun sonu (final): final sıralaması, tümünü indir, son turun meme'leri, tekrar oyna.
 */
export function Results({ room, players, me }: Props) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const isFinal = room.status === "final";
  const isHost = room.host_player_id === me.id;

  // Oyun sonu kutlaması: konfeti ve zafer sesi (bir kez).
  useEffect(() => {
    if (!isFinal) return;
    let cancelled = false;
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      playSound("win");
      const burst = (x: number) =>
        confetti({
          particleCount: 120,
          spread: 75,
          origin: { x, y: 0.35 },
          colors: ["#7b3fe4", "#ffc83d", "#ff5d73", "#19c3a6", "#3d9bff"],
          disableForReducedMotion: true,
        });
      burst(0.25);
      burst(0.75);
      window.setTimeout(() => !cancelled && burst(0.5), 400);
    });
    return () => {
      cancelled = true;
    };
  }, [isFinal]);

  // Ara sıralama 20 sn gösterilir; sonra sunucu sonraki turu kendiliğinden başlatır.
  const secondsLeft = useSecondsLeft(isFinal ? null : room.phase_ends_at);
  useAdvanceWhenDue(secondsLeft, 0.5);

  async function restart() {
    setBusy(true);
    const { error } = await getSupabaseClient().rpc("restart_room");
    if (error) {
      showToast(errorMessage(error), "error");
      setBusy(false);
    }
  }

  const scoreboard = (
    <Card className="flex flex-col gap-3">
      <h3 className="text-xl font-black">
        {isFinal ? strings.results.finalStandings : strings.results.standings}
      </h3>
      <ol className="flex flex-col gap-2" data-testid="scoreboard">
        {rankByScore(players).map(({ player, rank }) => (
          <li
            key={player.id}
            data-testid="score-row"
            className={cn(
              "flex items-center gap-3 rounded-2xl border-[3px] px-4 py-2.5 font-extrabold",
              player.id === me.id
                ? "border-grape bg-grape/10"
                : "border-ink/10 bg-white",
            )}
          >
            <span
              data-testid="rank"
              aria-label={strings.results.rank(rank)}
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-sm font-black",
                rank === 1 ? "bg-sun text-ink" : "bg-ink/10 text-ink",
              )}
            >
              {rank}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {player.username}
              {isFinal && rank === 1 && " 👑"}
            </span>
            <span className="tabular-nums">
              {strings.results.points(formatPoints(player.score))}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );

  const action = !isFinal ? (
    <p
      data-testid="next-round-countdown"
      className="rounded-2xl bg-sun/40 px-4 py-3 text-center font-extrabold"
    >
      {strings.results.nextRoundIn(Math.max(0, Math.ceil(secondsLeft ?? 0)))}
    </p>
  ) : isHost ? (
    <Button
      size="lg"
      variant="success"
      fullWidth
      disabled={busy}
      onClick={restart}
    >
      {busy ? strings.common.loading : strings.results.playAgain}
    </Button>
  ) : (
    <p className="animate-pulse text-center font-extrabold text-ink-soft">
      {strings.results.waitingForRestart}
    </p>
  );

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

      {isFinal ? (
        <>
          {scoreboard}
          <DownloadAllButton room={room} />
          {action}
          <RoundMemes room={room} />
        </>
      ) : (
        <>
          <RoundMemes room={room} />
          {scoreboard}
          {action}
        </>
      )}
    </div>
  );
}
