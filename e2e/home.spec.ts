import { expect, test } from "@playwright/test";

test("ana sayfa açılır ve anonim oturum kurulur", async ({ page }) => {
  const userIds: string[] = [];
  page.on("console", (message) => {
    const match = message.text().match(/Anonim kullanıcı kimliği: (\S+)/);
    if (match) userIds.push(match[1]);
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "MemeYap" })).toBeVisible();
  await expect(page.getByTestId("session-status")).toHaveAttribute(
    "data-status",
    "ready",
    {
      timeout: 15_000,
    },
  );
  await expect.poll(() => userIds.length).toBeGreaterThan(0);

  // Sayfa yenilenince aynı anonim kullanıcıyla devam edilir.
  const firstUserId = userIds[0];
  userIds.length = 0;
  await page.reload();
  await expect(page.getByTestId("session-status")).toHaveAttribute(
    "data-status",
    "ready",
  );
  await expect.poll(() => userIds[0]).toBe(firstUserId);
});
