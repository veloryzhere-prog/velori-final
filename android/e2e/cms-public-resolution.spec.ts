import { expect, test, type Page, type Route } from "@playwright/test";

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
  errorRules: [],
  errorPages: {},
  componentRules: [],
};

const settings = {
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
};

const publishedAboutPage = {
  title: "Published CMS About",
  slug: "about",
  route: "/about",
  content: "",
  seo_title: "Published CMS About | VELORI",
  seo_description: "Published CMS description",
  og_title: null,
  og_description: null,
  hero_image: null,
  custom_html: "<p class='cms-marker'>Published CMS body</p>",
  custom_css: ".cms-marker { color: rgb(1, 2, 3); }",
  content_mode: "custom_html",
  content_blocks: null,
};

function cmsPageFor(route: string, title: string, body: string) {
  const slug = route.split("/").filter(Boolean).join("-");
  return {
    ...publishedAboutPage,
    title,
    slug,
    route,
    seo_title: `${title} | VELORI`,
    custom_html: `<p class="cms-marker">${body}</p>`,
  };
}

async function allowCors(route: Route, body: string, status = 200) {
  const request = route.request();
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": request.headers().origin ?? "*",
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
      "access-control-allow-headers": request.headers()["access-control-request-headers"] ?? "*",
    },
    body,
  });
}

async function installPublicMocks(page: Page) {
  await page.route("**/rest/v1/site_settings**", (route) =>
    allowCors(route, JSON.stringify(settings)),
  );
  await page.route("**/rest/v1/rpc/get_published_motion_config", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await allowCors(route, "", 204);
      return;
    }
    await allowCors(route, JSON.stringify({ config: motionConfig, version: 1, publishedAt: null }));
  });
}

test("published CMS content replaces the loading state with matching HTML and CSS", async ({
  page,
}) => {
  await installPublicMocks(page);
  let releaseCmsResponse!: () => void;
  let signalCmsRequest!: () => void;
  const cmsResponseGate = new Promise<void>((resolve) => {
    releaseCmsResponse = resolve;
  });
  const cmsRequestStarted = new Promise<void>((resolve) => {
    signalCmsRequest = resolve;
  });

  await page.route("**/rest/v1/cms_pages**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await allowCors(route, "", 204);
      return;
    }
    signalCmsRequest();
    await cmsResponseGate;
    await allowCors(route, JSON.stringify(publishedAboutPage));
  });

  await page.goto("/about");
  await cmsRequestStarted;
  await expect(page.getByRole("heading", { name: "Loading page…" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A little more human." })).toHaveCount(0);

  releaseCmsResponse();
  await expect(page.getByRole("heading", { name: "Published CMS About" })).toBeVisible();
  const frame = page.frameLocator(".cms-public-custom-frame");
  await expect(frame.getByText("Published CMS body")).toBeVisible();
  await expect
    .poll(() => frame.locator(".cms-marker").evaluate((element) => getComputedStyle(element).color))
    .toBe("rgb(1, 2, 3)");
  await expect(page).toHaveTitle("Published CMS About | VELORI");
});

test("a confirmed missing page uses its documented built-in fallback", async ({ page }) => {
  await installPublicMocks(page);
  let cmsRequestUrl = "";
  await page.route("**/rest/v1/cms_pages**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await allowCors(route, "", 204);
      return;
    }
    cmsRequestUrl = route.request().url();
    await allowCors(route, "[]");
  });

  await page.goto("/about");

  await expect(page.getByRole("heading", { name: "A little more human." })).toBeVisible();
  expect(new URL(cmsRequestUrl).searchParams.get("status")).toBe("eq.published");
});

