const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
// Supabase now issues publishable keys ("sb_publishable_..."); older projects and
// existing deployments expose the legacy anon JWT as "anon". Accept either name so
// the app works against both a freshly created project and an older one. The anon
// key wins when both are present, because it is the more established convention.
const configuredKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "";

const fallbackUrl = "https://placeholder.supabase.co";
const fallbackKey = "public-placeholder-key";
const placeholderKeyPattern =
  /^(\*+|placeholder|change me|changeme|example|your_.*key|public-placeholder-key)$/i;

const normalizedUrl = (() => {
  if (!configuredUrl) return fallbackUrl;
  try {
    const parsedUrl = new URL(configuredUrl);
    if (
      !["https:", "http:"].includes(parsedUrl.protocol) ||
      (parsedUrl.protocol === "http:" &&
        !["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) ||
      parsedUrl.pathname !== "/" ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      return fallbackUrl;
    }
    return parsedUrl.origin;
  } catch {
    return fallbackUrl;
  }
})();

export const supabaseConfigured = Boolean(
  normalizedUrl !== fallbackUrl && configuredKey && !placeholderKeyPattern.test(configuredKey),
);

if (!supabaseConfigured) {
  console.warn(
    "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env.local before starting or building VELORI.",
  );
}

export const supabaseUrl = normalizedUrl;
export const supabasePublishableKey = configuredKey || fallbackKey;
export const supabaseConfigMessage = supabaseConfigured
  ? ""
  : "Supabase is not configured; the app is running in degraded mode until .env.local is filled in.";
