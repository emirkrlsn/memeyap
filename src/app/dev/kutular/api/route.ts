import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { MAX_BOXES, type BoxFrame } from "@/lib/meme/render";

const BOXES_FILE = join(process.cwd(), "templates", "templates.json");

function isBoxFrame(value: unknown): value is BoxFrame {
  if (!value || typeof value !== "object") return false;
  const { x, y, w, h } = value as Record<string, unknown>;
  const numbers = [x, y, w, h];
  if (!numbers.every((n) => typeof n === "number" && n >= 0 && n <= 1))
    return false;
  return (
    (x as number) + (w as number) <= 1.001 &&
    (y as number) + (h as number) <= 1.001
  );
}

/**
 * Sadece geliştirme ortamında: bir şablonun varsayılan kutularını
 * templates/templates.json dosyasına ve veritabanına yazar.
 */
export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.NODE_ENV !== "development" || !serviceKey) {
    return new Response(null, { status: 404 });
  }

  const { sourceName, boxes } = (await request.json()) as {
    sourceName?: unknown;
    boxes?: unknown;
  };
  if (
    typeof sourceName !== "string" ||
    !Array.isArray(boxes) ||
    boxes.length > MAX_BOXES ||
    !boxes.every(isBoxFrame)
  ) {
    return Response.json({ error: "INVALID_BOXES" }, { status: 400 });
  }
  const frames = boxes.map(({ x, y, w, h }) => ({ x, y, w, h }));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: { persistSession: false },
    },
  );
  const { data, error } = await supabase
    .from("templates")
    .update({ default_boxes: frames })
    .eq("source_name", sourceName)
    .select("id");
  if (error || !data?.length) {
    return Response.json(
      { error: error?.message ?? "NOT_FOUND" },
      { status: 400 },
    );
  }

  const all: Record<string, unknown> = existsSync(BOXES_FILE)
    ? JSON.parse(readFileSync(BOXES_FILE, "utf8"))
    : {};
  all[sourceName] = frames;
  const sorted = Object.fromEntries(
    Object.entries(all).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(BOXES_FILE, `${JSON.stringify(sorted, null, 2)}\n`);

  return Response.json({ ok: true });
}
