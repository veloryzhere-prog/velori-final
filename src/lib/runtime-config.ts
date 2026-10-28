import { useMemo } from "react";
import {
  pageTypeForPath,
  isMaintenanceTargetMatch,
  isWithinMaintenanceWindow,
  resolveErrorMotion,
  resolvePageExperience,
  resolvePageMotion,
  type MotionConfig,
} from "../../supabase/functions/_shared/motion-config.mjs";
import { useMotion } from "./motion-provider";
import { useSiteSettings, useSiteSettingsReady, type SiteSettings } from "./site-settings";

export type RuntimeDevice = "desktop" | "tablet" | "mobile";
export type RuntimeAnimationType = "startup" | "loading" | "error" | "maintenance";

export type SiteRuntimeConfig = {
  site: SiteSettings;
  motion: MotionConfig;
  motionVersion: number;
  publishedAt: string | null;
  siteReady: boolean;
  motionReady: boolean;
};

export function getSiteConfig(
  site: SiteSettings,
  motion: MotionConfig,
  motionVersion = 0,
  publishedAt: string | null = null,
  siteReady = true,
  motionReady = true,
): SiteRuntimeConfig {
  return { site, motion, motionVersion, publishedAt, siteReady, motionReady };
}

export function useSiteRuntimeConfig() {
  const site = useSiteSettings();
  const siteReady = useSiteSettingsReady();
  const { config, version, publishedAt, loaded: motionReady } = useMotion();
  return useMemo(
    () => getSiteConfig(site, config, version, publishedAt, siteReady, motionReady),
    [site, config, version, publishedAt, siteReady, motionReady],
  );
}

export function getPageConfig(
  config: SiteRuntimeConfig,
  route: string,
  device: RuntimeDevice = "desktop",
) {
  const context = { pathname: route, pageType: pageTypeForPath(route), device };
  const experience = resolvePageExperience(config.motion, route);
  return {
    experience,
    motion: resolvePageMotion(config.motion, context),
    maintenance: experience?.maintenance.enabled ? experience.maintenance : null,
  };
}

export function getAnimationConfig(
  config: SiteRuntimeConfig,
  route: string,
  type: RuntimeAnimationType,
  device: RuntimeDevice = "desktop",
  errorType = type === "maintenance" ? "MAINTENANCE" : "CONTENT_UNAVAILABLE",
) {
  const page = getPageConfig(config, route, device);
  const experience = page.experience;
  if (type === "startup") {
    const override = experience?.startup.enabled ? experience.startup : null;
    return {
      enabled: override?.enabled ?? config.motion.global.enabled,
      preset: override?.preset ?? config.motion.global.transitionPreset,
      assetUrl: override?.assetUrl || config.site.startup_animation_url,
      durationMs: override?.durationMs ?? config.motion.global.transitionDurationMs,
      delayMs: override?.delayMs ?? 0,
      minimumDisplayMs: override?.minimumDisplayMs ?? 0,
      loop: override?.loop ?? false,
      showOncePerSession: override?.showOncePerSession ?? true,
      message: "",
      source: override ? "page" : config.site.startup_animation_url ? "global" : "builtin",
    };
  }
  if (type === "loading") {
    const override = experience?.loading.enabled ? experience.loading : null;
    const componentRule = config.motion.componentRules.find(
      (rule) => rule.componentId === "loading",
    );
    return {
      enabled: override?.enabled ?? componentRule?.enabled ?? true,
      preset: override?.preset ?? componentRule?.preset ?? "shimmer",
      assetUrl: override?.assetUrl || null,
      durationMs: override?.durationMs ?? componentRule?.durationMs ?? 900,
      delayMs: 0,
      minimumDisplayMs: 0,
      loop: false,
      showOncePerSession: false,
      message: override?.message ?? "",
      source: override ? "page" : componentRule?.enabled ? "global" : "builtin",
    };
  }

  const isMaintenance = type === "maintenance" || errorType === "MAINTENANCE";
  const resolved = resolveErrorMotion(config.motion, {
    pathname: route,
    pageType: pageTypeForPath(route),
    device,
    errorType,
  });
  const override = isMaintenance ? experience?.maintenance : experience?.error;
  const enabled =
    override?.enabled === true ||
    ((errorType !== "NOT_FOUND" || config.site.error_404_enabled) &&
      (resolved.preset !== "none" || Boolean(config.site.error_animation_url)));
  const fallbackAsset =
    type === "maintenance"
      ? config.site.maintenance_animation_url || config.site.error_animation_url
      : config.site.error_animation_url;
  return {
    enabled,
    preset: override?.enabled ? override.preset : resolved.preset,
    assetUrl: override?.enabled
      ? override.assetUrl || fallbackAsset
      : resolved.assetUrl || fallbackAsset,
    durationMs: Number(resolved.durationMs ?? 260),
    delayMs: Number(resolved.delayMs ?? 0),
    minimumDisplayMs: 0,
    loop: false,
    showOncePerSession: false,
    message: override?.enabled ? override.message : "",
    title: override?.enabled ? override.title : resolved.title || "",
    subtitle: override?.enabled ? override.message : resolved.subtitle || "",
    backgroundColor: override?.enabled ? override.backgroundColor : "",
    actionLabel: override?.enabled ? override.actionLabel : resolved.primaryLabel || "",
    actionUrl: override?.enabled ? override.actionUrl : resolved.primaryUrl || "",
    secondaryLabel: resolved.secondaryLabel || "",
    secondaryUrl: resolved.secondaryUrl || "",
    layout: resolved.layout || "",
    alignment: resolved.alignment || "",
    source: override?.enabled ? "page" : fallbackAsset ? "global" : "builtin",
  };
}

