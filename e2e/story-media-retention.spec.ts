import { expect, test, type Page } from "@playwright/test";
import { resolveValue } from "../scripts/env.mjs";

async function signIn(page: Page) {
  const email = resolveValue("VELORI_QA_OWNER_EMAIL", { secret: true });
  const password = resolveValue("VELORI_QA_OWNER_PASSWORD", { secret: true });
  test.skip(!email || !password, "QA owner credentials are not configured");
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(email);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(password);
  const response = page.waitForResponse((item) =>
    item.url().includes("/auth/v1/token?grant_type=password"),
  );
  await page
    .getByRole("button", { name: /sign in/i })
    .first()
    .click();
  expect((await response).status()).toBe(200);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("story photos and videos survive edits, collaboration, and reload", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto(`/stories/create?collab=media-retention-${Date.now()}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".story-studio")).toBeVisible();
  await page.waitForFunction(() => document.querySelector(".startup-intro") === null, null, {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Media", exact: true }).click();
  await page
    .locator('input[accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"]')
    .setInputFiles({
      name: "test-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAmElEQVR4nO3QMREAIBDAsJeDRGTjAGRkoEP2XuesfX82OkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAO0Ba0nyWR9T9ikAAAAASUVORK5CYII=",
        "base64",
      ),
    });

  const photo = page.locator(".story-editor-canvas-media");
  await expect(photo).toBeVisible();
  await expect(photo).toHaveJSProperty("naturalWidth", 64);
  await page.screenshot({ path: "artifacts/story-media-retention-desktop.png" });

  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  await page.getByRole("button", { name: "Add Sparkles sticker" }).click();
  await expect(page.locator(".story-editor-canvas-media")).toBeVisible();
  await page.getByRole("button", { name: "Close tool panel" }).click();
  await expect(photo).toBeVisible();
  await expect(photo).toHaveJSProperty("naturalWidth", 64);

  const collaborator = await page.context().newPage();
  await collaborator.setViewportSize({ width: 1280, height: 800 });
  await collaborator.goto(page.url(), { waitUntil: "domcontentloaded" });
  const collaboratorPhoto = collaborator.locator(".story-editor-canvas-media");
  await expect(collaboratorPhoto).toBeVisible();
  await expect(collaboratorPhoto).toHaveJSProperty("naturalWidth", 64);
  await collaborator.getByRole("button", { name: "Stickers", exact: true }).click();
  await collaborator.getByRole("button", { name: "Add Sparkles sticker" }).click();
  await expect(page.locator(".story-editor-canvas-media")).toBeVisible();
  await expect(page.locator(".story-editor-canvas-media")).toHaveJSProperty("naturalWidth", 64);
  await collaborator.close();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Media", exact: true }).click();
  await expect(page.locator(".story-editor-canvas-media")).toBeVisible();
  await page.screenshot({ path: "artifacts/story-media-retention-mobile.png" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".story-editor-canvas-media")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".story-editor-canvas-media")).toHaveJSProperty("naturalWidth", 64);
  await expect(page.locator(".story-studio")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole("button", { name: "Media", exact: true }).click();
  await page.getByRole("button", { name: "Replace media" }).click();
  await page
    .locator('input[accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"]')
    .setInputFiles("src/imports/Scene.mp4");
  const video = page.locator("video.story-editor-canvas-media");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((element) => element.videoWidth), { timeout: 10_000 })
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  await page.getByRole("button", { name: "Add Sparkles sticker" }).click();
  await expect(video).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  const restoredVideo = page.locator("video.story-editor-canvas-media");
  await expect(restoredVideo).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(() => restoredVideo.evaluate((element) => element.videoWidth), { timeout: 10_000 })
    .toBeGreaterThan(0);
});
