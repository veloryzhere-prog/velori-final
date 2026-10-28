import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Admin panel audit.
 *
 * Walks every administrator screen as a disposable super administrator and
 * records, per screen, what a button's existence does NOT prove: HTTP status,
 * uncaught exceptions, console errors, failed requests, 4xx/5xx responses and
 * whether the panel actually rendered content rather than an empty shell.
 *
 * A screen that renders without error but shows nothing is reported as
 * `empty`, because that is the failure mode the brief is most concerned with.
 */

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
const env = {
  ...readEnv(`${ROOT}/.env.local`),
  ...readEnv(`${ROOT}/.env.secrets.local`),
};
const adminUsername = env.VELORI_QA_SUPER_ADMIN_USERNAME ?? "";
const adminPassword = env.VELORI_QA_SUPER_ADMIN_PASSWORD ?? "";
const qaAdminUsername = env.VELORI_QA_ADMIN_USERNAME ?? "";
const qaAdminPassword = env.VELORI_QA_ADMIN_PASSWORD ?? "";
const functionBase = `${(env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "")}/functions/v1/server`;

if (!adminUsername || !adminPassword) {
  throw new Error("VELORI_QA_SUPER_ADMIN_* credentials are missing from .env.secrets.local");
}

type Finding = {
  route: string;
  status: number;
  rendered: boolean;
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: string[];
  badResponses: string[];
};

async function signIn(page: Page): Promise<void> {
  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  await page
    .getByLabel(/username/i)
    .first()
    .fill(adminUsername);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(adminPassword);
  await page
    .getByRole("button", { name: /^sign in$/i })
    .first()
    .click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
}

const SCREENS = [
  // `/admin` has no screen of its own: ConsoleIndex redirects to /admin/dashboard.
  // Both are listed so the redirect itself is covered.
  "/admin",
  "/admin/dashboard",
  "/admin/website",
  "/admin/website/pages",
  "/admin/website/navigation",
  "/admin/website/footer",
  "/admin/website/seo",
  "/admin/website/about",
  "/admin/website/contact",
  "/admin/website/help",
  "/admin/website/terms",
  "/admin/website/privacy",
  "/admin/people",
  "/admin/users",
  "/admin/content",
  "/admin/posts",
  "/admin/comments",
  "/admin/reports",
  "/admin/messages",
  "/admin/reels",
  "/admin/stories",
  "/admin/brand",
  "/admin/brand-assets",
  "/admin/assets",
  "/admin/cms",
  "/admin/navigation",
  "/admin/routes",
  "/admin/moderation",
  "/admin/communication",
  "/admin/analytics",
  "/admin/errors",
  "/admin/maintenance",
  "/admin/logs",
  "/admin/branding",
  "/admin/animations",
  "/admin/motion",
  "/admin/error-pages",
  "/admin/theme",
  "/admin/announcements",
  "/admin/notifications",
  "/admin/ads",
  "/admin/groups",
  "/admin/settings",
  "/admin/platform",
  "/admin/feature-flags",
  "/admin/emails",
  "/admin/admins",
  "/admin/roles",
  "/admin/provisioning",
  "/admin/sessions",
  "/admin/audit",
  "/admin/system",
  "/admin/security",
  "/admin/not-a-real-screen",
];

