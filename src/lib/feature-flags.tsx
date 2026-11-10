import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";

export type FeatureFlagMap = Record<string, boolean>;

export const defaultFeatureFlags: FeatureFlagMap = {
  reels_enabled: true,
  stories_enabled: true,
  groups_enabled: true,
  messaging_enabled: true,
  notifications_enabled: true,
  ads_enabled: false,
  creator_tools_enabled: true,
  profile_qr_enabled: false,
  experimental_ui: false,
  new_home_feed: true,
};

const FeatureFlagsContext = createContext<FeatureFlagMap>(defaultFeatureFlags);
const FeatureFlagsReadyContext = createContext(false);

function coerceFlags(value: unknown): FeatureFlagMap {
  if (!value || typeof value !== "object") return { ...defaultFeatureFlags };
  const entries = Object.entries(value as Record<string, unknown>);
  const merged = { ...defaultFeatureFlags };
  for (const [key, enabled] of entries) {
    if (typeof enabled === "boolean") merged[key] = enabled;
  }
  return merged;
}

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlagMap>(defaultFeatureFlags);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { data, error } = await supabase.from("feature_flags").select("key,enabled");
        if (!active) return;
        if (error) {
          const message = error.message ?? "";
          const missingTable =
            error.code === "42P01" ||
            error.code === "PGRST205" ||
            message.includes("feature_flags") ||
            message.includes("does not exist");
          if (missingTable) {
            setFlags({ ...defaultFeatureFlags });
            setReady(true);
            return;
          }
          setFlags({ ...defaultFeatureFlags });
          setReady(true);
          return;
        }

        const merged: FeatureFlagMap = { ...defaultFeatureFlags };
        for (const item of data ?? []) {
          if (typeof item?.key === "string" && typeof item?.enabled === "boolean") {
            merged[item.key] = item.enabled;
          }
        }
        setFlags(coerceFlags(merged));
      } catch {
        if (active) {
          setFlags({ ...defaultFeatureFlags });
        }
      } finally {
        if (active) setReady(true);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <FeatureFlagsReadyContext.Provider value={ready}>
      <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>
    </FeatureFlagsReadyContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}

export function useFeatureFlagsReady() {
  return useContext(FeatureFlagsReadyContext);
}

export function useFeatureFlag(flag: string, fallback = true) {
  const flags = useFeatureFlags();
  return flags[flag] ?? fallback;
}
