import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  DEFAULT_MOTION_CONFIG,
  normalizePublicMotionConfig,
  type MotionConfig,
} from "../../supabase/functions/_shared/motion-config.mjs";
import { supabase } from "./supabase";
import { useInterfaceMotion } from "../motion/InterfaceMotion";

type MotionEnvelope = {
  config: MotionConfig;
  version: number;
  publishedAt: string | null;
};

type MotionContextValue = MotionEnvelope & {
  loaded: boolean;
  refresh: () => Promise<void>;
};

const FALLBACK: MotionEnvelope = {
  config: DEFAULT_MOTION_CONFIG,
  version: 0,
  publishedAt: null,
};
const CACHE_KEY = "velori-public-motion-v1";
const MotionContext = createContext<MotionContextValue>({
  ...FALLBACK,
  loaded: false,
  refresh: async () => undefined,
});

function readCache(): MotionEnvelope {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null") as {
      config?: unknown;
      version?: unknown;
      publishedAt?: unknown;
    } | null;
    if (!cached?.config) return FALLBACK;
    return {
      config: normalizePublicMotionConfig(cached.config),
      version: typeof cached.version === "number" ? cached.version : 0,
      publishedAt: typeof cached.publishedAt === "string" ? cached.publishedAt : null,
    };
  } catch {
    return FALLBACK;
  }
}

function applyTheme(config: MotionConfig) {
  const root = document.documentElement;
  const dark = root.dataset.theme === "dark";
  root.style.setProperty("--motion-brand-pink", config.theme.brandPink);
  root.style.setProperty("--motion-brand-blue", config.theme.brandBlue);
  root.style.setProperty(
    "--motion-surface",
    dark ? config.theme.darkSurface : config.theme.surface,
  );
  root.style.setProperty(
    "--motion-background",
    dark ? config.theme.darkBackground : config.theme.background,
  );
  root.style.setProperty("--motion-text", dark ? config.theme.darkText : config.theme.text);
  root.dataset.motionEnabled = String(config.global.enabled);
  root.dataset.motionAmbient = String(config.global.enabled && config.global.ambientEnabled);
  for (const componentId of ["button-hover", "card-hover", "loading", "empty-state"]) {
    root.setAttribute(`data-motion-${componentId}`, "none");
  }
  for (const rule of config.componentRules) {
    const active =
      config.global.enabled &&
      config.global.intensity !== "off" &&
      rule.enabled &&
      rule.intensity !== "off";
    root.setAttribute(`data-motion-${rule.componentId}`, active ? rule.preset : "none");
    root.style.setProperty(`--motion-${rule.componentId}-duration`, `${rule.durationMs}ms`);
    const intensityScale: Record<string, number> = {
      off: 1,
      subtle: 0.5,
      standard: 1,
      expressive: 1.5,
      cinematic: 2,
    };
    root.style.setProperty(
      `--motion-${rule.componentId}-scale`,
      String(1 + 0.02 * (intensityScale[rule.intensity] ?? 1)),
    );
  }
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [envelope, setEnvelope] = useState(readCache);
  const [loaded, setLoaded] = useState(false);
  const { mode } = useInterfaceMotion();
  const effectiveConfig = useMemo(
    () => ({
      ...envelope.config,
      global: {
        ...envelope.config.global,
        enabled: mode !== "off",
        ambientEnabled: mode === "full",
        intensity:
          mode === "off"
            ? ("off" as const)
            : mode === "gentle"
              ? ("subtle" as const)
              : envelope.config.global.intensity === "off"
                ? ("standard" as const)
                : envelope.config.global.intensity,
      },
    }),
    [envelope.config, mode],
  );

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_published_motion_config");
      if (error || !data || typeof data !== "object") return;
      const payload = data as Record<string, unknown>;
      if (!payload.config || typeof payload.config !== "object") return;
      const next: MotionEnvelope = {
        config: normalizePublicMotionConfig(payload.config),
        version: Number.isInteger(payload.version) ? Number(payload.version) : 0,
        publishedAt: typeof payload.publishedAt === "string" ? payload.publishedAt : null,
      };
      setEnvelope(next);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {
        // Public configuration remains live for this tab when storage is blocked.
      }
    } catch {
      // Keep the cached/default configuration; motion is never a prerequisite for rendering.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 120_000);
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", refreshOnVisible);
    const publicationChannel = supabase
      .channel("motion-publication-events")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "motion_publication_events",
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshOnVisible);
      void supabase.removeChannel(publicationChannel);
    };
  }, [refresh]);

  useEffect(() => {
    applyTheme(effectiveConfig);
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme(effectiveConfig);
    colorScheme.addEventListener("change", update);
    window.addEventListener("theme-preference-updated", update);
    return () => {
      colorScheme.removeEventListener("change", update);
      window.removeEventListener("theme-preference-updated", update);
    };
  }, [effectiveConfig]);

  const value = useMemo(
    () => ({ ...envelope, config: effectiveConfig, loaded, refresh }),
    [envelope, effectiveConfig, loaded, refresh],
  );
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotion() {
  return useContext(MotionContext);
}

export function useCreatorStudioTheme(editor: "story" | "reel" | "post"): CSSProperties {
  const { config } = useMotion();
  const theme = config.creatorStudio.themes[editor];
  return {
    "--creator-primary": theme.primary,
    "--creator-accent": theme.accent,
    "--creator-background": theme.background,
    "--creator-surface": theme.surface,
    "--creator-text": theme.text,
    "--velo-primary": theme.primary,
    "--brand-pink": theme.primary,
    "--brand-blue": theme.accent,
    "--background-primary": theme.background,
    "--surface-primary": theme.surface,
    "--surface-elevated": theme.surface,
    "--text-primary": theme.text,
  } as CSSProperties;
}
