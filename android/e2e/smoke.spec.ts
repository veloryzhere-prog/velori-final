import { expect, test } from "@playwright/test";

async function disableMaintenanceForTest(page: import("@playwright/test").Page) {
  await page.route("**/rest/v1/site_settings**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: true,
        site_name: "VELORI",
        site_title: "VELORI",
        logo_url: "",
        favicon_url: null,
        contact_email: null,
        contact_phone: null,
        website_url: null,
        footer_text: "VELORI",
        announcement_text: "",
        maintenance_mode: false,
        maintenance_scope: "site",
        maintenance_route: null,
        error_404_enabled: true,
        startup_animation_url: null,
        error_animation_url: null,
        maintenance_animation_url: null,
        homepage_kicker: "YOUR SPACE TO CONNECT",
        theme_accent: "rose",
        updated_at: "2026-10-04T00:00:00.000Z",
      }),
    });
  });
}

test("VELORI app shell renders", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const badResponses: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(`console.error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(`pageerror: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response, "navigation to / produced no response").not.toBeNull();
  expect(response?.status(), "navigation to / was not HTTP 200").toBe(200);

  const root = page.locator("#root");
  await expect(root, "#root was never attached to the document").toBeAttached();
  await expect(root, "#root rendered no markup, the app shell is empty").not.toBeEmpty();

  console.log(`console errors (${consoleErrors.length}):`);
  for (const entry of consoleErrors) console.log(`  ${entry}`);
  console.log(`failed requests (${failedRequests.length}):`);
  for (const entry of failedRequests) console.log(`  ${entry}`);
  console.log(`4xx/5xx responses (${badResponses.length}):`);
  for (const entry of badResponses) console.log(`  ${entry}`);

  expect(
    badResponses,
    `the app shell loaded with 4xx/5xx responses:\n${badResponses.join("\n")}`,
  ).toEqual([]);
});

