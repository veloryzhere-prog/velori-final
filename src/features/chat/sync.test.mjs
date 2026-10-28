import test from "node:test";
import assert from "node:assert/strict";
import { mergeChatPreferences, syncChatPreferences } from "./sync.mjs";
const local = { theme: "rose", nicknames: {}, childMode: false, hiddenIds: [] };
function adapter({
  row = { theme: "ocean", nicknames: {}, child_mode: true },
  hidden = [],
  fail = "",
} = {}) {
  const writes = [];
  return {
    writes,
    from(table) {
      const chain = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle() {
          return this;
        },
        upsert(value) {
          writes.push({ table, value });
          this.writing = true;
          return this;
        },
        then(resolve) {
          resolve({
            data: this.writing
              ? null
              : table === "conversation_preferences"
                ? row
                : hidden.map((message_id) => ({ message_id })),
            error:
              fail === (this.writing ? "write" : "read")
                ? { code: "42501", message: "denied" }
                : null,
          });
        },
      };
      return chain;
    },
  };
}
test("server settings replace stale browser preferences", () => {
  assert.deepEqual(
    mergeChatPreferences(
      { theme: "ocean", nicknames: { a: "Friend" }, child_mode: true, hiddenIds: ["remote"] },
      local,
    ),
    { theme: "ocean", nicknames: { a: "Friend" }, childMode: true, hiddenIds: ["remote"] },
  );
});
test("pending edits preserve untouched remote settings and merge hides", () => {
  const result = mergeChatPreferences(
    { theme: "ocean", child_mode: true, hiddenIds: ["remote"] },
    local,
    { theme: "sunshine", hiddenIds: ["local", "remote"] },
  );
  assert.equal(result.childMode, true);
  assert.equal(result.theme, "sunshine");
  assert.deepEqual(result.hiddenIds, ["remote", "local"]);
});
test("read-only sync performs no writes", async () => {
  const client = adapter();
  const result = await syncChatPreferences(client, "me", "chat", local, {});
  assert.equal(result.theme, "ocean");
  assert.equal(client.writes.length, 0);
});
test("first account sync imports local preferences and batches hidden references", async () => {
  const client = adapter({ row: null });
  const cached = { ...local, hiddenIds: Array.from({ length: 205 }, (_, i) => "id-" + i) };
  await syncChatPreferences(client, "me", "chat", cached, {});
  assert.equal(client.writes[0].table, "conversation_preferences");
  assert.deepEqual(
    client.writes.slice(1).map((x) => x.value.length),
    [100, 100, 5],
  );
});
test("unreadable private preferences cannot trigger writes", async () => {
  const client = adapter({ fail: "read" });
  await assert.rejects(syncChatPreferences(client, "me", "chat", local, { theme: "sunshine" }));
  assert.equal(client.writes.length, 0);
});
test("failed persistence rejects rather than reporting sync success", async () => {
  await assert.rejects(
    syncChatPreferences(adapter({ fail: "write" }), "me", "chat", local, { childMode: true }),
  );
});
