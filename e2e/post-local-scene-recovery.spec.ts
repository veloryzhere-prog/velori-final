import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

function readSecrets() {
  return Object.fromEntries(
    readFileSync(
      "C:/Users/aryan/Downloads/VELORI Platform Upgrade Audit (1)/.env.secrets.local",
      "utf8",
    )
      .split(/\r?\n/)
      .flatMap((line) => {
        const index = line.indexOf("=");
        return index > 0
          ? [
              [
                line.slice(0, index).trim(),
                line
                  .slice(index + 1)
                  .trim()
                  .replace(/^"|"$/g, ""),
              ],
            ]
          : [];
      }),
  );
}

async function signIn(page: Page) {
  const secrets = readSecrets();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(secrets.VELORI_QA_OWNER_EMAIL);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(secrets.VELORI_QA_OWNER_PASSWORD);
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

test("post canvas scene changes recover after reload on the same device", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  const canvas = page.locator(".post-studio-canvas-frame canvas");
  await expect(canvas).toBeVisible();

  await page.getByRole("button", { name: "Delete Post text" }).click();
  const saved = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("velori-post-draft:"));
    if (!key) return null;
    const draft = JSON.parse(localStorage.getItem(key) ?? "null");
    return draft?.canvas_layers_by_slide?.["post-body"]?.length ?? null;
  });
  expect(saved).toBe(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(canvas).toBeVisible();
  await expect(
    page.locator(".post-studio-layer-panel").getByText("0", { exact: true }),
  ).toBeVisible();
  const restoredAndMoved = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("velori-post-draft:"));
    if (!key) return null;
    const draft = JSON.parse(localStorage.getItem(key) ?? "null");
    return draft?.canvas_layers_by_slide?.["post-body"]?.length ?? null;
  });
  expect(restoredAndMoved).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});
