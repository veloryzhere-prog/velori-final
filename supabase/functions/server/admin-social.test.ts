import {
  moderationPermissionFor,
  moderationViewPermissionFor,
} from "./admin-social-permissions.ts";

Deno.test("moderation view permissions use the registered plural keys", () => {
  if (moderationViewPermissionFor("reel") !== "reels.view") {
    throw new Error("Reel list must require reels.view.");
  }
  if (moderationViewPermissionFor("story") !== "stories.view") {
    throw new Error("Story list must require stories.view.");
  }
});

Deno.test("story moderation permissions use the registered plural keys", () => {
  const expected: Record<string, string> = {
    hidden: "stories.hide",
    removed: "stories.delete",
    restricted: "stories.hide",
    clean: "stories.hide",
  };
  for (const [state, permission] of Object.entries(expected)) {
    if (moderationPermissionFor("story", state) !== permission) {
      throw new Error(`Story ${state} must require ${permission}.`);
    }
  }
});

Deno.test("reel moderation preserves its registered action permissions", () => {
  const expected: Record<string, string> = {
    hidden: "reels.hide",
    removed: "reels.delete",
    restricted: "reels.hide",
    clean: "reels.restore",
  };
  for (const [state, permission] of Object.entries(expected)) {
    if (moderationPermissionFor("reel", state) !== permission) {
      throw new Error(`Reel ${state} must require ${permission}.`);
    }
  }
});
