import { readFileSync } from "node:fs";

import { devices, type Browser, type Page } from "@playwright/test";

/** Her oyuncu ayrı bir tarayıcı bağlamı (ayrı anonim kullanıcı) kullanır. */
export async function openPlayer(browser: Browser, mobile = false) {
  const context = await browser.newContext(mobile ? devices["Pixel 7"] : {});
  return { context, page: await context.newPage() };
}

/** Oda oluşturur (kod verilmezse) ya da verilen koda katılır; oda kodunu döner. */
export async function enter(page: Page, username: string, code?: string) {
  await page.goto("/");
  await page.getByLabel("Kullanıcı adın").fill(username);
  if (code) {
    await page.getByLabel("Oyun kodu").fill(code);
    await page.getByRole("button", { name: "Oyuna Katıl" }).click();
  } else {
    await page.getByRole("button", { name: "Oyun Oluştur" }).click();
  }
  await page.waitForURL(/\/oda\/[A-Z0-9]{6}$/);
  return page.url().split("/").pop()!;
}

/** Bağlı Supabase projesinde SQL çalıştırır (sadece testlerde süreyi ileri sarmak için). */
export async function runSql(query: string) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN tanımlı değil.");
  const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  if (!response.ok) throw new Error(await response.text());
}

/** Odanın mevcut faz süresini bitmiş sayar; istemciler ve pg_cron fazı ilerletir. */
export async function fastForward(code: string) {
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error(`Geçersiz kod: ${code}`);
  await runSql(
    `update public.rooms set phase_ends_at = now() - interval '3 seconds' where code = '${code}'`,
  );
}
