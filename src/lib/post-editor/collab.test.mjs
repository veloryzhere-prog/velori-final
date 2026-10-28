import test from "node:test";
import assert from "node:assert/strict";
import { flattenDraftPresence, subscribeToPostDraftCollaboration } from "./collab.mjs";

function createRealtimeClient() {
  const handlers = [];
  const channel = {
    handlers,
    presenceState: () => ({
      "user-1": [{ user_id: "user-1", display_name: "Ari" }],
      "user-2": [{ user_id: "user-2", display_name: "Sam" }],
    }),
    on(type, filter, callback) {
      handlers.push({ type, filter, callback });
      return this;
    },
    subscribe(callback) {
      this.onStatus = callback;
      return this;
    },
    track(payload) {
      this.tracked = payload;
      return Promise.resolve("ok");
    },
  };
  const client = {
    channelName: null,
    channel(name, options) {
      this.channelName = name;
      this.channelOptions = options;
      return channel;
    },
    removeChannel(value) {
      this.removed = value;
      return Promise.resolve("ok");
    },
  };
  return { client, channel };
}

test("subscribes to draft changes and presence on the protected draft channel", () => {
  const { client, channel } = createRealtimeClient();
  const presence = [];
  const drafts = [];
  const cursors = [];
  const channels = [];
  subscribeToPostDraftCollaboration({
    client,
    draftId: "draft-1",
    user: { id: "user-1", displayName: "Ari" },
    onPresence: (value) => presence.push(flattenDraftPresence(value)),
    onDraftChange: (value) => drafts.push(value),
    onCursor: (value) => cursors.push(value),
    onChannel: (value) => channels.push(value),
  });

  assert.equal(client.channelName, "post-draft:draft-1");
  assert.equal(client.channelOptions.config.private, true);
  channel.onStatus("SUBSCRIBED");
  assert.equal(channel.tracked.display_name, "Ari");
  channel.handlers.find((handler) => handler.type === "presence").callback();
  channel.handlers
    .find((handler) => handler.filter.table === "post_drafts")
    .callback({ new: { id: "draft-1", body: "remote edit", version_number: 4 } });
  channel.handlers
    .find((handler) => handler.type === "broadcast")
    .callback({ payload: { user_id: "user-2", x: 0.4 } });

  assert.equal(presence[0].length, 2);
  assert.equal(drafts[0].body, "remote edit");
  assert.equal(cursors[0].user_id, "user-2");
  assert.equal(channels[0], channel);
});

test("subscribes to comments and suggestions and removes the channel on cleanup", async () => {
  const { client, channel } = createRealtimeClient();
  const comments = [];
  const suggestions = [];
  const activities = [];
  const cleanup = subscribeToPostDraftCollaboration({
    client,
    draftId: "draft-2",
    user: { id: "user-2" },
    onCommentChange: (value) => comments.push(value),
    onSuggestionChange: (value) => suggestions.push(value),
    onActivityChange: (value) => activities.push(value),
  });

  channel.handlers
    .find((handler) => handler.filter.table === "post_draft_comments")
    .callback({ eventType: "INSERT" });
  channel.handlers
    .find((handler) => handler.filter.table === "post_draft_suggestions")
    .callback({ eventType: "UPDATE" });
  channel.handlers
    .find((handler) => handler.filter.table === "post_draft_activity")
    .callback({ eventType: "INSERT" });
  await cleanup();

  assert.equal(comments[0].eventType, "INSERT");
  assert.equal(suggestions[0].eventType, "UPDATE");
  assert.equal(activities[0].eventType, "INSERT");
  assert.equal(client.removed, channel);
});

test("requires an authenticated user and draft ID", () => {
  assert.throws(() =>
    subscribeToPostDraftCollaboration({ client: {}, draftId: "draft", user: null }),
  );
});
