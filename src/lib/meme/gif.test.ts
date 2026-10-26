import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { describe, expect, it } from "vitest";

import { decodeGif, encodeGif, overlay } from "./gif";

const W = 8;
const H = 6;

/** Tek renkli kare. */
function solid(r: number, g: number, b: number) {
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < rgba.length; i += 4) rgba.set([r, g, b, 255], i);
  return rgba;
}

/** Test için: verilen karelerden gerçek bir GIF dosyası üretir. */
function makeGif(
  frames: Uint8ClampedArray[],
  delays: number[],
  repeat: number,
) {
  const encoder = GIFEncoder();
  frames.forEach((rgba, i) => {
    const palette = quantize(rgba, 256);
    encoder.writeFrame(applyPalette(rgba, palette), W, H, {
      palette,
      delay: delays[i],
      repeat,
    });
  });
  encoder.finish();
  const bytes = encoder.bytes();
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

const pixel = (rgba: Uint8ClampedArray, x: number, y: number) =>
  Array.from(rgba.subarray((y * W + x) * 4, (y * W + x) * 4 + 4));

describe("GIF işleme", () => {
  it("kareleri, kare sürelerini ve sonsuz döngüyü çözer", () => {
    const gif = decodeGif(
      makeGif([solid(255, 0, 0), solid(0, 0, 255)], [100, 250], 0),
    );
    expect(gif.width).toBe(W);
    expect(gif.height).toBe(H);
    expect(gif.frames.map((f) => f.delay)).toEqual([100, 250]);
    expect(gif.repeat).toBe(0);
    expect(pixel(gif.frames[0].rgba, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(gif.frames[1].rgba, 0, 0)).toEqual([0, 0, 255, 255]);
  });

  it("yazı katmanını her kareye işler, süreleri ve döngüyü koruyarak yeniden kodlar", () => {
    const source = decodeGif(
      makeGif([solid(255, 0, 0), solid(0, 0, 255)], [100, 250], 3),
    );

    // Sol üst piksel beyaz "yazı", geri kalanı saydam.
    const layer = new Uint8ClampedArray(W * H * 4);
    layer.set([255, 255, 255, 255], 0);
    for (const frame of source.frames) overlay(frame.rgba, layer);

    const progress: number[] = [];
    const output = encodeGif(source, (done) => progress.push(done));
    const result = decodeGif(
      output.buffer.slice(
        output.byteOffset,
        output.byteOffset + output.byteLength,
      ) as ArrayBuffer,
    );

    expect(progress).toEqual([1, 2]);
    expect(result.frames).toHaveLength(2);
    expect(result.frames.map((f) => f.delay)).toEqual([100, 250]);
    expect(result.repeat).toBe(3);
    for (const frame of result.frames) {
      expect(pixel(frame.rgba, 0, 0)).toEqual([255, 255, 255, 255]); // yazı her karede
    }
    expect(pixel(result.frames[0].rgba, 5, 5)).toEqual([255, 0, 0, 255]); // görüntü korunur
    expect(pixel(result.frames[1].rgba, 5, 5)).toEqual([0, 0, 255, 255]);
  });

  it("yarı saydam yazı kenarlarını karıştırır", () => {
    const frame = solid(0, 0, 0);
    const layer = new Uint8ClampedArray(W * H * 4);
    layer.set([255, 255, 255, 128], 0);
    overlay(frame, layer);
    expect(pixel(frame, 0, 0)[0]).toBeGreaterThan(120);
    expect(pixel(frame, 0, 0)[0]).toBeLessThan(135);
  });
});
