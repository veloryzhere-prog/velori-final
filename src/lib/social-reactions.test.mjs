import test from "node:test";
import assert from "node:assert/strict";
import { setSocialReaction } from "./social-reactions.mjs";

test("all insert-only reactions use conflict-ignore without requesting UPDATE", async () => {
  for (const table of ["likes", "saves", "reel_likes", "reel_saves"]) {
    const key = table.startsWith("reel_") ? "reel_id" : "post_id";
    const client = {
      from: (name) => ({
        upsert: (row, options) => {
          assert.equal(name, table);
          assert.deepEqual(row, { [key]: "content", user_id: "viewer" });
          assert.equal(options.ignoreDuplicates, true);
          assert.deepEqual(options.onConflict.split(",").sort(), [key, "user_id"].sort());
          return Promise.resolve({ error: null });
        },
      }),
    };
    assert.equal(
      (
        await setSocialReaction(
          client,
          table,
          { [key]: "content", user_id: "viewer", unrelated: "ignored" },
          false,
        )
      ).error,
      null,
    );
  }
});
test("removing a reaction is scoped to both the content and current viewer", async () => {
  for (const table of ["likes", "saves", "reel_likes", "reel_saves"]) {
    const key = table.startsWith("reel_") ? "reel_id" : "post_id",
      filters = [];
    const query = {
      eq: (key, value) => {
        filters.push([key, value]);
        return query;
      },
      then: (resolve) => resolve({ error: null }),
    };
    await setSocialReaction(
      { from: () => ({ delete: () => query }) },
      table,
      { [key]: "content", user_id: "viewer" },
      true,
    );
    assert.deepEqual(filters, [
      [key, "content"],
      ["user_id", "viewer"],
    ]);
  }
});
test("invalid reactions fail before accessing a table and write errors remain visible", async () => {
  const unused = { from: () => assert.fail("must not access a table") };
  assert.throws(() => setSocialReaction(unused, "profiles", { user_id: "viewer" }, false));
  assert.throws(() => setSocialReaction(unused, "likes", { post_id: "content" }, true));
  const error = { message: "Access denied", code: "42501" };
  const result = await setSocialReaction(
    { from: () => ({ upsert: () => Promise.resolve({ error }) }) },
    "likes",
    { post_id: "content", user_id: "viewer" },
    false,
  );
  assert.equal(result.error, error);
});