test("light is the default appearance, while saved theme choices are respected", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");

  await page.evaluate(() => localStorage.setItem("velori-theme", "dark"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");

  await page.evaluate(() => localStorage.setItem("velori-theme", "system"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("signed-out visitors get the entry page, never the social app", async ({ page }) => {
  await disableMaintenanceForTest(page);
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const badResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "unknown";
    // Account-only SPA routes can be canceled as React Router redirects a
    // signed-out visitor to login; that navigation cancellation is expected.
    if (reason !== "net::ERR_ABORTED") {
      failedRequests.push(`${request.method()} ${request.url()} :: ${reason}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });

  // Public destinations keep the minimal entry page, rather than exposing
  // private social content to a visitor without a session.
  for (const route of ["/", "/home", "/profile/someone"]) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route} did not load`).toBe(200);
    await expect(
      page.getByRole("link", { name: "Create account" }),
      `${route} did not show the visitor entry page`,
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  }

  await page.goto("/this-route-does-not-exist", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".not-found")).toBeVisible();
  await expect(page.locator(".not-found h1")).toBeVisible();

  // Account-only destinations redirect to login and preserve the requested
  // internal path, query, and hash for a successful sign-in.
  for (const route of [
    "/stories",
    "/stories?story=11111111-1111-4111-8111-111111111111",
    "/reels",
    "/reels?reel=22222222-2222-4222-8222-222222222222&comment=33333333-3333-4333-8333-333333333333",
    "/messages?to=someone#latest",
    "/messages?conversation=44444444-4444-4444-8444-444444444444&message=55555555-5555-4555-8555-555555555555",
    "/groups",
    "/settings",
    "/settings/account",
    "/notifications",
    "/create",
    "/saved",
  ]) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route} did not load`).toBe(200);
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => window.history.state?.usr?.from)).toBe(route);
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
  }

  // The auth flows stay reachable and render standalone, without shell chrome.
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Find your place here/i })).toBeVisible();

  expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toEqual([]);
  expect(failedRequests, `failed requests: ${failedRequests.join("\n")}`).toEqual([]);
  expect(badResponses, `bad responses: ${badResponses.join("\n")}`).toEqual([]);
});

test("public information pages keep social navigation out of the visitor experience", async ({
  page,
}) => {
  await disableMaintenanceForTest(page);
  for (const route of [
    "/about",
    "/privacy",
    "/terms",
    "/community-guidelines",
    "/safety",
    "/help",
    "/cookies",
    "/acceptable-use",
    "/data-policy",
    "/legal",
    "/contact",
  ]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("main h1").first(),
      `${route} did not render a page heading`,
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Search anything" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Notifications" })).toHaveCount(0);
  }
  await expect(page.locator(".public-content-footer a")).toHaveCount(11);
});

test("visitor entry page fits a small mobile viewport", async ({ page }) => {
  await disableMaintenanceForTest(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: /Make space for real connection/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByText("87% happy", { exact: true })).toHaveCount(0);
  await expect(page.getByText("4 new updates", { exact: true })).toHaveCount(0);
  for (const fabricatedContent of [
    "Emma Davis",
    "12.4K",
    "2.4K",
    "342",
    "126",
    "#TravelDays",
    "#GoodVibes",
  ]) {
    await expect(page.getByText(fabricatedContent, { exact: true })).toHaveCount(0);
  }
  await expect(page.locator(".landing-artboard")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("invalid member credentials show a clear sign-in error", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill("velori-qa-invalid-20261003@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("NotARealPassword123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "The email or password is incorrect. Please try again.",
  );
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("We couldn't load this right now.", { exact: true })).toHaveCount(0);
});

test("invalid administrator credentials reach the service and stay on admin sign-in", async ({
  page,
}) => {
  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username").fill("velori-qa-invalid");
  await page.getByLabel("Password", { exact: true }).fill("NotARealPassword123!");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    /^(The username or password is incorrect\.|Too many failed attempts\. Try again later\.)$/,
  );
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("page maintenance uses its published experience ahead of error fallbacks", async ({
  page,
}) => {
  const motionConfig = {
    schemaVersion: 1,
    global: {
      enabled: true,
      intensity: "standard",
      speed: "normal",
      transitionPreset: "page-crossfade",
      transitionDurationMs: 180,
      ambientEnabled: false,
      reducedMotion: "respect",
    },
    theme: {
      brandPink: "#ed9bb7",
      brandBlue: "#aac2ed",
      surface: "#ffffff",
      background: "#fbfafb",
      text: "#19243b",
      darkSurface: "#1a2539",
      darkBackground: "#101726",
      darkText: "#f5f7fd",
    },
    pageRules: [],
    pageExperiences: [
      {
        route: "/maintenance",
        enabled: true,
        maintenance: {
          enabled: true,
          preset: "pulse",
          title: "Page-specific maintenance",
          message: "Page-specific service window.",
        },
        error: {
          enabled: true,
          preset: "fade",
          title: "Wrong page error",
        },
      },
    ],
    errorRules: [
      {
        id: "maintenance-global-error",
        ruleType: "exact",
        routePattern: "/maintenance",
        errorType: "MAINTENANCE",
        preset: "fade-down",
      },
    ],
    errorPages: {
      MAINTENANCE: {
        title: "Global error title",
        subtitle: "Global error message.",
        preset: "scale-soft",
      },
    },
    componentRules: [],
  };

  await page.route("**/rest/v1/rpc/get_published_motion_config", async (route) => {
    const request = route.request();
    const origin = request.headers().origin ?? "http://localhost:8443";
    const corsHeaders = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers":
        request.headers()["access-control-request-headers"] ??
        "apikey, authorization, content-type",
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify({ config: motionConfig, version: 42, publishedAt: null }),
    });
  });

  await page.goto("/maintenance");
  await expect(page.getByRole("heading", { name: "Page-specific maintenance" })).toBeVisible();
  await expect(page.getByText("Page-specific service window.")).toBeVisible();
  await expect(page.locator(".maintenance-page")).toHaveAttribute("data-motion-preset", "pulse");
  await expect(page.getByText("Wrong page error")).toHaveCount(0);
});
