import { expect, test } from "@playwright/test";

import { enter, openPlayer, runSql } from "./helpers";

// Android Chrome (mobile) ve iPhone Safari motoru (iphone) projelerinde koşar.
test.skip(({ isMobile }) => !isMobile, "Sadece telefon görünümü");

test("telefonda PNG ve GIF indirme", async ({ browser, browserName }) => {
  test.setTimeout(120_000);
  const names = [
    `Tel Gif ${browserName}`.slice(0, 16),
    `Tel Png ${browserName}`.slice(0, 16),
    "Tel Üçüncü",
  ];
  const players = await Promise.all(names.map(() => openPlayer(browser, true)));
  const [gifPage, pngPage] = players.map((p) => p.page);

  const code = await enter(gifPage, names[0]);
  await enter(pngPage, names[1], code);
  await enter(players[2].page, names[2], code);
  await expect(gifPage.getByTestId("player")).toHaveCount(3);
  await gifPage.getByRole("button", { name: "Oyunu Başlat" }).click();
  await expect(gifPage.getByTestId("countdown")).toBeVisible();

  // Test kısayolu: 1. oyuncuya hareketli şablon ver.
  await runSql(`
    update public.memes m set
      template_id = (select id from public.templates where kind = 'gif' and is_active order by storage_path limit 1),
      boxes = '[{"x":0.05,"y":0.03,"w":0.9,"h":0.2,"text":""}]'::jsonb
    from public.players p
    where p.id = m.player_id and p.username = '${names[0]}'
      and m.room_id = (select id from public.rooms where code = '${code}');
  `);
  await gifPage.reload();

  for (const [page, extension] of [
    [gifPage, "gif"],
    [pngPage, "png"],
  ] as const) {
    await page.getByRole("textbox", { name: "1. kutu" }).fill("Telefondan");
    await expect(page.getByTestId("download")).toHaveText(
      `⬇ İndir (${extension.toUpperCase()})`,
    );
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("download").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^tur1_.+\.${extension}$`),
    );
    expect((await download.failure()) ?? null).toBeNull();
  }

  for (const player of players) await player.context.close();
});
