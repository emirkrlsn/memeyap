/**
 * Oy seçenekleri ve puanları. Sunucudaki private.rating_points() ile aynı olmalı;
 * `npm run test:db` ikisini karşılaştırır. Sıra, ekrandaki buton sırasıdır.
 *
 * Bu dosya scripts/test-db.mjs tarafından doğrudan Node ile de okunur: başka
 * modül içe aktarmamalı.
 */
export const RATINGS = [
  "cok_begenildi",
  "begenildi",
  "fena_degil",
  "begenilmedi",
  "berbat",
] as const;

export type Rating = (typeof RATINGS)[number];

export const RATING_POINTS: Record<Rating, number> = {
  cok_begenildi: 500,
  begenildi: 200,
  fena_degil: 0,
  begenilmedi: -100,
  berbat: -250,
};
