import test from "node:test";
import assert from "node:assert/strict";
import { messageAlertTarget } from "./device-alert-policy.mjs";
const now = Date.now(),
  user = "me",
  conversation = "11111111-1111-4111-8111-111111111111";
const item = {
  id: "notification",
  recipient_id: user,
  actor_id: "sender",
  kind: "message",
  created_at: new Date(now).toISOString(),
  link: `/messages?conversation=${conversation}`,
};
test("new unread messages route to the real conversation without copying private content", () => {
  assert.deepEqual(messageAlertTarget(item, user, "https://velori.test/home", now), {
    url: item.link,
    conversation,
  });
  assert.deepEqual(
    messageAlertTarget({ ...item, link: "/messages" }, user, "https://velori.test/", now),
    { url: "/messages", conversation: null },
  );
});
test("other users, read or old notifications and self messages never generate a device alert", () => {
  for (const patch of [
    { recipient_id: "other" },
    { actor_id: user },
    { read_at: new Date(now).toISOString() },
    { kind: "like" },
    { created_at: "bad" },
    { created_at: new Date(now - 120001).toISOString() },
    { created_at: new Date(now + 20000).toISOString() },
  ])
    assert.equal(
      messageAlertTarget({ ...item, ...patch }, user, "https://velori.test/", now),
      null,
    );
});
test("malformed targets and cross-origin destinations are rejected", () => {
  for (const link of [
    "https://evil.test/messages?conversation=" + conversation,
    "//evil.test/messages",
    "/\\evil.test/messages",
    "/profile/someone",
    "/messages?conversation=invalid",
  ])
    assert.equal(messageAlertTarget({ ...item, link }, user, "https://velori.test/", now), null);
});
