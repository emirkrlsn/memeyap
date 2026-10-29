import { expect, test, type Page } from "@playwright/test";

import { enter, fastForward, openPlayer } from "./helpers";

// Supabase IP başına saatte 30 anonim girişe izin verdiği için sadece masaüstünde koşar.
test.skip(({ isMobile }) => isMobile, "Çok oyunculu test sadece masaüstünde");

const NAMES = ["Ayşe Oylar", "Bora Oylar", "Cem Oylar"];

test("3 oyuncuyla tam tur: oluştur → oyla → tur sonucu → sonraki tur", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const players = await Promise.all(NAMES.map(() => openPlayer(browser)));
  const pages = players.map((player) => player.page);

  // Oylama sırasında sunucudan gelen meme yanıtlarını topla (sahip sızıyor mu?).
  const votingResponses: string[] = [];
  for (const page of pages) {
    page.on("response", async (response) => {
      if (!response.url().includes("/rpc/get_current_vote_meme")) return;
      const body = await response.text().catch(() => "");
      if (body) votingResponses.push(body);
    });
  }

  const code = await enter(pages[0], NAMES[0]);
  await enter(pages[1], NAMES[1], code);
  await enter(pages[2], NAMES[2], code);
  await expect(pages[0].getByTestId("player")).toHaveCount(3);
  await pages[0].getByRole("button", { name: "Oyunu Başlat" }).click();

  // Her aşamadan önce 3 sn'lik giriş ekranı.
  const intro = (text: string) =>
    expect(pages[1].getByTestId("phase-intro")).toContainText(text);
  await intro("Oyun başlıyor!");

  // Herkes yazar ve hazır olur.
  for (const [index, page] of pages.entries()) {
    await page
      .getByRole("textbox", { name: "1. kutu" })
      .fill(`Komik yazı ${index + 1}`);
  }
  for (const page of pages) {
    await page.getByRole("button", { name: "Hazırım!" }).click();
  }
  await intro("Oylama başlıyor!");

  // Ekrandaki meme kimin? Sadece sahibi "senin meme'in" yazısını görür.
  async function ownerIndex() {
    let found = -1;
    await expect
      .poll(async () => {
        for (const [index, page] of pages.entries()) {
          if (await page.getByText("Bu senin meme'in!").isVisible())
            found = index;
        }
        return found;
      })
      .toBeGreaterThan(-1);
    return found;
  }

  const vote = (page: Page, rating: string) =>
    page.getByRole("button", { name: new RegExp(rating) }).click();

  const scores = [0, 0, 0];
  const owners: number[] = [];
  for (let memeNumber = 1; memeNumber <= 3; memeNumber++) {
    for (const page of pages) {
      await expect(page.getByTestId("voting")).toBeVisible();
      await expect(page.getByText(`Meme ${memeNumber}/3`)).toBeVisible();
    }
    if (memeNumber > 1) await intro("Sıradaki meme!");
    const owner = await ownerIndex();
    owners.push(owner);
    const [first, second] = pages.filter((_, index) => index !== owner);
    await expect(
      pages[owner].getByRole("button", { name: /Berbat/ }),
    ).toHaveCount(0);

    if (memeNumber < 3) {
      // İki oy da verilince süre dolmadan (açıklama beklemeden) sıradakine geçilir.
      await vote(first, "Çok beğenildi");
      await expect(first.getByText("Oyun kaydedildi")).toBeVisible();
      await vote(second, "Berbat");
      scores[owner] += 500 - 250;
    } else {
      // Biri oy vermez: süre dolunca otomatik "fena değil" (0) sayılır.
      await vote(first, "Beğenildi");
      await fastForward(code);
      scores[owner] += 200;
    }
  }

  // Oylama sırasında hiçbir yanıtta oyuncu adı geçmez (sahip gizli).
  expect(votingResponses.length).toBeGreaterThan(0);
  for (const body of votingResponses) {
    for (const name of NAMES) expect(body).not.toContain(name);
  }

  // Tur sonucu tek sayfada: meme'ler puana göre sıralı, sahipleri ve oy dağılımıyla;
  // altında genel sıralama.
  for (const page of pages) {
    await expect(page.getByText("1. tur bitti!")).toBeVisible();
    await expect(page.getByTestId("round-meme")).toHaveCount(3);
    await expect(page.getByTestId("meme-owner")).toHaveText(
      owners.map((owner) => NAMES[owner]),
    );
    await expect(page.getByTestId("meme-points")).toHaveText([
      "+250",
      "+250",
      "+200",
    ]);
    const firstMeme = page.getByTestId("round-meme").first();
    await expect(firstMeme.locator("[data-rating=cok_begenildi]")).toHaveText(
      /1$/,
    );
    await expect(firstMeme.locator("[data-rating=berbat]")).toHaveText(/1$/);
    const lastMeme = page.getByTestId("round-meme").last();
    await expect(lastMeme.locator("[data-rating=begenildi]")).toHaveText(/1$/);
    await expect(lastMeme.locator("[data-rating=fena_degil]")).toHaveText(/1$/);

    const rows = page.getByTestId("score-row");
    await expect(rows).toHaveCount(3);
    const texts = await rows.allTextContents();
    const shown = texts.map((text) =>
      Number(text.match(/([+−]?\d+) puan/)![1].replace("+", "")),
    );
    expect(shown).toEqual([...scores].sort((a, b) => b - a));
  }
  // Ara sıralama 20 sn sayar, sonra sonraki tur kendiliğinden başlar (test süreyi ileri sarar).
  await expect(pages[1].getByTestId("next-round-countdown")).toContainText(
    "saniye içinde başlıyor",
  );
  await fastForward(code);
  for (const page of pages) {
    await expect(page.getByText("Tur 2/3")).toBeVisible();
  }

  for (const player of players) await player.context.close();
});
