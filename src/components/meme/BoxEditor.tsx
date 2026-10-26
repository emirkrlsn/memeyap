"use client";

import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";

import { cn } from "@/lib/cn";
import {
  loadMemeFont,
  renderMemeFrame,
  type Box,
  type BoxFrame,
} from "@/lib/meme/render";
import { clampBox } from "@/lib/meme/templates";

type Props = {
  imageUrl: string;
  /** Şablonun gerçek boyutu (en-boy oranı için). */
  width: number;
  height: number;
  boxes: Box[];
  /** Verilmezse kutular taşınamaz (salt önizleme). */
  onChange?: (boxes: Box[]) => void;
  selected?: number | null;
  onSelect?: (index: number) => void;
};

/**
 * Şablon görseli + yazılar + sürüklenip boyutlandırılabilen kutular.
 * Görsel <img> ile gösterilir (GIF'ler canlı oynar); yazılar üstteki saydam canvas'a
 * ortak renderMemeFrame ile çizilir.
 */
export function BoxEditor({
  imageUrl,
  width,
  height,
  boxes,
  onChange,
  selected = null,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    loadMemeFont()
      .catch((error: unknown) =>
        console.error("[MemeYap] Font yüklenemedi:", error),
      )
      .finally(() => setFontReady(true));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || size.width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    renderMemeFrame(ctx, null, boxes, size);
  }, [boxes, size, fontReady]);

  function update(index: number, frame: Partial<BoxFrame>) {
    onChange?.(
      boxes.map((box, i) =>
        i === index ? clampBox({ ...box, ...frame }) : box,
      ),
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative mx-auto touch-none overflow-hidden rounded-2xl border-[3px] border-ink bg-ink select-none"
      style={{
        aspectRatio: `${width} / ${height}`,
        // Uzun görseller ekranın en fazla %60'ını kaplasın (butonlar görünür kalsın).
        width: `min(100%, calc(60svh * ${width / height}))`,
      }}
    >
      {/* GIF'lerin oynaması ve canvas'a çizilebilmesi için düz <img> (CORS açık). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        crossOrigin="anonymous"
        draggable={false}
        className="absolute inset-0 size-full"
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 size-full"
      />

      {onChange &&
        size.width > 0 &&
        boxes.map((box, index) => (
          <Rnd
            key={index}
            bounds="parent"
            position={{ x: box.x * size.width, y: box.y * size.height }}
            size={{ width: box.w * size.width, height: box.h * size.height }}
            minWidth={24}
            minHeight={18}
            enableResizing={{ bottomRight: true }}
            resizeHandleStyles={{
              bottomRight: { width: 28, height: 28, right: -10, bottom: -10 },
            }}
            resizeHandleComponent={{
              bottomRight: (
                <span className="block size-full rounded-full border-[3px] border-ink bg-sun" />
              ),
            }}
            onDragStart={() => onSelect?.(index)}
            onResizeStart={() => onSelect?.(index)}
            onDrag={(_, data) =>
              update(index, { x: data.x / size.width, y: data.y / size.height })
            }
            onResize={(_, __, element, ___, position) =>
              update(index, {
                x: position.x / size.width,
                y: position.y / size.height,
                w: element.offsetWidth / size.width,
                h: element.offsetHeight / size.height,
              })
            }
            data-testid="meme-box"
            className={cn(
              "rounded-md border-2 border-dashed",
              selected === index ? "border-sun bg-sun/15" : "border-white/80",
            )}
          >
            <span className="absolute top-0.5 left-0.5 grid size-5 place-items-center rounded-full bg-sun text-[11px] font-black text-ink">
              {index + 1}
            </span>
          </Rnd>
        ))}
    </div>
  );
}
