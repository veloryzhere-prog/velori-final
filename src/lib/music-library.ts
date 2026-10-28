/* Copyright © 2026 VELORYZ. All rights reserved. */
export type MusicLibrary = { version: 1; saved: string[]; recent: string[] };
export const emptyMusicLibrary = (): MusicLibrary => ({ version: 1, saved: [], recent: [] });
export const musicLibraryKey = (userId: string) => `velori.music-library.v1:${userId}`;
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9_-]{1,200}$/i.test(value);
export function readMusicLibrary(
  storage: Pick<Storage, "getItem">,
  userId: string | null,
): MusicLibrary {
  if (!userId) return emptyMusicLibrary();
  const raw = storage.getItem(musicLibraryKey(userId));
  if (!raw) return emptyMusicLibrary();
  const parsed = JSON.parse(raw);
  if (parsed?.version !== 1 || !Array.isArray(parsed.saved) || !Array.isArray(parsed.recent))
    throw new Error("Saved music could not be restored on this device.");
  return {
    version: 1,
    saved: [...new Set<string>((parsed.saved as unknown[]).filter(validId))].slice(0, 50),
    recent: [...new Set<string>((parsed.recent as unknown[]).filter(validId))].slice(0, 12),
  };
}
export function updateMusicLibrary(
  current: MusicLibrary,
  id: string,
  action: "save" | "recent",
): MusicLibrary {
  if (!validId(id)) throw new Error("Choose a valid catalog track.");
  if (action === "recent")
    return {
      ...current,
      recent: [id, ...current.recent.filter((value) => value !== id)].slice(0, 12),
    };
  if (current.saved.includes(id))
    return { ...current, saved: current.saved.filter((value) => value !== id) };
  if (current.saved.length >= 50)
    throw new Error("You can save up to 50 music tracks on this device.");
  return { ...current, saved: [id, ...current.saved] };
}