test("route changes do not show the old page and back navigation uses the route cache", async ({
  page,
}) => {
  await installPublicMocks(page);
  let releaseTerms!: () => void;
  let signalTermsRequest!: () => void;
  const termsResponseGate = new Promise<void>((resolve) => {
    releaseTerms = resolve;
  });
  const termsRequestStarted = new Promise<void>((resolve) => {
    signalTermsRequest = resolve;
  });
  const requestCounts = new Map<string, number>();

  await page.route("**/rest/v1/cms_pages**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await allowCors(route, "", 204);
      return;
    }
    const routeFilter = new URL(route.request().url()).searchParams.get("route") ?? "";
    const cmsRoute = routeFilter.replace(/^eq\./, "");
    requestCounts.set(cmsRoute, (requestCounts.get(cmsRoute) ?? 0) + 1);
    if (cmsRoute === "/terms") {
      signalTermsRequest();
      await termsResponseGate;
      await allowCors(
        route,
        JSON.stringify(cmsPageFor("/terms", "Published CMS Terms", "Terms body")),
      );
      return;
    }
    await allowCors(route, JSON.stringify(publishedAboutPage));
  });

  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Published CMS About" })).toBeVisible();
  await page.getByRole("link", { name: "Terms" }).click();
  await termsRequestStarted;
  await expect(page.getByRole("heading", { name: "Loading page…" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Published CMS About" })).toHaveCount(0);

  releaseTerms();
  await expect(page.getByRole("heading", { name: "Published CMS Terms" })).toBeVisible();
  const aboutRequestsBeforeBack = requestCounts.get("/about");
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { name: "Published CMS About" })).toBeVisible();
  expect(requestCounts.get("/about")).toBe(aboutRequestsBeforeBack);
});

test("Help and unregistered routes use the same pending and published CMS resolution", async ({
  page,
}) => {
  await installPublicMocks(page);
  let releaseHelp!: () => void;
  let signalHelpRequest!: () => void;
  const helpResponseGate = new Promise<void>((resolve) => {
    releaseHelp = resolve;
  });
  const helpRequestStarted = new Promise<void>((resolve) => {
    signalHelpRequest = resolve;
  });

  await page.route("**/rest/v1/cms_pages**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await allowCors(route, "", 204);
      return;
    }
    const routeFilter = new URL(route.request().url()).searchParams.get("route") ?? "";
    const cmsRoute = routeFilter.replace(/^eq\./, "");
    if (cmsRoute === "/help") {
      signalHelpRequest();
      await helpResponseGate;
      await allowCors(
        route,
        JSON.stringify(cmsPageFor("/help", "Published CMS Help", "Help body")),
      );
      return;
    }
    await allowCors(
      route,
      JSON.stringify(cmsPageFor("/campaign/spring", "Published Campaign", "Campaign body")),
    );
  });

  await page.goto("/help");
  await helpRequestStarted;
  await expect(page.getByRole("heading", { name: "Loading page…" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How can we help?" })).toHaveCount(0);
  releaseHelp();
  await expect(page.getByRole("heading", { name: "Published CMS Help" })).toBeVisible();

  await page.goto("/campaign/spring");
  await expect(page.getByRole("heading", { name: "Published Campaign" })).toBeVisible();
  await expect(
    page.frameLocator(".cms-public-custom-frame").getByText("Campaign body"),
  ).toBeVisible();
  await expect(page.locator(".not-found")).toHaveCount(0);
});

test("CMS request errors stay visible, do not fall back, and can be retried", async ({ page }) => {
  test.setTimeout(45_000);
  await installPublicMocks(page);
  let attempts = 0;
  let retryAllowed = false;
  await page.route("**/rest/v1/cms_pages**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await allowCors(route, "", 204);
      return;
    }
    attempts += 1;
    if (!retryAllowed) {
      await route.abort("failed");
      return;
    }
    await allowCors(route, JSON.stringify(publishedAboutPage));
  });

  await page.goto("/about");

  await expect(page.getByRole("alert")).toBeVisible({ timeout: 12_000 });
  await expect(page.getByRole("heading", { name: "A little more human." })).toHaveCount(0);
  retryAllowed = true;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Published CMS About" })).toBeVisible();
  expect(attempts).toBeGreaterThanOrEqual(2);
});
