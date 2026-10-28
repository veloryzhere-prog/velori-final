import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";

export type ThemeSettings = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  muted_text_color: string;
  border_radius: number;
  shadow_level: "none" | "soft" | "medium" | "bold";
  glass_effects: boolean;
  heading_font: string;
  body_font: string;
  button_style: "rounded" | "pill" | "square" | "soft";
  card_style: "flat" | "outlined" | "elevated" | "glass";
  navigation_style: "sidebar" | "topbar" | "minimal";
};

export const defaultThemeSettings: ThemeSettings = {
  primary_color: "#922fe6",
  secondary_color: "#8735e8",
  accent_color: "#e535b4",
  background_color: "#faf8fc",
  surface_color: "#ffffff",
  text_color: "#211428",
  muted_text_color: "#77677e",
  border_radius: 12,
  shadow_level: "soft",
  glass_effects: false,
  heading_font: "Manrope",
  body_font: "DM Sans",
  button_style: "rounded",
  card_style: "outlined",
  navigation_style: "sidebar",
};

const THEME_COLUMNS =
  "primary_color,secondary_color,accent_color,background_color,surface_color,text_color,muted_text_color,border_radius,shadow_level,glass_effects,heading_font,body_font,button_style,card_style,navigation_style";
const THEME_EVENT = "public-theme-updated";
const THEME_STORAGE_KEY = "velori-public-theme-updated";
const ThemeSettingsContext = createContext(defaultThemeSettings);

function applyThemeSettings(theme: ThemeSettings) {
  const root = document.documentElement;
  const shadow = {
    none: "none",
    soft: "0 18px 48px rgba(34, 44, 75, 0.07)",
    medium: "0 18px 48px rgba(34, 44, 75, 0.14)",
    bold: "0 22px 55px rgba(34, 44, 75, 0.24)",
  }[theme.shadow_level];
  const buttonRadius = {
    rounded: `${theme.border_radius}px`,
    pill: "999px",
    square: "0px",
    soft: `${Math.min(theme.border_radius, 8)}px`,
  }[theme.button_style];
  root.style.setProperty("--site-theme-primary", theme.primary_color);
  root.style.setProperty("--site-theme-secondary", theme.secondary_color);
  root.style.setProperty("--site-theme-accent", theme.accent_color);
  root.style.setProperty("--site-theme-background", theme.background_color);
  root.style.setProperty("--site-theme-surface", theme.surface_color);
  root.style.setProperty("--site-theme-text", theme.text_color);
  root.style.setProperty("--site-theme-muted-text", theme.muted_text_color);
  root.style.setProperty("--site-heading-font", `"${theme.heading_font}"`);
  root.style.setProperty("--site-body-font", `"${theme.body_font}"`);
  root.style.setProperty("--site-theme-shadow", shadow);
  root.style.setProperty("--site-button-radius", buttonRadius);
  root.dataset.siteCardStyle = theme.card_style;
  root.dataset.siteNavigationStyle = theme.navigation_style;
  root.dataset.siteGlassEffects = String(theme.glass_effects);
}

function mergeThemeSettings(value: Partial<ThemeSettings>): ThemeSettings {
  // Recognize the previous stock palette while preserving administrator-customized themes.
  const legacy =
    (value.primary_color === "#ff5c8a" &&
      value.secondary_color === "#7c5cff" &&
      value.accent_color === "#3ba7ff") ||
    (value.background_color === "#faf9f5" && value.accent_color === "#d6bd65");
  return legacy ? { ...value, ...defaultThemeSettings } : { ...defaultThemeSettings, ...value };
}

export function ThemeSettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(defaultThemeSettings);

  const applyTheme = useCallback((next: Partial<ThemeSettings>) => {
    const merged = mergeThemeSettings(next);
    setTheme(merged);
    applyThemeSettings(merged);
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("theme_settings")
      .select(THEME_COLUMNS)
      .eq("id", true)
      .maybeSingle();
    if (error) {
      console.error("Public theme settings could not be loaded", error.code);
      return;
    }
    if (data) applyTheme(data as Partial<ThemeSettings>);
  }, [applyTheme]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 120_000);
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const onThemeUpdated = (event: Event) => {
      const detail = (event as CustomEvent<Partial<ThemeSettings>>).detail;
      if (detail) applyTheme(detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !event.newValue) return;
      try {
        applyTheme(JSON.parse(event.newValue) as Partial<ThemeSettings>);
      } catch {
        console.warn("Ignoring an invalid cross-tab theme update");
      }
    };
    document.addEventListener("visibilitychange", refreshOnVisible);
    window.addEventListener(THEME_EVENT, onThemeUpdated);
    window.addEventListener("storage", onStorage);
    const channel = supabase
      .channel("public-theme-settings")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "theme_settings" },
        (payload) => {
          if (payload.new && typeof payload.new === "object")
            applyTheme(payload.new as Partial<ThemeSettings>);
          else void load();
        },
      )
      .subscribe();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshOnVisible);
      window.removeEventListener(THEME_EVENT, onThemeUpdated);
      window.removeEventListener("storage", onStorage);
      void supabase.removeChannel(channel);
    };
  }, [applyTheme, load]);

  return <ThemeSettingsContext.Provider value={theme}>{children}</ThemeSettingsContext.Provider>;
}

export function useThemeSettings() {
  return useContext(ThemeSettingsContext);
}
