"use client";

import type { GifWorkerRequest, GifWorkerResponse } from "./gif.worker";
import { loadMemeFont, renderMemeFrame, type Box } from "./render";
import { templateUrl, type Template } from "./templates";

export type ExportableMeme = {
  template: Pick<Template, "storage_path" | "width" | "height" | "kind">;
  boxes: Box[];
};

/** Sabit şablonlar PNG, GIF şablonlar GIF olarak indirilir. */
export function memeExtension(meme: ExportableMeme): "png" | "gif" {
  return meme.template.kind === "gif" ? "gif" : "png";
}

/**
 * Meme'i şablonun kendi çözünürlüğünde dosyaya çevirir. Ekrandaki önizleme ile aynı
 * renderMemeFrame kullanılır. GIF'lerde yazı her kareye işlenir (Web Worker'da).
 */
export async function exportMeme(
  meme: ExportableMeme,
  onProgress?: (value: number) => void,
): Promise<Blob> {
  await loadMemeFont();
  const { width, height } = meme.template;
  const url = templateUrl(meme.template);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  if (memeExtension(meme) === "png") {
    renderMemeFrame(ctx, await loadImage(url), meme.boxes, { width, height });
    onProgress?.(1);
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG üretilemedi"))),
        "image/png",
      ),
    );
  }

  // Yazı her karede aynı: bir kez çiz, Worker her kareye işlesin.
  renderMemeFrame(ctx, null, meme.boxes, { width, height });
  const layer = ctx.getImageData(0, 0, width, height).data;
  const gif = await (await fetch(url)).arrayBuffer();
  const bytes = await runGifWorker(
    { gif, layer: { data: layer, width, height } },
    onProgress,
  );
  return new Blob([bytes as BlobPart], { type: "image/gif" });
}

function runGifWorker(
  request: GifWorkerRequest,
  onProgress?: (value: number) => void,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./gif.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<GifWorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") return onProgress?.(message.value);
      worker.terminate();
      if (message.type === "done") resolve(message.bytes);
      else reject(new Error(message.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage(request, [request.gif, request.layer.data.buffer]);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous"; // canvas'tan dosya alınabilsin
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Görsel yüklenemedi: ${url}`));
    image.src = url;
  });
}
