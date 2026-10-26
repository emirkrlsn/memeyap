"use client";

import { useSyncExternalStore } from "react";

/**
 * Oyun sesleri: dosya yok, Web Audio ile üretilen kısa tonlar. Ses tercihi tarayıcıda
 * saklanır (varsayılan: açık). Tarayıcılar sesi ancak bir dokunuştan sonra çalar;
 * AudioContext ilk seste oluşturulur.
 */
export type Sound = "pop" | "tick" | "tickLast" | "join" | "win";

const STORAGE_KEY = "memeyap:sound";
const listeners = new Set<() => void>();
let enabled = readEnabled();
let audio: AudioContext | undefined;

function readEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  } catch {
    // Kaydedilemezse bu oturum için geçerli olur.
  }
  listeners.forEach((listener) => listener());
  if (value) playSound("pop");
}

/** Ses açık mı? (Ses düğmesi için.) */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
    () => true,
  );
}

/** Her ses: [frekans (Hz), süre (sn), başlangıç gecikmesi (sn)] notaları. */
const NOTES: Record<Sound, Array<[number, number, number]>> = {
  pop: [[660, 0.08, 0]],
  tick: [[880, 0.05, 0]],
  tickLast: [[1320, 0.08, 0]],
  join: [
    [523, 0.09, 0],
    [784, 0.12, 0.09],
  ],
  win: [
    [523, 0.12, 0],
    [659, 0.12, 0.12],
    [784, 0.12, 0.24],
    [1047, 0.3, 0.36],
  ],
};

export function playSound(sound: Sound) {
  if (!enabled || typeof window === "undefined" || !window.AudioContext) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const now = audio.currentTime;
    for (const [frequency, duration, delay] of NOTES[sound]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + duration + 0.02);
    }
  } catch {
    // Ses çalınamazsa oyun etkilenmesin.
  }
}

/** Telefonda kısa titreşim (destekleyen cihazlarda; ses kapalıysa titremez). */
export function vibrate(milliseconds: number) {
  if (enabled) navigator.vibrate?.(milliseconds);
}
