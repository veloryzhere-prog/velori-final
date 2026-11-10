/* Copyright © 2026 VELORYZ. All rights reserved. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadDeviceProjects,
  persistDeviceProject,
  deleteDeviceProject,
  browserStorageExplanation,
} from "./device-store.ts";
import { reactStarterFiles } from "./multi-file.ts";

test("device-only fallback keeps React sources offline and deletes selected project", async () => {
  const data = new Map<string, string>();
  const origStorage = globalThis.localStorage;
  const origDb = globalThis.indexedDB;
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
  try {
    const id = "d0f389f5-e454-4389-a9d7-81e3f423f7c9";
    const item = {
      id,
      title: "Mobile React Project",
      pages: [{ path: "index", html: "<h1>Hello</h1>", css: "", js: "" }],
      stack: "react" as const,
      files: reactStarterFiles("Mobile React Project"),
      history: [],
      updatedAt: "2026-10-26T12:00:00Z",
    };
    await persistDeviceProject("test-user", item, "test.local.forget");
    assert.equal((await loadDeviceProjects("test-user", "test.local.forget"))[0].files?.length, 7);
    assert.equal((await loadDeviceProjects("other-user", "other.local.forget")).length, 0);
    await deleteDeviceProject("test-user", id, "test.local.forget");
    assert.equal((await loadDeviceProjects("test-user", "test.local.forget")).length, 0);
    assert.match(browserStorageExplanation(), /ZIP backup/);
  } finally {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: origStorage });
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: origDb });
  }
});
