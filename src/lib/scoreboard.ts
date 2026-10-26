/** Puan tablosu sırası: yüksek puan önce; eşitlikte kullanıcı adına göre (Türkçe alfabe). */
export function sortByScore<T extends { score: number; username: string }>(
  players: readonly T[],
): T[] {
  return [...players].sort(
    (a, b) => b.score - a.score || a.username.localeCompare(b.username, "tr"),
  );
}

/** Puanı işaretiyle yazar: +500, 0, −250 (gerçek eksi işaretiyle). */
export function formatPoints(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return "0";
}
