// supabase/tests/*.sql dosyalarını bağlı Supabase projesinde çalıştırır ve sunucudaki
// puan eşlemesinin src/lib/ratings.ts ile aynı olduğunu doğrular.
// SQL testleri her zaman geri alınır; sonuç "TESTS PASSED" / "TEST FAILED" hata mesajı olarak döner.
// Gerekenler: SUPABASE_ACCESS_TOKEN ortam değişkeni ve `supabase link` yapılmış proje.
import { readdirSync, readFileSync } from "node:fs";

import { RATING_POINTS } from "../src/lib/ratings.ts";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN tanımlı değil.");
const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();

async function query(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  return response.text();
}

let failed = false;
function report(passed, name, message) {
  failed ||= !passed;
  console.log(`${passed ? "✓" : "✗"} ${name}: ${message}`);
}

for (const file of readdirSync("supabase/tests").filter((f) =>
  f.endsWith(".sql"),
)) {
  const message = (
    await query(readFileSync(`supabase/tests/${file}`, "utf8"))
  ).match(/TESTS? (PASSED|FAILED)[^\\]*/)?.[0];
  report(
    message?.startsWith("TESTS PASSED") ?? false,
    file,
    message ?? "beklenmeyen yanıt",
  );
}

const serverPoints = Object.fromEntries(
  JSON.parse(
    await query(
      "select r::text as rating, private.rating_points(r) as points from unnest(enum_range(null::public.vote_rating)) r",
    ),
  ).map(({ rating, points }) => [rating, points]),
);
const same = JSON.stringify(serverPoints) === JSON.stringify(RATING_POINTS);
report(
  same,
  "puan eşlemesi",
  same
    ? "sunucu ve istemci aynı"
    : `farklı! sunucu=${JSON.stringify(serverPoints)}`,
);

process.exit(failed ? 1 : 0);
