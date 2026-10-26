/**
 * GIF çözme / yazı işleme / yeniden kodlama. Tarayıcı API'si kullanmaz: hem Web Worker'da
 * hem testlerde çalışır. Yazı katmanı ana iş parçacığında renderMemeFrame ile çizilir
 * (yazı her karede aynıdır) ve burada her karenin üstüne işlenir.
 */
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { decompressFrames, parseGIF } from "gifuct-js";

export type GifFrame = { rgba: Uint8ClampedArray; delay: number };

export type DecodedGif = {
  width: number;
  height: number;
  frames: GifFrame[];
  /** gifenc'in `repeat` değeri: 0 sonsuz, -1 bir kez, n kez tekrar. */
  repeat: number;
};

/** GIF'i tam boyutlu RGBA karelere çözer (kare atma/disposal kurallarıyla). */
export function decodeGif(buffer: ArrayBuffer): DecodedGif {
  const gif = parseGIF(buffer);
  const { width, height } = gif.lsd;
  const canvas = new Uint8ClampedArray(width * height * 4);
  let restore: Uint8ClampedArray | null = null;
  let previous: {
    disposalType: number;
    dims: { left: number; top: number; width: number; height: number };
  } | null = null;
  const frames: GifFrame[] = [];

  for (const frame of decompressFrames(gif, true)) {
    // Önceki karenin "sonra ne yapılsın" kuralı.
    if (previous?.disposalType === 2) clearRect(canvas, width, previous.dims);
    if (previous?.disposalType === 3 && restore) canvas.set(restore);
    restore = frame.disposalType === 3 ? canvas.slice() : null;

    const { left, top, width: w, height: h } = frame.dims;
    for (let y = 0; y < h; y++) {
      const canvasY = top + y;
      if (canvasY >= height) break;
      for (let x = 0; x < w; x++) {
        const canvasX = left + x;
        if (canvasX >= width) break;
        const from = (y * w + x) * 4;
        if (frame.patch[from + 3] === 0) continue; // saydam: alttaki kalır
        canvas.set(
          frame.patch.subarray(from, from + 4),
          (canvasY * width + canvasX) * 4,
        );
      }
    }

    frames.push({ rgba: canvas.slice(), delay: frame.delay });
    previous = frame;
  }

  return { width, height, frames, repeat: loopCount(gif.frames) };
}

function clearRect(
  canvas: Uint8ClampedArray,
  width: number,
  dims: { left: number; top: number; width: number; height: number },
) {
  for (let y = dims.top; y < dims.top + dims.height; y++) {
    canvas.fill(
      0,
      (y * width + dims.left) * 4,
      (y * width + dims.left + dims.width) * 4,
    );
  }
}

/** NETSCAPE uzantısındaki tekrar sayısı; uzantı yoksa GIF bir kez oynar. */
function loopCount(blocks: ReturnType<typeof parseGIF>["frames"]): number {
  for (const block of blocks) {
    // Kimlik "NETSCAPE2.0"; bloklar: [1, tekrar (düşük bayt), tekrar (yüksek bayt)].
    if ("application" in block && block.application.id.startsWith("NETSCAPE")) {
      const { blocks: data } = block.application;
      return (data[1] ?? 0) | ((data[2] ?? 0) << 8);
    }
  }
  return -1;
}

/** Yazı katmanını (saydam RGBA) karenin üstüne alfa karışımıyla işler. */
export function overlay(frame: Uint8ClampedArray, layer: Uint8ClampedArray) {
  for (let i = 0; i < frame.length; i += 4) {
    const alpha = layer[i + 3] / 255;
    if (alpha === 0) continue;
    frame[i] = layer[i] * alpha + frame[i] * (1 - alpha);
    frame[i + 1] = layer[i + 1] * alpha + frame[i + 1] * (1 - alpha);
    frame[i + 2] = layer[i + 2] * alpha + frame[i + 2] * (1 - alpha);
    frame[i + 3] = Math.max(frame[i + 3], layer[i + 3]);
  }
}

/** Kareleri GIF'e kodlar. Kare süreleri ve tekrar ayarı korunur. */
export function encodeGif(
  { width, height, frames, repeat }: DecodedGif,
  onProgress?: (done: number, total: number) => void,
): Uint8Array {
  const encoder = GIFEncoder();
  frames.forEach((frame, index) => {
    const transparent = hasTransparency(frame.rgba);
    const format = transparent ? "rgba4444" : "rgb565";
    const palette = quantize(frame.rgba, 256, {
      format,
      oneBitAlpha: transparent,
    });
    const transparentIndex = transparent
      ? palette.findIndex((color) => color[3] === 0)
      : -1;
    encoder.writeFrame(
      applyPalette(frame.rgba, palette, format),
      width,
      height,
      {
        palette,
        delay: frame.delay,
        repeat,
        transparent: transparentIndex >= 0,
        transparentIndex: Math.max(0, transparentIndex),
      },
    );
    onProgress?.(index + 1, frames.length);
  });
  encoder.finish();
  return encoder.bytes();
}

function hasTransparency(rgba: Uint8ClampedArray) {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 128) return true;
  return false;
}
