import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MOTION_CONFIG,
  isWithinMaintenanceWindow,
  isMaintenanceTargetMatch,
  normalizeMotionConfig,
  resolveErrorMotion,
  resolvePageExperience,
  resolvePageMotion,
} from "../../supabase/functions/_shared/motion-config.mjs";

test("global published motion has an immediate safe fallback", () => {
  const result = resolvePageMotion(DEFAULT_MOTION_CONFIG, {
    pathname: "/home",
    pageType: "feed",
    device: "desktop",
  });
  assert.equal(result.preset, "page-crossfade");
  assert.equal(result.source, "global");
});

test("page experience overrides resolve registered dynamic routes and sanitize unsafe assets", () => {
  const config = normalizeMotionConfig({
    ...DEFAULT_MOTION_CONFIG,
    pageExperiences: [
      {
        route: "/profile/:username",
        loading: {
          enabled: true,
          preset: "pulse",
          message: "Loading this profile",
          assetUrl: "javascript:alert(1)",
        },
        error: { enabled: true, actionUrl: "//evil.example" },
      },
    ],
  });

  const resolved = resolvePageExperience(config, "/profile/aryan/");
  assert.equal(resolved.route, "/profile/:username");
  assert.equal(resolved.loading.message, "Loading this profile");
  assert.equal(resolved.loading.assetUrl, "");
  assert.equal(resolved.error.actionUrl, "");
  assert.equal(resolvePageExperience(config, "/profile/aryan/posts"), null);
});

test("page experiences reject unsafe routes and duplicate route assignments", () => {
  assert.throws(() =>
    normalizeMotionConfig({
      ...DEFAULT_MOTION_CONFIG,
      pageExperiences: [{ route: "/messages?admin=true" }],
    }),
  );
  assert.throws(() =>
    normalizeMotionConfig({
      ...DEFAULT_MOTION_CONFIG,
      pageExperiences: [{ route: "/messages" }, { route: "/messages" }],
    }),
  );
});

test("exact route outranks route pattern and page type", () => {
  const config = {
    ...DEFAULT_MOTION_CONFIG,
    pageRules: [
      { id: "page", ruleType: "page_type", pageType: "profile", preset: "fade", priority: 999 },
      { id: "pattern", ruleType: "pattern", routePattern: "/profile/*", preset: "fade-up" },
      { id: "exact", ruleType: "exact", routePattern: "/profile/arya", preset: "scale-soft" },
    ],
  };
  const result = resolvePageMotion(config, {
    pathname: "/profile/arya",
    pageType: "profile",
    device: "desktop",
  });
  assert.equal(result.id, "exact");
  assert.equal(result.preset, "scale-soft");
});

test("the most specific matching route pattern wins before priority", () => {
  const config = {
    ...DEFAULT_MOTION_CONFIG,
    pageRules: [
      { id: "broad", ruleType: "pattern", routePattern: "/groups/*", preset: "fade" },
      {
        id: "specific",
        ruleType: "pattern",
        routePattern: "/groups/invites/*",
        preset: "fade-left",
      },
    ],
  };
  const result = resolvePageMotion(config, {
    pathname: "/groups/invites/abc",
    pageType: "groups",
    device: "mobile",
  });
  assert.equal(result.id, "specific");
});

test("a disabled rule is skipped and global motion can be disabled", () => {
  const config = {
    ...DEFAULT_MOTION_CONFIG,
    pageRules: [
      { id: "off", ruleType: "exact", routePattern: "/home", preset: "fade", enabled: false },
    ],
  };
  const result = resolvePageMotion(config, {
    pathname: "/home",
    pageType: "feed",
    device: "desktop",
  });
  assert.equal(result.source, "global");
  assert.equal(
    resolvePageMotion(
      { ...config, global: { ...config.global, enabled: false } },
      {
        pathname: "/home",
        pageType: "feed",
        device: "desktop",
      },
    ).preset,
    "none",
  );
});

test("error rules resolve by exact error and route before general error fallback", () => {
  const config = {
    ...DEFAULT_MOTION_CONFIG,
    errorRules: [
      {
        id: "general",
        ruleType: "pattern",
        routePattern: "/profile/*",
        errorType: "NOT_FOUND",
        preset: "glow",
      },
      {
        id: "media",
        ruleType: "pattern",
        routePattern: "/profile/*",
        errorType: "MEDIA_UNAVAILABLE",
        preset: "blur-in",
      },
    ],
  };
  const result = resolveErrorMotion(config, {
    pathname: "/profile/missing",
    pageType: "profile",
    errorType: "MEDIA_UNAVAILABLE",
    device: "desktop",
  });
  assert.equal(result.id, "media");
  assert.equal(result.preset, "blur-in");
});

