import {
  devices,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";

// Supabase IP başına saatte 30 anonim girişe izin verdiği için sadece masaüstü projesinde koşar;
// telefon görünümü, oyunculardan birinin bağlamında ayrıca denenir.
test.skip(({ isMobile }) => isMobile, "Çok oyunculu test sadece masaüstünde");

async function openPlayer(browser: Browser, mobile = false) {
  const context = await browser.newContext(mobile ? devices["Pixel 7"] : {});
  return { context, page: await context.newPage() };
}

async function enter(page: Page, username: string, code?: string) {
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

const templateSrc = (page: Page) =>
  page.locator("img[src*='/templates/']").first().getAttribute("src");

test("meme oluşturma: farklı şablonlar, pas, kutular, hazır olma", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const a = await openPlayer(browser);
  const b = await openPlayer(browser);
  const c = await openPlayer(browser, true);

  const code = await enter(a.page, "Ayşe Meme");
  await enter(b.page, "Bora Meme", code);
  await enter(c.page, "Cem Telefon", code);
  await expect(a.page.getByTestId("player")).toHaveCount(3);
  await a.page.getByRole("button", { name: "Oyunu Başlat" }).click();

  // Herkes editörü görür ve farklı bir şablon alır.
  for (const { page } of [a, b, c]) {
    await expect(page.getByTestId("countdown")).toBeVisible();
    await expect(page.getByTestId("meme-box").first()).toBeVisible();
  }
  const sources = await Promise.all(
    [a, b, c].map(({ page }) => templateSrc(page)),
  );
  expect(new Set(sources).size).toBe(3);

  // Pas: şablon değişir, hak azalır.
  await a.page.getByRole("button", { name: "Şablonu değiştir (3)" }).click();
  await expect(
    a.page.getByRole("button", { name: "Şablonu değiştir (2)" }),
  ).toBeVisible();
  await expect.poll(() => templateSrc(a.page)).not.toBe(sources[0]);

  // Telefonda kutu sürüklenir ve sarı köşeden boyutlandırılır; değişiklik kaydedilir.
  const box = c.page.getByTestId("meme-box").first();
  const before = (await box.boundingBox())!;
  await c.page.mouse.move(
    before.x + before.width / 2,
    before.y + before.height / 2,
  );
  await c.page.mouse.down();
  await c.page.mouse.move(
    before.x + before.width / 2,
    before.y + before.height / 2 + 60,
    {
      steps: 8,
    },
  );
  await c.page.mouse.up();
  const moved = (await box.boundingBox())!;
  expect(moved.y).toBeGreaterThan(before.y + 30);

  const handle = {
    x: moved.x + moved.width - 2,
    y: moved.y + moved.height - 2,
  };
  await c.page.mouse.move(handle.x, handle.y);
  await c.page.mouse.down();
  await c.page.mouse.move(handle.x - 50, handle.y + 30, { steps: 8 });
  await c.page.mouse.up();
  const resized = (await box.boundingBox())!;
  expect(resized.width).toBeLessThan(moved.width - 25);
  expect(resized.height).toBeGreaterThan(moved.height + 15);

  await c.page.waitForTimeout(1500); // gecikmeli kayıt
  await c.page.reload();
  const reloaded = (await c.page
    .getByTestId("meme-box")
    .first()
    .boundingBox())!;
  expect(Math.abs(reloaded.y - resized.y)).toBeLessThan(4);
  expect(Math.abs(reloaded.width - resized.width)).toBeLessThan(4);

  // Kutu ekleme ve yazı yazma (Cem boş bırakır: oylamaya girmez).
  await a.page.getByRole("button", { name: "+ Kutu ekle" }).click();
  await expect(a.page.getByTestId("meme-box")).toHaveCount(3);
  await a.page
    .getByRole("textbox", { name: "1. kutu" })
    .fill("Pazartesi sabahı");
  await b.page.getByRole("textbox", { name: "1. kutu" }).fill("Kod çalıştı");

  // Herkes hazır olunca süre dolmadan oylamaya geçilir.
  for (const { page } of [a, b, c]) {
    await page.getByRole("button", { name: "Hazırım!" }).click();
  }
  for (const { page } of [a, b, c]) {
    await expect(page.getByText("Meme'ler hazır!")).toBeVisible();
    await expect(page.getByText("2 meme oylamaya girdi.")).toBeVisible();
  }

  for (const player of [a, b, c]) await player.context.close();
});
