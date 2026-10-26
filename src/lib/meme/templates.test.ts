import { describe, expect, it } from "vitest";

import { clampBox, toBoxes } from "./templates";

describe("toBoxes", () => {
  it("geçerli kutuları alır, bozuk olanları atar, eksik yazıyı boş sayar", () => {
    expect(
      toBoxes([
        { x: 0.1, y: 0.2, w: 0.5, h: 0.3 },
        { x: "bozuk", y: 0, w: 1, h: 1 },
        null,
        { x: 0, y: 0, w: 1, h: 1, text: "selam" },
      ]),
    ).toEqual([
      { x: 0.1, y: 0.2, w: 0.5, h: 0.3, text: "" },
      { x: 0, y: 0, w: 1, h: 1, text: "selam" },
    ]);
    expect(toBoxes(null)).toEqual([]);
  });
});

describe("clampBox", () => {
  it("kutuyu görselin içinde tutar", () => {
    expect(clampBox({ x: 0.9, y: -0.1, w: 0.5, h: 0.2 })).toEqual({
      x: 0.5,
      y: 0,
      w: 0.5,
      h: 0.2,
    });
  });

  it("çok küçük ve çok büyük boyutları sınırlar", () => {
    expect(clampBox({ x: 0, y: 0, w: 0.001, h: 2 })).toEqual({
      x: 0,
      y: 0,
      w: 0.05,
      h: 1,
    });
  });
});