test("invalid route patterns and unknown presets are rejected", () => {
  assert.throws(() =>
    normalizeMotionConfig({
      ...DEFAULT_MOTION_CONFIG,
      pageRules: [{ ruleType: "pattern", routePattern: "/profile/*/posts/*", preset: "fade" }],
    }),
  );
  assert.throws(() =>
    normalizeMotionConfig({
      ...DEFAULT_MOTION_CONFIG,
      pageRules: [{ ruleType: "exact", routePattern: "/home", preset: "javascript:alert(1)" }],
    }),
  );
});

test("invalid colors and unsafe action URLs fall back safely", () => {
  const safe = normalizeMotionConfig({
    ...DEFAULT_MOTION_CONFIG,
    theme: { ...DEFAULT_MOTION_CONFIG.theme, brandPink: "url(javascript:bad)" },
    errorPages: { NOT_FOUND: { primaryUrl: "javascript:alert(1)", title: "Missing" } },
  });
  assert.equal(safe.theme.brandPink, DEFAULT_MOTION_CONFIG.theme.brandPink);
  assert.equal(safe.errorPages.NOT_FOUND.primaryUrl, "");
});

test("error rules resolve exact routes before pattern rules and page-level defaults", () => {
  const config = {
    ...DEFAULT_MOTION_CONFIG,
    errorPages: { NOT_FOUND: { preset: "error-reveal" } },
    errorRules: [
      {
        id: "pattern",
        ruleType: "pattern",
        routePattern: "/profile/*",
        errorType: "NOT_FOUND",
        preset: "fade-up",
      },
      {
        id: "exact",
        ruleType: "exact",
        routePattern: "/profile/missing",
        errorType: "*",
        preset: "blur-in",
      },
    ],
  };
  assert.equal(
    resolveErrorMotion(config, {
      pathname: "/profile/missing",
      pageType: "profile",
      errorType: "NOT_FOUND",
      device: "desktop",
    }).id,
    "exact",
  );
  assert.equal(
    resolveErrorMotion(config, {
      pathname: "/profile/other",
      pageType: "profile",
      errorType: "NOT_FOUND",
      device: "desktop",
    }).preset,
    "fade-up",
  );
  assert.equal(
    resolveErrorMotion(config, {
      pathname: "/groups/other",
      pageType: "groups",
      errorType: "NOT_FOUND",
      device: "desktop",
    }).preset,
    "error-reveal",
  );
});

test("route-specific error content resolves from the published matching rule", () => {
  const config = normalizeMotionConfig({
    ...DEFAULT_MOTION_CONFIG,
    errorRules: [
      {
        id: "global-profile",
        ruleType: "pattern",
        routePattern: "/profile/*",
        errorType: "NOT_FOUND",
        preset: "fade-up",
        title: "This profile moved",
        subtitle: "Find another creator to follow.",
        assetUrl: "/storage/v1/object/public/site-assets/errors/profile.svg",
        primaryLabel: "Explore",
        primaryUrl: "/explore",
      },
    ],
  });
  const resolved = resolveErrorMotion(config, {
    pathname: "/profile/missing",
    pageType: "profile",
    errorType: "NOT_FOUND",
    device: "desktop",
  });
  assert.equal(resolved.source, "error-rule");
  assert.equal(resolved.page.title, "This profile moved");
  assert.equal(resolved.page.subtitle, "Find another creator to follow.");
  assert.equal(
    resolved.page.illustrationUrl,
    "/storage/v1/object/public/site-assets/errors/profile.svg",
  );
  assert.equal(resolved.page.primaryUrl, "/explore");
});

test("maintenance target resolver handles site, exact route and route group scope", () => {
  assert.equal(isMaintenanceTargetMatch("site", null, "/messages"), true);
  assert.equal(isMaintenanceTargetMatch("route", "/messages", "/messages/"), true);
  assert.equal(isMaintenanceTargetMatch("route", "/messages", "/messages/thread"), false);
  assert.equal(isMaintenanceTargetMatch("group", "/messages/*", "/messages"), true);
  assert.equal(isMaintenanceTargetMatch("group", "/messages/*", "/messages/thread/1"), true);
  assert.equal(isMaintenanceTargetMatch("group", "/messages/*", "/groups/one"), false);
  assert.equal(isMaintenanceTargetMatch("group", "/messages/*", "/admin/settings"), false);
});

