/** Puan tablosu sırası: yüksek puan önce; eşitlikte kullanıcı adına göre (Türkçe alfabe). */
export function sortByScore<T extends { score: number; username: string }>(
  players: readonly T[],
): T[] {
  return [...players].sort(
    (a, b) => b.score - a.score || a.username.localeCompare(b.username, "tr"),
  );
}

/**
 * Sıra numaralı puan tablosu. Eşit puanlılar aynı sırayı paylaşır ve sonraki sıra
 * atlanmaz (Açık karar 6): 1, 1, 2.
 */
export function rankByScore<T extends { score: number; username: string }>(
  players: readonly T[],
): Array<{ player: T; rank: number }> {
  let rank = 0;
  let previousScore: number | undefined;
  return sortByScore(players).map((player) => {
    if (player.score !== previousScore) {
      rank += 1;
      previousScore = player.score;
    }
    return { player, rank };
  });
}

/** Puanı işaretiyle yazar: +500, 0, −250 (gerçek eksi işaretiyle). */
export function formatPoints(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return "0";
}
