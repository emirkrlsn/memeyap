// templates/ klasöründeki görselleri Supabase Storage'a yükler ve templates tablosunu günceller.
// Çalıştırma: npm run templates:seed   (SUPABASE_SERVICE_ROLE_KEY .env.local içinde olmalı)
//
// * Sabit görseller en fazla 1000 px genişliğe küçültülüp WebP'ye çevrilir.
// * Hareketli görseller (GIF, hareketli WebP) 480 px genişliğe küçültülüp GIF'e çevrilir.
// * Dosya adı içerik özetinden üretilir: aynı görsel iki kez yüklenmez.
// * Varsayılan yazı kutuları templates/templates.json'dan okunur; tanımsızsa üst + alt kutu.
// * Klasörden silinen şablonlar pasifleştirilir (eski meme'ler bozulmasın diye silinmez).
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const TEMPLATE_DIR = "templates";
const BOXES_FILE = join(TEMPLATE_DIR, "templates.json");
const BUCKET = "templates";
// src/lib/meme/templates.ts içindeki DEFAULT_TEMPLATE_BOXES ile aynı olmalı.
const DEFAULT_BOXES = [
  { x: 0.05, y: 0.03, w: 0.9, h: 0.2 },
  { x: 0.05, y: 0.77, w: 0.9, h: 0.2 },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY .env.local içinde tanımlı olmalı.",
  );
}
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const boxesByFile: Record<string, unknown> = existsSync(BOXES_FILE)
  ? JSON.parse(readFileSync(BOXES_FILE, "utf8"))
  : {};

async function listUploaded(): Promise<Set<string>> {
  const names = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: 1000, offset });
    if (error) throw error;
    for (const object of data) names.add(object.name);
    if (data.length < 1000) return names;
  }
}

const uploaded = await listUploaded();
const files = readdirSync(TEMPLATE_DIR)
  .filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file))
  .sort();

const seen = new Map<string, string>();
const rows = [];
let newUploads = 0;

for (const file of files) {
  const input = readFileSync(join(TEMPLATE_DIR, file));
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 16);
  if (seen.has(hash)) {
    console.log(`= ${file}: ${seen.get(hash)} ile aynı, atlandı`);
    continue;
  }
  seen.set(hash, file);

  const animated = ((await sharp(input).metadata()).pages ?? 1) > 1;
  const resized = sharp(input, { animated }).resize({
    width: animated ? 480 : 1000,
    withoutEnlargement: true,
  });
  const output = await (
    animated ? resized.gif() : resized.webp({ quality: 85 })
  ).toBuffer();
  const meta = await sharp(output).metadata();
  const storagePath = `${hash}.${animated ? "gif" : "webp"}`;

  if (!uploaded.has(storagePath)) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, output, {
        contentType: animated ? "image/gif" : "image/webp",
        cacheControl: "31536000",
        upsert: true,
      });
    if (error) throw new Error(`${file} yüklenemedi: ${error.message}`);
    newUploads++;
  }

  rows.push({
    storage_path: storagePath,
    source_name: file,
    kind: animated ? ("gif" as const) : ("image" as const),
    width: meta.width!,
    height: meta.pageHeight ?? meta.height!,
    default_boxes: boxesByFile[file] ?? DEFAULT_BOXES,
    is_active: true,
  });
}

const { error: upsertError } = await supabase
  .from("templates")
  .upsert(rows, { onConflict: "storage_path" });
if (upsertError) throw upsertError;

const activePaths = rows.map((row) => row.storage_path);
const { data: deactivated, error: deactivateError } = await supabase
  .from("templates")
  .update({ is_active: false })
  .eq("is_active", true)
  .not("storage_path", "in", `(${activePaths.join(",")})`)
  .select("source_name");
if (deactivateError) throw deactivateError;

const custom = rows.filter((row) => row.default_boxes !== DEFAULT_BOXES).length;
console.log(
  `\n✓ ${rows.length} şablon hazır (${newUploads} yeni yükleme, ${rows.filter((r) => r.kind === "gif").length} hareketli, ` +
    `${custom} özel kutulu, ${deactivated.length} pasifleştirildi).`,
);
