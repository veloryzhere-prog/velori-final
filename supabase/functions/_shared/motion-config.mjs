export const MOTION_PRESETS = [
  "none",
  "fade",
  "fade-up",
  "fade-down",
  "fade-left",
  "fade-right",
  "scale-soft",
  "blur-in",
  "page-crossfade",
  "page-slide",
  "modal-rise",
  "toast-slide",
  "pulse",
  "shimmer",
  "float",
  "glow",
  "error-reveal",
];

export const PAGE_TYPES = [
  "feed",
  "explore",
  "search",
  "create",
  "reels",
  "stories",
  "messages",
  "notifications",
  "groups",
  "profile",
  "settings",
  "auth",
  "legal",
  "admin",
  "content-detail",
  "error",
];

export const ERROR_TYPES = [
  "NOT_FOUND",
  "FORBIDDEN",
  "RATE_LIMITED",
  "SERVER_ERROR",
  "BAD_GATEWAY",
  "MAINTENANCE",
  "OFFLINE",
  "AUTH_FAILURE",
  "CONTENT_UNAVAILABLE",
  "MEDIA_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "APPLICATION_ERROR",
];

export const DEFAULT_MOTION_CONFIG = Object.freeze({
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
  creatorStudio: {
    schemaVersion: 1,
    themes: {
      story: {
        primary: "#f05a9d",
        accent: "#3478f6",
        background: "#fff8fc",
        surface: "#ffffff",
        text: "#17131b",
      },
      reel: {
        primary: "#f05a9d",
        accent: "#3478f6",
        background: "#fff8fc",
        surface: "#ffffff",
        text: "#17131b",
      },
      post: {
        primary: "#f05a9d",
        accent: "#3478f6",
        background: "#fff8fc",
        surface: "#ffffff",
        text: "#17131b",
      },
    },
    stickers: [],
  },
  pageRules: [],
  pageExperiences: [],
  errorRules: [],
  errorPages: {},
  componentRules: [
    {
      componentId: "button-hover",
      preset: "scale-soft",
      enabled: true,
      durationMs: 160,
      intensity: "subtle",
    },
    {
      componentId: "card-hover",
      preset: "fade-up",
      enabled: true,
      durationMs: 220,
      intensity: "subtle",
    },
    {
      componentId: "loading",
      preset: "shimmer",
      enabled: true,
      durationMs: 1200,
      intensity: "subtle",
    },
    {
      componentId: "empty-state",
      preset: "fade-up",
      enabled: true,
      durationMs: 240,
      intensity: "subtle",
    },
  ],
});

