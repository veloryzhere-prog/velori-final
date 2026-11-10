export const REEL_MUTED_PREFERENCE_KEY = "velori-reels-muted";

export function readReelMutedPreference(storage) {
  try {
    const preference = (storage ?? globalThis.localStorage).getItem(REEL_MUTED_PREFERENCE_KEY);
    return preference !== "false";
  } catch {
    return true;
  }
}

export function writeReelMutedPreference(muted, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(REEL_MUTED_PREFERENCE_KEY, String(muted));
    return true;
  } catch {
    return false;
  }
}
