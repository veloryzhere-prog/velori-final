import { expect, test } from "@playwright/test";

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
  pageExperiences: [],
  errorRules: [
    {
      id: "missing-profile",
      ruleType: "exact",
      routePattern: "/this-route-does-not-exist",
      errorType: "NOT_FOUND",
      preset: "fade",
      title: "This route has moved",
      subtitle: "Open the people directory to find another profile.",
      primaryLabel: "Browse people",
      primaryUrl: "/people",
      assetUrl: "/storage/v1/object/public/site-assets/errors/profile.svg",
    },
  ],
  errorPages: {
    NOT_FOUND: {
      title: "Global not-found title",
      subtitle: "Global not-found copy.",
      primaryLabel: "Home",
      primaryUrl: "/home",
      secondaryLabel: "",
      secondaryUrl: "",
      logoUrl: "",
      preset: "error-reveal",
      durationMs: 260,
      intensity: "standard",
      layout: "centered",
      alignment: "center",
      illustrationUrl: "",
      backgroundColor: "",
      enabled: true,
    },
  },
  componentRules: [],
};

async function mockSettings(page: import("@playwright/test").Page, settings: object) {
  await page.route("**/rest/v1/site_settings**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(settings),
    });
  });
}

async function mockMotion(page: import("@playwright/test").Page, config: object = motionConfig) {
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
      body: JSON.stringify({ config, version: 42, publishedAt: null }),
    });
  });
}

test("public error screens use the matching route rule content", async ({ page }) => {
  await mockSettings(page, {
    id: true,
    site_name: "VELORI",
    site_title: "VELORI",
    logo_url: "",
    maintenance_mode: false,
    maintenance_scope: "site",
    maintenance_route: null,
    maintenance_starts_at: null,
    maintenance_ends_at: null,
    error_404_enabled: true,
    error_animation_url: null,
    maintenance_animation_url: null,
    startup_animation_url: null,
  });
  await mockMotion(page);
  await page.route("**/rest/v1/cms_pages**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/storage/v1/object/public/site-assets/errors/profile.svg", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>',
    });
  });

  await page.goto("/this-route-does-not-exist");

  await expect(page.getByRole("heading", { name: "This route has moved" })).toBeVisible();
  await expect(page.getByText("Open the people directory to find another profile.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse people" })).toHaveAttribute(
    "href",
    "/people",
  );
  await expect(page.locator(".not-found-art img")).toHaveAttribute(
    "src",
    "/storage/v1/object/public/site-assets/errors/profile.svg",
  );
});

test("reduced motion keeps an error page static and usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockSettings(page, {
    id: true,
    site_name: "VELORI",
    site_title: "VELORI",
    logo_url: "",
    maintenance_mode: false,
    maintenance_scope: "site",
    maintenance_route: null,
    maintenance_starts_at: null,
    maintenance_ends_at: null,
    error_404_enabled: true,
    error_animation_url: null,
    maintenance_animation_url: null,
    startup_animation_url: null,
  });
  await mockMotion(page, {
    ...motionConfig,
    errorRules: motionConfig.errorRules.map((rule) => ({
      ...rule,
      assetUrl: "/storage/v1/object/public/site-assets/errors/profile.mp4",
    })),
  });
  await page.route("**/rest/v1/cms_pages**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/this-route-does-not-exist");

  await expect(page.getByRole("heading", { name: "This route has moved" })).toBeVisible();
  await expect(page.locator(".not-found-art img")).toBeVisible();
  await expect(page.locator(".not-found-art video")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("scheduled maintenance targets its route group and displays an end countdown", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const startsAt = new Date(Date.now() - 60_000).toISOString();
  const endsAt = new Date(Date.now() + 5 * 60_000).toISOString();
  await mockSettings(page, {
    id: true,
    site_name: "VELORI",
    site_title: "VELORI",
    logo_url: "",
    maintenance_mode: true,
    maintenance_scope: "group",
    maintenance_route: "/messages/*",
    maintenance_starts_at: startsAt,
    maintenance_ends_at: endsAt,
    error_404_enabled: true,
    error_animation_url: null,
    maintenance_animation_url: null,
    startup_animation_url: null,
  });
  await mockMotion(page);

  const settingsResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/rest/v1/site_settings") && response.ok(),
  );
  await page.goto("/messages");
  await settingsResponse;
  await expect(page.locator(".maintenance-page")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("timer")).toContainText("Scheduled maintenance ends in");

  await page.goto("/groups");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".maintenance-page")).toHaveCount(0);
});