const EASINGS = ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "spring"];
const INTENSITIES = ["off", "subtle", "standard", "expressive", "cinematic"];
const SPEEDS = ["slow", "normal", "fast"];
const RULE_TYPES = ["exact", "pattern", "page_type"];
const DEVICES = ["all", "desktop", "tablet", "mobile"];
const ERROR_LAYOUTS = ["centered", "split", "illustration-top"];
const ERROR_ALIGNMENTS = ["left", "center", "right"];
const COMPONENT_IDS = ["button-hover", "card-hover", "loading", "empty-state"];
const COMPONENT_PRESETS = {
  "button-hover": ["none", "fade", "scale-soft"],
  "card-hover": ["none", "fade-up", "scale-soft"],
  loading: ["none", "fade", "pulse", "shimmer"],
  "empty-state": ["none", "fade", "fade-up"],
};

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function choice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function boundedInteger(value, min, max, fallback) {
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function boundedNumber(value, min, max, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

function text(value, maxLength, fallback = "") {
  return typeof value === "string" && value.length <= maxLength ? value.trim() : fallback;
}

export function isSafeRoutePattern(value, kind) {
  if (typeof value !== "string" || value.length > 160 || !value.startsWith("/")) return false;
  if (value.includes("?") || value.includes("#") || value.includes("..") || value.includes("\\"))
    return false;
  if (kind === "exact") return !value.includes("*");
  if (kind === "pattern") {
    return (
      value.endsWith("/*") &&
      value.indexOf("*") === value.length - 1 &&
      !value.slice(0, -2).includes("*")
    );
  }
  return false;
}

export function isMaintenanceTargetMatch(scope, target, pathname) {
  const path =
    typeof pathname === "string" ? pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/" : "/";
  const value = typeof target === "string" ? target.trim().replace(/\/+$/, "") || "/" : "";
  if (scope === "site") return true;
  if (!value || !path.startsWith("/") || path.startsWith("/admin")) return false;
  if (scope === "page" || scope === "route") return path === value;
  if (scope !== "group" || !value.endsWith("/*")) return false;
  const base = value.slice(0, -2).replace(/\/$/, "") || "/";
  return path === base || path.startsWith(`${base}/`);
}

export function isWithinMaintenanceWindow(startsAt, endsAt, now = Date.now()) {
  const parseBoundary = (value) =>
    value == null || value === ""
      ? null
      : typeof value === "string"
        ? Date.parse(value)
        : Number.NaN;
  const start = parseBoundary(startsAt);
  const end = parseBoundary(endsAt);
  if (
    !Number.isFinite(now) ||
    (start !== null && !Number.isFinite(start)) ||
    (end !== null && !Number.isFinite(end)) ||
    (start !== null && end !== null && end <= start)
  ) {
    return false;
  }
  return (start === null || now >= start) && (end === null || now < end);
}

function isSafeRegisteredRoute(value) {
  if (typeof value !== "string" || value.length > 180 || !value.startsWith("/")) return false;
  if (value.includes("?") || value.includes("#") || value.includes("..") || value.includes("\\"))
    return false;
  if (value === "/") return true;
  return value
    .slice(1)
    .split("/")
    .every(
      (segment) =>
        /^[a-z0-9][a-z0-9._~-]*$/.test(segment) || /^:[a-zA-Z][a-zA-Z0-9_]*$/.test(segment),
    );
}

function sanitizePageExperience(raw, index) {
  const source = object(raw);
  const route = text(source.route, 180);
  if (!isSafeRegisteredRoute(route)) {
    throw new Error(`Page experience ${index + 1} has an invalid registered route.`);
  }
  const startup = object(source.startup);
  const loading = object(source.loading);
  const error = object(source.error);
  const maintenance = object(source.maintenance);
  const safeAction = (value) => safeActionUrl(value);
  return {
    route,
    enabled: source.enabled !== false,
    startup: {
      enabled: startup.enabled === true,
      preset: choice(startup.preset, MOTION_PRESETS, "fade"),
      assetUrl: safeAssetUrl(startup.assetUrl),
      durationMs: boundedInteger(startup.durationMs, 0, 30000, 1200),
      delayMs: boundedInteger(startup.delayMs, 0, 5000, 0),
      minimumDisplayMs: boundedInteger(startup.minimumDisplayMs, 0, 5000, 0),
      loop: startup.loop === true,
      showOncePerSession: startup.showOncePerSession !== false,
    },
    loading: {
      enabled: loading.enabled === true,
      preset: choice(loading.preset, ["none", "fade", "pulse", "shimmer"], "shimmer"),
      assetUrl: safeAssetUrl(loading.assetUrl),
      durationMs: boundedInteger(loading.durationMs, 100, 10000, 900),
      message: text(loading.message, 120),
    },
    error: {
      enabled: error.enabled === true,
      preset: choice(error.preset, MOTION_PRESETS, "error-reveal"),
      assetUrl: safeAssetUrl(error.assetUrl),
      title: text(error.title, 120),
      message: text(error.message, 500),
      backgroundColor: safeColor(error.backgroundColor, ""),
      actionLabel: text(error.actionLabel, 50),
      actionUrl: safeAction(error.actionUrl),
    },
    maintenance: {
      enabled: maintenance.enabled === true,
      preset: choice(maintenance.preset, MOTION_PRESETS, "error-reveal"),
      assetUrl: safeAssetUrl(maintenance.assetUrl),
      title: text(maintenance.title, 120),
      message: text(maintenance.message, 500),
      backgroundColor: safeColor(maintenance.backgroundColor, ""),
      actionLabel: text(maintenance.actionLabel, 50),
      actionUrl: safeAction(maintenance.actionUrl),
    },
  };
}

function sanitizeRule(raw, index, isError) {
  const source = object(raw);
  const ruleType = choice(source.ruleType, RULE_TYPES, isError ? "pattern" : "exact");
  const routePattern = text(source.routePattern, 160);
  const pageType = choice(source.pageType, PAGE_TYPES, "");
  const errorType = choice(source.errorType, isError ? [...ERROR_TYPES, "*"] : [], "");
  if (ruleType === "page_type" ? !pageType : !isSafeRoutePattern(routePattern, ruleType)) {
    throw new Error(`Rule ${index + 1} has an invalid route or page type.`);
  }
  if (isError && !errorType)
    throw new Error(`Error rule ${index + 1} needs a supported error type.`);
  const preset = choice(source.preset, MOTION_PRESETS, "");
  if (!preset) throw new Error(`Rule ${index + 1} uses an unsupported preset.`);
  if (source.trigger !== undefined && source.trigger !== "on-mount") {
    throw new Error(`Rule ${index + 1} uses a trigger that is not supported yet.`);
  }
  if (source.repeat !== undefined && source.repeat !== "once") {
    throw new Error(`Rule ${index + 1} uses a repeat mode that is not supported yet.`);
  }
  const startsAt = text(source.startsAt, 40);
  const endsAt = text(source.endsAt, 40);
  if (
    (startsAt && !Number.isFinite(Date.parse(startsAt))) ||
    (endsAt && !Number.isFinite(Date.parse(endsAt)))
  ) {
    throw new Error(`Rule ${index + 1} has an invalid schedule date.`);
  }
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new Error(`Rule ${index + 1} must end after it starts.`);
  }
  return {
    id: text(source.id, 64) || `rule-${index + 1}`,
    ruleType,
    routePattern: ruleType === "page_type" ? "" : routePattern,
    pageType: ruleType === "page_type" ? pageType : "",
    ...(isError ? { errorType } : {}),
    ...(isError
      ? {
          title: text(source.title, 120),
          subtitle: text(source.subtitle, 500),
          assetUrl: safeAssetUrl(source.assetUrl),
          primaryLabel: text(source.primaryLabel, 50),
          primaryUrl: safeActionUrl(source.primaryUrl),
          secondaryLabel: text(source.secondaryLabel, 50),
          secondaryUrl: safeActionUrl(source.secondaryUrl),
          layout: choice(source.layout, ERROR_LAYOUTS, "centered"),
          alignment: choice(source.alignment, ERROR_ALIGNMENTS, "center"),
        }
      : {}),
    preset,
    enabled: source.enabled !== false,
    priority: boundedInteger(source.priority, -1000, 1000, 0),
    deviceScope: choice(source.deviceScope, DEVICES, "all"),
    reducedMotion: choice(source.reducedMotion, ["static", "fade"], "static"),
    durationMs: boundedInteger(source.durationMs, 0, 30000, 240),
    delayMs: boundedInteger(source.delayMs, 0, 5000, 0),
    easing: choice(source.easing, EASINGS, "ease-out"),
    intensity: choice(source.intensity, INTENSITIES, "standard"),
    repeat: "once",
    trigger: "on-mount",
    direction: choice(source.direction, ["up", "down", "left", "right"], "up"),
    distance: boundedInteger(source.distance, 0, 48, 12),
    scale: boundedNumber(source.scale, 0.8, 1.2, 0.98),
    backgroundColor: safeColor(source.backgroundColor, ""),
    surfaceColor: safeColor(source.surfaceColor, ""),
    opacity: boundedNumber(source.opacity, 0, 1, 0),
    blur: boundedNumber(source.blur, 0, 8, 0),
    staggerMs: boundedInteger(source.staggerMs, 0, 300, 0),
    viewportThreshold: boundedNumber(source.viewportThreshold, 0.1, 1, 0.15),
    startsAt: text(source.startsAt, 40),
    endsAt: text(source.endsAt, 40),
  };
}

function safeColor(value, fallback) {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}

function safeActionUrl(value) {
  const url = text(value, 300);
  if (!url) return "";
  if (/^\/(?!\/)[\w/?#=&.%~-]*$/.test(url)) return url;
  try {
    return new URL(url).protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function safeAssetUrl(value) {
  const url = text(value, 500);
  if (!url) return "";
  if (
    /^\/storage\/v1\/object\/public\/site-assets\/[\w./?=&%~-]+$/.test(url) &&
    !url.includes("..")
  )
    return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".supabase.co") &&
      /^\/storage\/v1\/object\/public\/site-assets\/[\w./?=&%~-]+$/.test(parsed.pathname) &&
      !parsed.pathname.includes("..")
      ? url
      : "";
  } catch {
    return "";
  }
}

export function normalizeMotionConfig(raw) {
  const source = object(raw);
  const global = object(source.global);
  const theme = object(source.theme);
  const creatorStudio = object(source.creatorStudio);
  const pageRules = Array.isArray(source.pageRules) ? source.pageRules : [];
  const pageExperiences = Array.isArray(source.pageExperiences) ? source.pageExperiences : [];
  const errorRules = Array.isArray(source.errorRules) ? source.errorRules : [];
  const componentRules = Array.isArray(source.componentRules)
    ? source.componentRules
    : DEFAULT_MOTION_CONFIG.componentRules;
  if (
    pageRules.length > 200 ||
    pageExperiences.length > 200 ||
    errorRules.length > 200 ||
    componentRules.length > COMPONENT_IDS.length
  ) {
    throw new Error("Motion rule limits were exceeded.");
  }
  if (source.schemaVersion !== undefined && source.schemaVersion !== 1) {
    throw new Error("Unsupported motion configuration version.");
  }
  const creatorThemes = {};
  for (const studio of ["story", "reel", "post"]) {
    const candidate = object(object(creatorStudio.themes)[studio]);
    const fallback = DEFAULT_MOTION_CONFIG.creatorStudio.themes[studio];
    creatorThemes[studio] = Object.fromEntries(
      ["primary", "accent", "background", "surface", "text"].map((key) => [
        key,
        safeColor(candidate[key], fallback[key]),
      ]),
    );
  }
  const stickers = Array.isArray(creatorStudio.stickers) ? creatorStudio.stickers : [];
  if (stickers.length > 120) throw new Error("Creator sticker limit was exceeded.");
  const stickerIds = new Set();
  const safeCreatorStickers = stickers.map((rawSticker, index) => {
    const sticker = object(rawSticker);
    const id = text(sticker.id, 48);
    const name = text(sticker.name, 60);
    const emoji = text(sticker.emoji, 16);
    const category = text(sticker.category, 32);
    const allowedCategories = [
      "Emoji",
      "Happy",
      "Laughing",
      "Sad",
      "Love",
      "Reactions",
      "Celebration",
      "Animals",
      "Food",
      "Travel",
      "Decorative",
      "Aesthetic",
      "Text",
      "Frames",
      "Symbols",
    ];
    if (!/^[a-z0-9][a-z0-9_-]{1,47}$/i.test(id) || stickerIds.has(id)) {
      throw new Error(`Creator sticker ${index + 1} has an invalid or duplicate ID.`);
    }
    if (!name || !emoji || !allowedCategories.includes(category)) {
      throw new Error(
        `Creator sticker ${index + 1} is missing valid name, emoji, or category data.`,
      );
    }
    stickerIds.add(id);
    return {
      id,
      name,
      emoji,
      category,
      style: text(sticker.style, 30) || "VELORI",
      color: safeColor(sticker.color, "#f05a9d"),
      background: safeColor(sticker.background, "#fce7f1"),
      enabled: sticker.enabled !== false,
      editors: ["story", "reel", "post"].filter((editor) =>
        Array.isArray(sticker.editors) ? sticker.editors.includes(editor) : editor === "story",
      ),
    };
  });
  const safeErrorPages = {};
  for (const [code, value] of Object.entries(object(source.errorPages))) {
    if (!ERROR_TYPES.includes(code)) continue;
    const page = object(value);
    safeErrorPages[code] = {
      title: text(page.title, 120),
      subtitle: text(page.subtitle, 500),
      primaryLabel: text(page.primaryLabel, 50),
      primaryUrl: safeActionUrl(page.primaryUrl),
      secondaryLabel: text(page.secondaryLabel, 50),
      secondaryUrl: safeActionUrl(page.secondaryUrl),
      logoUrl: safeAssetUrl(page.logoUrl),
      preset: choice(page.preset, MOTION_PRESETS, "error-reveal"),
      durationMs: boundedInteger(page.durationMs, 0, 30000, 260),
      intensity: choice(page.intensity, INTENSITIES, "standard"),
      layout: choice(page.layout, ERROR_LAYOUTS, "centered"),
      alignment: choice(page.alignment, ERROR_ALIGNMENTS, "center"),
      illustrationUrl: safeAssetUrl(page.illustrationUrl),
      backgroundColor: safeColor(page.backgroundColor, ""),
      enabled: page.enabled !== false,
    };
  }
  const seenExperienceRoutes = new Set();
  const safePageExperiences = pageExperiences.map((raw, index) => {
    const experience = sanitizePageExperience(raw, index);
    if (seenExperienceRoutes.has(experience.route)) {
      throw new Error(`Page experience route ${experience.route} is duplicated.`);
    }
    seenExperienceRoutes.add(experience.route);
    return experience;
  });
  const seenComponents = new Set();
  const safeComponentRules = componentRules.map((raw, index) => {
    const rule = object(raw);
    const componentId = choice(rule.componentId, COMPONENT_IDS, "");
    if (!componentId) throw new Error(`Component rule ${index + 1} is not supported.`);
    if (seenComponents.has(componentId))
      throw new Error(`Component rule ${componentId} is duplicated.`);
    seenComponents.add(componentId);
    const preset = choice(rule.preset, COMPONENT_PRESETS[componentId], "");
    if (!preset) throw new Error(`Component rule ${componentId} uses an unsupported preset.`);
    return {
      componentId,
      preset,
      enabled: rule.enabled !== false,
      durationMs: boundedInteger(rule.durationMs, 0, 10000, 220),
      intensity: choice(rule.intensity, INTENSITIES, "subtle"),
    };
  });
  return {
    schemaVersion: 1,
    global: {
      enabled: global.enabled !== false,
      intensity: choice(global.intensity, INTENSITIES, "standard"),
      speed: choice(global.speed, SPEEDS, "normal"),
      transitionPreset: choice(global.transitionPreset, MOTION_PRESETS, "page-crossfade"),
      transitionDurationMs: boundedInteger(global.transitionDurationMs, 0, 1500, 180),
      ambientEnabled: global.ambientEnabled === true,
      reducedMotion: "respect",
    },
    theme: {
      brandPink: safeColor(theme.brandPink, DEFAULT_MOTION_CONFIG.theme.brandPink),
      brandBlue: safeColor(theme.brandBlue, DEFAULT_MOTION_CONFIG.theme.brandBlue),
      surface: safeColor(theme.surface, DEFAULT_MOTION_CONFIG.theme.surface),
      background: safeColor(theme.background, DEFAULT_MOTION_CONFIG.theme.background),
      text: safeColor(theme.text, DEFAULT_MOTION_CONFIG.theme.text),
      darkSurface: safeColor(theme.darkSurface, DEFAULT_MOTION_CONFIG.theme.darkSurface),
      darkBackground: safeColor(theme.darkBackground, DEFAULT_MOTION_CONFIG.theme.darkBackground),
      darkText: safeColor(theme.darkText, DEFAULT_MOTION_CONFIG.theme.darkText),
    },
    creatorStudio: {
      schemaVersion: 1,
      themes: creatorThemes,
      stickers: safeCreatorStickers,
    },
    pageRules: pageRules.map((rule, index) => sanitizeRule(rule, index, false)),
    pageExperiences: safePageExperiences,
    errorRules: errorRules.map((rule, index) => sanitizeRule(rule, index, true)),
    errorPages: safeErrorPages,
    componentRules: safeComponentRules,
  };
}

export function normalizePublicMotionConfig(raw) {
  const source = object(raw);
  const pageRules = (Array.isArray(source.pageRules) ? source.pageRules : []).slice(0, 200);
  const pageExperiences = (
    Array.isArray(source.pageExperiences) ? source.pageExperiences : []
  ).slice(0, 200);
  const errorRules = (Array.isArray(source.errorRules) ? source.errorRules : []).slice(0, 200);
  const validPageRules = pageRules.filter((rule, index) => {
    try {
      sanitizeRule(rule, index, false);
      return true;
    } catch {
      return false;
    }
  });
  const validErrorRules = errorRules.filter((rule, index) => {
    try {
      sanitizeRule(rule, index, true);
      return true;
    } catch {
      return false;
    }
  });
  const validExperiences = [];
  const seenExperienceRoutes = new Set();
  pageExperiences.forEach((experience, index) => {
    try {
      const safe = sanitizePageExperience(experience, index);
      if (!seenExperienceRoutes.has(safe.route)) {
        seenExperienceRoutes.add(safe.route);
        validExperiences.push(safe);
      }
    } catch {
      // Ignore malformed public overrides and use the safe site defaults.
    }
  });
  const componentRules = (
    Array.isArray(source.componentRules)
      ? source.componentRules
      : DEFAULT_MOTION_CONFIG.componentRules
  ).slice(0, COMPONENT_IDS.length);
  const seenComponents = new Set();
  const validComponentRules = componentRules.filter((raw) => {
    const rule = object(raw);
    if (
      !COMPONENT_IDS.includes(rule.componentId) ||
      !COMPONENT_PRESETS[rule.componentId].includes(rule.preset) ||
      seenComponents.has(rule.componentId)
    )
      return false;
    if (
      rule.durationMs !== undefined &&
      (!Number.isInteger(rule.durationMs) || rule.durationMs < 0 || rule.durationMs > 10000)
    )
      return false;
    seenComponents.add(rule.componentId);
    return true;
  });
  return normalizeMotionConfig({
    ...source,
    pageRules: validPageRules,
    pageExperiences: validExperiences,
    errorRules: validErrorRules,
    componentRules: validComponentRules,
  });
}

function routeMatches(rule, pathname, pageType) {
  if (rule.ruleType === "page_type") return rule.pageType === pageType;
  if (rule.ruleType === "exact") return rule.routePattern === pathname;
  const prefix = rule.routePattern.slice(0, -1);
  return pathname.startsWith(prefix);
}

function isActive(rule, context) {
  if (!rule.enabled || !routeMatches(rule, context.pathname, context.pageType)) return false;
  if (rule.deviceScope !== "all" && rule.deviceScope !== context.device) return false;
  const now = context.now ?? Date.now();
  if (rule.startsAt && Date.parse(rule.startsAt) > now) return false;
  if (rule.endsAt && Date.parse(rule.endsAt) <= now) return false;
  return true;
}

function specificity(rule) {
  if (rule.ruleType === "exact") return 3000;
  if (rule.ruleType === "pattern")
    return 2000 + rule.routePattern.split("/").filter(Boolean).length * 10;
  return 1000;
}

function compareRules(a, b) {
  return specificity(b) - specificity(a) || b.priority - a.priority || a.id.localeCompare(b.id);
}

export function resolvePageMotion(config, context) {
  const safe = normalizePublicMotionConfig(config);
  const matched = safe.pageRules.filter((rule) => isActive(rule, context)).sort(compareRules)[0];
  if (!safe.global.enabled || safe.global.intensity === "off")
    return {
      ...(matched ?? {}),
      preset: "none",
      durationMs: 0,
      intensity: "off",
      source: "global-disabled",
    };
  if (matched) return { ...matched, source: "page-rule" };
  return {
    preset: safe.global.transitionPreset,
    durationMs: safe.global.transitionDurationMs,
    intensity: safe.global.intensity,
    source: "global",
  };
}

function registeredRouteMatches(route, pathname) {
  const routeParts = route === "/" ? [] : route.slice(1).split("/");
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  const pathParts = path === "/" ? [] : path.slice(1).split("/");
  return (
    routeParts.length === pathParts.length &&
    routeParts.every((part, index) => part.startsWith(":") || part === pathParts[index])
  );
}

export function resolvePageExperience(config, pathname) {
  const safe = normalizePublicMotionConfig(config);
  return (
    safe.pageExperiences
      .filter(
        (experience) => experience.enabled && registeredRouteMatches(experience.route, pathname),
      )
      .sort((a, b) => {
        const staticSegments = (route) =>
          route.split("/").filter((part) => part && !part.startsWith(":")).length;
        return staticSegments(b.route) - staticSegments(a.route) || b.route.length - a.route.length;
      })[0] ?? null
  );
}

export function resolveErrorMotion(config, context) {
  const safe = normalizePublicMotionConfig(config);
  const matching = safe.errorRules
    .filter(
      (rule) =>
        (rule.errorType === context.errorType || rule.errorType === "*") && isActive(rule, context),
    )
    .sort(
      (a, b) =>
        specificity(b) - specificity(a) ||
        Number(b.errorType === context.errorType) - Number(a.errorType === context.errorType) ||
        b.priority - a.priority ||
        a.id.localeCompare(b.id),
    );
  const matched = matching[0];
  const legacyPage = safe.errorPages[context.errorType];
  const resolvedPage = matched
    ? {
        ...legacyPage,
        enabled: true,
        ...(matched.title ? { title: matched.title } : {}),
        ...(matched.subtitle ? { subtitle: matched.subtitle } : {}),
        ...(matched.assetUrl ? { illustrationUrl: matched.assetUrl } : {}),
        ...(matched.primaryLabel ? { primaryLabel: matched.primaryLabel } : {}),
        ...(matched.primaryUrl ? { primaryUrl: matched.primaryUrl } : {}),
        ...(matched.secondaryLabel ? { secondaryLabel: matched.secondaryLabel } : {}),
        ...(matched.secondaryUrl ? { secondaryUrl: matched.secondaryUrl } : {}),
        ...(matched.layout ? { layout: matched.layout } : {}),
        ...(matched.alignment ? { alignment: matched.alignment } : {}),
      }
    : legacyPage;
  if (!safe.global.enabled || safe.global.intensity === "off")
    return {
      ...(matched ?? {}),
      preset: "none",
      durationMs: 0,
      intensity: "off",
      page: resolvedPage,
      source: "global-disabled",
    };
  if (matched)
    return {
      ...matched,
      page: resolvedPage,
      source: "error-rule",
    };
  return {
    preset: legacyPage?.preset || "error-reveal",
    durationMs: legacyPage?.durationMs ?? 260,
    intensity: legacyPage?.intensity || safe.global.intensity,
    page: legacyPage,
    source: "safe-default",
  };
}

export function pageTypeForPath(pathname) {
  if (pathname.startsWith("/admin")) return "admin";
  if (/^\/profile\/[^/]+/.test(pathname)) return "profile";
  if (pathname.startsWith("/post/") || pathname.startsWith("/reels/")) return "content-detail";
  if (["/login", "/signup", "/forgot-password", "/reset-password"].includes(pathname))
    return "auth";
  if (pathname === "/" || ["/home", "/feed"].includes(pathname)) return "feed";
  const first = pathname.split("/").filter(Boolean)[0];
  return PAGE_TYPES.includes(first) ? first : "content-detail";
}
