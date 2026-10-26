"use client";

import { useEffect, useRef } from "react";

import { playSound, vibrate } from "./sound";

/** Geri sayımın son 10 saniyesinde her saniye tık sesi ve kısa titreşim. */
export function useCountdownTicks(secondsLeft: number | null) {
  const lastSecond = useRef<number | null>(null);
  const second = secondsLeft === null ? null : Math.ceil(secondsLeft);

  useEffect(() => {
    if (second === null || second === lastSecond.current) return;
    const first = lastSecond.current === null;
    lastSecond.current = second;
    // Sayfa açılır açılmaz değil, sayım ilerlerken çal.
    if (first || second < 1 || second > 10) return;
    playSound(second <= 3 ? "tickLast" : "tick");
    vibrate(second <= 3 ? 60 : 25);
  }, [second]);
}
