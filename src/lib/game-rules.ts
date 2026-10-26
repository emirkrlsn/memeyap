/**
 * Oyun kuralları. Sunucudaki kontrollerle (supabase/migrations) aynı olmalı;
 * istemci bunları sadece kullanıcıya erken geri bildirim vermek için kullanır.
 */
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 15;

export const ROUND_COUNT_OPTIONS = [3, 4, 5] as const;
export const ROUND_SECONDS_OPTIONS = [60, 90, 120] as const;
export const REROLL_OPTIONS = [3, 4, 5, 6, 7, 8] as const;

export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 16;
export const ROOM_CODE_LENGTH = 6;

/** Sunucu 30 sn sessiz kalan oyuncuyu kopmuş sayar; bu aralık ondan kısa olmalı. */
export const HEARTBEAT_INTERVAL_MS = 10_000;

/** Baştaki/sondaki boşlukları kırpar; kurallara uymuyorsa null döner. */
export function normalizeUsername(raw: string): string | null {
  const username = raw.replace(/^ +| +$/g, "");
  const length = [...username].length; // Postgres char_length gibi kod noktası sayar.
  if (length < USERNAME_MIN_LENGTH || length > USERNAME_MAX_LENGTH) return null;
  if (/\p{Cc}/u.test(username)) return null;
  return username;
}

/** Oda kodunu büyük harfe çevirir ve harf/rakam dışındaki karakterleri atar. */
export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}
