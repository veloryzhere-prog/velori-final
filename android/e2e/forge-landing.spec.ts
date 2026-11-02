import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
const screenshots = resolve(process.cwd(), "PHASE1_SCREENSHOTS");

test("FORGE landing themes, sections, and responsive widths render without overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseURL}/forge`);
  await expect(page.getByRole("heading", { name: /Your ideas.*Built with FORGE/ })).toBeVisible();
  const motionTip = page.getByRole("button", { name: "Dismiss motion tip" });
  if (await motionTip.isVisible().catch(() => false)) await motionTip.click();
  await expect(page.getByLabel("Describe what you want to create")).toBeVisible();

  await page.getByLabel("Appearance").selectOption("aurora");
  await expect(page.locator(".forge-landing")).toHaveAttribute("data-forge-theme", "aurora");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(screenshots, "aurora-desktop.png") });
  await page.getByLabel("Appearance").selectOption("ivory");
  await expect(page.locator(".forge-landing")).toHaveAttribute("data-forge-theme", "ivory");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(screenshots, "ivory-desktop.png") });
  await page.reload();
  await expect(page.locator(".forge-landing")).toHaveAttribute("data-forge-theme", "ivory");

  await page.locator(".forge-nav").getByRole("link", { name: "Features" }).click();
  await expect(page).toHaveURL(/#features$/);
  const faq = page.locator(".forge-faq-list details").first();
  await faq.locator("summary").click();
  await expect(faq).toHaveAttribute("open", "");

  for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: "Open navigation menu" });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Explore FORGE" });
  await expect(drawer).toBeVisible();
  await page.locator(".forge-mobile-theme select").selectOption("aurora");
  await expect(page.locator(".forge-landing")).toHaveAttribute("data-forge-theme", "aurora");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(drawer).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(screenshots, "aurora-mobile.png") });

  await trigger.click();
  await page.locator(".forge-mobile-theme select").selectOption("ivory");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(screenshots, "ivory-mobile.png") });
  await expect(page.locator(".forge-landing")).toHaveAttribute("data-forge-theme", "ivory");
  expect(errors.filter((error) => /velori-studio|Transform failed|Uncaught/i.test(error))).toEqual(
    [],
  );
});

