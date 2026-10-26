import { readFileSync } from "node:fs";

import { expect, test, type Download, type Page } from "@playwright/test";
import JSZip from "jszip";

import { decodeGif } from "../src/lib/meme/gif";
import { enter, openPlayer, runSql } from "./helpers";

test.skip(({ isMobile }) => isMobile, "Çok oyunculu test sadece masaüstünde");

const NAMES = ["Gif Yapan", "Png Yapan", "Üçüncü Kişi"];

async function downloadFrom(page: Page, testId = "download") {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId(testId).first().click(),
  ]);
  return download;
}

const bytesOf = async (download: Download) =>
  readFileSync((await download.path())!);

/** İki görselin üst kutu bölgesinde (yazının olduğu yer) belirgin farklı piksel oranı. */
function topRegionDiff(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  width: number,
  height: number,
) {
  let changed = 0;
  const rows = Math.floor(height * 0.2);
  for (let y = Math.floor(height * 0.04); y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const diff =
        Math.abs(a[i] - b[i]) +
        Math.abs(a[i + 1] - b[i + 1]) +
        Math.abs(a[i + 2] - b[i + 2]);
      if (diff > 150) changed++;
    }
  }
  return changed / (rows * width);
}

test("indirme: GIF her karede yazılı, PNG şablon boyutunda, oyun sonunda ZIP", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const players = await Promise.all(NAMES.map(() => openPlayer(browser)));
  const [gifPage, pngPage, thirdPage] = players.map((p) => p.page);

  const code = await enter(gifPage, NAMES[0]);
  await enter(pngPage, NAMES[1], code);
  await enter(thirdPage, NAMES[2], code);
  await expect(gifPage.getByTestId("player")).toHaveCount(3);
  await gifPage.getByRole("button", { name: "Oyunu Başlat" }).click();
  await expect(gifPage.getByTestId("countdown")).toBeVisible();

  // Test kısayolu: 1. oyuncuya hareketli bir şablon ver ve doğrudan son tura atla
  // (böylece oylamadan sonra oyun biter ve "Tümünü indir" denenebilir).
  await runSql(`
    with r as (select id from public.rooms where code = '${code}')
    update public.memes m set
      round = 3,
      template_id = case when p.username = '${NAMES[0]}'
        then (select id from public.templates where kind = 'gif' and is_active order by storage_path limit 1)
        else m.template_id end,
      boxes = case when p.username = '${NAMES[0]}'
        then '[{"x":0.05,"y":0.03,"w":0.9,"h":0.2,"text":""}]'::jsonb else m.boxes end
    from public.players p, r
    where m.room_id = r.id and p.id = m.player_id;
    update public.rooms set current_round = 3 where code = '${code}';
  `);
  for (const page of [gifPage, pngPage, thirdPage]) {
    await page.reload();
    await expect(page.getByText("Tur 3/3")).toBeVisible();
  }

  // GIF: yazı her karede, kare sayısı ve süreleri korunur.
  await gifPage
    .getByRole("textbox", { name: "1. kutu" })
    .fill("Her karede yazı");
  await expect(gifPage.getByTestId("download")).toHaveText("⬇ İndir (GIF)");
  const gifDownload = await downloadFrom(gifPage);
  expect(gifDownload.suggestedFilename()).toBe("tur3_Gif_Yapan.gif");
  const original = decodeGif(
    await (
      await fetch(
        (await gifPage
          .locator("img[src*='/templates/']")
          .first()
          .getAttribute("src"))!,
      )
    ).arrayBuffer(),
  );
  const exported = decodeGif(new Uint8Array(await bytesOf(gifDownload)).buffer);
  expect(original.frames.length).toBeGreaterThan(1);
  expect(exported.frames.length).toBe(original.frames.length);
  expect(exported.frames.map((f) => f.delay)).toEqual(
    original.frames.map((f) => f.delay),
  );
  expect([exported.width, exported.height]).toEqual([
    original.width,
    original.height,
  ]);
  for (const [i, frame] of exported.frames.entries()) {
    const ratio = topRegionDiff(
      frame.rgba,
      original.frames[i].rgba,
      exported.width,
      exported.height,
    );
    expect(ratio, `kare ${i}`).toBeGreaterThan(0.03);
  }

  // PNG: şablonun kendi çözünürlüğünde ve yazı görselin üstünde.
  await pngPage.getByRole("textbox", { name: "1. kutu" }).fill("Png yazısı");
  await expect(pngPage.getByTestId("download")).toHaveText("⬇ İndir (PNG)");
  const pngDownload = await downloadFrom(pngPage);
  expect(pngDownload.suggestedFilename()).toBe("tur3_Png_Yapan.png");
  const png = await bytesOf(pngDownload);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  const template = pngPage.locator("img[src*='/templates/']").first();
  const natural = await template.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
  ]);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual(natural);
  const pngTextRatio = await pngPage.evaluate(
    async ({ pngBase64, templateSrc }) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.src = src;
        });
      const [exportedImg, templateImg] = await Promise.all([
        load(`data:image/png;base64,${pngBase64}`),
        load(templateSrc),
      ]);
      const { naturalWidth: w, naturalHeight: h } = exportedImg;
      const pixels = (img: HTMLImageElement) => {
        const canvas = Object.assign(document.createElement("canvas"), {
          width: w,
          height: h,
        });
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const [a, b] = [pixels(exportedImg), pixels(templateImg)];
      let changed = 0;
      for (let i = 0; i < w * Math.floor(h * 0.2) * 4; i += 4) {
        if (
          Math.abs(a[i] - b[i]) +
            Math.abs(a[i + 1] - b[i + 1]) +
            Math.abs(a[i + 2] - b[i + 2]) >
          150
        )
          changed++;
      }
      return changed / (w * Math.floor(h * 0.2));
    },
    {
      pngBase64: png.toString("base64"),
      templateSrc: (await template.getAttribute("src"))!,
    },
  );
  expect(pngTextRatio).toBeGreaterThan(0.02);

  // Oylama: ekrandaki meme indirilebilir; sahip gizli olduğu için dosya adında sıra numarası.
  await thirdPage.getByRole("textbox", { name: "1. kutu" }).fill("Üçüncü yazı");
  await thirdPage.waitForTimeout(1000);
  for (const page of [gifPage, pngPage, thirdPage]) {
    await page.getByRole("button", { name: "Hazırım!" }).click();
  }
  await expect(thirdPage.getByTestId("voting")).toBeVisible();
  const votingDownload = await downloadFrom(thirdPage);
  expect(votingDownload.suggestedFilename()).toMatch(/^tur3_meme1\.(png|gif)$/);

  // Herkes oy versin: 3 meme hızlıca biter ve oyun sona erer.
  for (let memeNumber = 1; memeNumber <= 3; memeNumber++) {
    for (const page of [gifPage, pngPage, thirdPage]) {
      await expect(page.getByText(`Meme ${memeNumber}/3`)).toBeVisible();
    }
    for (const page of [gifPage, pngPage, thirdPage]) {
      const button = page.getByRole("button", { name: /Beğenildi/ }).first();
      if (await button.isVisible()) await button.click();
    }
  }

  // Oyun sonu: tümü tek ZIP'te, doğru adlarla.
  await expect(pngPage.getByText("Oyun bitti!")).toBeVisible();
  await expect(pngPage.getByTestId("round-meme")).toHaveCount(3);
  const zipDownload = await downloadFrom(pngPage, "download-all");
  expect(zipDownload.suggestedFilename()).toBe(`memeyap_${code}.zip`);
  const zip = await JSZip.loadAsync(await bytesOf(zipDownload));
  expect(Object.keys(zip.files).sort()).toEqual(
    ["tur3_Gif_Yapan.gif", "tur3_Png_Yapan.png", "tur3_Ucuncu_Kisi.png"].sort(),
  );
  const zippedGif = decodeGif(
    (await zip.file("tur3_Gif_Yapan.gif")!.async("uint8array")).slice().buffer,
  );
  expect(zippedGif.frames.length).toBe(original.frames.length);
  const zippedPng = await zip.file("tur3_Png_Yapan.png")!.async("nodebuffer");
  expect(zippedPng.subarray(1, 4).toString()).toBe("PNG");

  for (const player of players) await player.context.close();
});
