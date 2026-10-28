import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import officialLogo from "../imports/velori-official.svg";
import { supabase } from "./supabase";

export type SiteSettings = {
  site_name: string;
  site_title: string;
  logo_url: string;
  favicon_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  footer_text: string;
  announcement_text: string;
  maintenance_mode: boolean;
  maintenance_scope: "site" | "page" | "route" | "group";
  maintenance_route: string | null;
  maintenance_starts_at: string | null;
  maintenance_ends_at: string | null;
  error_404_enabled: boolean;
  startup_animation_url: string | null;
  error_animation_url: string | null;
  maintenance_animation_url: string | null;
  homepage_kicker: string;
  theme_accent: "rose" | "blue" | "cyan";
  pwa_install_enabled: boolean;
  pwa_install_title: string;
  pwa_install_description: string;
  pwa_install_cta: string;
  updated_at?: string;
};

export const defaultSiteSettings: SiteSettings = {
  site_name: "VELORI",
  site_title: "VELORI",
  logo_url: officialLogo,
  favicon_url: null,
  contact_email: null,
  contact_phone: null,
  website_url: null,
  footer_text: "VELORI",
  announcement_text: "",
  maintenance_mode: false,
  maintenance_scope: "site",
  maintenance_route: null,
  maintenance_starts_at: null,
  maintenance_ends_at: null,
  error_404_enabled: true,
  startup_animation_url: null,
  error_animation_url: null,
  maintenance_animation_url: null,
  homepage_kicker: "YOUR CORNER OF THE INTERNET",
  theme_accent: "rose",
  pwa_install_enabled: true,
  pwa_install_title: "Install VELORI",
  pwa_install_description: "Add VELORI to your home screen for a faster, app-like experience.",
  pwa_install_cta: "Install",
};

// Fields an administrator may legitimately clear. A stored null for these means
// "not set", so the compiled-in default stays in effect. Verified live on
// 2026-10-02: contact_email, contact_phone and website_url are all null in the
// database, and a plain spread overwrote the defaults with null, which made
// those admin fields look saved while changing nothing on the site.
const NULLABLE_FIELDS = [
  "favicon_url",
  "contact_email",
  "contact_phone",
  "website_url",
  "startup_animation_url",
  "error_animation_url",
  "maintenance_animation_url",
  "maintenance_starts_at",
  "maintenance_ends_at",
] as const satisfies readonly (keyof SiteSettings)[];

function withDefaults(stored: Partial<SiteSettings>): SiteSettings {
  const merged: SiteSettings = { ...defaultSiteSettings, ...stored };
  merged.maintenance_starts_at = stored.maintenance_starts_at ?? null;
  merged.maintenance_ends_at = stored.maintenance_ends_at ?? null;
  // Use the deployment default when this field is not installed yet; only an
  // explicit stored false disables the animation.
  merged.error_404_enabled = Object.prototype.hasOwnProperty.call(stored, "error_404_enabled")
    ? stored.error_404_enabled === true
    : defaultSiteSettings.error_404_enabled;
  for (const field of NULLABLE_FIELDS) {
    if (stored[field] === null || stored[field] === undefined)
      merged[field] = defaultSiteSettings[field];
  }
  return merged;
}

const SiteSettingsContext = createContext(defaultSiteSettings);
const SiteSettingsReadyContext = createContext(false);

const SETTINGS_COLUMNS =
  "site_name,site_title,logo_url,favicon_url,contact_email,contact_phone,website_url,footer_text,announcement_text,maintenance_mode,maintenance_scope,maintenance_route,maintenance_starts_at,maintenance_ends_at,error_404_enabled,startup_animation_url,error_animation_url,maintenance_animation_url,homepage_kicker,theme_accent,pwa_install_enabled,pwa_install_title,pwa_install_description,pwa_install_cta,updated_at";
const SCHEDULE_COMPAT_COLUMNS =
  "site_name,site_title,logo_url,favicon_url,contact_email,contact_phone,website_url,footer_text,announcement_text,maintenance_mode,maintenance_scope,maintenance_route,error_404_enabled,startup_animation_url,error_animation_url,maintenance_animation_url,homepage_kicker,theme_accent,updated_at";
const LEGACY_COLUMNS =
  "site_name,site_title,logo_url,favicon_url,contact_email,contact_phone,website_url,footer_text,announcement_text,maintenance_mode,homepage_kicker,theme_accent,updated_at";

// One fetch path, reused by mount, revalidation, visibility refresh and the
// realtime fallback. It resolves to the stored row, or to null when the row
// cannot be read -- in which case the compiled-in defaults stay in force and the
// shell still renders. Returning null rather than throwing is deliberate: an
// unreachable settings table must never reject.
async function fetchSiteSettings(): Promise<Partial<SiteSettings> | null> {
  const primary = await supabase
    .from("site_settings")
    .select(SETTINGS_COLUMNS)
    .eq("id", true)
    .maybeSingle();
  if (!primary.error) return (primary.data as Partial<SiteSettings> | null) ?? null;
  // Keep all existing public settings usable when an older deployment has not
  // yet received the new optional animation columns.
  const message = primary.error.message || "";
  const missingAnimationColumn =
    primary.error.code === "42703" ||
    primary.error.code === "PGRST204" ||
    message.includes("error_404_enabled") ||
    message.includes("startup_animation_url") ||
    message.includes("error_animation_url") ||
    message.includes("maintenance_animation_url") ||
    message.includes("maintenance_starts_at") ||
    message.includes("maintenance_ends_at");
  const missingPwaSettings = message.includes("pwa_install_");
  if (!missingAnimationColumn && !missingPwaSettings) return null;
  const scheduleCompatible = await supabase
    .from("site_settings")
    .select(SCHEDULE_COMPAT_COLUMNS)
    .eq("id", true)
    .maybeSingle();
  if (!scheduleCompatible.error && scheduleCompatible.data)
    return scheduleCompatible.data as Partial<SiteSettings>;
  if (!message.includes("error_404_enabled")) {
    const compatible = await supabase
      .from("site_settings")
      .select(`${LEGACY_COLUMNS},error_404_enabled`)
      .eq("id", true)
      .maybeSingle();
    if (!compatible.error && compatible.data) return compatible.data as Partial<SiteSettings>;
  }
  const legacy = await supabase
    .from("site_settings")
    .select(LEGACY_COLUMNS)
    .eq("id", true)
    .maybeSingle();
  return !legacy.error && legacy.data ? (legacy.data as Partial<SiteSettings>) : null;
}

