import { describe, expect, it, vi } from "vitest";

import {
  hasText,
  layoutText,
  renderMemeFrame,
  wrapText,
  type Measure,
} from "./render";

// Her karakter yazı boyutunun yarısı kadar yer kaplar.
const measure: Measure = (text, fontSize) => text.length * fontSize * 0.5;

describe("wrapText", () => {
  it("sığan kelimeleri aynı satırda tutar", () => {
    expect(wrapText(measure, "BİR İKİ", 10, 100)).toEqual(["BİR İKİ"]);
  });

  it("sığmayan kelimeyi alt satıra geçirir", () => {
    // 10px'te karakter başı 5px; 40px genişliğe en fazla 8 karakter sığar.
    expect(wrapText(measure, "MERHABA DÜNYA NASIL", 10, 40)).toEqual([
      "MERHABA",
      "DÜNYA",
      "NASIL",
    ]);
  });

  it("tek başına sığmayan uzun kelimeyi harflerden böler", () => {
    expect(wrapText(measure, "ABCDEFGHIJ", 10, 20)).toEqual([
      "ABCD",
      "EFGH",
      "IJ",
    ]);
  });

  it("satır sonlarını korur", () => {
    expect(wrapText(measure, "ÜST\nALT", 10, 100)).toEqual(["ÜST", "ALT"]);
  });
});

describe("layoutText", () => {
  it("kısa metni kutunun yüksekliğinin izin verdiği kadar büyütür", () => {
    const { fontSize, lines } = layoutText(measure, "OK", 1000, 54);
    expect(lines).toEqual(["OK"]);
    expect(fontSize).toBe(50); // 50 * 1.08 = 54
  });

  it("uzun metni sığdırmak için küçültür ve satırlara böler", () => {
    const text = "BU ÇOK UZUN BİR MEME YAZISI KUTUYA SIĞMALI";
    const { fontSize, lines } = layoutText(measure, text, 200, 100);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.length * fontSize * 1.08).toBeLessThanOrEqual(100);
    for (const line of lines)
      expect(measure(line, fontSize)).toBeLessThanOrEqual(200);
    // Bir boy büyüğü artık sığmamalı.
    const bigger = layoutText(measure, text, 200, 100).fontSize + 1;
    const biggerLines = wrapText(measure, text, bigger, 200);
    expect(
      biggerLines.length * bigger * 1.08 > 100 ||
        biggerLines.some((l) => measure(l, bigger) > 200),
    ).toBe(true);
  });

  it("hiç sığmazsa en küçük boyuta düşer", () => {
    expect(layoutText(measure, "A".repeat(500), 10, 10).fontSize).toBe(6);
  });
});

describe("renderMemeFrame", () => {
  function fakeContext() {
    return {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 10 }),
      strokeText: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D & {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
      strokeText: ReturnType<typeof vi.fn>;
    };
  }

  it("görseli ve yazıları Türkçe büyük harfle çizer, boş kutuları atlar", () => {
    const ctx = fakeContext();
    const image = {} as CanvasImageSource;
    renderMemeFrame(
      ctx,
      image,
      [
        { x: 0, y: 0, w: 1, h: 0.2, text: "  istanbul  " },
        { x: 0, y: 0.8, w: 1, h: 0.2, text: "   " },
      ],
      { width: 500, height: 500 },
    );

    expect(ctx.drawImage).toHaveBeenCalledWith(image, 0, 0, 500, 500);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    expect(ctx.fillText.mock.calls[0][0]).toBe("İSTANBUL");
    expect(ctx.strokeText).toHaveBeenCalledTimes(1);
  });

  it("görsel verilmezse sadece yazıları çizer", () => {
    const ctx = fakeContext();
    renderMemeFrame(ctx, null, [{ x: 0, y: 0, w: 1, h: 1, text: "a" }], {
      width: 100,
      height: 100,
    });
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
  });
});

describe("hasText", () => {
  it("sadece boşluk içeren kutuları yazı saymaz", () => {
    expect(hasText([{ x: 0, y: 0, w: 1, h: 1, text: "  " }])).toBe(false);
    expect(hasText([{ x: 0, y: 0, w: 1, h: 1, text: "a" }])).toBe(true);
  });
});
