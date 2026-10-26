import { describe, expect, it } from "vitest";

import { formatPoints, sortByScore } from "./scoreboard";

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

describe("formatPoints", () => {
  it("işaretle yazar", () => {
    expect(formatPoints(500)).toBe("+500");
    expect(formatPoints(0)).toBe("0");
    expect(formatPoints(-250)).toBe("−250");
  });
});
