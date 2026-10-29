import { expect, test } from "@playwright/test";

import { enter, openPlayer } from "./helpers";

test.skip(({ isMobile }) => isMobile, "Çok oyunculu test sadece masaüstünde");

test("15 kişilik oda: aynı anda katılım, 16. reddedilir, oyun akar", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const players = await Promise.all(
    Array.from({ length: 16 }, () => openPlayer(browser)),
  );
  const pages = players.map((player) => player.page);
  const name = (i: number) => `Kalabalık ${String(i + 1).padStart(2, "0")}`;

  // 15 kişi: biri kurar, 14'ü aynı anda katılır.
  const code = await enter(pages[0], name(0));
  await Promise.all(
    pages.slice(1, 15).map((page, i) => enter(page, name(i + 1), code)),
  );
  for (const page of [pages[0], pages[7], pages[14]]) {
    await expect(page.getByTestId("player-count")).toHaveText("15 / 15");
  }

  // 16. oyuncu reddedilir.
  await pages[15].goto("./");
  await pages[15].getByLabel("Kullanıcı adın").fill(name(15));
  await pages[15].getByLabel("Oyun kodu").fill(code);
  await pages[15].getByRole("button", { name: "Oyuna Katıl" }).click();
  await expect(
    pages[15].getByText("Oda dolu (en fazla 15 oyuncu)."),
  ).toBeVisible();

  // Oyun başlar; herkes aynı anda yazar ve hazır olur.
  const room = pages.slice(0, 15);
  await room[0].getByRole("button", { name: "Oyunu Başlat" }).click();
  await Promise.all(
    room.map(async (page, i) => {
      await page
        .getByRole("textbox", { name: "1. kutu" })
        .fill(`Yazı ${i + 1}`);
      await page.getByRole("button", { name: "Hazırım!" }).click();
    }),
  );

  // İlk meme'e 14 kişi oy verir; hemen ikinciye geçilir.
  for (const page of room) {
    await expect(page.getByText("Meme 1/15")).toBeVisible({ timeout: 30_000 });
  }
  await Promise.all(
    room.map(async (page) => {
      const button = page.getByRole("button", { name: /^Beğenildi/ });
      // Meme yüklenene kadar bekle: ya oy butonu ya da "senin meme'in" görünür.
      await expect(
        button.or(page.getByText("Bu senin meme'in!")),
      ).toBeVisible();
      if (await button.isVisible()) await button.click();
    }),
  );
  for (const page of room) {
    await expect(page.getByText("Meme 2/15")).toBeVisible({ timeout: 30_000 });
  }

  for (const player of players) await player.context.close();
});
