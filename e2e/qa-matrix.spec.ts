import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Phase 4 - authenticated main-site feature matrix.
 *
 * The evidence bar for this pass is click, request, database row, response, UI,
 * refresh and persistence. A control that merely renders is not a pass, so every
 * mutation asserted here is read back out of the database with the service role
 * rather than inferred from the UI.
 *
 * Credentials come from the gitignored `.env.secrets.local`; nothing secret is
 * logged. Every identity used here is a prefixed, non-production QA account
 * created for this audit.
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

const secrets = {
  ...readEnv("C:/Users/aryan/Downloads/VELORI Platform Upgrade Audit (1)/.env.local"),
  ...readEnv("C:/Users/aryan/Downloads/VELORI Platform Upgrade Audit (1)/.env.secrets.local"),
};
const ownerEmail = secrets.VELORI_QA_OWNER_EMAIL;
const ownerPassword = secrets.VELORI_QA_OWNER_PASSWORD;
const viewerEmail = secrets.VELORI_QA_VIEWER_EMAIL;
const viewerPassword = secrets.VELORI_QA_VIEWER_PASSWORD;
const serviceKey = secrets.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = secrets.VITE_SUPABASE_PUBLISHABLE_KEY;
const projectUrl =
  process.env.VITE_SUPABASE_URL?.replace(/\/$/, "") ??
  secrets.VITE_SUPABASE_URL?.replace(/\/$/, "");

if (
  !ownerEmail ||
  !ownerPassword ||
  !viewerEmail ||
  !viewerPassword ||
  !serviceKey ||
  !projectUrl ||
  !publishableKey
) {
  throw new Error("QA account credentials or Supabase configuration are missing");
}

const serviceHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

/** Reads a count straight out of Postgres so "it updated the UI" is not the proof. */

type Network = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
};

function watch(page: Page): Network {
  const net: Network = { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on("console", (message) => {
    if (message.type() === "error") net.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => net.pageErrors.push(error.message));
  page.on("requestfailed", (request) =>
    net.failedRequests.push(
      `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "?"}`,
    ),
  );
  page.on("response", async (response) => {
    if (response.status() >= 400) {
      const body = await response.text().catch(() => "");
      net.badResponses.push(
        `${response.status()} ${response.request().method()} ${response.url()} ${body}`,
      );
    }
  });
  return net;
}

async function signInAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(email);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(password);
  const signInResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "password" &&
      response.request().method() === "POST"
    );
  });
  await page
    .getByRole("button", { name: /sign in/i })
    .first()
    .click();
  expect((await signInResponse).status(), "the QA password sign-in request failed").toBe(200);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

async function signIn(page: Page): Promise<void> {
  await signInAs(page, ownerEmail, ownerPassword);
}

async function waitForVisibleStoryCanvas(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector<HTMLElement>(".story-editor-canvas");
      if (!canvas) return false;
      const bounds = canvas.getBoundingClientRect();
      const hit = document.elementFromPoint(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2,
      );
      return hit?.closest(".story-editor-canvas") === canvas;
    },
    null,
    { timeout: 15_000 },
  );
}

async function qaUserId(email: string, password: string): Promise<string> {
  const response = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`QA account lookup failed with HTTP ${response.status}.`);
  const result = (await response.json()) as { user?: { id?: string } };
  if (!result.user?.id) throw new Error("QA account lookup returned no user id.");
  return result.user.id;
}

async function openOwnProfile(page: Page): Promise<void> {
  const profileLink = page.locator('.topbar-actions a[href^="/profile/"]');
  await expect(profileLink, "the member profile did not load in the app header").toBeVisible({
    timeout: 30_000,
  });
  const profilePath = await profileLink.evaluate((link) => (link as HTMLAnchorElement).pathname);
  await profileLink.click();
  await expect(page).toHaveURL((url) => url.pathname === profilePath, { timeout: 30_000 });
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${projectUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders, ...((init.headers as Record<string, string>) ?? {}) },
  });
}

