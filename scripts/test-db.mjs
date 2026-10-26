// supabase/tests/*.sql dosyalarını bağlı Supabase projesinde çalıştırır.
// Testler her zaman geri alınır; sonuç "TESTS PASSED" / "TEST FAILED" hata mesajı olarak döner.
// Gerekenler: SUPABASE_ACCESS_TOKEN ortam değişkeni ve `supabase link` yapılmış proje.
import { readdirSync, readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN tanımlı değil.");
const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();

let failed = false;
for (const file of readdirSync("supabase/tests").filter((f) =>
  f.endsWith(".sql"),
)) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: readFileSync(`supabase/tests/${file}`, "utf8"),
      }),
    },
  );
  const message = (await response.text()).match(
    /TESTS? (PASSED|FAILED)[^\\]*/,
  )?.[0];
  const passed = message?.startsWith("TESTS PASSED") ?? false;
  failed ||= !passed;
  console.log(
    `${passed ? "✓" : "✗"} ${file}: ${message ?? "beklenmeyen yanıt"}`,
  );
}
process.exit(failed ? 1 : 0);
