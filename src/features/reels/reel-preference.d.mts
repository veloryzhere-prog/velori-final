export const REEL_MUTED_PREFERENCE_KEY: "velori-reels-muted";
export function readReelMutedPreference(storage?: Pick<Storage, "getItem">): boolean;
export function writeReelMutedPreference(
  muted: boolean,
  storage?: Pick<Storage, "setItem">,
): boolean;
