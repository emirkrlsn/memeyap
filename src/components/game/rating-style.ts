import type { Rating } from "@/lib/ratings";

/** Oy seçeneklerinin emojisi, rengi ve (buton için) gölgesi. */
export const RATING_STYLE: Record<
  Rating,
  { emoji: string; color: string; shadow: string }
> = {
  cok_begenildi: {
    emoji: "🤣",
    color: "bg-mint text-ink",
    shadow: "shadow-[0_5px_0_0_var(--color-mint-dark)]",
  },
  begenildi: {
    emoji: "😄",
    color: "bg-sky text-ink",
    shadow: "shadow-[0_5px_0_0_var(--color-sky-dark)]",
  },
  fena_degil: {
    emoji: "🙂",
    color: "bg-sun text-ink",
    shadow: "shadow-[0_5px_0_0_var(--color-sun-dark)]",
  },
  begenilmedi: {
    emoji: "😕",
    color: "bg-coral text-ink",
    shadow: "shadow-[0_5px_0_0_var(--color-coral-dark)]",
  },
  berbat: {
    emoji: "🤮",
    color: "bg-ink text-white",
    shadow: "shadow-[0_5px_0_0_#000]",
  },
};
