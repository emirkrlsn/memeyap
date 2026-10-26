import type { Json, Tables } from "@/types/database";

import { getSupabaseClient } from "../supabase/client";
import type { Box } from "./render";

export type Template = Tables<"templates">;

export function templateUrl(template: Pick<Template, "storage_path">): string {
  return getSupabaseClient()
    .storage.from("templates")
    .getPublicUrl(template.storage_path).data.publicUrl;
}

/** Veritabanından gelen JSON kutuları güvenli Box dizisine çevirir. */
export function toBoxes(json: Json): Box[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const { x, y, w, h, text } = item;
    if ([x, y, w, h].some((value) => typeof value !== "number")) return [];
    return [
      {
        x: x as number,
        y: y as number,
        w: w as number,
        h: h as number,
        text: typeof text === "string" ? text : "",
      },
    ];
  });
}

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

/** Kutuyu görselin içinde tutar ve gereksiz ondalıkları atar. */
export function clampBox<T extends Omit<Box, "text">>(box: T): T {
  const w = round4(Math.min(1, Math.max(0.05, box.w)));
  const h = round4(Math.min(1, Math.max(0.04, box.h)));
  return {
    ...box,
    w,
    h,
    x: round4(Math.min(1 - w, Math.max(0, box.x))),
    y: round4(Math.min(1 - h, Math.max(0, box.y))),
  };
}

/**
 * Kutusu tanımlanmamış şablonlar için klasik üst + alt yazı.
 * scripts/seed-templates.mts içindeki DEFAULT_BOXES ile aynı olmalı.
 */
export const DEFAULT_TEMPLATE_BOXES: Box[] = [
  { x: 0.05, y: 0.03, w: 0.9, h: 0.2, text: "" },
  { x: 0.05, y: 0.77, w: 0.9, h: 0.2, text: "" },
];

/** Yeni eklenen kutunun varsayılan yeri: görselin ortası. */
export const NEW_BOX: Box = { x: 0.1, y: 0.4, w: 0.8, h: 0.2, text: "" };
