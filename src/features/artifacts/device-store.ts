/* Copyright © 2026 VELORYZ. Browser-only project storage. No network calls. */
import { normalizeProject, readProjects, saveProject, type Project } from "./model.ts";
const DB_NAME = "velori-forge-device-v1";
const STORE = "projects";
const KEY_PREFIX = "velori.forge.device.";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Device storage unavailable"));
  });
}
function withStore<T>(
  mode: IDBTransactionMode,
  work: (
    store: IDBObjectStore,
    resolve: (value: T) => void,
    reject: (cause: unknown) => void,
  ) => void,
): Promise<T> {
  return database().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let prepared = false;
        let result: T;
        const tx = db.transaction(STORE, mode);
        // A successful request isn't a durable save until the entire IDB transaction commits.
        const fail = (error: unknown) => {
          db.close();
          reject(error);
        };
        tx.oncomplete = () => {
          db.close();
          if (!prepared) reject(new Error("The device storage transaction was incomplete."));
          else resolve(result);
        };
        tx.onerror = () => fail(tx.error ?? new Error("Device storage transaction failed."));
        tx.onabort = () => fail(tx.error ?? new Error("Device storage transaction was aborted."));
        try {
          work(
            tx.objectStore(STORE),
            (value) => {
              prepared = true;
              result = value;
            },
            fail,
          );
        } catch (cause) {
          try {
            tx.abort();
          } catch {
            /* transaction may already have finished */
          }
          fail(cause);
        }
      }),
  );
}
function legacy(key: string) {
  try {
    return readProjects(localStorage, key);
  } catch {
    return [];
  }
}
export async function loadDeviceProjects(scope: string, legacyKey: string): Promise<Project[]> {
  try {
    const data = await withStore<Array<[string, unknown]>>("readonly", (store, resolve, reject) => {
      const items: Array<[string, unknown]> = [];
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (!entry) return resolve(items);
        if (typeof entry.key === "string" && entry.key.startsWith(`${KEY_PREFIX}${scope}:`))
          items.push([entry.key, entry.value]);
        entry.continue();
      };
      cursor.onerror = () => reject(cursor.error);
    });
    const records = data.flatMap(([, raw]) => {
      try {
        return [normalizeProject(raw)];
      } catch {
        return [];
      }
    });
    const fromOld = legacy(legacyKey).filter((p) => !records.some((q) => q.id === p.id));
    for (const p of fromOld) await persistDeviceProject(scope, p, legacyKey);
    return [...records, ...fromOld]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 40);
  } catch {
    return legacy(legacyKey);
  }
}
export async function persistDeviceProject(
  scope: string,
  project: Project,
  legacyKey: string,
): Promise<void> {
  const p = normalizeProject(project);
  try {
    await withStore<void>("readwrite", (store, resolve, reject) => {
      const request = store.put(p, `${KEY_PREFIX}${scope}:${p.id}`);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Legacy fallback is intentionally bounded; large project sources require IndexedDB.
    saveProject(localStorage, legacyKey, p);
  }
}
export async function deleteDeviceProject(scope: string, id: string, legacyKey: string) {
  try {
    await withStore<void>("readwrite", (store, resolve, reject) => {
      const request = store.delete(`${KEY_PREFIX}${scope}:${id}`);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    /* IndexedDB may be disabled; still clear the legacy fallback. */
  }
  try {
    const next = legacy(legacyKey).filter((p) => p.id !== id);
    localStorage.setItem(legacyKey, JSON.stringify(next));
  } catch {
    /* No browser storage available. */
  }
}
export function browserStorageExplanation() {
  return "Projects are saved on this device, not in VELORI's cloud database. Clearing site data, using private browsing, or changing devices can remove them. Download a ZIP backup to keep a portable copy.";
}