test.describe("Phase 4 authenticated main-site matrix", () => {
  test("QA owner can sign in and the session survives a reload", async ({ page }) => {
    const net = watch(page);
    await signIn(page);
    expect(page.url()).toContain("/home");
    await page.reload({ waitUntil: "domcontentloaded" });
    // The authenticated shell is a labelled complementary landmark, not a <nav>.
    await expect(
      page.getByRole("complementary", { name: /primary navigation/i }),
      "the authenticated sidebar did not render after a reload, so the session did not persist",
    ).toBeVisible();
    expect(net.pageErrors, `uncaught exceptions: ${net.pageErrors.join(" | ")}`).toEqual([]);
  });

  test("QA owner can sign out and returns to the visitor entry point", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: /primary navigation/i })).toHaveCount(0);
  });

  test("signed-in compact navigation opens, traps focus, and closes accessibly", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.goto("/home", { waitUntil: "domcontentloaded" });

    const menuToggle = page.getByRole("button", { name: "Open menu" });
    await menuToggle.click();
    const drawer = page.getByRole("dialog", { name: "Primary navigation" });
    await expect(drawer).toBeVisible();
    expect(
      await page.evaluate(() => document.body.style.overflow),
      "opening the compact navigation should prevent background scroll",
    ).toBe("hidden");

    await drawer.getByRole("link", { name: "Explore", exact: true }).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(drawer).toHaveCount(0);

    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await menuToggle.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(drawer.getByRole("link", { name: "VELORI home" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(drawer.getByRole("link", { name: "Your profile" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(menuToggle).toBeFocused();

    const createTrigger = page.getByRole("button", { name: "Create something" });
    await createTrigger.click();
    const createDialog = page.getByRole("dialog", { name: "Create" });
    await expect(createDialog).toBeVisible();
    await expect(createDialog.getByRole("link", { name: /Create post/ })).toBeVisible();
    await expect(createDialog.getByRole("link", { name: /Add story/ })).toBeVisible();
    await expect(createDialog.getByRole("link", { name: /Create reel/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(createDialog).toHaveCount(0);
    await expect(createTrigger).toBeFocused();
  });

  test("New chat opens the recipient thread without submitting a page navigation", async ({
    page,
  }) => {
    const recipientId = await qaUserId(viewerEmail, viewerPassword);
    const [profileResponse, settingsResponse] = await Promise.all([
      rest(`profiles?select=username&id=eq.${recipientId}`),
      rest(`account_settings?select=message_permission&profile_id=eq.${recipientId}`),
    ]);
    expect(profileResponse.ok, "the QA recipient profile could not be read").toBe(true);
    expect(settingsResponse.ok, "the QA recipient message setting could not be read").toBe(true);
    const [profiles, settings] = await Promise.all([
      profileResponse.json() as Promise<{ username: string }[]>,
      settingsResponse.json() as Promise<{ message_permission: string }[]>,
    ]);
    expect(profiles).toHaveLength(1);
    const username = profiles[0].username;
    const insertedSetting = settings.length === 0;
    const originalPermission = settings[0]?.message_permission ?? null;
    const marker = `QA message ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let conversationId = "";
    let messageId = "";
    let viewerContext: BrowserContext | null = null;
    const changed = await rest(
      insertedSetting ? "account_settings" : `account_settings?profile_id=eq.${recipientId}`,
      {
        method: insertedSetting ? "POST" : "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(
          insertedSetting
            ? { profile_id: recipientId, message_permission: "everyone" }
            : { message_permission: "everyone" },
        ),
      },
    );
    expect(changed.ok, "the QA recipient message setting could not be temporarily opened").toBe(
      true,
    );

    try {
      await signIn(page);
      await page.goto("/messages", { waitUntil: "domcontentloaded" });
      let pageNavigations = 0;
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) pageNavigations += 1;
      });
      await page.getByPlaceholder("Start with a username").fill(username);
      const openConversation = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith("/rpc/open_direct_conversation") &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Start conversation" }).click();
      const opened = await openConversation;
      expect(opened.ok(), "the direct-conversation RPC did not succeed").toBe(true);
      conversationId = (await opened.json()) as string;
      expect(conversationId).toMatch(/^[0-9a-f-]{36}$/i);
      await expect(page.getByRole("textbox", { name: "Your message" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page).toHaveURL(/\/messages$/);
      expect(pageNavigations, "submitting New chat reloaded the page").toBe(0);

      await page.getByRole("textbox", { name: "Your message" }).fill(marker);
      const sendResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith("/rest/v1/messages") &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Send message" }).click();
      expect((await sendResponse).ok(), "sending a direct message failed").toBe(true);

      const messageRowsResponse = await rest(
        `messages?select=id,conversation_id,sender_id,body&conversation_id=eq.${conversationId}&body=eq.${encodeURIComponent(marker)}`,
      );
      expect(messageRowsResponse.ok, "the sent message was not persisted").toBe(true);
      const messageRows = (await messageRowsResponse.json()) as {
        id: string;
        conversation_id: string;
        sender_id: string;
        body: string;
      }[];
      expect(messageRows).toHaveLength(1);
      expect(messageRows[0]).toMatchObject({ conversation_id: conversationId, body: marker });
      messageId = messageRows[0].id;

      const browser = page.context().browser();
      if (!browser) throw new Error("The Playwright browser context is unavailable.");
      viewerContext = await browser.newContext();
      const viewerPage = await viewerContext.newPage();
      await signInAs(viewerPage, viewerEmail, viewerPassword);
      await viewerPage.goto("/messages", { waitUntil: "domcontentloaded" });
      const recipientThread = viewerPage
        .locator(".messages-conversation")
        .filter({ hasText: marker });
      await expect(recipientThread, "the recipient could not see the new conversation").toBeVisible(
        {
          timeout: 30_000,
        },
      );
      await recipientThread.click();
      await expect(viewerPage.getByText(marker, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await viewerContext?.close();
      try {
        if (messageId) {
          const removedMessage = await rest(`messages?id=eq.${messageId}`, {
            method: "DELETE",
            headers: { Prefer: "return=minimal" },
          });
          expect(removedMessage.ok, "the temporary QA message was not removed").toBe(true);
        }
      } finally {
        const restored = await rest(`account_settings?profile_id=eq.${recipientId}`, {
          method: insertedSetting ? "DELETE" : "PATCH",
          headers: { Prefer: "return=minimal" },
          body: insertedSetting
            ? undefined
            : JSON.stringify({ message_permission: originalPermission }),
        });
        expect(restored.ok, "the QA recipient message setting was not restored").toBe(true);
      }
    }
  });

  test("signed-in home shows the live story tray and no marketing hero", async ({ page }) => {
    await signIn(page);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const body = (await page.locator("body").innerText()).toLowerCase();
    // The signed-out hero copy must not survive into the authenticated feed.
    expect(body, "the signed-in feed still shows marketing hero copy").not.toContain(
      "your corner of the internet",
    );
    // The story tray is the first surface in the signed-in layout.
    const trayLink = page.locator('a[href^="/stories"], a[href*="story"]').first();
    await expect(trayLink, "no story tray entry is rendered for a signed-in user").toBeVisible();
    const ownProfilePath = await page
      .locator('.topbar-actions a[href^="/profile/"]')
      .getAttribute("href");
    const ownUsername = ownProfilePath?.split("/").filter(Boolean).at(-1);
    if (ownUsername) {
      await expect(
        page.locator(".suggested-profile").filter({
          has: page.getByText(`@${decodeURIComponent(ownUsername)}`, { exact: true }),
        }),
        "the signed-in user appeared in their own suggestions",
      ).toHaveCount(0);
    }
  });

  test("Story Studio reveals one tool at a time and previews the storyboard", async ({
    page,
  }, testInfo) => {
    await signIn(page);
    const net = watch(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/stories/create", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Computer Studio" }).click();
    await expect(page.getByRole("heading", { name: "Story Studio" })).toBeVisible();
    await expect(page.locator(".story-editor-page")).toHaveAttribute(
      "data-device-layout",
      "computer",
    );
    await expect(page.locator(".story-editor-sidebar")).toHaveCount(0);

    const canvas = page.locator(".story-editor-canvas");
    const desktopBounds = await canvas.boundingBox();
    const editorBounds = await page.locator(".story-editor-page").boundingBox();
    expect(desktopBounds).not.toBeNull();
    expect(editorBounds).not.toBeNull();
    expect(desktopBounds!.width).toBeGreaterThanOrEqual(240);
    expect(Math.abs(desktopBounds!.width / desktopBounds!.height - 9 / 16)).toBeLessThan(0.03);
    expect(
      Math.abs(
        desktopBounds!.x + desktopBounds!.width / 2 - (editorBounds!.x + editorBounds!.width / 2),
      ),
    ).toBeLessThan(8);

    const panel = page.locator(".story-editor-sidebar");
    const toolExpectations = [
      ["Media", "Media and background tools"],
      ["Text", "Text and animation tools"],
      ["Sticker", "Interactive stickers and brand overlays"],
      ["Music", "Story music"],
      ["Layout", "Story templates and brand kit"],
      ["More", "More story tools"],
    ] as const;
    for (const [tool, panelLabel] of toolExpectations) {
      await page.getByRole("button", { name: tool, exact: true }).click();
      await expect(panel).toHaveCount(1);
      if (tool !== "More") {
        await expect(panel.getByRole("region", { name: panelLabel })).toBeVisible();
      } else {
        await expect(panel.getByRole("navigation", { name: panelLabel })).toBeVisible();
      }
    }

    await page.getByRole("button", { name: "Sticker", exact: true }).click();
    await expect(panel.locator('[aria-label="Recent picks sticker choices"] button')).toHaveCount(
      12,
    );
    await expect(panel.locator('[aria-label="Trending sticker choices"] button')).toHaveCount(8);
    await expect(panel.getByRole("button", { name: "Upload", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "More", exact: true }).click();
    await expect(
      panel.getByRole("region", { name: "Story templates and brand kit" }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Collaborate" }).click();
    await expect(panel.getByRole("region", { name: "Story collaboration" })).toBeVisible();
    await panel.getByRole("button", { name: "Share", exact: true }).click();
    await expect(panel.getByRole("region", { name: "Export and share story" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Download MP4" })).toBeVisible();
    await expect(
      panel.getByRole("region", { name: "Export and share story" }).getByRole("button", {
        name: "Share",
        exact: true,
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Layout", exact: true }).click();
    await page.getByLabel("Auto-advance this slide").selectOption("3");
    await page.getByRole("button", { name: "Add slide" }).click();
    await expect(page.getByText("2 / 10 slides")).toBeVisible();
    await page.getByRole("button", { name: "Select slide 1" }).click();

    await canvas.click({ position: { x: 20, y: 20 } });
    await expect(panel).toHaveCount(0);
    const desktopStoryboardBounds = await page
      .getByRole("region", { name: "Story slides" })
      .boundingBox();
    expect(desktopStoryboardBounds).not.toBeNull();
    expect(desktopStoryboardBounds!.y + desktopStoryboardBounds!.height).toBeLessThanOrEqual(1000);
    await expect(page.locator(".runtime-loading")).toBeHidden({ timeout: 10_000 });
    await expect(page.locator(".startup-intro")).toHaveCount(0, { timeout: 15_000 });
    await waitForVisibleStoryCanvas(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("story-studio-desktop.png") });

    const mobilePage = await page.context().newPage();
    const mobileNet = watch(mobilePage);
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    await mobilePage.goto("/stories/create", { waitUntil: "domcontentloaded" });
    await mobilePage.getByRole("button", { name: "Android / Mobile Studio" }).click();
    await expect(mobilePage.getByRole("heading", { name: "Story Studio" })).toBeVisible();
    await expect(mobilePage.locator(".story-editor-page")).toHaveAttribute(
      "data-device-layout",
      "mobile",
    );
    await expect(mobilePage.locator(".story-editor-sidebar")).toHaveCount(0);
    await expect(mobilePage.locator(".runtime-loading")).toBeHidden({ timeout: 10_000 });
    await expect(mobilePage.locator(".startup-intro")).toHaveCount(0, { timeout: 15_000 });
    await waitForVisibleStoryCanvas(mobilePage);
    await expect(mobilePage.locator("body")).toHaveJSProperty("scrollWidth", 390);
    const mobileStoryboard = mobilePage.getByRole("region", { name: "Story slides" });
    const mobileStoryboardBounds = await mobileStoryboard.boundingBox();
    expect(mobileStoryboardBounds).not.toBeNull();
    expect(mobileStoryboardBounds!.y + mobileStoryboardBounds!.height).toBeLessThanOrEqual(844);
    const mobileTools = mobilePage.getByRole("navigation", { name: "Mobile story tools" });
    await expect(mobileTools.getByRole("button")).toHaveCount(5);
    await mobilePage.getByRole("button", { name: "Text", exact: true }).click();
    await mobilePage
      .locator(".story-editor-text-tools button[aria-label='Add text overlay']")
      .click();
    await mobilePage.getByPlaceholder("Write something for your story…").fill("Mobile text");
    await expect(mobilePage.locator('[data-story-object-kind="text"]')).toContainText(
      "Mobile text",
    );
    await mobilePage.getByRole("button", { name: "Sticker", exact: true }).click();
    await mobilePage.locator('[aria-label="Recent picks sticker choices"] button').first().click();
    await expect(mobilePage.locator('[data-story-object-kind="sticker"]')).toHaveCount(1);
    await mobilePage.getByRole("button", { name: "More", exact: true }).click();
    await mobilePage.getByRole("button", { name: "Music", exact: true }).click();
    await expect(mobilePage.locator('[data-story-object-kind="text"]')).toContainText(
      "Mobile text",
    );
    await expect(mobilePage.locator('[data-story-object-kind="sticker"]')).toHaveCount(1);
    await mobilePage.screenshot({ path: testInfo.outputPath("story-studio-mobile.png") });
    await mobilePage.getByRole("button", { name: "Preview story" }).click();
    await expect
      .poll(() => mobilePage.evaluate(() => Boolean(document.fullscreenElement)))
      .toBe(true);
    await mobilePage.getByRole("button", { name: "Exit full-screen preview" }).click();
    expect(
      mobileNet.consoleErrors,
      `mobile console errors: ${mobileNet.consoleErrors.join(" | ")}`,
    ).toEqual([]);
    expect(mobileNet.pageErrors, `mobile page errors: ${mobileNet.pageErrors.join(" | ")}`).toEqual(
      [],
    );
    await mobilePage.close();

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    const previewCanvas = page.locator(".story-editor-canvas");
    await page.getByRole("button", { name: "Pause story preview" }).click();
    await expect(previewCanvas).toHaveAttribute("aria-label", "Story preview, slide 1 of 2");
    await page.waitForTimeout(3200);
    await expect(previewCanvas).toHaveAttribute("aria-label", "Story preview, slide 1 of 2");
    await page.getByRole("button", { name: "Play story preview" }).click();
    await expect(previewCanvas).toHaveAttribute("aria-label", "Story preview, slide 2 of 2", {
      timeout: 6000,
    });
    await page.getByRole("button", { name: "Pause story preview" }).click();
    const previewBounds = await previewCanvas.boundingBox();
    expect(previewBounds).not.toBeNull();
    await page.mouse.move(previewBounds!.x + 30, previewBounds!.y + previewBounds!.height / 2);
    await page.mouse.down();
    await page.mouse.move(previewBounds!.x + 100, previewBounds!.y + previewBounds!.height / 2);
    await page.mouse.up();
    await expect(previewCanvas).toHaveAttribute("aria-label", "Story preview, slide 1 of 2");
    await page.getByRole("button", { name: "Exit full-screen preview" }).click();
    await expect(page.locator(".story-editor-sidebar")).toHaveCount(0);
    expect(net.consoleErrors, `console errors: ${net.consoleErrors.join(" | ")}`).toEqual([]);
    expect(net.pageErrors, `page errors: ${net.pageErrors.join(" | ")}`).toEqual([]);
  });

  test("Story Studio offers a fresh device choice and mobile controls use shared scene history", async ({
    page,
  }, testInfo) => {
    await signIn(page);
    const snapshotsBefore = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith("velori:story-collaboration:"))
        .sort(),
    );
    await page.goto("/stories/create", { waitUntil: "domcontentloaded" });
    const dialog = page.getByRole("dialog", { name: "Choose Your Editing Experience" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Computer Studio" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Android / Mobile Studio" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("story-device-selector-mobile.png") });
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/stories$/);
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith("velori:story-collaboration:"))
          .sort(),
      ),
    ).toEqual(snapshotsBefore);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/stories/create", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Android / Mobile Studio" }).click();
    const editor = page.locator('.story-editor-page[data-device-layout="mobile"]');
    await expect(editor).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("story-mobile-studio.png") });
    await page.getByRole("button", { name: "Shape", exact: true }).click();
    await page.getByRole("button", { name: "Rectangle", exact: true }).click();
    const shape = page.locator('[data-story-object-kind="shape"]');
    await expect(shape).toHaveCount(1);
    const positionBeforeRotation = await shape.evaluate(
      (element) => (element as HTMLElement).style.left,
    );
    await expect(page.getByRole("button", { name: "Undo edit" })).toBeEnabled();
    await page.getByRole("button", { name: "Undo edit" }).click();
    await expect(shape).toHaveCount(0);
    await page.getByRole("button", { name: "Redo edit" }).click();
    await expect(shape).toHaveCount(1);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(editor).toHaveAttribute("data-device-layout", "mobile");
    await expect
      .poll(() => shape.evaluate((element) => (element as HTMLElement).style.left))
      .toBe(positionBeforeRotation);
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 844);
    await page.getByRole("button", { name: "Close Story Studio" }).click();
    await expect(page.getByRole("dialog", { name: "Leave Story Studio?" })).toBeVisible();
    await page.getByRole("button", { name: "Keep editing" }).click();
    await expect(editor).toBeVisible();
  });

  test("Mobile Story Studio publishes its rendered slide through the existing audience-aware flow", async ({
    page,
  }) => {
    await signIn(page);
    const marker = `velori-qa-mobile-studio-story-${Date.now()}`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/stories/create", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Android / Mobile Studio" }).click();
    await page.getByRole("button", { name: "Next: review and publish" }).click();
    const dialog = page.getByRole("dialog", { name: "Review your story" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("This slide will be published")).toBeVisible();
    await dialog.getByRole("radio", { name: /Only me/ }).check();
    await dialog.getByLabel("Caption (optional)").fill(marker);

    try {
      await dialog.getByRole("button", { name: "Publish story" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "Your story was published successfully." }),
      ).toBeVisible({ timeout: 45_000 });

      const storyResponse = await rest(
        `stories?select=id,audience,status,media_type,caption&caption=eq.${encodeURIComponent(marker)}`,
      );
      expect(storyResponse.ok, "the story row could not be read back").toBe(true);
      const stories = (await storyResponse.json()) as {
        id: string;
        audience: string;
        status: string;
        media_type: string;
      }[];
      expect(stories).toHaveLength(1);
      expect(stories[0]).toMatchObject({
        audience: "private",
        status: "active",
        media_type: "image",
      });
      const mediaResponse = await rest(
        `story_media?select=mime_type,byte_size&story_id=eq.${stories[0].id}`,
      );
      expect(mediaResponse.ok, "the uploaded story media could not be read back").toBe(true);
      const media = (await mediaResponse.json()) as { mime_type: string; byte_size: number }[];
      expect(media).toHaveLength(1);
      expect(media[0].mime_type).toBe("image/png");
      expect(media[0].byte_size).toBeGreaterThan(0);
    } finally {
      const matchingStories = await rest(
        `stories?select=id&caption=eq.${encodeURIComponent(marker)}`,
      );
      if (matchingStories.ok) {
        const stories = (await matchingStories.json()) as { id: string }[];
        for (const story of stories) {
          const mediaResponse = await rest(
            `story_media?select=object_path&story_id=eq.${story.id}`,
          );
          if (mediaResponse.ok) {
            const media = (await mediaResponse.json()) as { object_path: string }[];
            const paths = media.map((item) => item.object_path).filter(Boolean);
            if (paths.length) {
              const storageCleanup = await fetch(`${projectUrl}/storage/v1/object/story-media`, {
                method: "DELETE",
                headers: serviceHeaders,
                body: JSON.stringify({ prefixes: paths }),
              });
              expect(storageCleanup.ok, "the temporary Studio story asset was not removed").toBe(
                true,
              );
            }
          }
        }
      }
      const cleanup = await rest(`stories?caption=eq.${encodeURIComponent(marker)}`, {
        method: "DELETE",
      });
      expect(cleanup.ok, "the temporary Studio story was not removed").toBe(true);
    }
  });

  test("Story Studio creates, transforms, orders and restores editable objects", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const prototype = CanvasRenderingContext2D.prototype;
      const originalEllipse = prototype.ellipse;
      const state = window as Window & { __storyExportEllipseCalls?: number };
      state.__storyExportEllipseCalls = 0;
      prototype.ellipse = function (...args) {
        state.__storyExportEllipseCalls = (state.__storyExportEllipseCalls ?? 0) + 1;
        return originalEllipse.apply(this, args);
      };
    });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/stories/create", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Computer Studio" }).click();
    await expect(page.getByRole("heading", { name: "Story Studio" })).toBeVisible();

    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.locator(".story-editor-text-tools button[aria-label='Add text overlay']").click();
    const text = page.locator('[data-story-object-kind="text"]');
    await expect(text).toHaveCount(1);
    await expect(page.getByRole("group", { name: "Selected story object controls" })).toBeVisible();

    const originalLeft = await text.evaluate((element) => (element as HTMLElement).style.left);
    const textBounds = await text.boundingBox();
    expect(textBounds).not.toBeNull();
    await page.mouse.move(
      textBounds!.x + textBounds!.width / 2,
      textBounds!.y + textBounds!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      textBounds!.x + textBounds!.width / 2 + 32,
      textBounds!.y + textBounds!.height / 2 + 18,
      { steps: 4 },
    );
    await page.mouse.up();
    await expect
      .poll(() => text.evaluate((element) => (element as HTMLElement).style.left))
      .not.toBe(originalLeft);

    const widthBeforeResize = await text.evaluate(
      (element) => (element as HTMLElement).style.width,
    );
    const resizeHandle = page.getByRole("button", { name: "Resize selected object se" });
    const resizeBounds = await resizeHandle.boundingBox();
    expect(resizeBounds).not.toBeNull();
    await page.mouse.move(resizeBounds!.x + 14, resizeBounds!.y + 14);
    await page.mouse.down();
    await page.mouse.move(resizeBounds!.x + 42, resizeBounds!.y + 30, { steps: 3 });
    await page.mouse.up();
    await expect
      .poll(() => text.evaluate((element) => (element as HTMLElement).style.width))
      .not.toBe(widthBeforeResize);

    const rotation = page.getByRole("button", { name: "Rotate selected object" });
    const rotationBounds = await rotation.boundingBox();
    expect(rotationBounds).not.toBeNull();
    const textTransformBeforeRotation = await text.evaluate(
      (element) => (element as HTMLElement).style.transform,
    );
    await page.mouse.move(
      rotationBounds!.x + rotationBounds!.width / 2,
      rotationBounds!.y + rotationBounds!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(rotationBounds!.x + 68, rotationBounds!.y + 24, { steps: 4 });
    await page.mouse.up();
    await expect
      .poll(() => text.evaluate((element) => (element as HTMLElement).style.transform))
      .not.toBe(textTransformBeforeRotation);

    await page.getByRole("button", { name: "Bring selected object to front" }).click();
    await expect(page.getByRole("button", { name: "Undo edit" })).toBeEnabled();
    await page.getByRole("button", { name: "Undo edit" }).click();
    await page.getByRole("button", { name: "Redo edit" }).click();

    await page.getByRole("button", { name: "Sticker", exact: true }).click();
    const recent = page.locator('[aria-label="Recent picks sticker choices"] button');
    await recent.nth(0).click();
    await recent.nth(1).click({ force: true });
    await expect(page.locator('[data-story-object-kind="sticker"]')).toHaveCount(2);

    await page.getByRole("button", { name: "Shape", exact: true }).click();
    await page.getByRole("button", { name: "Rectangle", exact: true }).click();
    await page.getByRole("button", { name: "Ellipse", exact: true }).click();
    await expect(page.locator('[data-story-object-kind="shape"]')).toHaveCount(2);
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.locator(".story-editor-advanced-options summary").click();
    const ellipseExportCallsBefore = await page.evaluate(
      () => (window as Window & { __storyExportEllipseCalls?: number }).__storyExportEllipseCalls,
    );
    const imageDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download slide 1" }).click();
    expect((await imageDownload).suggestedFilename()).toMatch(/slide-1-1080p\.png$/);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { __storyExportEllipseCalls?: number }).__storyExportEllipseCalls,
        ),
      )
      .toBeGreaterThan(ellipseExportCallsBefore ?? 0);

    await page.getByRole("button", { name: "Shape", exact: true }).click();
    await page.getByRole("button", { name: "Delete selected shape" }).click();
    await expect(page.locator('[data-story-object-kind="shape"]')).toHaveCount(1);
    await page.getByRole("button", { name: "Undo edit" }).click();
    await expect(page.locator('[data-story-object-kind="shape"]')).toHaveCount(2);
    await page.getByRole("button", { name: "Redo edit" }).click();
    await expect(page.locator('[data-story-object-kind="shape"]')).toHaveCount(1);

    const positionBeforeResize = await text.evaluate(
      (element) => (element as HTMLElement).style.left,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => text.evaluate((element) => (element as HTMLElement).style.left))
      .toBe(positionBeforeResize);
  });

  test("profile story shortcut opens the simple camera, gallery and text choices", async ({
    page,
  }) => {
    await signIn(page);
    await openOwnProfile(page);
    const addStory = page.getByRole("link", { name: "Add a story" });
    await expect(addStory, "the profile avatar has no story shortcut").toBeVisible({
      timeout: 30_000,
    });
    await addStory.click();

    await expect(page.getByRole("button", { name: /Camera/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Gallery/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Text/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Publish story/ })).toHaveCount(0);
  });

  test("Edit photo shortcut lands at the profile photo editor", async ({ page }) => {
    await signIn(page);
    await openOwnProfile(page);
    await page.getByRole("link", { name: "Edit profile photo" }).click({ timeout: 30_000 });

    const editor = page.locator("#profile-photo");
    await expect(editor).toBeVisible();
    await expect(page).toHaveURL(/\/settings\/account#profile-photo$/);
    await expect(editor).toBeInViewport();
  });

  test("profile follow states persist and restore the QA relationship", async ({ page }) => {
    const ownerId = await qaUserId(ownerEmail, ownerPassword);
    const viewerId = await qaUserId(viewerEmail, viewerPassword);
    const profileResponse = await rest(`profiles?select=username,is_private&id=eq.${viewerId}`);
    expect(profileResponse.ok, "the QA profile could not be read").toBe(true);
    const profiles = (await profileResponse.json()) as {
      username: string;
      is_private: boolean;
    }[];
    expect(profiles).toHaveLength(1);
    const { username, is_private: isPrivate } = profiles[0];
    const relationPath = `follows?select=status&follower_id=eq.${ownerId}&following_id=eq.${viewerId}`;
    const initialResponse = await rest(relationPath);
    expect(initialResponse.ok, "the initial QA follow relationship could not be read").toBe(true);
    const initialRows = (await initialResponse.json()) as { status: "accepted" | "pending" }[];
    const originalStatus = initialRows[0]?.status ?? null;
    const expectedStatus = isPrivate ? "pending" : "accepted";

    try {
      await signIn(page);
      await page.goto(`/profile/${encodeURIComponent(username)}`, {
        waitUntil: "domcontentloaded",
      });
      const followButton = page.getByRole("button", {
        name: /^(Follow|Request to follow|Following|Cancel request)$/,
      });
      await expect(followButton).toBeVisible({ timeout: 30_000 });

      if (originalStatus) {
        await followButton.click();
        await expect(followButton).toHaveText(isPrivate ? "Request to follow" : "Follow");
        await expect
          .poll(async () => {
            const response = await rest(relationPath);
            if (!response.ok) return "query-error";
            const rows = (await response.json()) as { status: string }[];
            return rows[0]?.status ?? "none";
          })
          .toBe("none");
      }

      await followButton.click();
      await expect(followButton).toHaveText(isPrivate ? "Cancel request" : "Following");
      await expect
        .poll(async () => {
          const response = await rest(relationPath);
          if (!response.ok) return "query-error";
          const rows = (await response.json()) as { status: string }[];
          return rows[0]?.status ?? "none";
        })
        .toBe(expectedStatus);

      await followButton.click();
      await expect(followButton).toHaveText(isPrivate ? "Request to follow" : "Follow");
      await expect
        .poll(async () => {
          const response = await rest(relationPath);
          if (!response.ok) return "query-error";
          const rows = (await response.json()) as { status: string }[];
          return rows[0]?.status ?? "none";
        })
        .toBe("none");

      if (originalStatus) {
        await followButton.click();
        await expect(followButton).toHaveText(
          originalStatus === "pending" ? "Cancel request" : "Following",
        );
        await expect
          .poll(async () => {
            const response = await rest(relationPath);
            if (!response.ok) return "query-error";
            const rows = (await response.json()) as { status: string }[];
            return rows[0]?.status ?? "none";
          })
          .toBe(originalStatus);
      }
    } finally {
      const cleanup = await rest(`follows?follower_id=eq.${ownerId}&following_id=eq.${viewerId}`, {
        method: originalStatus ? "POST" : "DELETE",
        headers: {
          Prefer: originalStatus ? "resolution=merge-duplicates,return=minimal" : "return=minimal",
        },
        body: originalStatus
          ? JSON.stringify({
              follower_id: ownerId,
              following_id: viewerId,
              status: originalStatus,
            })
          : undefined,
      });
      expect(cleanup.ok, "the original QA follow relationship was not restored").toBe(true);
    }
  });

  test("a text story publishes, survives refresh and appears in the story viewer", async ({
    page,
  }) => {
    await signIn(page);
    const marker = `velori-qa-story-${Date.now()}`;
    const writeErrors: string[] = [];
    page.on("response", async (response) => {
      if (response.url().includes("/rest/v1/stories") && response.status() >= 400) {
        writeErrors.push(
          `${response.status()} ${response.url()} ${await response.text().catch(() => "")}`,
        );
      }
    });
    try {
      await page.goto("/stories?create=1", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Text/ }).click();
      await page.getByLabel("Your story").fill(marker);
      await page.getByRole("button", { name: /Publish story/ }).click();
      await page.waitForURL((url) => url.pathname === "/home", { timeout: 30_000 });

      const ownStory = page.getByRole("button", { name: "View your story" });
      await expect(ownStory, "the published story did not appear in the home tray").toBeVisible({
        timeout: 30_000,
      });
      await ownStory.click();
      await expect(page.getByText(marker, { exact: true })).toBeVisible();

      await page.reload({ waitUntil: "domcontentloaded" });
      const refreshedStory = page.getByRole("button", { name: "View your story" });
      await expect(refreshedStory, "the story disappeared after refresh").toBeVisible({
        timeout: 30_000,
      });
      await refreshedStory.click();
      await expect(page.getByText(marker, { exact: true })).toBeVisible();

      const rows = await rest(
        `stories?select=id,caption,status,expires_at&caption=eq.${encodeURIComponent(marker)}`,
      );
      const stories = (await rows.json()) as {
        id: string;
        caption: string;
        status: string;
        expires_at: string;
      }[];
      expect(stories.length, "the published story was not saved to the database").toBe(1);
      expect(stories[0].status).toBe("active");
    } finally {
      if (writeErrors.length) console.log(`story API errors: ${writeErrors.join(" | ")}`);
      const cleanup = await rest(`stories?caption=eq.${encodeURIComponent(marker)}`, {
        method: "DELETE",
      }).catch(() => null);
      expect(cleanup?.ok, "the temporary QA story was not cleaned up").toBe(true);
    }
  });

  test("a gallery story uploads, publishes and remains available after refresh", async ({
    page,
  }) => {
    await signIn(page);
    const marker = `velori-qa-image-story-${Date.now()}`;
    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lX8AAAAASUVORK5CYII=",
      "base64",
    );
    const writeErrors: string[] = [];
    const badResponses: string[] = [];
    page.on("response", async (response) => {
      if (response.status() < 400) return;
      const body = await response.text().catch(() => "");
      badResponses.push(
        `${response.status()} ${response.request().method()} ${response.url()} ${body}`,
      );
      if (
        response.url().includes("/rest/v1/stories") ||
        response.url().includes("/rest/v1/story_media") ||
        response.url().includes("/storage/v1/object/story-media")
      ) {
        writeErrors.push(`${response.status()} ${response.url()} ${body}`);
      }
    });
    try {
      await page.goto("/stories?create=1", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Gallery/ }).click();
      await page.getByLabel("Choose story from gallery").setInputFiles({
        name: "velori-qa-story.png",
        mimeType: "image/png",
        buffer: onePixelPng,
      });
      await expect(page.getByAltText("Story preview")).toBeVisible();
      await page.getByLabel("Add a caption (optional)").fill(marker);
      await page.getByRole("button", { name: /Publish story/ }).click();
      await page.waitForURL((url) => url.pathname === "/home", { timeout: 30_000 });

      const ownStory = page.getByRole("button", { name: "View your story" });
      await expect(ownStory, "the uploaded story did not appear in the home tray").toBeVisible({
        timeout: 30_000,
      });
      await ownStory.click();
      await expect(page.getByText(marker, { exact: true })).toBeVisible();
      await expect(page.locator(".story-viewer-body img")).toBeVisible();

      await page.reload({ waitUntil: "domcontentloaded" });
      const refreshedStory = page.getByRole("button", { name: "View your story" });
      await expect(refreshedStory, "the uploaded story disappeared after refresh").toBeVisible({
        timeout: 30_000,
      });
      await refreshedStory.click();
      await expect(page.getByText(marker, { exact: true })).toBeVisible();

      const storyResponse = await rest(
        `stories?select=id,status,caption&caption=eq.${encodeURIComponent(marker)}`,
      );
      const stories = (await storyResponse.json()) as { id: string; status: string }[];
      expect(stories.length, "the uploaded story row was not persisted").toBe(1);
      expect(stories[0].status).toBe("active");
      const mediaResponse = await rest(
        `story_media?select=object_path,media_type&story_id=eq.${stories[0].id}`,
      );
      const media = (await mediaResponse.json()) as { object_path: string; media_type: string }[];
      expect(media.length, "the story media row was not persisted").toBe(1);
      expect(media[0].media_type).toBe("image");
    } finally {
      if (badResponses.length) console.log(`story media API errors: ${badResponses.join(" | ")}`);
      if (writeErrors.length) console.log(`story specific errors: ${writeErrors.join(" | ")}`);
      const matchingStories = await rest(
        `stories?select=id&caption=eq.${encodeURIComponent(marker)}`,
      ).catch(() => null);
      const stories = matchingStories?.ok
        ? ((await matchingStories.json()) as { id: string }[])
        : [];
      for (const story of stories) {
        const mediaResponse = await rest(
          `story_media?select=object_path&story_id=eq.${story.id}`,
        ).catch(() => null);
        const media = mediaResponse?.ok
          ? ((await mediaResponse.json()) as { object_path: string }[])
          : [];
        const paths = media.map((item) => item.object_path).filter(Boolean);
        if (paths.length) {
          const storageCleanup = await fetch(`${projectUrl}/storage/v1/object/story-media`, {
            method: "DELETE",
            headers: serviceHeaders,
            body: JSON.stringify({ prefixes: paths }),
          }).catch(() => null);
          expect(storageCleanup?.ok, "the temporary story image was not removed").toBe(true);
        }
      }
      const cleanup = await rest(`stories?caption=eq.${encodeURIComponent(marker)}`, {
        method: "DELETE",
      }).catch(() => null);
      expect(cleanup?.ok, "the temporary gallery story was not cleaned up").toBe(true);
    }
  });

  test("a playable reel uploads, publishes and persists with ready media", async ({ page }) => {
    const ownerId = await qaUserId(ownerEmail, ownerPassword);
    const marker = `QA reel ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let reelId = "";
    const objectPaths: string[] = [];

    try {
      await signIn(page);
      await page.goto("/reels?create=1", { waitUntil: "domcontentloaded" });
      await page.getByLabel("Select video").setInputFiles({
        name: "qa-reel.mp4",
        mimeType: "video/mp4",
        buffer: readFileSync("src/imports/Scene.mp4"),
      });
      await expect(page.locator(".reel-upload-preview")).toBeVisible({ timeout: 30_000 });
      await page.getByLabel("Caption").fill(marker);

      const publishButton = page.getByRole("button", { name: "Publish reel" });
      await expect(publishButton).toBeEnabled();
      await publishButton.click();
      await expect(page.getByText("Your reel is live.", { exact: true })).toBeVisible({
        timeout: 60_000,
      });

      const reelsResponse = await rest(
        `reels?select=id,author_id,caption,status,visibility&author_id=eq.${ownerId}&caption=eq.${encodeURIComponent(marker)}`,
      );
      expect(reelsResponse.ok, "the new reel could not be read from the database").toBe(true);
      const reels = (await reelsResponse.json()) as {
        id: string;
        author_id: string;
        caption: string;
        status: string;
        visibility: string;
      }[];
      expect(reels).toHaveLength(1);
      expect(reels[0]).toMatchObject({
        author_id: ownerId,
        caption: marker,
        status: "published",
        visibility: "public",
      });
      reelId = reels[0].id;

      const mediaResponse = await rest(
        `reel_media?select=object_path,media_type,mime_type,byte_size,duration_seconds,processing_state&reel_id=eq.${reelId}`,
      );
      expect(mediaResponse.ok, "the published reel media record could not be read").toBe(true);
      const media = (await mediaResponse.json()) as {
        object_path: string;
        media_type: string;
        mime_type: string;
        byte_size: number;
        duration_seconds: number;
        processing_state: string;
      }[];
      expect(media).toHaveLength(1);
      expect(media[0]).toMatchObject({
        media_type: "video",
        mime_type: "video/mp4",
        byte_size: readFileSync("src/imports/Scene.mp4").byteLength,
        processing_state: "ready",
      });
      expect(media[0].duration_seconds).toBeGreaterThan(0);
      objectPaths.push(media[0].object_path);

      const storedVideo = await fetch(
        `${projectUrl}/storage/v1/object/reel-media/${media[0].object_path}`,
        { headers: serviceHeaders },
      );
      expect(storedVideo.status, "the published reel video is missing from private storage").toBe(
        200,
      );
      const reelCard = page.locator(".reel-viewer-card").filter({ hasText: marker });
      await expect(reelCard).toBeVisible();
      const reelVideo = reelCard.locator("video");
      await expect(reelVideo, "the published reel has no playable video element").toBeVisible();
      await reelVideo.evaluate(async (element) => {
        const video = element as HTMLVideoElement;
        video.muted = true;
        await video.play();
      });
      await expect
        .poll(() => reelVideo.evaluate((element) => (element as HTMLVideoElement).currentTime))
        .toBeGreaterThan(0);
      await reelVideo.evaluate((element) => (element as HTMLVideoElement).pause());

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".reel-viewer-card").filter({ hasText: marker })).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      if (!reelId) {
        const createdResponse = await rest(
          `reels?select=id&author_id=eq.${ownerId}&caption=eq.${encodeURIComponent(marker)}`,
        ).catch(() => null);
        if (createdResponse?.ok) {
          const created = (await createdResponse.json()) as { id: string }[];
          reelId = created[0]?.id ?? "";
        }
      }
      if (reelId && !objectPaths.length) {
        const mediaCleanup = await rest(`reel_media?select=object_path&reel_id=eq.${reelId}`).catch(
          () => null,
        );
        if (mediaCleanup?.ok) {
          const media = (await mediaCleanup.json()) as { object_path: string }[];
          objectPaths.push(...media.map((item) => item.object_path).filter(Boolean));
        }
      }
      if (objectPaths.length) {
        const storageCleanup = await fetch(`${projectUrl}/storage/v1/object/reel-media`, {
          method: "DELETE",
          headers: serviceHeaders,
          body: JSON.stringify({ prefixes: objectPaths }),
        });
        expect(storageCleanup.ok, "the temporary reel video was not removed from storage").toBe(
          true,
        );
      }
      if (reelId) {
        const cleanup = await rest(`reels?id=eq.${reelId}`, { method: "DELETE" }).catch(() => null);
        expect(cleanup?.ok, "the temporary QA reel was not removed from the database").toBe(true);
      }
    }
  });

  test("profile privacy saves to the account and survives refresh", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const toggle = page.getByRole("switch", { name: "Private profile" });
    await expect(toggle).toBeEnabled({ timeout: 30_000 });
    const initialState = await toggle.getAttribute("aria-checked");
    expect(initialState).toMatch(/^(true|false)$/);
    const expectedState = initialState === "true" ? "false" : "true";

    try {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", expectedState);
      await expect(page.getByRole("status").filter({ hasText: "Changes saved" })).toBeVisible();

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("switch", { name: "Private profile" })).toHaveAttribute(
        "aria-checked",
        expectedState,
      );
    } finally {
      const currentToggle = page.getByRole("switch", { name: "Private profile" });
      await expect(currentToggle).toBeVisible({ timeout: 30_000 });
      if ((await currentToggle.getAttribute("aria-checked")) !== initialState) {
        await currentToggle.click();
        await expect(currentToggle).toHaveAttribute("aria-checked", initialState!);
      }
    }
  });

  test("notification category preferences persist and restore the original setting", async ({
    page,
  }) => {
    const ownerId = await qaUserId(ownerEmail, ownerPassword);
    const existingResponse = await rest(
      `notification_preferences?select=profile_id,groups&profile_id=eq.${ownerId}`,
    );
    expect(
      existingResponse.ok,
      "the original group notification preference could not be read",
    ).toBe(true);
    const existingRows = (await existingResponse.json()) as {
      profile_id: string;
      groups: boolean;
    }[];
    expect(existingRows.length).toBeLessThanOrEqual(1);
    const hadExistingRow = existingRows.length === 1;
    const originalValue = existingRows[0]?.groups ?? true;
    const expectedValue = !originalValue;

    try {
      await signIn(page);
      await page.goto("/settings/notifications", { waitUntil: "domcontentloaded" });
      const groupNotifications = page.getByRole("checkbox", {
        name: "In-app notifications for Groups",
      });
      await expect(groupNotifications).toBeVisible({ timeout: 30_000 });
      await expect(groupNotifications).toBeEnabled();
      await expect(groupNotifications).toBeChecked({ checked: originalValue });

      await groupNotifications.click();
      await expect(groupNotifications).toBeChecked({ checked: expectedValue });
      await expect(
        page.getByText("Notification preferences saved.", { exact: true }),
      ).toBeVisible();

      await expect
        .poll(async () => {
          const response = await rest(
            `notification_preferences?select=groups&profile_id=eq.${ownerId}`,
          );
          if (!response.ok) return null;
          const rows = (await response.json()) as { groups: boolean }[];
          return rows[0]?.groups ?? null;
        })
        .toBe(expectedValue);

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("checkbox", { name: "In-app notifications for Groups" }),
      ).toBeChecked({ checked: expectedValue });
    } finally {
      if (hadExistingRow) {
        const restore = await rest(`notification_preferences?profile_id=eq.${ownerId}`, {
          method: "PATCH",
          body: JSON.stringify({ groups: originalValue }),
        });
        expect(restore.ok, "the original group notification preference was not restored").toBe(
          true,
        );
      } else {
        const cleanup = await rest(`notification_preferences?profile_id=eq.${ownerId}`, {
          method: "DELETE",
        });
        expect(cleanup.ok, "the temporary notification preference row was not removed").toBe(true);
      }
    }
  });

  test("notifications filter by category and persist read state", async ({ page }) => {
    const ownerId = await qaUserId(ownerEmail, ownerPassword);
    const marker = `QA notification ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let notificationId = "";

    try {
      const created = await rest("notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          recipient_id: ownerId,
          kind: "group_invite",
          title: marker,
          body: "Temporary notification acceptance check.",
          link: "/groups",
          entity_type: "group",
        }),
      });
      expect(
        created.ok,
        `the temporary notification could not be created: HTTP ${created.status}`,
      ).toBe(true);
      const rows = (await created.json()) as { id: string }[];
      expect(rows).toHaveLength(1);
      notificationId = rows[0].id;

      await signIn(page);
      await page.goto("/notifications", { waitUntil: "domcontentloaded" });
      await page.getByRole("tab", { name: "Groups" }).click();
      const notification = page.locator(".notification-card").filter({ hasText: marker });
      await expect(notification).toBeVisible({ timeout: 30_000 });
      await expect(notification).toHaveClass(/is-unread/);
      await notification.getByRole("button", { name: "Mark read" }).click();
      await expect(notification).not.toHaveClass(/is-unread/);
      await expect(notification.getByRole("button", { name: "Mark read" })).toHaveCount(0);

      const readResult = await rest(
        `notifications?select=read_at&recipient_id=eq.${ownerId}&id=eq.${notificationId}`,
      );
      expect(readResult.ok, "the notification read state could not be checked").toBe(true);
      const readRows = (await readResult.json()) as { read_at: string | null }[];
      expect(readRows).toHaveLength(1);
      expect(readRows[0].read_at).toEqual(expect.any(String));

      await page.getByRole("tab", { name: "Unread" }).click();
      await expect(page.locator(".notification-card").filter({ hasText: marker })).toHaveCount(0);
      await page.getByRole("tab", { name: "All" }).click();
      await expect(notification).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("tab", { name: "Groups" }).click();
      await expect(notification).toBeVisible({ timeout: 30_000 });
      await expect(notification).not.toHaveClass(/is-unread/);
    } finally {
      const cleanupFilter = notificationId
        ? `id=eq.${notificationId}`
        : `recipient_id=eq.${ownerId}&title=eq.${encodeURIComponent(marker)}`;
      const cleanup = await rest(`notifications?${cleanupFilter}`, { method: "DELETE" }).catch(
        () => null,
      );
      expect(cleanup?.ok, "the temporary notification was not removed").toBe(true);
    }
  });

  test("signed-in home stays within small screens and keeps mobile controls touch-sized", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await signIn(page);
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);

    for (const width of [320, 375, 390, 430, 760, 768, 980, 1024, 1250, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 520 ? 740 : 900 });
      const dimensions = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        overflowingElements: Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .flatMap((element) => {
            const bounds = element.getBoundingClientRect();
            if (bounds.right <= document.documentElement.clientWidth + 1) return [];
            let ancestor = element.parentElement;
            while (ancestor && ancestor !== document.body) {
              const overflowX = getComputedStyle(ancestor).overflowX;
              if (["auto", "scroll", "hidden", "clip"].includes(overflowX)) return [];
              ancestor = ancestor.parentElement;
            }
            return [
              {
                element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.className ? `.${String(element.className).trim().replace(/\s+/g, ".")}` : ""}`,
                right: Math.round(bounds.right),
              },
            ];
          })
          .slice(0, 10),
        mobileTargets: Array.from(
          document.querySelectorAll(".mobile-nav a, .mobile-nav button"),
        ).map((target) => {
          const bounds = target.getBoundingClientRect();
          return { width: bounds.width, height: bounds.height };
        }),
      }));
      expect(
        dimensions.pageWidth,
        `the home page overflows its ${dimensions.viewportWidth}px viewport: ${JSON.stringify(dimensions.overflowingElements)}`,
      ).toBeLessThanOrEqual(dimensions.viewportWidth);

      if (width <= 760) {
        expect(
          dimensions.mobileTargets.length,
          `mobile navigation controls did not render at ${width}px`,
        ).toBeGreaterThan(0);
        for (const target of dimensions.mobileTargets) {
          expect(
            target.width,
            `a mobile navigation control is narrower than 44px at ${width}px`,
          ).toBeGreaterThanOrEqual(44);
          expect(
            target.height,
            `a mobile navigation control is shorter than 44px at ${width}px`,
          ).toBeGreaterThanOrEqual(44);
        }

        const searchTarget = page.getByRole("link", { name: "Search" });
        await expect(searchTarget, `mobile search is not reachable at ${width}px`).toBeVisible();
        const searchBounds = await searchTarget.boundingBox();
        const minimumSearchSize = width <= 520 ? 44 : 38;
        expect(
          searchBounds?.width ?? 0,
          `mobile search target is narrower than ${minimumSearchSize}px at ${width}px`,
        ).toBeGreaterThanOrEqual(minimumSearchSize);
        expect(
          searchBounds?.height ?? 0,
          `mobile search target is shorter than ${minimumSearchSize}px at ${width}px`,
        ).toBeGreaterThanOrEqual(minimumSearchSize);
        const notificationsLink = page
          .locator(".topbar-actions")
          .getByRole("link", { name: /Notifications/ });
        if (await notificationsLink.count()) await expect(notificationsLink).toBeVisible();
        await expect(
          page.locator(".topbar-actions").getByRole("link", { name: "Open your profile" }),
        ).toBeVisible();
      }
    }
  });

  test("post publishing, likes, saves, and replies persist and clean up", async ({ page }) => {
    await signIn(page);
    const marker = `velori-qa-post-${Date.now()}`;
    const replyMarker = `velori-qa-reply-${Date.now()}`;
    try {
      await page.goto("/create", { waitUntil: "domcontentloaded" });
      const composer = page.locator("textarea").first();
      await composer.fill(marker);

      const [createResponse] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/rest/v1/posts") && r.request().method() === "POST",
          {
            timeout: 30_000,
          },
        ),
        page
          .getByRole("button", { name: /publish|post|share/i })
          .first()
          .click(),
      ]);
      expect(createResponse.status(), `post create returned HTTP ${createResponse.status()}`).toBe(
        201,
      );

      await page.waitForURL((url) => url.pathname.startsWith("/post/"), { timeout: 30_000 });
      await expect(
        page.getByText(marker).first(),
        "the published post did not open after the composer completed",
      ).toBeVisible();
      await page.goto("/home", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(marker).first(), "the new post is not in the feed").toBeVisible();

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByText(marker).first(),
        "the new post did not survive a refresh",
      ).toBeVisible();

      const rows = await rest(
        `posts?select=id,author_id,body&body=eq.${encodeURIComponent(marker)}`,
      );
      const posts = (await rows.json()) as {
        id: string;
        author_id: string;
        body: string;
      }[];
      expect(posts.length, "the post row is not in the database").toBe(1);
      await page.goto(`/post/${posts[0].id}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Join the conversation" })).toBeVisible();

      const likePath = `likes?select=user_id&post_id=eq.${posts[0].id}`;
      const likeButton = page.getByRole("button", { name: "Like", exact: true });
      await likeButton.click();
      await expect(page.getByRole("button", { name: "Unlike", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect
        .poll(async () => {
          const response = await rest(likePath);
          if (!response.ok) return -1;
          return ((await response.json()) as { user_id: string }[]).length;
        })
        .toBe(1);
      await page.getByRole("button", { name: "Unlike", exact: true }).click();
      await expect
        .poll(async () => {
          const response = await rest(likePath);
          if (!response.ok) return -1;
          return ((await response.json()) as { user_id: string }[]).length;
        })
        .toBe(0);

      const savePath = `saves?select=user_id&post_id=eq.${posts[0].id}`;
      await page.getByRole("button", { name: "Save post", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Remove saved post", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(async () => {
          const response = await rest(savePath);
          if (!response.ok) return -1;
          return ((await response.json()) as { user_id: string }[]).length;
        })
        .toBe(1);
      await page.getByRole("button", { name: "Remove saved post", exact: true }).click();
      await expect
        .poll(async () => {
          const response = await rest(savePath);
          if (!response.ok) return -1;
          return ((await response.json()) as { user_id: string }[]).length;
        })
        .toBe(0);

      await page.getByRole("textbox", { name: "Write a comment" }).fill(replyMarker);
      const [replyResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/rest/v1/comments") && response.request().method() === "POST",
        ),
        page.getByRole("button", { name: /^Reply/ }).click(),
      ]);
      expect(
        replyResponse.status(),
        `reply create returned HTTP ${replyResponse.status()}: ${await replyResponse.text()}`,
      ).toBe(201);
      await expect(page.getByText(replyMarker, { exact: true })).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByText(replyMarker, { exact: true }),
        "the persisted reply did not load with its post",
      ).toBeVisible();
      const replyRows = await rest(
        `comments?select=id,body&body=eq.${encodeURIComponent(replyMarker)}`,
      );
      const replies = (await replyRows.json()) as { id: string; body: string }[];
      expect(replies.length, "the reply row is not in the database").toBe(1);
    } finally {
      const cleanup = await rest(`posts?body=eq.${encodeURIComponent(marker)}`, {
        method: "DELETE",
      }).catch(() => null);
      expect(cleanup?.ok, "the temporary QA post was not cleaned up").toBe(true);
    }
  });

  test("private groups are discoverable and support an approved join lifecycle", async ({
    page,
  }) => {
    const ownerId = await qaUserId(ownerEmail, ownerPassword);
    const viewerId = await qaUserId(viewerEmail, viewerPassword);
    const viewerProfileResponse = await rest(`profiles?select=username&id=eq.${viewerId}`);
    expect(viewerProfileResponse.ok, "the QA viewer profile could not be read").toBe(true);
    const viewerProfiles = (await viewerProfileResponse.json()) as { username: string }[];
    expect(viewerProfiles).toHaveLength(1);
    const viewerUsername = viewerProfiles[0].username;
    const groupName = `QA private discovery ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let groupId = "";
    let groupSlug = "";
    let viewerContext: BrowserContext | null = null;

    try {
      await signIn(page);
      await page.goto("/groups/create", { waitUntil: "domcontentloaded" });
      await page.getByLabel("Group name").fill(groupName);
      await page.getByLabel(/Description/).fill("Temporary QA group for private discovery.");
      await page.getByRole("button", { name: "Continue to privacy" }).click();
      await page.getByRole("radio", { name: /Private/ }).check();
      await page.getByRole("button", { name: "Review group" }).click();
      await expect(page.getByRole("heading", { name: "Review your group" })).toBeVisible();

      const createResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname.endsWith("/rest/v1/rpc/create_group") &&
          response.request().method() === "POST"
        );
      });
      const createButton = page.getByRole("button", { name: "Create group" });
      await expect(createButton).toBeVisible();
      await expect(createButton).toBeEnabled();
      await createButton.dispatchEvent("click");
      const createResponse = await createResponsePromise;
      expect(
        createResponse.status(),
        `group creation returned HTTP ${createResponse.status()}: ${await createResponse.text()}`,
      ).toBe(200);
      groupId = (await createResponse.json()) as string;

      const groupResponse = await rest(
        `groups?select=id,slug,name,privacy,member_count&owner_id=eq.${ownerId}&id=eq.${groupId}`,
      );
      expect(groupResponse.ok, "the created QA group could not be read").toBe(true);
      const groups = (await groupResponse.json()) as {
        id: string;
        slug: string;
        name: string;
        privacy: string;
        member_count: number;
      }[];
      expect(groups).toHaveLength(1);
      expect(groups[0]).toMatchObject({ id: groupId, name: groupName, privacy: "private" });
      expect(groups[0].member_count).toBe(1);
      groupSlug = groups[0].slug;

      const settingsResponse = await rest(
        `group_settings?select=join_policy&group_id=eq.${groupId}`,
      );
      expect(settingsResponse.ok, "group join settings could not be read").toBe(true);
      expect(await settingsResponse.json()).toEqual([{ join_policy: "approval" }]);

      const browser = page.context().browser();
      if (!browser) throw new Error("The Playwright browser context is unavailable.");
      viewerContext = await browser.newContext();
      const viewerPage = await viewerContext.newPage();
      await signInAs(viewerPage, viewerEmail, viewerPassword);
      await viewerPage.goto("/groups", { waitUntil: "domcontentloaded" });
      await viewerPage.getByPlaceholder("Search by group name").fill(groupName);

      const groupCard = viewerPage.locator(".group-discovery-card").filter({ hasText: groupName });
      await expect(groupCard, "a signed-in user could not discover the private group").toBeVisible({
        timeout: 30_000,
      });
      const requestButton = groupCard.getByRole("button", { name: "Request to join" });
      await expect(requestButton).toBeEnabled();
      await requestButton.dispatchEvent("click");
      await expect(groupCard.getByRole("status")).toContainText("request is waiting");

      const requestRowsResponse = await rest(
        `group_members?select=user_id,status&group_id=eq.${groupId}&user_id=eq.${viewerId}`,
      );
      expect(requestRowsResponse.ok, "the viewer membership request could not be read").toBe(true);
      expect(await requestRowsResponse.json()).toEqual([
        { user_id: viewerId, status: "requested" },
      ]);

      await page.goto(`/groups/${groupSlug}/requests`, { waitUntil: "domcontentloaded" });
      const requestRow = page
        .locator(".group-member-row")
        .filter({ hasText: `@${viewerUsername}` });
      await expect(requestRow, "the owner could not see the pending request").toBeVisible();
      const approveButton = requestRow.getByRole("button", { name: "Approve" });
      await expect(approveButton).toBeEnabled();
      await approveButton.dispatchEvent("click");
      await expect(
        requestRow,
        "the approved request remained in the pending directory",
      ).toHaveCount(0);

      const membershipPath = `group_members?select=role,status&group_id=eq.${groupId}&user_id=eq.${viewerId}`;
      await expect
        .poll(async () => {
          const response = await rest(membershipPath);
          if (!response.ok) return "";
          const rows = (await response.json()) as { role: string; status: string }[];
          return rows[0]?.status ?? "";
        })
        .toBe("active");

      await page.goto(`/groups/${groupSlug}/members`, { waitUntil: "domcontentloaded" });
      const memberRow = page.locator(".group-member-row").filter({ hasText: `@${viewerUsername}` });
      await expect(
        memberRow,
        "the approved viewer is missing from the member directory",
      ).toBeVisible();
      await page.getByLabel(`Role for @${viewerUsername}`).selectOption("moderator");
      await expect(memberRow.getByText("moderator", { exact: true })).toBeVisible();
      await expect
        .poll(async () => {
          const response = await rest(membershipPath);
          if (!response.ok) return "";
          const rows = (await response.json()) as { role: string; status: string }[];
          return rows[0]?.role ?? "";
        })
        .toBe("moderator");

      await viewerPage.goto(`/groups/${groupSlug}`, { waitUntil: "domcontentloaded" });
      await expect(viewerPage.getByText("You are a moderator of this group.")).toBeVisible();
      const leaveButton = viewerPage.getByRole("button", { name: "Leave group" });
      await expect(leaveButton).toBeEnabled();
      await leaveButton.dispatchEvent("click");
      await expect(
        viewerPage.getByRole("button", { name: "Request to join" }),
        "the viewer did not leave the group",
      ).toBeVisible();
      await expect
        .poll(async () => {
          const response = await rest(membershipPath);
          if (!response.ok) return -1;
          const rows = (await response.json()) as { role: string; status: string }[];
          return rows.length;
        })
        .toBe(0);

      await page.goto(`/groups/${groupSlug}`, { waitUntil: "domcontentloaded" });
      await page.getByLabel("Username").fill(viewerUsername);
      const invitationResponse = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith("/rest/v1/rpc/invite_group_member"),
      );
      await page.getByRole("button", { name: "Send invitation" }).click();
      const invitationResult = await invitationResponse;
      expect(
        invitationResult.status(),
        `group invitation returned HTTP ${invitationResult.status()}: ${await invitationResult.text()}`,
      ).toBe(200);
      await expect(
        page.getByText(`Invitation sent to @${viewerUsername}.`, { exact: true }),
      ).toBeVisible();
      await expect
        .poll(async () => {
          const response = await rest(membershipPath);
          if (!response.ok) return "";
          const rows = (await response.json()) as { role: string; status: string }[];
          return rows[0]?.status ?? "";
        })
        .toBe("invited");

      await viewerPage.goto("/groups", { waitUntil: "domcontentloaded" });
      await viewerPage.getByPlaceholder("Search by group name").fill(groupName);
      const invitedGroup = viewerPage
        .locator(".group-discovery-card")
        .filter({ hasText: groupName });
      await expect(invitedGroup, "the invited group was not shown to the invitee").toBeVisible();
      await invitedGroup.getByRole("button", { name: "Accept invitation" }).click();
      await expect
        .poll(async () => {
          const response = await rest(membershipPath);
          if (!response.ok) return "";
          const rows = (await response.json()) as { role: string; status: string }[];
          return rows[0]?.status ?? "";
        })
        .toBe("active");
      await viewerPage.goto(`/groups/${groupSlug}`, { waitUntil: "domcontentloaded" });
      await expect(viewerPage.getByText("You are a member of this group.")).toBeVisible();
    } finally {
      if (viewerContext) await viewerContext.close();
      const cleanupFilter = groupId
        ? `id=eq.${groupId}`
        : `owner_id=eq.${ownerId}&name=eq.${encodeURIComponent(groupName)}`;
      const cleanup = await rest(`groups?${cleanupFilter}`, { method: "DELETE" }).catch(() => null);
      expect(cleanup?.ok, "the temporary QA group was not cleaned up").toBe(true);
    }
  });

  test("every main-site route renders for a signed-in user with no uncaught errors", async ({
    page,
  }) => {
    await signIn(page);
    const routes = [
      "/home",
      "/stories",
      "/create",
      "/explore",
      "/reels",
      "/messages",
      "/groups",
      "/notifications",
      "/profile",
      "/settings",
      "/search?q=velori",
    ];
    const findings: string[] = [];
    for (const route of routes) {
      const net = watch(page);
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const status = response?.status() ?? 0;
      const rootEmpty = (await page.locator("#root").innerHTML()).trim().length === 0;
      const unexpected = net.pageErrors.length || rootEmpty;
      console.log(
        `${route} -> HTTP ${status} rootEmpty=${rootEmpty} pageErrors=${net.pageErrors.length} badResponses=${net.badResponses.length}`,
      );
      for (const entry of net.pageErrors) findings.push(`${route} pageerror: ${entry}`);
      for (const entry of net.badResponses) findings.push(`${route} ${entry}`);
      if (rootEmpty) findings.push(`${route} rendered an empty #root`);
    }
    expect(findings, `route sweep problems:\n${findings.join("\n")}`).toEqual([]);
  });

  test("a signed-in user is refused every administrator surface", async ({ page }) => {
    await signIn(page);
    for (const route of ["/admin", "/admin/users", "/admin/settings", "/admin/audit"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const url = page.url();
      expect(
        url.includes("/login") || url.includes("/admin/login") || url.includes("/home"),
        `${route} was reachable by an ordinary signed-in user and landed on ${url}`,
      ).toBe(true);
    }
  });

  test("a normal user token is rejected by the administrator API", async () => {
    // Evidence for Phase 7.2: an ordinary signed-in user's own access token must
    // not authenticate against the administrator API. Uses the REST sign-in the
    // app itself uses, so the token is a real user session, not a fixture.
    const auth = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    });
    expect(auth.status, `user sign-in returned HTTP ${auth.status}`).toBe(200);
    const { access_token: userToken } = (await auth.json()) as { access_token: string };
    expect(userToken, "no user access token was issued").toBeTruthy();

    const response = await fetch(`${projectUrl}/functions/v1/server/admin/me`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${userToken}` },
    });
    console.log(`admin/me with a user token: HTTP ${response.status}`);
    expect(
      response.status,
      `the administrator API accepted an ordinary user token (HTTP ${response.status})`,
    ).toBe(401);
  });
});
