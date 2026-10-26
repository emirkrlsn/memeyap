import { describe, expect, it } from "vitest";

import { formatPoints, rankByScore, sortByScore } from "./scoreboard";

describe("sortByScore", () => {
  it("yüksek puandan düşüğe sıralar, eksi puanları en sona koyar", () => {
    const sorted = sortByScore([
      { username: "Ali", score: 200 },
      { username: "Can", score: -250 },
      { username: "Ece", score: 700 },
    ]);
    expect(sorted.map((p) => p.username)).toEqual(["Ece", "Ali", "Can"]);
  });

  it("eşit puanlıları Türkçe alfabeye göre sıralar ve orijinali değiştirmez", () => {
    const players = [
      { username: "Zeynep", score: 500 },
      { username: "Çağrı", score: 500 },
      { username: "Cem", score: 500 },
      { username: "İpek", score: 0 },
      { username: "Ilgaz", score: 0 },
    ];
    expect(sortByScore(players).map((p) => p.username)).toEqual([
      "Cem",
      "Çağrı",
      "Zeynep",
      "Ilgaz",
      "İpek",
    ]);
    expect(players[0].username).toBe("Zeynep");
  });
});

describe("rankByScore", () => {
  const rows = (players: { username: string; score: number }[]) =>
    rankByScore(players).map(
      ({ player, rank }) => `${rank}. ${player.username}`,
    );

  it("eşit puanlılar aynı sırayı paylaşır ve sonraki sıra atlanmaz (1, 1, 2)", () => {
    expect(
      rows([
        { username: "Ali", score: 1200 },
        { username: "Can", score: 0 },
        { username: "Ece", score: 1200 },
      ]),
    ).toEqual(["1. Ali", "1. Ece", "2. Can"]);
  });

  it("birden çok eşitlik grubunu ve eksi puanları doğru sıralar", () => {
    expect(
      rows([
        { username: "A", score: 500 },
        { username: "B", score: 200 },
        { username: "C", score: 200 },
        { username: "D", score: -250 },
        { username: "E", score: -250 },
        { username: "F", score: 500 },
      ]),
    ).toEqual(["1. A", "1. F", "2. B", "2. C", "3. D", "3. E"]);
  });

  it("herkes eşitse herkes birinci", () => {
    expect(
      rows([
        { username: "X", score: 0 },
        { username: "Y", score: 0 },
      ]),
    ).toEqual(["1. X", "1. Y"]);
  });
});

describe("formatPoints", () => {
  it("işaretle yazar", () => {
    expect(formatPoints(500)).toBe("+500");
    expect(formatPoints(0)).toBe("0");
    expect(formatPoints(-250)).toBe("−250");
  });
});
