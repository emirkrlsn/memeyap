import { expect, test } from "@playwright/test";

import { enter, openPlayer, runSql } from "./helpers";

test.skip(({ isMobile }) => isMobile, "Çok oyunculu test sadece masaüstünde");

const NAMES = ["Ali Final", "Banu Final", "Cem Final"];

test("3 turluk tam oyun: final sıralaması (eşitlik 1,1,2), tekrar oyna, silme", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const players = await Promise.all(NAMES.map(() => openPlayer(browser)));
  const pages = players.map((player) => player.page);

  const code = await enter(pages[0], NAMES[0]);
  await enter(pages[1], NAMES[1], code);
  await enter(pages[2], NAMES[2], code);
  await expect(pages[0].getByTestId("player")).toHaveCount(3);
  await pages[0].getByRole("button", { name: "Oyunu Başlat" }).click();

  for (let round = 1; round <= 3; round++) {
    for (const [index, page] of pages.entries()) {
      await expect(page.getByText(`Tur ${round}/3`)).toBeVisible();
      await page
        .getByRole("textbox", { name: "1. kutu" })
        .fill(`Tur ${round} yazı ${index + 1}`);
    }
    for (const page of pages) {
      await page.getByRole("button", { name: "Hazırım!" }).click();
    }

    // Ali ve Banu'nun meme'lerine "Beğenildi" (2 × 200), Cem'inkine "Fena değil" (0):
    // her tur sonunda Ali = Banu, Cem 0.
    for (let memeNumber = 1; memeNumber <= 3; memeNumber++) {
      for (const page of pages) {
        await expect(page.getByText(`Meme ${memeNumber}/3`)).toBeVisible();
      }
      let owner = -1;
      await expect
        .poll(async () => {
          for (const [index, page] of pages.entries()) {
            if (await page.getByText("Bu senin meme'in!").isVisible())
              owner = index;
          }
          return owner;
        })
        .toBeGreaterThan(-1);
      const rating = owner === 2 ? "Fena değil" : "Beğenildi";
      for (const [index, page] of pages.entries()) {
        if (index === owner) continue;
        await page
          .getByRole("button", { name: new RegExp(`^${rating} `) })
          .click();
      }
    }

    if (round < 3) {
      await expect(pages[0].getByText(`${round}. tur bitti!`)).toBeVisible();
      await pages[0].getByRole("button", { name: "Sonraki tura geç" }).click();
    }
  }

  // Final: eşit puanlılar aynı sırada, sonraki sıra atlanmaz (1, 1, 2).
  for (const page of pages) {
    await expect(page.getByText("Oyun bitti!")).toBeVisible();
    await expect(page.getByTestId("rank")).toHaveText(["1", "1", "2"]);
    const rows = await page.getByTestId("score-row").allTextContents();
    expect(rows[0]).toContain("Ali Final");
    expect(rows[0]).toContain("+1200 puan");
    expect(rows[1]).toContain("Banu Final");
    expect(rows[1]).toContain("+1200 puan");
    expect(rows[2]).toContain("Cem Final");
    expect(rows[2]).toContain("0 puan");
  }
  await expect(
    pages[1].getByText("Yönetici aynı odayla yeni bir oyun başlatabilir."),
  ).toBeVisible();

  // Aynı odayla tekrar oyna: herkes aynı kodla lobiye döner, yeni oyun başlar.
  await pages[0]
    .getByRole("button", { name: /Aynı odayla tekrar oyna/ })
    .click();
  for (const page of pages) {
    await expect(page.getByTestId("room-code")).toHaveText(code);
    await expect(page.getByTestId("player")).toHaveCount(3);
  }
  const [{ memes }] = await runSql(
    `select count(*)::int as memes from public.memes m join public.rooms r on r.id = m.room_id where r.code = '${code}'`,
  );
  expect(memes).toBe(0);
  await pages[0].getByRole("button", { name: "Oyunu Başlat" }).click();
  for (const page of pages) {
    await expect(page.getByText("Tur 1/3")).toBeVisible();
  }

  // Son oyuncu da ayrılınca oda ve tüm verisi silinir.
  for (const page of pages) {
    await page.getByRole("button", { name: "Odadan ayrıl" }).click();
    await page.waitForURL((url) => !url.pathname.includes("/oda"));
  }
  const [{ rooms }] = await runSql(
    `select count(*)::int as rooms from public.rooms where code = '${code}'`,
  );
  expect(rooms).toBe(0);

  for (const player of players) await player.context.close();
});