test("scheduled rules and unsupported execution modes are validated safely", () => {
  const rule = { ruleType: "exact", routePattern: "/home", preset: "fade" };
  assert.throws(
    () =>
      normalizeMotionConfig({
        ...DEFAULT_MOTION_CONFIG,
        pageRules: [{ ...rule, trigger: "interaction" }],
      }),
    /trigger/,
  );
  assert.throws(
    () =>
      normalizeMotionConfig({
        ...DEFAULT_MOTION_CONFIG,
        pageRules: [{ ...rule, repeat: "loop" }],
      }),
    /repeat/,
  );
  assert.throws(
    () =>
      normalizeMotionConfig({
        ...DEFAULT_MOTION_CONFIG,
        pageRules: [{ ...rule, startsAt: "not-a-date" }],
      }),
    /schedule/,
  );
});

test("custom error illustrations only resolve from public site-assets", () => {
  const safe = normalizeMotionConfig({
    ...DEFAULT_MOTION_CONFIG,
    errorPages: {
      NOT_FOUND: { illustrationUrl: "https://evil.example/image.svg" },
      SERVER_ERROR: {
        illustrationUrl:
          "https://velori.supabase.co/storage/v1/object/public/site-assets/errors/server.svg",
      },
      FORBIDDEN: { illustrationUrl: "/storage/v1/object/public/site-assets/errors/forbidden.svg" },
    },
  });
  assert.equal(safe.errorPages.NOT_FOUND.illustrationUrl, "");
  assert.match(safe.errorPages.SERVER_ERROR.illustrationUrl, /site-assets/);
  assert.match(safe.errorPages.FORBIDDEN.illustrationUrl, /^\//);
});

test("maintenance schedules open at their start and close at their end", () => {
  const now = Date.parse("2026-10-06T10:00:00Z");
  assert.equal(
    isWithinMaintenanceWindow("2026-10-06T10:01:00Z", "2026-10-06T11:00:00Z", now),
    false,
  );
  assert.equal(
    isWithinMaintenanceWindow("2026-10-06T10:00:00Z", "2026-10-06T11:00:00Z", now),
    true,
  );
  assert.equal(isWithinMaintenanceWindow(null, null, now), true);
  assert.equal(
    isWithinMaintenanceWindow("2026-10-06T12:00:00Z", "2026-10-06T11:00:00Z", now),
    false,
  );
  assert.equal(isWithinMaintenanceWindow("invalid", null, now), false);
});

test("public resolution skips a corrupted rule and keeps valid rules usable", () => {
  const result = resolvePageMotion(
    {
      ...DEFAULT_MOTION_CONFIG,
      pageRules: [
        { ruleType: "pattern", routePattern: "/profile/*/nested/*", preset: "fade" },
        { ruleType: "exact", routePattern: "/home", preset: "fade-up" },
      ],
    },
    { pathname: "/home", pageType: "feed", device: "desktop" },
  );
  assert.equal(result.preset, "fade-up");
  assert.throws(() =>
    normalizeMotionConfig({
      ...DEFAULT_MOTION_CONFIG,
      pageRules: [{ ruleType: "pattern", routePattern: "/profile/*/nested/*", preset: "fade" }],
    }),
  );
});

test("component motion accepts only presets wired to supported shared components", () => {
  const safe = normalizeMotionConfig({
    ...DEFAULT_MOTION_CONFIG,
    componentRules: [
      { componentId: "button-hover", preset: "scale-soft", durationMs: 180, intensity: "subtle" },
    ],
  });
  assert.equal(safe.componentRules[0].preset, "scale-soft");
  assert.throws(() =>
    normalizeMotionConfig({
      ...DEFAULT_MOTION_CONFIG,
      componentRules: [{ componentId: "button-hover", preset: "float", durationMs: 180 }],
    }),
  );
});

test("disabling motion keeps published visual and error-page settings", () => {
  const config = {
    ...DEFAULT_MOTION_CONFIG,
    global: { ...DEFAULT_MOTION_CONFIG.global, enabled: false },
    pageRules: [
      {
        ruleType: "exact",
        routePattern: "/explore",
        preset: "fade-up",
        backgroundColor: "#fafafa",
        surfaceColor: "#ffffff",
      },
    ],
    errorRules: [
      {
        ruleType: "pattern",
        routePattern: "/profile/*",
        errorType: "NOT_FOUND",
        preset: "glow",
        title: "This profile is unavailable",
      },
    ],
    errorPages: { NOT_FOUND: { title: "Still visible", preset: "error-reveal" } },
  };
  const page = resolvePageMotion(config, {
    pathname: "/explore",
    pageType: "explore",
    device: "desktop",
  });
  assert.equal(page.preset, "none");
  assert.equal(page.backgroundColor, "#fafafa");
  const error = resolveErrorMotion(config, {
    pathname: "/profile/missing",
    pageType: "profile",
    device: "desktop",
    errorType: "NOT_FOUND",
  });
  assert.equal(error.preset, "none");
  assert.equal(error.page.title, "This profile is unavailable");
});
