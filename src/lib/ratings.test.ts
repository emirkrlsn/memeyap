import { describe, expect, it } from "vitest";

import { RATING_POINTS, RATINGS } from "./ratings";

describe("RATING_POINTS", () => {
  it("plandaki puan tablosuyla birebir aynı", () => {
    expect(RATING_POINTS).toEqual({
      cok_begenildi: 500,
      begenildi: 200,
      fena_degil: 0,
      begenilmedi: -100,
      berbat: -250,
    });
  });

  it("butonlar en iyiden en kötüye sıralı", () => {
    const points = RATINGS.map((rating) => RATING_POINTS[rating]);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });
});
