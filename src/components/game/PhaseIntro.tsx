"use client";

import { strings } from "@/lib/strings";
import { useSecondsLeft } from "@/lib/supabase/server-clock";
import type { Room } from "@/lib/supabase/use-room";

/**
 * Aşama başlamadan önceki 3 sn'lik giriş ekranı ("Oyun başlıyor", "Oylama başlıyor",
 * "Sıradaki meme"). Zaman sunucudan gelir (rooms.phase_starts_at): herkeste aynı anda biter.
 * Alttaki ekran bu sırada yüklenir; giriş bitince doğrudan görünür.
 */
export function PhaseIntro({ room }: { room: Room }) {
  const secondsLeft = useSecondsLeft(room.phase_starts_at);
  const active =
    (room.status === "creating" || room.status === "voting") &&
    secondsLeft !== null &&
    secondsLeft > 0;
  if (!active) return null;

  const title =
    room.status === "voting"
      ? room.current_vote_index === 0
        ? strings.intro.votingStarting
        : strings.intro.nextMeme
      : room.current_round === 1
        ? strings.intro.gameStarting
        : strings.intro.roundStarting(room.current_round);

  return (
    <div
      role="status"
      data-testid="phase-intro"
      className="fixed inset-0 z-40 grid place-items-center bg-grape/95 px-6 text-center"
    >
      <div className="flex flex-col items-center gap-6">
        <p className="animate-pop-in font-meme text-5xl tracking-wide text-white uppercase [-webkit-text-stroke:3px_var(--color-ink)] [paint-order:stroke_fill] sm:text-6xl">
          {title}
        </p>
        <span
          key={Math.ceil(secondsLeft)}
          className="grid size-24 animate-pop-in place-items-center rounded-full bg-sun font-meme text-6xl text-ink"
        >
          {Math.ceil(secondsLeft)}
        </span>
      </div>
    </div>
  );
}
