import { expect, test } from "@playwright/test";
import { resolveValue } from "../scripts/env.mjs";

/**
 * The last mile of the administrator-to-visitor chain, in a real browser.
 *
 * `scripts/_qa-config-chain.mjs` proves an administrator's change reaches the
 * public document and the shared resolver. This proves a real visitor's browser
 * actually paints it, and that the two ways this can go wrong -- an asset that
 * does not exist, and an animation that never completes -- both degrade instead
 * of blocking the page forever.
 *
 * The original motion document is captured before the change and restored
 * afterwards, including when an assertion fails.
 */

const supabaseUrl = resolveValue("VITE_SUPABASE_URL");
const adminUsername = resolveValue("VELORI_QA_SUPER_ADMIN_USERNAME", { secret: true });
const adminPassword = resolveValue("VELORI_QA_SUPER_ADMIN_PASSWORD", { secret: true });
const functionUrl = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/server` : "";

const MARKER = `velori-browser-probe-${Date.now()}`;
// Shape-valid for `safeAssetUrl`, but deliberately absent from the bucket so the
// asset-failure fallback is exercised for real.
const MISSING_ASSET = `/storage/v1/object/public/site-assets/${MARKER}.mp4`;

let originalDraft: Record<string, unknown> | null = null;
let sessionToken = "";

async function adminFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${functionUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function publish(config: Record<string, unknown>, summary: string) {
  const saved = await adminFetch("/admin/design/motion/draft", {
    method: "PUT",
    body: JSON.stringify({ config, summary }),
  });
  if (saved.status !== 200) throw new Error(`draft save failed: HTTP ${saved.status}`);
  const published = await adminFetch("/admin/design/motion/publish", {
    method: "POST",
    body: JSON.stringify({ summary }),
  });
  if (published.status !== 200) throw new Error(`publish failed: HTTP ${published.status}`);
}

test.describe.configure({ mode: "serial" });

test("an administrator's startup animation reaches the browser and cannot block the page", async ({
  page,
}) => {
  test.skip(
    !adminUsername || !adminPassword || !supabaseUrl,
    "QA super-admin credentials and Supabase URL are required",
  );
  test.setTimeout(180_000);

  const login = await fetch(`${functionUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: adminUsername,
      password: adminPassword,
    }),
  });
  const session = await login.json();
  sessionToken = session.sessionToken;
  expect(sessionToken, `admin login HTTP ${login.status}`).toBeTruthy();
  await fetch(`${functionUrl}/admin/reauthenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ password: adminPassword }),
  });

  const current = await adminFetch("/admin/design/motion");
  const draft = (current.body?.config ??
    current.body?.draftConfig ??
    current.body?.draft) as Record<string, unknown>;
  expect(draft, `could not read the draft document (HTTP ${current.status})`).toBeTruthy();
  originalDraft = JSON.parse(JSON.stringify(draft));

  // `/home` gets a distinctive preset and an asset that does not exist.
  const configured = JSON.parse(JSON.stringify(originalDraft)) as Record<string, unknown>;
  configured.pageExperiences = [
    {
      route: "/home",
      enabled: true,
      startup: {
        enabled: true,
        preset: "glow",
        assetUrl: MISSING_ASSET,
        durationMs: 600,
        delayMs: 0,
        minimumDisplayMs: 200,
        loop: false,
        // Off, so a second navigation still exercises the animation.
        showOncePerSession: false,
      },
      loading: { enabled: false, preset: "shimmer", assetUrl: "", durationMs: 900, message: "" },
      error: {
        enabled: false,
        preset: "error-reveal",
        assetUrl: "",
        title: "",
        message: "",
        backgroundColor: "",
        actionLabel: "",
        actionUrl: "",
      },
      maintenance: {
        enabled: false,
        preset: "error-reveal",
        assetUrl: "",
        title: "",
        message: "",
        backgroundColor: "",
        actionLabel: "",
        actionUrl: "",
      },
    },
  ];
  await publish(configured, "browser chain probe");

  try {
    // A fresh context, so no sessionStorage carries over.
    const context = await page
      .context()
      .browser()!
      .newContext({ baseURL: "http://localhost:8443" });
    const visitor = await context.newPage();
    const pageErrors: string[] = [];
    visitor.on("pageerror", (e) => pageErrors.push(e.message));

    // Attached before the first navigation so the asset request cannot be missed.
    // Reading `src` off the video element instead would be unreliable, because
    // the element is already replaced by the fallback once the missing file
    // errors.
    const assetRequests: string[] = [];
    visitor.on("request", (r) => {
      if (r.url().includes(MARKER)) assetRequests.push(r.url());
    });

    const started = Date.now();
    await visitor.goto("/home", { waitUntil: "domcontentloaded" });

    // The administrator's preset must be what the browser paints. This has to be
    // polled, not read once: the intro element exists in its "waiting" phase
    // before the published motion document arrives, so the first paint carries
    // no preset and only settles onto the configured override later.
    const intro = visitor.locator(".startup-intro");
    const presetsSeen = new Set<string>();
    await expect
      .poll(
        async () => {
          const value = await intro
            .first()
            .getAttribute("data-motion-preset")
            .catch(() => null);
          if (value) presetsSeen.add(value);
          return value;
        },
        { timeout: 20_000, message: "the configured startup preset never reached the browser" },
      )
      .toBe("glow");
    console.log(`startup presets observed: ${[...presetsSeen].join(" -> ")}`);
    expect(
      [...presetsSeen],
      "the intro painted a preset before the configuration arrived, so the wrong animation flashes first",
    ).toEqual(["glow"]);

    // The browser must actually fetch the administrator's configured asset.
    await expect
      .poll(() => assetRequests.length, {
        timeout: 20_000,
        message: "the configured asset was never requested",
      })
      .toBeGreaterThan(0);
    console.log(
      `configured asset requested: ${assetRequests[0]?.replace(/^.*site-assets\//, "site-assets/")}`,
    );

    // The asset does not exist, so the intro must fall back and then clear.
    // This is the whole point: a missing file may never block the page.
    await expect
      .poll(async () => (await intro.count()) === 0, {
        timeout: 20_000,
        message: "the startup intro never cleared after its asset failed",
      })
      .toBe(true);
    const clearedAfter = Date.now() - started;
    console.log(`startup intro cleared after ${clearedAfter} ms`);

    // The page must be genuinely usable, not merely unpainted.
    await expect(visitor.locator("#root")).not.toBeEmpty();
    const links = await visitor.locator('a[href="/login"], a[href="/signup"]').count();
    console.log(`visitor entry page interactive links=${links}`);
    expect(links, "the visitor entry page rendered no navigation after the intro").toBeGreaterThan(
      0,
    );
    expect(pageErrors, `uncaught errors: ${pageErrors.join(" | ")}`).toEqual([]);

    await context.close();
  } finally {
    if (originalDraft) {
      await publish(originalDraft, "restore pre-probe document");
      const restored = await adminFetch("/admin/design/motion");
      const now = JSON.stringify(
        (restored.body?.config ?? restored.body?.draftConfig ?? restored.body?.draft)
          ?.pageExperiences ?? [],
      );
      console.log(`restored pageExperiences=${now}`);
      expect(now, "the original motion document was not restored").not.toContain(MARKER);
    }
    if (sessionToken) {
      await fetch(`${functionUrl}/admin/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
    }
  }
});
