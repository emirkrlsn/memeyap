import { expect, test, type Browser, type Page } from "@playwright/test";

// Her oyuncu ayrı bir tarayıcı bağlamı (ayrı anonim kullanıcı) kullanır.
// Supabase IP başına saatte 30 anonim girişe izin verdiği için bu test sadece masaüstünde koşar.
test.skip(({ isMobile }) => isMobile, "Çok oyunculu test sadece masaüstünde");

async function openPlayer(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

async function fillUsername(page: Page, username: string) {
  await page.goto("/");
  await page.getByLabel("Kullanıcı adın").fill(username);
}

async function createRoom(page: Page, username: string) {
  await fillUsername(page, username);
  await page.getByRole("button", { name: "Oyun Oluştur" }).click();
  await page.waitForURL(/\/oda\/[A-Z0-9]{6}$/);
  return page.url().split("/").pop()!;
}

async function tryJoin(page: Page, code: string, username: string) {
  await fillUsername(page, username);
  await page.getByLabel("Oyun kodu").fill(code.toLowerCase());
  await page.getByRole("button", { name: "Oyuna Katıl" }).click();
}

async function joinRoom(page: Page, code: string, username: string) {
  await tryJoin(page, code, username);
  await page.waitForURL(`**/oda/${code}`);
}

const players = (page: Page) => page.getByTestId("player");
const host = (page: Page) => page.locator("[data-testid=player][data-host]");

test("oda kurma, katılma, host devri, başlatma ve geç katılım", async ({
  browser,
}) => {
  test.setTimeout(150_000);

  const a = await openPlayer(browser);
  const b = await openPlayer(browser);
  const c = await openPlayer(browser);
  const d = await openPlayer(browser);
  const e = await openPlayer(browser);

  // Oda oluştur: 3 kişiden azken başlatılamaz.
  const code = await createRoom(a.page, "Ev Sahibi");
  await expect(a.page.getByTestId("room-code")).toHaveText(code);
  await expect(
    a.page.getByRole("button", { name: "Oyunu Başlat" }),
  ).toBeDisabled();
  await expect(a.page.getByText("en az 3 bağlı oyuncu gerekli")).toBeVisible();

  // Katılanlar herkesin listesinde anlık görünür (küçük harfli kod da kabul edilir).
  await joinRoom(b.page, code, "İkinci");
  await expect(players(a.page)).toHaveCount(2);

  // Aynı ad, farklı harf büyüklüğüyle de reddedilir.
  await tryJoin(c.page, code, "ev sahibi");
  await expect(
    c.page.getByText("Bu kullanıcı adı odada zaten alınmış."),
  ).toBeVisible();
  await c.page.getByLabel("Kullanıcı adın").fill("Üçüncü");
  await c.page.getByRole("button", { name: "Oyuna Katıl" }).click();
  await c.page.waitForURL(`**/oda/${code}`);

  for (const { page } of [a, b, c]) {
    await expect(players(page)).toHaveCount(3);
    await expect(host(page)).toContainText("Ev Sahibi");
  }
  await expect(
    a.page.getByRole("button", { name: "Oyunu Başlat" }),
  ).toBeEnabled();
  await expect(
    b.page.getByText("Yöneticinin oyunu başlatması bekleniyor"),
  ).toBeVisible();

  // Ayarları sadece host değiştirir; diğerleri anlık görür.
  const fiveRounds = (page: Page) =>
    page
      .getByRole("group", { name: "Tur sayısı" })
      .getByRole("button", { name: "5" });
  await fiveRounds(a.page).click();
  await expect(fiveRounds(b.page)).toHaveAttribute("aria-pressed", "true");
  await expect(fiveRounds(b.page)).toBeDisabled();

  // Host sekmeyi kapatır: ~30 sn sonra yetki en erken katılan bağlı oyuncuya geçer.
  await a.context.close();
  await expect(host(b.page)).toContainText("İkinci", { timeout: 60_000 });
  await expect(
    b.page.getByText("Artık oyunun yöneticisi sensin!"),
  ).toBeVisible();
  await expect(
    c.page.getByText("İkinci artık oyunun yöneticisi."),
  ).toBeVisible();

  // Yeni host, bağlı 3 oyuncuyla oyunu başlatır.
  await joinRoom(d.page, code, "Dördüncü");
  await expect(
    b.page.getByRole("button", { name: "Oyunu Başlat" }),
  ).toBeEnabled();
  await b.page.getByRole("button", { name: "Oyunu Başlat" }).click();
  for (const { page } of [b, c, d]) {
    await expect(page.getByTestId("countdown")).toBeVisible();
    await expect(page.getByText("Tur 1/5")).toBeVisible();
  }

  // Oyun sürerken katılan bir sonraki turdan oynar ve izleme ekranı görür.
  await joinRoom(e.page, code, "Geç Gelen");
  await expect(e.page.getByText("Oyun devam ediyor")).toBeVisible();
  await expect(e.page.getByText("2. turdan itibaren")).toBeVisible();
  await expect(players(e.page)).toHaveCount(5);

  // Sayfa yenilenince oyuncu kaldığı yerden devam eder.
  await c.page.reload();
  await expect(c.page.getByTestId("countdown")).toBeVisible();

  for (const player of [b, c, d, e]) await player.context.close();
});
