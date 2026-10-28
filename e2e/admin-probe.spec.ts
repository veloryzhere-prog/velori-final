import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

function readEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}
const ROOT = "C:/Users/aryan/Downloads/VELORI Platform Upgrade Audit (1)";
const env = { ...readEnv(`${ROOT}/.env.local`), ...readEnv(`${ROOT}/.env.secrets.local`) };

test("capture feature-flags and overview payloads exactly as the browser sees them", async ({
  page,
}) => {
  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/username/i).first().fill(env.VELORI_QA_SUPER_ADMIN_USERNAME!);
  await page.getByLabel(/password/i).first().fill(env.VELORI_QA_SUPER_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: /^sign in$/i }).first().click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });

  const captured: { url: string; status: number; body: string }[] = [];
  page.on("response", async (r) => {
    const url = r.url();
    if (!url.includes("/functions/v1/server/admin/")) return;
    if (!/feature-flags|overview|\/me\b/.test(url)) return;
    let body = "";
    try {
      body = (await r.text()).slice(0, 500);
    } catch {
      body = "<unreadable>";
    }
    captured.push({ url: url.replace(/^.*\/admin/, "/admin"), status: r.status(), body });
  });

  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.stack ?? e.message}`));

  await page.goto("/admin/feature-flags", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  console.log("=== captured admin payloads ===");
  for (const c of captured) console.log(`${c.status} ${c.url}\n    ${c.body}`);
  console.log("=== console ===");
  for (const e of errors) console.log(e.slice(0, 1500));

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const dashText = await page.locator("body").innerText();
  console.log(`=== dashboard body (${dashText.length} chars) ===`);
  console.log(dashText.slice(0, 1200));
  expect(true).toBe(true);
});
