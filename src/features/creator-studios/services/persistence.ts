import { DATABASE_NAME, type PostDraft, type ReelDraft } from "../models";

const openDraftDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("drafts"))
        request.result.createObjectStore("drafts");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local draft storage."));
  });

/**
 * Local drafts are namespaced per authenticated user so one account's work
 * never appears inside another account's studio session.
 */
const draftKey = (userId: string) => `user:${userId}`;

export const readStoredDraft = async (userId: string) => {
  const database = await openDraftDatabase();
  return new Promise<{ post: PostDraft; reel: ReelDraft } | undefined>((resolve, reject) => {
    const transaction = database.transaction("drafts", "readonly");
    const request = transaction.objectStore("drafts").get(draftKey(userId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read the local draft."));
    transaction.oncomplete = () => database.close();
  });
};

export const writeStoredDraft = async (userId: string, post: PostDraft, reel: ReelDraft) => {
  const database = await openDraftDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("drafts", "readwrite");
    transaction
      .objectStore("drafts")
      .put({ post, reel, updatedAt: new Date().toISOString() }, draftKey(userId));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save the local draft."));
    };
  });
};
