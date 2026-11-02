export const MOTION_PREFERENCE_KEY = "velori-interface-motion-v2";
export const MOTION_PREFERENCES = ["auto", "full", "gentle", "off"];

export function normalizeMotionPreference(value) {
  return MOTION_PREFERENCES.includes(value) ? value : "auto";
}

export function resolveInterfaceMotion(preference, prefersReducedMotion) {
  const normalized = normalizeMotionPreference(preference);
  if (normalized === "auto") return prefersReducedMotion ? "gentle" : "full";
  if (prefersReducedMotion && normalized !== "off") return "gentle";
  return normalized;
}
