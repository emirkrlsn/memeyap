"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Sayfa tarayıcıda React'e bağlandıysa true. Ondan önce yazılan değerler hydration
 * sırasında silinebildiği için formlar o ana kadar pasif tutulur (yavaş telefonlarda önemli).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
