import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { enter, openPlayer } from "./helpers";

test.skip(({ isMobile }) => isMobile, "Masaüstünde bir kez yeterli");

/** Ciddi ve kritik erişilebilirlik ihlallerini (kontrast, etiket, rol…) listeler. */
async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
}

test("erişilebilirlik: ana sayfa, lobi, editör, oylama, tur sonucu", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const players = await Promise.all([0, 1, 2].map(() => openPlayer(browser)));
  const [host, second, third] = players.map((p) => p.page);

  await host.goto("./");
  await expect(
    host.getByRole("button", { name: "Oyun Oluştur" }),
  ).toBeEnabled();
  expect(await seriousViolations(host), "ana sayfa").toEqual([]);

  const code = await enter(host, "Erişim Bir");
  await enter(second, "Erişim İki", code);
  await enter(third, "Erişim Üç", code);
  await expect(host.getByTestId("player")).toHaveCount(3);
  expect(await seriousViolations(host), "lobi (yönetici)").toEqual([]);
  expect(await seriousViolations(second), "lobi (oyuncu)").toEqual([]);

  await host.getByRole("button", { name: "Oyunu Başlat" }).click();
  await expect(host.getByTestId("meme-box").first()).toBeVisible();
  expect(await seriousViolations(host), "meme editörü").toEqual([]);

  // Klavye: kutu yazı alanı klavyeyle doldurulabilir.
  await host.getByRole("textbox", { name: "1. kutu" }).focus();
  await host.keyboard.type("Klavyeyle");
  await expect(host.getByRole("textbox", { name: "1. kutu" })).toHaveValue(
    "Klavyeyle",
  );

  // Oylama ve tur sonucu ekranları.
  for (const page of [second, third]) {
    await page.getByRole("textbox", { name: "1. kutu" }).fill("Erişilebilir");
  }
  for (const page of [host, second, third]) {
    await page.getByRole("button", { name: "Hazırım!" }).click();
  }
  await expect(second.getByTestId("voting")).toBeVisible();
  const voter = (await host.getByText("Bu senin meme'in!").isVisible())
    ? second
    : host;
  await expect(voter.getByRole("button", { name: /^Beğenildi/ })).toBeVisible();
  expect(await seriousViolations(voter), "oylama").toEqual([]);

  for (let meme = 1; meme <= 3; meme++) {
    await expect(host.getByText(`Meme ${meme}/3`)).toBeVisible();
    for (const page of [host, second, third]) {
      const button = page.getByRole("button", { name: /^Beğenildi/ });
      if (await button.isVisible()) await button.click();
    }
  }
  await expect(host.getByText("1. tur bitti!")).toBeVisible();
  await host.waitForTimeout(2500); // sırayla belirme animasyonu
  expect(await seriousViolations(host), "tur sonucu").toEqual([]);

  for (const player of players) await player.context.close();
});
