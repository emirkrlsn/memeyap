"use client";

import { setSoundEnabled, useSoundEnabled } from "@/lib/sound";
import { strings } from "@/lib/strings";

/** Ses aç/kapa düğmesi (titreşimi de kapatır). */
export function SoundToggle() {
  const enabled = useSoundEnabled();
  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? strings.sound.turnOff : strings.sound.turnOn}
      title={enabled ? strings.sound.turnOff : strings.sound.turnOn}
      onClick={() => setSoundEnabled(!enabled)}
      className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/70 text-xl shadow-[0_4px_0_0_rgb(36_22_58/0.15)] active:translate-y-1 active:shadow-none"
    >
      <span aria-hidden>{enabled ? "🔊" : "🔇"}</span>
    </button>
  );
}
