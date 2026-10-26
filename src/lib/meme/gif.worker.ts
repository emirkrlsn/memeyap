/// <reference lib="webworker" />
// GIF dışa aktarma Web Worker'ı: uzun GIF'lerde arayüz donmasın diye çözme, yazı işleme
// ve yeniden kodlama burada yapılır.
import { decodeGif, encodeGif, overlay } from "./gif";

export type GifWorkerRequest = {
  gif: ArrayBuffer;
  /** renderMemeFrame ile çizilmiş saydam yazı katmanı (GIF ile aynı boyutta). */
  layer: { data: Uint8ClampedArray; width: number; height: number };
};

export type GifWorkerResponse =
  | { type: "progress"; value: number }
  | { type: "done"; bytes: Uint8Array }
  | { type: "error"; message: string };

const post = (message: GifWorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(
    message,
    transfer,
  );

self.onmessage = (event: MessageEvent<GifWorkerRequest>) => {
  try {
    const { gif, layer } = event.data;
    const decoded = decodeGif(gif);
    if (decoded.width !== layer.width || decoded.height !== layer.height) {
      throw new Error(
        `Yazı katmanı ${layer.width}×${layer.height}, GIF ${decoded.width}×${decoded.height}`,
      );
    }
    for (const frame of decoded.frames) overlay(frame.rgba, layer.data);
    const bytes = encodeGif(decoded, (done, total) =>
      post({ type: "progress", value: done / total }),
    );
    post({ type: "done", bytes }, [bytes.buffer]);
  } catch (error) {
    post({ type: "error", message: String(error) });
  }
};
