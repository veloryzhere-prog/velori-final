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
  route: "/campaign/spring",
  content: "",
  seo_title: "Published CMS About | VELORI",
  seo_description: "Published CMS description",
  og_title: null,
  og_description: null,
  hero_image: null,
  custom_html: "<p class='cms-marker'>Published CMS body</p><a href='/campaign/terms'>Terms</a>",
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

test("published dynamic CMS content replaces the loading state with matching HTML and CSS", async ({
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
    await allowCors(
      route,
      JSON.stringify(
        cmsPageFor("/campaign/spring", "Published CMS Campaign", "Published CMS body"),
      ),
    );
  });

  await page.goto("/campaign/spring");
  await cmsRequestStarted;
  await expect(page.getByRole("heading", { name: "Loading page…" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A little more human." })).toHaveCount(0);

  releaseCmsResponse();
  await expect(page.getByRole("heading", { name: "Published CMS Campaign" })).toBeVisible();
  const frame = page.frameLocator(".cms-public-custom-frame");
  await expect(frame.getByText("Published CMS body")).toBeVisible();
  await expect
    .poll(() => frame.locator(".cms-marker").evaluate((element) => getComputedStyle(element).color))
    .toBe("rgb(1, 2, 3)");
  await expect(page).toHaveTitle("Published CMS Campaign | VELORI");
});

test("a confirmed missing dynamic page uses the standard not-found screen", async ({ page }) => {
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

  await page.goto("/campaign/missing");

  await expect(page.locator(".not-found h1")).toBeVisible();
  expect(new URL(cmsRequestUrl).searchParams.get("status")).toBe("eq.published");
});

test("company hub links change route content and browser Back restores the prior page", async ({
  page,
}) => {
  await installPublicMocks(page);
  await page.goto("/us#about");
  await expect(page.getByRole("heading", { name: "About VELORYZ" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Company pages" })
    .getByRole("link", { name: "Terms" })
    .click();
  await expect(page).toHaveURL(/\/us#terms$/);
  await expect(page.getByRole("heading", { name: "Terms" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/us#about$/);
  await expect(page.getByRole("heading", { name: "About VELORYZ" })).toBeVisible();
});

test("Help uses the company hub while registered dynamic CMS routes remain published", async ({
  page,
}) => {
  await installPublicMocks(page);
  await page.route("**/rest/v1/cms_pages**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await allowCors(route, "", 204);
      return;
    }
    await allowCors(
      route,
      JSON.stringify(cmsPageFor("/campaign/spring", "Published Campaign", "Campaign body")),
    );
  });

  await page.goto("/help");
  await expect(page).toHaveURL(/\/us#help$/);
  await expect(page.getByRole("navigation", { name: "Company pages" })).toBeVisible();

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
    await allowCors(
      route,
      JSON.stringify(
        cmsPageFor("/campaign/spring", "Published CMS Campaign", "Published CMS body"),
      ),
    );
  });

  await page.goto("/campaign/spring");

  await expect(page.getByRole("alert")).toBeVisible({ timeout: 12_000 });
  await expect(page.getByRole("heading", { name: "Published CMS Campaign" })).toHaveCount(0);
  retryAllowed = true;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Published CMS Campaign" })).toBeVisible();
  expect(attempts).toBeGreaterThanOrEqual(2);
});