function isPublishedSettingsRow(value: unknown): value is Partial<SiteSettings> {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return "site_title" in row || "maintenance_mode" in row || "announcement_text" in row;
}

function readAnimationCache(): Partial<SiteSettings> {
  try {
    const value = localStorage.getItem("velori-animation-settings");
    if (!value) return {};
    const parsed = JSON.parse(value) as Partial<SiteSettings>;
    return {
      error_404_enabled:
        typeof parsed.error_404_enabled === "boolean"
          ? parsed.error_404_enabled
          : defaultSiteSettings.error_404_enabled,
      startup_animation_url:
        typeof parsed.startup_animation_url === "string" ? parsed.startup_animation_url : null,
      error_animation_url:
        typeof parsed.error_animation_url === "string" ? parsed.error_animation_url : null,
      maintenance_animation_url:
        typeof parsed.maintenance_animation_url === "string"
          ? parsed.maintenance_animation_url
          : null,
    };
  } catch {
    return {};
  }
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(() =>
    withDefaults({ ...defaultSiteSettings, ...readAnimationCache() }),
  );
  const [settingsReady, setSettingsReady] = useState(false);
  const mounted = useRef(true);
  const settingsRevision = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applyLoadedSettings = useCallback((data: Partial<SiteSettings>) => {
    if (!mounted.current) return;
    settingsRevision.current++;
    const next = withDefaults(data);
    setSettings({ ...next, logo_url: next.logo_url || officialLogo });
    document.title = next.site_title || defaultSiteSettings.site_title;
    if (next.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.append(link);
      }
      link.href = next.favicon_url;
    }
  }, []);

  const load = useCallback(async () => {
    const revision = ++settingsRevision.current;
    try {
      const data = await fetchSiteSettings();
      if (data && revision === settingsRevision.current) applyLoadedSettings(data);
    } catch {
      // Settings are optional for rendering. Keep compiled defaults so a missing
      // migration, offline browser, or Supabase outage cannot break the router's
      // error UI.
    } finally {
      if (mounted.current) setSettingsReady(true);
    }
  }, [applyLoadedSettings]);

  // Settings are one half of the public runtime configuration layer, so they
  // invalidate the same way the published motion document does: on mount, on a
  // bounded interval, when a hidden tab becomes visible again, and immediately
  // when an administrator publishes. Without the realtime channel an
  // administrator's save only ever reached the tab that performed it.
  useEffect(() => {
    void load();
    const interval = window.setInterval(
      () => void load(),
      settings.maintenance_mode ? 15_000 : 120_000,
    );
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refreshOnVisible);
    window.addEventListener("online", refreshOnVisible);
    window.addEventListener("focus", refreshOnVisible);
    const channel = supabase
      .channel("site-settings-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "site_settings" },
        (payload) => {
          // The broadcast already carries the new row, so apply it directly and
          // skip the extra request. Refetch only if the shape is unrecognised.
          if (isPublishedSettingsRow(payload?.new)) applyLoadedSettings(payload.new);
          else void load();
        },
      )
      .subscribe();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshOnVisible);
      window.removeEventListener("online", refreshOnVisible);
      window.removeEventListener("focus", refreshOnVisible);
      void supabase.removeChannel(channel);
    };
  }, [load, applyLoadedSettings, settings.maintenance_mode]);
  useEffect(() => {
    const applySettings = (updated: Partial<SiteSettings> | null | undefined) => {
      if (updated) {
        applyLoadedSettings(updated);
        try {
          localStorage.setItem(
            "velori-animation-settings",
            JSON.stringify({
              error_404_enabled: updated.error_404_enabled,
              startup_animation_url: updated.startup_animation_url,
              error_animation_url: updated.error_animation_url,
              maintenance_animation_url: updated.maintenance_animation_url,
            }),
          );
        } catch {
          // The database stays authoritative if browser storage is disabled.
        }
      }
    };
    const onSettingsUpdated = (event: Event) => {
      applySettings((event as CustomEvent<Partial<SiteSettings>>).detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "velori-site-settings-updated" || !event.newValue) return;
      try {
        const update = JSON.parse(event.newValue) as {
          settings?: Partial<SiteSettings>;
        };
        applySettings(update.settings);
      } catch {
        // Ignore malformed cross-tab notifications; the database remains authoritative.
      }
    };
    window.addEventListener("site-settings-updated", onSettingsUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("site-settings-updated", onSettingsUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [applyLoadedSettings]);
  return (
    <SiteSettingsReadyContext.Provider value={settingsReady}>
      <SiteSettingsContext.Provider value={settings}>{children}</SiteSettingsContext.Provider>
    </SiteSettingsReadyContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}

export function useSiteSettingsReady() {
  return useContext(SiteSettingsReadyContext);
}
