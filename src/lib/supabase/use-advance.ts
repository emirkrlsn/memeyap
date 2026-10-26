"use client";

import { useEffect, useRef } from "react";

import { getSupabaseClient } from "./client";

const RETRY_MS = 3000;

/**
 * Faz süresi `graceSeconds` kadar geçtiyse sunucudan ilerletmesini ister (3 sn'de bir
 * tekrar dener). Sunucu da pg_cron ile kendi kendine ilerler; bu sadece beklemeyi kısaltır.
 */
export function useAdvanceWhenDue(
  secondsLeft: number | null,
  graceSeconds: number,
) {
  const lastCall = useRef(0);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft > -graceSeconds) return;
    if (Date.now() - lastCall.current < RETRY_MS) return;
    lastCall.current = Date.now();
    void getSupabaseClient().rpc("advance_phase");
  }, [secondsLeft, graceSeconds]);
}