test("logged-out prompt submission preserves a bounded draft and requires login", async ({
  page,
}) => {
  const generationRequests: string[] = [];
  page.on("request", (request) => {
    if (/velori-studio|\/generate|\/converse/.test(request.url()))
      generationRequests.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/forge`);
  const prompt = "Create an interactive neighborhood reading garden.";
  await page.getByLabel("Describe what you want to create").fill(prompt);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await page.getByRole("button", { name: "Sign in to continue" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  const draft = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("velori.forge.landing-draft.v1") ?? "null"),
  );
  expect(draft).toMatchObject({ prompt, mode: "ask", version: 1 });
  expect(draft).not.toHaveProperty("accessToken");
  expect(draft).not.toHaveProperty("password");
  expect(await page.evaluate(() => localStorage.getItem("velori.artifacts.v1.visitor"))).toBeNull();
  expect(generationRequests).toEqual([]);
});

test("FORGE renders an eligible announcement campaign from the existing campaign pipeline", async ({
  page,
  browser,
}) => {
  const campaign = {
    id: "forge-entry-test-v1",
    title: "Welcome to FORGE AI",
    message:
      "Explore the verified options available to your account. No reward is granted by viewing this message.",
    active: true,
    dismissible: true,
    display_mode: "modal",
    action_type: "link",
    link: "/forge/pricing",
    cta_label: "Explore plans",
    target_route: "/forge",
    frequency_mode: "once_total",
    max_show_count: 1,
    starts_at: "2026-10-01T00:00:00.000Z",
    ends_at: "2026-11-01T00:00:00.000Z",
  };
  await page.route("**/rest/v1/system_announcements**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([campaign]),
    }),
  );
  await page.route("**/rest/v1/rpc/record_system_announcement_event**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/forge`);

  const dialog = page.getByRole("dialog", { name: campaign.title });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog.evaluate((element) =>
        element.getAnimations().some((animation) => animation.playState === "running"),
      ),
    )
    .toBe(false);
  await expect(dialog.getByText(campaign.message)).toBeVisible();
  await expect(dialog).toHaveCSS("position", "relative");
  await expect(page.locator(".cp-announcement-overlay")).toHaveCSS("z-index", "95000");
  await page.screenshot({ path: resolve(process.cwd(), "PHASE3_SCREENSHOTS", "offer-mobile.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.screenshot({
    path: resolve(process.cwd(), "PHASE3_SCREENSHOTS", "offer-dismissed-mobile.png"),
  });

  await page.reload();
  await expect(page.getByRole("dialog", { name: campaign.title })).toHaveCount(0);
  await page
    .getByLabel("Describe what you want to create")
    .fill("Create a local-first reading garden.");
  await page.getByRole("button", { name: "Sign in to continue" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  const draft = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("velori.forge.landing-draft.v1") ?? "null"),
  );
  expect(draft).toMatchObject({ prompt: "Create a local-first reading garden.", mode: "build" });

  const ctaContext = await browser.newContext();
  const ctaPage = await ctaContext.newPage();
  await ctaPage.route("**/rest/v1/system_announcements**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([campaign]),
    }),
  );
  await ctaPage.route("**/rest/v1/rpc/record_system_announcement_event**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
  );
  await ctaPage.goto(`${baseURL}/forge`);
  await ctaPage.setViewportSize({ width: 1440, height: 900 });
  const desktopOffer = ctaPage.getByRole("dialog", { name: campaign.title });
  await expect
    .poll(() =>
      desktopOffer.evaluate((element) =>
        element.getAnimations().some((animation) => animation.playState === "running"),
      ),
    )
    .toBe(false);
  await ctaPage.screenshot({
    path: resolve(process.cwd(), "PHASE3_SCREENSHOTS", "offer-desktop.png"),
  });
  await desktopOffer.getByRole("link", { name: "Explore plans" }).click();
  await expect(ctaPage).toHaveURL(/\/forge\/pricing$/);
  await ctaContext.close();
});

