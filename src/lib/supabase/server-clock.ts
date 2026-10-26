"use client";

import { useEffect, useState } from "react";

import { getSupabaseClient } from "./client";

let offsetRequest: Promise<number> | undefined;

/** Sunucu saati ile bu cihazın saati arasındaki fark (ms). Bir kez ölçülür. */
function serverOffset(): Promise<number> {
  offsetRequest ??= (async () => {
    const sentAt = Date.now();
    const { data, error } = await getSupabaseClient().rpc("server_now");
    if (error) throw error;
    const receivedAt = Date.now();
    return new Date(data).getTime() - (sentAt + receivedAt) / 2;
  })().catch(() => {
    offsetRequest = undefined;
    return 0;
  });
  return offsetRequest;
}

/** Sunucu saatine göre `endsAt` zamanına kalan saniye (geçtiyse negatif). */
export function useSecondsLeft(endsAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    void serverOffset().then(setOffset);
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  if (!endsAt) return null;
  return (new Date(endsAt).getTime() - (now + offset)) / 1000;
}
