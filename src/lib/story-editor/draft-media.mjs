const DATABASE_NAME = "velori-story-drafts";
const STORE_NAME = "media";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support persistent story media drafts."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open story media storage."));
  });
}

async function transact(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not access saved story media."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not save story media."));
  });
}

export function putStoryDraftMedia(key, blob) {
  return transact("readwrite", (store) => store.put(blob, key));
}

export function getStoryDraftMedia(key) {
  return transact("readonly", (store) => store.get(key));
}

export function deleteStoryDraftMedia(key) {
  return transact("readwrite", (store) => store.delete(key));
}
