import type { ReelProject } from "./types.ts";

const DATABASE_NAME = "velori-reel-studio";
const STORE_NAME = "drafts";

const openDraftDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open the local reel draft storage."));
  });

/**
 * Drafts are namespaced per authenticated user so one account's work never
 * appears inside another account's studio session.
 */
const draftKey = (userId: string) => `user:${userId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Restores a saved draft. Object URLs do not survive a reload, so every asset
 * that still carries its original file gets a fresh URL.
 */
function restoreProject(stored: ReelProject): ReelProject {
  const assets: ReelProject["assets"] = {};
  for (const [id, asset] of Object.entries(stored.assets ?? {})) {
    if (!isRecord(asset)) continue;
    const file = asset.file instanceof File ? asset.file : undefined;
    assets[id] = {
      ...(asset as ReelProject["assets"][string]),
      file,
      url: file ? URL.createObjectURL(file) : asset.url,
    };
  }
  return { ...stored, assets };
}

/** Reads the saved draft for a user, if there is one. */
export async function readReelDraft(userId: string): Promise<ReelProject | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const database = await openDraftDatabase();
    const stored = await new Promise<ReelProject | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(draftKey(userId));
      request.onsuccess = () => resolve(request.result as ReelProject | undefined);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not read the local reel draft."));
      transaction.oncomplete = () => database.close();
    });
    if (!stored) return null;
    return restoreProject(stored);
  } catch {
    return null;
  }
}

/** Saves the current project for a user. */
export async function writeReelDraft(userId: string, project: ReelProject): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openDraftDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(project, draftKey(userId));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save the local reel draft."));
    };
  });
}

/** Removes the saved draft for a user. */
export async function clearReelDraft(userId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openDraftDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(draftKey(userId));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not clear the local reel draft."));
    };
  });
}