test.describe("admin panel audit", () => {
  test("a wrong password is refused and does not create a session", async ({ page }) => {
    const res = await page.request.post(`${functionBase}/admin/login`, {
      data: { username: adminUsername, password: "definitely-not-the-password" },
    });
    console.log(`wrong password: HTTP ${res.status()}`);
    expect([401, 429]).toContain(res.status());
    const body = (await res.json().catch(() => ({}))) as { sessionToken?: string };
    expect(body.sessionToken, "a failed login issued a session token").toBeUndefined();
  });

  test("feature flags screen renders the consumed flag map", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/feature-flags", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Feature flags" })).toBeVisible();
    await expect(page.getByText("Flags this codebase reads")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Features" })).toHaveClass(/admin-is-active/);
    await expect(page.getByRole("cell", { name: "messaging_enabled" }).last()).toBeVisible();
  });

  test("administrator session survives a page reload", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
    const accountMenu = page.getByRole("button", { name: /Administrator menu for/ });
    await expect(accountMenu).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(accountMenu).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".admin-main")).not.toBeEmpty();
  });

  test("command center shows live metrics and checked platform health", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Good (morning|afternoon|evening),/ }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("region", { name: "Platform overview" }).getByText("Total users"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "System health" })).toBeVisible();
    await expect(page.locator(".admin-health-summary strong")).toHaveText(
      /^(All systems operational|Needs attention|Status unavailable|Status unknown)$/,
      {
        timeout: 30_000,
      },
    );
    await expect(page.locator(".admin-health-checks li")).toHaveCount(5, {
      timeout: 20_000,
    });
  });

  test("global search opens the matching user detail from Ctrl+K", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    const firstUser = (await page.locator("table tbody tr strong").first().textContent())?.trim();
    test.skip(!firstUser, "the live database has no user row to search");

    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
    const search = page.getByLabel("Search VELORI");
    await expect(search).toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(search).toBeFocused();
    await search.fill(firstUser!);
    const result = page.getByRole("option").filter({ hasText: firstUser! }).first();
    await expect(result, "global search did not return the existing user").toBeVisible({
      timeout: 20_000,
    });
    await result.click();
    await expect(page).toHaveURL(/\/admin\/users\?user=/);
    const detail = page.getByRole("dialog");
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Email", { exact: true })).toBeVisible();
  });

  test("the backend permits admin reads and denies administrator creation", async ({ page }) => {
    test.skip(!qaAdminUsername || !qaAdminPassword, "QA admin credentials are not configured");
    const login = await page.request.post(`${functionBase}/admin/login`, {
      data: { username: qaAdminUsername, password: qaAdminPassword },
    });
    expect(login.status(), "the QA administrator could not sign in").toBe(200);
    const session = (await login.json()) as { sessionToken?: string };
    expect(session.sessionToken).toBeTruthy();
    const headers = { Authorization: `Bearer ${session.sessionToken}` };
    const identityResponse = await page.request.get(`${functionBase}/admin/me`, { headers });
    const identity = (await identityResponse.json()) as {
      roleKey?: string;
      permissions?: string[];
    };
    expect(identity.roleKey).toBe("admin");

    try {
      const allowed = await page.request.get(`${functionBase}/admin/users`, { headers });
      expect(allowed.status(), "the admin role was denied its user-list permission").toBe(200);
      const denied = await page.request.post(`${functionBase}/admin/admins`, {
        headers,
        data: {},
      });
      expect(denied.status(), "the admin role reached administrator provisioning").toBe(403);
      const body = (await denied.json()) as { permission?: string };
      expect(body.permission).toBe("admins.create");
    } finally {
      await page.request.post(`${functionBase}/admin/logout`, { headers });
    }
  });

  test("mobile admin navigation opens, routes, and fits the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
    const width = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(width.content, "the admin shell overflows horizontally on mobile").toBeLessThanOrEqual(
      width.viewport,
    );

    await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.locator(".admin-sidebar").getByRole("navigation");
    await expect(navigation).toBeVisible();
    await navigation.getByRole("link", { name: "Social" }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    const afterRoute = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(
      afterRoute.content,
      "the admin users screen overflows horizontally on mobile",
    ).toBeLessThanOrEqual(afterRoute.viewport);

    for (const size of [
      { width: 768, height: 1024, label: "tablet" },
      { width: 1440, height: 900, label: "desktop" },
    ]) {
      await page.setViewportSize(size);
      const layout = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(
        layout.content,
        `the admin users screen overflows at ${size.label} width`,
      ).toBeLessThanOrEqual(layout.viewport);
    }
  });

  test("every administrator screen renders real content without application-owned errors", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await signIn(page);

    const findings: Finding[] = [];
    for (const route of SCREENS) {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      const badResponses: string[] = [];
      const onConsole = (m: import("@playwright/test").ConsoleMessage) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      };
      const onPageError = (e: Error) => pageErrors.push(e.message);
      const onFailed = (r: import("@playwright/test").Request) =>
        failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText ?? "?"}`);
      const onResponse = (r: import("@playwright/test").Response) => {
        if (r.status() >= 400)
          badResponses.push(`${r.status()} ${r.request().method()} ${r.url()}`);
      };
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onFailed);
      page.on("response", onResponse);

      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      // A redirect target must be allowed to settle, otherwise `/admin` reports
      // the empty frame it renders for a moment before navigating away.
      if (page.url().replace(/\/$/, "") !== route.replace(/\/$/, "")) {
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(750);
      }
      const main = page.locator("main, [role='main'], .console-main").first();
      const text = (await main.innerText().catch(() => "")).trim();
      const rendered = text.length > 0;

      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onFailed);
      page.off("response", onResponse);

      findings.push({
        route: `${route} -> ${new URL(page.url()).pathname}`,
        status: response?.status() ?? 0,
        rendered,
        pageErrors,
        consoleErrors,
        failedRequests,
        badResponses,
      });
      console.log(
        `${route} -> ${new URL(page.url()).pathname} status=${response?.status() ?? 0} rendered=${rendered} chars=${text.length} pageErrors=${pageErrors.length} console=${consoleErrors.length} failed=${failedRequests.length} bad=${badResponses.length}`,
      );
    }

    console.log("--- application-owned failures ---");
    for (const finding of findings) {
      for (const e of finding.pageErrors) console.log(`${finding.route} pageerror: ${e}`);
      for (const e of finding.consoleErrors) console.log(`${finding.route} console: ${e}`);
      for (const e of finding.failedRequests) console.log(`${finding.route} failed: ${e}`);
      for (const e of finding.badResponses) console.log(`${finding.route} bad: ${e}`);
    }

    const notRendered = findings.filter((f) => !f.rendered).map((f) => f.route);
    expect(notRendered, `screens that rendered nothing:\n${notRendered.join("\n")}`).toEqual([]);

    const nonOk = findings
      .filter((f) => f.status !== 200)
      .map((f) => `${f.route} HTTP ${f.status}`);
    expect(nonOk, `screens that did not return HTTP 200:\n${nonOk.join("\n")}`).toEqual([]);

    const crashed = findings
      .filter((f) => f.pageErrors.length || f.consoleErrors.length || f.failedRequests.length)
      .map((f) => f.route);
    expect(
      crashed,
      `screens with uncaught errors or failed requests:\n${crashed.join("\n")}`,
    ).toEqual([]);
  });

  test("logout revokes the administrator session", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/security", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Administrator menu for/ }).click();
    const logout = page.getByRole("button", { name: /^sign out$/i });
    await expect(logout, "logout is missing from the administrator account panel").toBeVisible();
    await logout.click();
    await page.waitForURL((url) => url.pathname.includes("/admin/login"), { timeout: 30_000 });
    await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    expect(page.url(), "the console was still reachable after logout").toContain("/admin/login");
  });

  test("an unauthenticated visitor cannot reach any administrator screen", async ({ page }) => {
    for (const route of ["/admin", "/admin/users", "/admin/system", "/admin/admins"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      expect(page.url(), `${route} was reachable without an administrator session`).toContain(
        "/admin/login",
      );
    }
  });
});
