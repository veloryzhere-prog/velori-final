export type MotionPreset =
  | "none"
  | "fade"
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right"
  | "scale-soft"
  | "blur-in"
  | "page-crossfade"
  | "page-slide"
  | "modal-rise"
  | "toast-slide"
  | "pulse"
  | "shimmer"
  | "float"
  | "glow"
  | "error-reveal";

export type MotionRule = {
  id: string;
  ruleType: "exact" | "pattern" | "page_type";
  routePattern: string;
  pageType: string;
  errorType?: string;
  title?: string;
  subtitle?: string;
  assetUrl?: string;
  primaryLabel?: string;
  primaryUrl?: string;
  secondaryLabel?: string;
  secondaryUrl?: string;
  layout?: string;
  alignment?: string;
  preset: MotionPreset;
  enabled: boolean;
  priority: number;
  deviceScope: "all" | "desktop" | "tablet" | "mobile";
  reducedMotion: "static" | "fade";
  durationMs: number;
  delayMs: number;
  easing: string;
  intensity: string;
  repeat: "once" | "loop";
  trigger: "on-mount" | "viewport" | "interaction";
  direction: string;
  distance: number;
  scale: number;
  backgroundColor: string;
  surfaceColor: string;
  opacity: number;
  blur: number;
  staggerMs: number;
  viewportThreshold: number;
  startsAt: string;
  endsAt: string;
};

export type MotionConfig = {
  schemaVersion: 1;
  global: {
    enabled: boolean;
    intensity: "off" | "subtle" | "standard" | "expressive" | "cinematic";
    speed: "slow" | "normal" | "fast";
    transitionPreset: MotionPreset;
    transitionDurationMs: number;
    ambientEnabled: boolean;
    reducedMotion: "respect";
  };
  theme: {
    brandPink: string;
    brandBlue: string;
    surface: string;
    background: string;
    text: string;
    darkSurface: string;
    darkBackground: string;
    darkText: string;
  };
  creatorStudio: {
    schemaVersion: 1;
    themes: Record<
      "story" | "reel" | "post",
      { primary: string; accent: string; background: string; surface: string; text: string }
    >;
    stickers: {
      id: string;
      name: string;
      emoji: string;
      category: string;
      style: string;
      color: string;
      background: string;
      enabled: boolean;
      editors: Array<"story" | "reel" | "post">;
    }[];
  };
  pageRules: MotionRule[];
  pageExperiences: {
    route: string;
    enabled: boolean;
    startup: {
      enabled: boolean;
      preset: MotionPreset;
      assetUrl: string;
      durationMs: number;
      delayMs: number;
      minimumDisplayMs: number;
      loop: boolean;
      showOncePerSession: boolean;
    };
    loading: {
      enabled: boolean;
      preset: "none" | "fade" | "pulse" | "shimmer";
      assetUrl: string;
      durationMs: number;
      message: string;
    };
    error: {
      enabled: boolean;
      preset: MotionPreset;
      assetUrl: string;
      title: string;
      message: string;
      backgroundColor: string;
      actionLabel: string;
      actionUrl: string;
    };
    maintenance: {
      enabled: boolean;
      preset: MotionPreset;
      assetUrl: string;
      title: string;
      message: string;
      backgroundColor: string;
      actionLabel: string;
      actionUrl: string;
    };
  }[];
  errorRules: MotionRule[];
  componentRules: {
    componentId: "button-hover" | "card-hover" | "loading" | "empty-state";
    preset: MotionPreset;
    enabled: boolean;
    durationMs: number;
    intensity: string;
  }[];
  errorPages: Record<
    string,
    {
      title: string;
      subtitle: string;
      primaryLabel: string;
      primaryUrl: string;
      secondaryLabel: string;
      secondaryUrl: string;
      logoUrl: string;
      preset: MotionPreset;
      durationMs: number;
      intensity: string;
      layout: string;
      alignment: string;
      illustrationUrl: string;
      backgroundColor: string;
      enabled: boolean;
    }
  >;
};

export type ResolvedErrorPage = MotionConfig["errorPages"][string];
export type ResolvedErrorMotion = Partial<MotionRule> & {
  [key: string]: unknown;
  preset: string;
  durationMs: number;
  intensity: string;
  page: ResolvedErrorPage | undefined;
  source: string;
};

export const MOTION_PRESETS: readonly MotionPreset[];
export const PAGE_TYPES: readonly string[];
export const ERROR_TYPES: readonly string[];
export const DEFAULT_MOTION_CONFIG: MotionConfig;
export function normalizeMotionConfig(raw: unknown): MotionConfig;
export function normalizePublicMotionConfig(raw: unknown): MotionConfig;
export function isSafeRoutePattern(value: unknown, kind: string): boolean;
export function isMaintenanceTargetMatch(scope: string, target: unknown, pathname: string): boolean;
export function isWithinMaintenanceWindow(
  startsAt: unknown,
  endsAt: unknown,
  now?: number,
): boolean;
export function resolvePageMotion(
  config: unknown,
  context: Record<string, unknown>,
): Record<string, unknown>;
export function resolvePageExperience(
  config: unknown,
  pathname: string,
): MotionConfig["pageExperiences"][number] | null;
export function resolveErrorMotion(
  config: unknown,
  context: Record<string, unknown>,
): ResolvedErrorMotion;
export function pageTypeForPath(pathname: string): string;
