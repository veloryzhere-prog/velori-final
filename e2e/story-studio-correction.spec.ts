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

test("Story Studio keeps selection separate from its tools and reserves canvas space", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/stories/create", { waitUntil: "domcontentloaded" });
  const studio = page.locator(".story-studio");
  await expect(studio).toBeVisible();

  const tools = page.locator(".ss-tools > button");
  await expect(tools).toHaveCount(6);
  const desktopLayout = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>(".ss-tools")!;
    const canvas = document.querySelector<HTMLElement>(".ss-preview")!.getBoundingClientRect();
    const side = document.querySelector<HTMLElement>(".ss-side")!.getBoundingClientRect();
    return {
      direction: getComputedStyle(nav).flexDirection,
      canvasRight: canvas.right,
      sideLeft: side.left,
    };
  });
  expect(desktopLayout.direction).toBe("row");
  expect(desktopLayout.sideLeft).toBeGreaterThan(desktopLayout.canvasRight);
  const desktopPreview = await page.locator(".ss-preview").boundingBox();
  expect(desktopPreview).not.toBeNull();
  expect(Math.abs(desktopPreview!.width / desktopPreview!.height - 9 / 16)).toBeLessThan(0.03);
  await page.getByRole("button", { name: "Music", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No music available yet" })).toBeVisible();
  await page.waitForFunction(() => document.querySelector(".startup-intro") === null, null, {
    timeout: 20_000,
  });
  await page.screenshot({ path: "artifacts/story-studio-correction-desktop.png" });
  await page.getByRole("button", { name: "Close tool panel" }).click();

  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Create styled text" }).click();
  await page.getByPlaceholder(/write something/i).fill("Move without opening tools");
  await page.getByRole("button", { name: "Add to story" }).click();
  const textObject = page
    .locator('[data-story-object-kind="text"]')
    .filter({ hasText: "Move without opening tools" })
    .first();
  await expect(textObject).toBeVisible();
  await page.getByRole("button", { name: "Close tool panel" }).click();
  const bounds = await textObject.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 32, bounds!.y + bounds!.height / 2 + 18, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(page.locator(".ss-tools > button.active")).toHaveCount(0);
  await expect(page.locator(".ss-panel")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(page.getByLabel("Text and animation tools")).toBeVisible();
  await expect(page.getByLabel("Quick text colors")).toBeVisible();
  await expect(page.getByText("Fade In and Out")).toHaveCount(1);
  await page.locator(".story-editor-text-tools select").nth(3).selectOption("slide-left");
  await page.getByRole("button", { name: /Preview/ }).click();
  await expect(page.locator(".story-editor-canvas")).toBeVisible();
  const startTransform = await textObject.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await page.waitForTimeout(900);
  const settledTransform = await textObject.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  expect(startTransform).not.toBe(settledTransform);

  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  await page.getByRole("button", { name: "Add Sparkles sticker" }).click();
  const stickerObject = page.locator(".velori-story-sticker").first();
  await expect(stickerObject).toBeVisible();
  await page.getByRole("button", { name: "Close tool panel" }).click();
  const stickerBounds = await stickerObject.boundingBox();
  expect(stickerBounds).not.toBeNull();
  await page.mouse.move(
    stickerBounds!.x + stickerBounds!.width / 2,
    stickerBounds!.y + stickerBounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    stickerBounds!.x + stickerBounds!.width / 2 + 24,
    stickerBounds!.y + stickerBounds!.height / 2 + 14,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(page.locator(".ss-tools > button.active")).toHaveCount(0);
  await expect(page.locator(".ss-panel")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  await expect(page.getByLabel("Effect")).toBeVisible();
  await page.getByLabel("Effect").selectOption("fade-in");

  await page.getByRole("button", { name: "Music", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>(".ss-preview")!.getBoundingClientRect();
    const tools = document.querySelector<HTMLElement>(".ss-tools")!.getBoundingClientRect();
    const panel = document.querySelector<HTMLElement>(".ss-panel")!.getBoundingClientRect();
    return {
      canvasBottom: canvas.bottom,
      toolsTop: tools.top,
      toolsBottom: tools.bottom,
      panelTop: panel.top,
      panelBottom: panel.bottom,
      footerTop: document.querySelector<HTMLElement>(".ss-bottom")!.getBoundingClientRect().top,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(mobileLayout.canvasBottom).toBeLessThanOrEqual(mobileLayout.toolsTop + 1);
  expect(mobileLayout.toolsBottom).toBeLessThanOrEqual(mobileLayout.panelTop + 1);
  expect(mobileLayout.panelBottom).toBeLessThanOrEqual(mobileLayout.footerTop + 1);
  expect(mobileLayout.scrollWidth).toBe(390);
  await page.getByRole("button", { name: "Reset edits" }).click();
  await page.screenshot({ path: "artifacts/story-studio-correction-mobile.png" });
  await page.setViewportSize({ width: 320, height: 740 });
  const narrowLayout = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>(".ss-preview")!.getBoundingClientRect();
    const tools = document.querySelector<HTMLElement>(".ss-tools")!.getBoundingClientRect();
    const panel = document.querySelector<HTMLElement>(".ss-panel")!.getBoundingClientRect();
    return {
      canvasBottom: canvas.bottom,
      toolsTop: tools.top,
      toolsBottom: tools.bottom,
      panelTop: panel.top,
      panelBottom: panel.bottom,
      footerTop: document.querySelector<HTMLElement>(".ss-bottom")!.getBoundingClientRect().top,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(narrowLayout.canvasBottom).toBeLessThanOrEqual(narrowLayout.toolsTop + 1);
  expect(narrowLayout.toolsBottom).toBeLessThanOrEqual(narrowLayout.panelTop + 1);
  expect(narrowLayout.panelBottom).toBeLessThanOrEqual(narrowLayout.footerTop + 1);
  expect(narrowLayout.scrollWidth).toBe(320);
  expect(pageErrors).toEqual([]);
});