test("FORGE does not invent an offer when no campaign is returned", async ({ page }) => {
  await page.route("**/rest/v1/system_announcements**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/forge`);
  await expect(page.getByRole("heading", { name: /Your ideas.*Built with FORGE/ })).toBeVisible();
  await expect(page.locator(".cp-announcement-overlay")).toHaveCount(0);
});

test("authenticated setup saves a local project and opens the editor without generating", async ({
  page,
}) => {
  const prompt = "Create an API for a neighborhood book exchange.";
  const user = {
    id: "9cfa98ab-57a8-4e56-9fd0-1f93ae2a0a11",
    aud: "authenticated",
    role: "authenticated",
    email: "forge-setup-e2e@example.invalid",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-10-27T00:00:00.000Z",
  };
  const generationRequests: string[] = [];
  page.on("request", (request) => {
    if (/velori-studio|\/generate|\/converse/.test(request.url()))
      generationRequests.push(request.url());
  });
  await page.route("**/rest/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/rest/v1/system_announcements**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const accessToken = `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), email: user.email })}.e2e`;
  await page.route("**/auth/v1/user**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }),
  );
  await page.route("**/functions/v1/velori-studio**", async (route) => {
    const body = route.request().postDataJSON() as { action?: string };
    if (body.action === "status")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cloud: false, generation: false }),
      });
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not part of this test" }),
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/forge`);
  const motionTip = page.getByRole("button", { name: "Dismiss motion tip" });
  if (await motionTip.isVisible().catch(() => false))
    await motionTip.evaluate((button) => (button as HTMLButtonElement).click());
  const sessionUserId = await page.evaluate(
    async ({ token, testUser }) => {
      const loadModule = new Function("path", "return import(path)") as (path: string) => Promise<{
        supabase: {
          auth: {
            setSession: (value: object) => Promise<{ error: Error | null }>;
            getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }>;
          };
        };
      }>;
      const { supabase } = await loadModule("/src/lib/supabase.ts");
      const { error } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: "browser-test-only",
      });
      if (error) throw error;
      if (testUser.id !== "9cfa98ab-57a8-4e56-9fd0-1f93ae2a0a11")
        throw new Error("Unexpected test user");
      return (await supabase.auth.getSession()).data.session?.user.id ?? null;
    },
    { token: accessToken, testUser: user },
  );
  expect(sessionUserId).toBe(user.id);
  await expect(page.getByRole("button", { name: "Continue to build" })).toBeVisible();
  await page.getByLabel("Describe what you want to create").fill(prompt);
  await page.getByRole("button", { name: "Continue to build" }).click();
  await expect(page).toHaveURL(/\/forge\/projects\/new$/);
  await expect(page.getByRole("heading", { name: "Project identity" })).toBeVisible();

  await page.getByLabel("Project name").fill("Neighborhood Exchange API");
  await expect(page.getByLabel("Project name")).toHaveValue("Neighborhood Exchange API");
  await page.screenshot({
    path: resolve(process.cwd(), "PHASE3_SCREENSHOTS", "project-identity-mobile.png"),
  });
  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved on this device.");
  const savedSetupDraft = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([key]) => key.startsWith("velori.forge.setup.v1."))
      .map(([key, value]) => ({ key, value: JSON.parse(value) })),
  );
  expect(savedSetupDraft[0]?.value).toMatchObject({ title: "Neighborhood Exchange API" });
  await page.goto(`${baseURL}/forge`);
  await page.goto(`${baseURL}/forge/projects/new`);
  await page.getByRole("button", { name: "Resume draft" }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("Neighborhood Exchange API");
  for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Backend API").check();
  await page.getByRole("radio", { name: /Python \+ FastAPI/ }).check();
  await page.screenshot({
    path: resolve(process.cwd(), "PHASE3_SCREENSHOTS", "framework-mobile.png"),
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.screenshot({
    path: resolve(process.cwd(), "PHASE3_SCREENSHOTS", "design-mobile.png"),
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.screenshot({
    path: resolve(process.cwd(), "PHASE3_SCREENSHOTS", "ai-preferences-mobile.png"),
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Source and ZIP export; Python server execution unavailable"),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(process.cwd(), "PHASE3_SCREENSHOTS", "setup-review-mobile.png"),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: resolve(process.cwd(), "PHASE3_SCREENSHOTS", "setup-review-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]+$/);
  const projectIdForLayout = new URL(page.url()).pathname.split("/").at(-1);
  await expect(page.getByLabel("Describe what to build")).toHaveValue(prompt);
  await page.screenshot({
    path: resolve(process.cwd(), "PHASE3_SCREENSHOTS", "editor-entry-mobile.png"),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: resolve(process.cwd(), "PHASE4_SCREENSHOTS", "desktop-chat.png"),
  });
  const desktopColumns = await page.evaluate(() => {
    const left = document.querySelector(".vf-explorer")!.getBoundingClientRect();
    const chat = document.querySelector(".vf-assistant")!.getBoundingClientRect();
    const development = document.querySelector(".vf-development")!.getBoundingClientRect();
    return { explorer: left.x, chat: chat.x, development: development.x };
  });
  expect(desktopColumns.explorer).toBeLessThan(desktopColumns.chat);
  expect(desktopColumns.chat).toBeLessThan(desktopColumns.development);
  await page.getByRole("tab", { name: /Code/ }).click();
  await page.screenshot({
    path: resolve(process.cwd(), "PHASE4_SCREENSHOTS", "desktop-code.png"),
  });
  await page.getByRole("tab", { name: "Preview" }).click();
  await page.screenshot({
    path: resolve(process.cwd(), "PHASE4_SCREENSHOTS", "desktop-python-preview-blocked.png"),
  });
  await page.locator(".vf-layout-menu > summary").click();
  const explorerWidthSlider = page.locator(".vf-layout-menu input[type=range]").first();
  await explorerWidthSlider.focus();
  await explorerWidthSlider.press("End");
  for (let step = 0; step < 4; step += 1) await explorerWidthSlider.press("ArrowLeft");
  await expect
    .poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem(`velori.forge.layout.v1.${id}`) ?? "{}").explorerWidth, projectIdForLayout))
    .toBe(300);
  await page.setViewportSize({ width: 390, height: 844 });
  const workspaceNav = page.getByRole("navigation", { name: "Workspace views" });
  await expect(workspaceNav.getByRole("button")).toHaveCount(5);
  await workspaceNav.getByRole("button", { name: "Chat" }).click();
  await page.getByLabel("Describe what to build").fill("Add a compact status banner.");
  await workspaceNav.getByRole("button", { name: "Files" }).click();
  await expect(page.getByRole("complementary", { name: "Project explorer" })).toBeVisible();
  await page.getByRole("button", { name: "Folder", exact: true }).click();
  const createFolderDialog = page.getByRole("dialog", { name: "Create folder" });
  await createFolderDialog.getByLabel("Folder path").fill("notes");
  await createFolderDialog.getByRole("button", { name: "Create folder" }).click();
  await expect(page.locator(".vf-explorer-folder").getByText("notes")).toBeVisible();
  await page.getByLabel("Search project files").fill("main.py");
  await expect(page.getByRole("button", { name: "main.py", exact: true })).toBeVisible();
  await page.locator(".vf-explorer-row").filter({ hasText: "main.py" }).locator("summary").click();
  await page.getByRole("button", { name: "duplicate", exact: true }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Duplicate source file" });
  await duplicateDialog.getByLabel("Project-relative path").fill("main-copy.py");
  await duplicateDialog.getByRole("button", { name: "Duplicate", exact: true }).click();
  await page.getByRole("button", { name: "main.py", exact: true }).click();
  await expect(page.getByLabel("main.py source code")).toBeVisible();
  await page.screenshot({ path: resolve(process.cwd(), "PHASE4_SCREENSHOTS", "mobile-files.png") });
  await workspaceNav.getByRole("button", { name: "Code" }).click();
  await expect(page.getByLabel(/source code/)).toBeVisible();
  await page.screenshot({ path: resolve(process.cwd(), "PHASE4_SCREENSHOTS", "mobile-code.png") });
  await workspaceNav.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { name: "Python execution is unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No Python process is running" })).toBeVisible();
  await workspaceNav.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByRole("region", { name: "Project activity" })).toBeVisible();
  await workspaceNav.getByRole("button", { name: "Chat" }).click();
  await expect(page.getByLabel("Describe what to build")).toHaveValue("Add a compact status banner.");
  expect(generationRequests.filter((url) => /generate|converse/.test(url))).toEqual([]);
  const projectExists = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("velori-forge-device-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction("projects", "readonly").objectStore("projects").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return rows.some((row) => (row as { title?: string }).title === "Neighborhood Exchange API");
  });
  expect(projectExists).toBe(true);

  await page.getByRole("button", { name: "Project settings" }).click();
  const settings = page.getByRole("dialog", { name: "Project Settings" });
  await settings.getByLabel("Theme").selectOption("dark");
  await settings.getByLabel("Design style").selectOption("Minimal");
  await settings.getByLabel("Provider").selectOption("local");
  const projectId = projectIdForLayout;
  await expect
    .poll(async () =>
      page.evaluate(
        async ({ id, userId }) => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("velori-forge-device-v1", 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const record = await new Promise<
            { setup?: { theme?: string; design?: string; aiProvider?: string } } | undefined
          >((resolve, reject) => {
            const request = db
              .transaction("projects", "readonly")
              .objectStore("projects")
              .get(`velori.forge.device.${userId}:${id}`);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          db.close();
          return record?.setup;
        },
        { id: projectId, userId: user.id },
      ),
    )
    .toMatchObject({ theme: "dark", design: "Minimal", aiProvider: "local" });
  await settings.getByLabel("Autosave edits").uncheck();
  await expect(
    page.getByText("Autosave is off. Save Project or export a backup before leaving."),
  ).toBeVisible();
  await settings.getByRole("button", { name: "Delete local project" }).click();
  await expect(page.getByRole("dialog", { name: "Delete this local project?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete Local Project" }).click();
  await expect(page).toHaveURL(/\/artifacts$/);
  expect(generationRequests.filter((url) => /generate|converse/.test(url))).toEqual([]);
});