export function getErrorAnimationConfig(
  config: SiteRuntimeConfig,
  route: string,
  errorType: string,
  device: RuntimeDevice = "desktop",
) {
  const animation = getAnimationConfig(
    config,
    route,
    errorType === "MAINTENANCE" ? "maintenance" : "error",
    device,
    errorType,
  );
  const resolution = resolveErrorMotion(config.motion, {
    pathname: route,
    pageType: pageTypeForPath(route),
    device,
    errorType,
  });
  const page = resolution.page;
  return {
    animation: {
      ...animation,
      title: animation.title || page?.title || "",
      message: animation.message || animation.subtitle || page?.subtitle || "",
      backgroundColor: animation.backgroundColor || page?.backgroundColor || "",
      actionLabel: animation.actionLabel || page?.primaryLabel || "",
      actionUrl: animation.actionUrl || page?.primaryUrl || "",
    },
    page,
    experience: getPageConfig(config, route, device).experience,
  };
}

export function getMaintenanceConfig(config: SiteRuntimeConfig, route: string) {
  const page = getPageConfig(config, route);
  if (
    !config.site.maintenance_mode ||
    !isWithinMaintenanceWindow(config.site.maintenance_starts_at, config.site.maintenance_ends_at)
  ) {
    return { enabled: false, source: "global" };
  }
  const inScope = isMaintenanceTargetMatch(
    config.site.maintenance_scope,
    config.site.maintenance_route,
    route,
  );
  if (!inScope) return { enabled: false, source: "page" };
  if (page.maintenance) return { ...page.maintenance, enabled: true, source: "page" };
  return { enabled: true, source: "global" };
}

export function getErrorConfig(
  config: SiteRuntimeConfig,
  route: string,
  status: number,
  device: RuntimeDevice = "desktop",
) {
  const type =
    status === 404
      ? "NOT_FOUND"
      : status === 403
        ? "FORBIDDEN"
        : status === 429
          ? "RATE_LIMITED"
          : status === 502
            ? "BAD_GATEWAY"
            : status === 408 || status === 504
              ? "OFFLINE"
              : status === 401
                ? "AUTH_FAILURE"
                : status === 503
                  ? "OFFLINE"
                  : "SERVER_ERROR";
  const resolved = getErrorAnimationConfig(config, route, type, device);
  return {
    ...resolved.animation,
    type,
  };
}

export function getAppearanceConfig(config: SiteRuntimeConfig) {
  return {
    theme: config.site.theme_accent,
    logoUrl: config.site.logo_url,
    faviconUrl: config.site.favicon_url,
    title: config.site.site_title,
    motionTheme: config.motion.theme,
  };
}

export function getHomepageConfig(config: SiteRuntimeConfig) {
  return {
    kicker: config.site.homepage_kicker,
    announcement: config.site.announcement_text,
    experience: getPageConfig(config, "/home").experience,
  };
}
