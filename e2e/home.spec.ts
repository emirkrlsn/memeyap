import { expect, test } from "@playwright/test";

test("ana sayfa açılır ve anonim oturum yenilemede korunur", async ({
  page,
}) => {
  const userIds: string[] = [];
  page.on("console", (message) => {
    const match = message.text().match(/Anonim kullanıcı kimliği: (\S+)/);
    if (match) userIds.push(match[1]);
  });

  await page.goto("./");
  await expect(page.getByRole("heading", { name: "MemeYap" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Oyun Oluştur" }),
  ).toBeVisible();
  await expect.poll(() => userIds.length).toBeGreaterThan(0);

  const firstUserId = userIds[0];
  userIds.length = 0;
  await page.reload();
  await expect.poll(() => userIds[0]).toBe(firstUserId);
});

test("geçersiz kullanıcı adı ve oda kodu Türkçe hata verir", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByLabel("Kullanıcı adın").fill("abc");
  await page.getByRole("button", { name: "Oyun Oluştur" }).click();
  await expect(
    page.getByText("Kullanıcı adı 4–16 karakter olmalı."),
  ).toBeVisible();

  await page.getByLabel("Kullanıcı adın").fill("Deneme");
  await page.getByLabel("Oyun kodu").fill("abc");
  await page.getByRole("button", { name: "Oyuna Katıl" }).click();
  await expect(page.getByText("Oyun kodu 6 karakter olmalı.")).toBeVisible();
});
