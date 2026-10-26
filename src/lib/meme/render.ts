import { publicPath } from "../routes";

/**
 * Meme çizimi. Düzenleme önizlemesi, oylama ekranı, PNG indirme ve GIF'in her karesi
 * aynı renderMemeFrame fonksiyonunu kullanır; böylece ekranda görülen ile indirilen aynıdır.
 */

/** Yazı kutusu. Koordinatlar görselin boyutuna oranla 0–1 arasıdır. */
export type Box = { x: number; y: number; w: number; h: number; text: string };

export type BoxFrame = Omit<Box, "text">;

export const MAX_BOXES = 6;
export const MAX_BOX_TEXT_LENGTH = 200;
export const MEME_FONT_FAMILY = "MemeAnton";

const LINE_HEIGHT = 1.08;
const MIN_FONT_SIZE = 6;
const STROKE_RATIO = 0.16;

export type TextLayout = { fontSize: number; lines: string[] };

/** Metnin genişliğini ölçer (canvas'ta ctx.measureText; testlerde sahte ölçüm). */
export type Measure = (text: string, fontSize: number) => number;

/** Metni kelime kelime satırlara böler; tek başına sığmayan kelimeyi harflerden böler. */
export function wrapText(
  measure: Measure,
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, fontSize) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      // Kelime satıra tek başına da sığmıyorsa harf harf böl.
      for (const char of word) {
        if (line && measure(line + char, fontSize) > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Metnin kutuya sığdığı en büyük yazı boyutunu ve satırlarını bulur. */
export function layoutText(
  measure: Measure,
  text: string,
  maxWidth: number,
  maxHeight: number,
): TextLayout {
  const fits = (size: number) => {
    const lines = wrapText(measure, text, size, maxWidth);
    const tallEnough = lines.length * size * LINE_HEIGHT <= maxHeight;
    return tallEnough && lines.every((line) => measure(line, size) <= maxWidth)
      ? lines
      : null;
  };

  let low = MIN_FONT_SIZE;
  let high = Math.max(MIN_FONT_SIZE, Math.floor(maxHeight / LINE_HEIGHT));
  let best: TextLayout | null = null;
  while (low <= high) {
    const size = Math.floor((low + high) / 2);
    const lines = fits(size);
    if (lines) {
      best = { fontSize: size, lines };
      low = size + 1;
    } else {
      high = size - 1;
    }
  }
  return (
    best ?? {
      fontSize: MIN_FONT_SIZE,
      lines: wrapText(measure, text, MIN_FONT_SIZE, maxWidth),
    }
  );
}

function fontFor(size: number) {
  return `${size}px ${MEME_FONT_FAMILY}, Impact, "Arial Narrow Bold", sans-serif`;
}

/**
 * Bir meme karesini çizer. `image` null ise sadece yazılar çizilir (düzenleyicide
 * görselin üstündeki saydam katman için).
 */
export function renderMemeFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource | null,
  boxes: readonly Box[],
  size: { width: number; height: number },
) {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  if (image) ctx.drawImage(image, 0, 0, width, height);

  const measure: Measure = (text, fontSize) => {
    ctx.font = fontFor(fontSize);
    return ctx.measureText(text).width;
  };

  for (const box of boxes) {
    const text = box.text.trim().toLocaleUpperCase("tr");
    if (!text) continue;

    const boxWidth = box.w * width;
    const boxHeight = box.h * height;
    const padding = Math.min(boxWidth, boxHeight) * 0.05;
    const { fontSize, lines } = layoutText(
      measure,
      text,
      boxWidth - padding * 2,
      boxHeight - padding * 2,
    );
    const lineHeight = fontSize * LINE_HEIGHT;
    const centerX = box.x * width + boxWidth / 2;
    const firstLineY =
      box.y * height + boxHeight / 2 - ((lines.length - 1) * lineHeight) / 2;

    ctx.font = fontFor(fontSize);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.5, fontSize * STROKE_RATIO);
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#fff";
    lines.forEach((line, index) => {
      const y = firstLineY + index * lineHeight;
      ctx.strokeText(line, centerX, y);
      ctx.fillText(line, centerX, y);
    });
  }
}

let fontLoading: Promise<void> | undefined;

/** Anton fontunu canvas için bir kez yükler (CSS'teki next/font adı canvas'ta kullanılamaz). */
export function loadMemeFont(): Promise<void> {
  fontLoading ??= new FontFace(
    MEME_FONT_FAMILY,
    `url(${publicPath("/fonts/Anton-Regular.ttf")})`,
  )
    .load()
    .then((font) => {
      document.fonts.add(font);
    });
  return fontLoading;
}

/** Yazısı olan en az bir kutu var mı? (Boş meme oylamaya girmez.) */
export function hasText(boxes: readonly Box[]): boolean {
  return boxes.some((box) => box.text.trim() !== "");
}
