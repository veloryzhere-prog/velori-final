import assert from "node:assert/strict";
import test from "node:test";
import { createStoryEditorStore, handleStoryEditorRequest } from "./api.mjs";

const request = (method, resource, values = {}) => ({
  method,
  resource,
  ...values,
});

test("stories support create, list, read, update, and cascading delete", () => {
  const store = createStoryEditorStore();
  const created = handleStoryEditorRequest(
    request("POST", "stories", { payload: { title: "Launch story", ownerId: "creator-1" } }),
    store,
  );
  assert.equal(created.status, 201);
  assert.equal(created.body.aspectRatio, "9:16");
  assert.equal(created.body.ownerId, "creator-1");
  assert.equal(handleStoryEditorRequest(request("GET", "stories"), store).body.length, 1);

  const slide = handleStoryEditorRequest(
    request("POST", "slides", {
      storyId: created.body.id,
      payload: { mediaType: "video", mediaUrl: "https://cdn.example/intro.mp4", duration: 12 },
    }),
    store,
  );
  assert.equal(slide.status, 201);
  assert.equal(slide.body.order, 0);
  assert.equal(
    handleStoryEditorRequest(request("GET", "stories", { id: created.body.id }), store).body.slides
      .length,
    1,
  );
  assert.equal(
    handleStoryEditorRequest(
      request("PUT", "stories", {
        id: created.body.id,
        payload: { title: "Updated launch", loop: true },
      }),
      store,
    ).body.loop,
    true,
  );
  assert.equal(
    handleStoryEditorRequest(request("DELETE", "stories", { id: created.body.id }), store).status,
    200,
  );
  assert.deepEqual(handleStoryEditorRequest(request("GET", "stories"), store).body, []);
});

test("slide routes create, reorder, update, delete, and keep a maximum of ten", () => {
  const store = createStoryEditorStore();
  const story = store.createStory();
  const first = handleStoryEditorRequest(
    request("POST", "slides", { storyId: story.id, payload: { backgroundType: "gradient" } }),
    store,
  ).body;
  const second = handleStoryEditorRequest(
    request("POST", "slides", { storyId: story.id, payload: { order: 1, duration: 15 } }),
    store,
  ).body;
  assert.equal(second.duration, 15);
  assert.equal(
    handleStoryEditorRequest(
      request("PUT", "slides", { storyId: story.id, id: first.id, payload: { order: 1 } }),
      store,
    ).status,
    400,
  );
  assert.equal(
    handleStoryEditorRequest(
      request("PATCH", "slides", { storyId: story.id, id: first.id, payload: { duration: 4 } }),
      store,
    ).body.duration,
    4,
  );
  assert.equal(
    handleStoryEditorRequest(
      request("DELETE", "slides", { storyId: story.id, id: first.id }),
      store,
    ).status,
    200,
  );
  assert.equal(store.getSlides(story.id)[0].order, 0);
  for (let index = 1; index < 10; index += 1) store.createSlide(story.id);
  assert.throws(() => store.createSlide(story.id), /at most 10 slides/);
});

test("story API validates metadata, canvas dimensions, and slide durations", () => {
  const store = createStoryEditorStore();
  assert.equal(
    handleStoryEditorRequest(request("POST", "stories", { payload: { title: "" } }), store).status,
    400,
  );
  assert.equal(
    handleStoryEditorRequest(
      request("POST", "stories", { payload: { width: 1080, height: 1080 } }),
      store,
    ).status,
    400,
  );
  const story = store.createStory();
  assert.equal(
    handleStoryEditorRequest(
      request("POST", "slides", { storyId: story.id, payload: { duration: 15.1 } }),
      store,
    ).status,
    400,
  );
  assert.equal(
    handleStoryEditorRequest(request("POST", "slides", { storyId: "missing" }), store).status,
    404,
  );
});

test("stickers support CRUD, placement/config validation, and slide cascade", () => {
  const store = createStoryEditorStore();
  const story = store.createStory();
  const slide = store.createSlide(story.id);
  const sticker = handleStoryEditorRequest(
    request("POST", "stickers", {
      storyId: story.id,
      slideId: slide.id,
      payload: { type: "poll", content: "Choose", x: 0.3, config: { options: ["A", "B"] } },
    }),
    store,
  );
  assert.equal(sticker.status, 201);
  assert.equal(sticker.body.config, '{"options":["A","B"]}');
  const updated = handleStoryEditorRequest(
    request("PATCH", "stickers", {
      storyId: story.id,
      slideId: slide.id,
      id: sticker.body.id,
      payload: { y: 0.75 },
    }),
    store,
  );
  assert.equal(updated.body.y, 0.75);
  assert.equal(
    handleStoryEditorRequest(
      request("PUT", "stickers", {
        storyId: story.id,
        slideId: slide.id,
        id: sticker.body.id,
        payload: { x: 2 },
      }),
      store,
    ).status,
    400,
  );
  assert.equal(
    handleStoryEditorRequest(
      request("DELETE", "slides", { storyId: story.id, id: slide.id }),
      store,
    ).status,
    200,
  );
  assert.deepEqual(store.getStory(story.id).slides, []);
});

test("audio tracks support story-wide and per-slide CRUD with validated timing", () => {
  const store = createStoryEditorStore();
  const story = store.createStory();
  const slide = store.createSlide(story.id);
  const created = handleStoryEditorRequest(
    request("POST", "audio-tracks", {
      storyId: story.id,
      payload: {
        slideId: slide.id,
        name: "Music",
        sourceUrl: "blob:music",
        startTime: 0.5,
        endTime: 8,
        volume: 0.7,
      },
    }),
    store,
  );
  assert.equal(created.status, 201);
  assert.equal(created.body.slideId, slide.id);
  assert.equal(
    handleStoryEditorRequest(
      request("PATCH", "audio-tracks", {
        storyId: story.id,
        id: created.body.id,
        payload: { muted: true, fadeIn: 1.5 },
      }),
      store,
    ).body.muted,
    true,
  );
  assert.equal(
    handleStoryEditorRequest(
      request("POST", "audio-tracks", {
        storyId: story.id,
        payload: { name: "Invalid slide audio", sourceUrl: "blob:other", slideId: "foreign" },
      }),
      store,
    ).status,
    400,
  );
  assert.equal(
    handleStoryEditorRequest(
      request("DELETE", "audio-tracks", { storyId: story.id, id: created.body.id }),
      store,
    ).status,
    200,
  );
});

test("transitions enforce slide membership, type, duration, and duplicate pairs", () => {
  const store = createStoryEditorStore();
  const story = store.createStory();
  const from = store.createSlide(story.id);
  const to = store.createSlide(story.id);
  const created = handleStoryEditorRequest(
    request("POST", "transitions", {
      storyId: story.id,
      payload: { fromSlideId: from.id, toSlideId: to.id, type: "wipe", duration: 1.2 },
    }),
    store,
  );
  assert.equal(created.status, 201);
  assert.equal(created.body.type, "wipe");
  assert.equal(
    handleStoryEditorRequest(
      request("POST", "transitions", {
        storyId: story.id,
        payload: { fromSlideId: from.id, toSlideId: to.id },
      }),
      store,
    ).status,
    400,
  );
  assert.equal(
    handleStoryEditorRequest(
      request("PUT", "transitions", {
        storyId: story.id,
        id: created.body.id,
        payload: { duration: 2 },
      }),
      store,
    ).status,
    400,
  );
  assert.equal(
    handleStoryEditorRequest(
      request("DELETE", "transitions", { storyId: story.id, id: created.body.id }),
      store,
    ).status,
    200,
  );
});

test("brand override is upserted and removed through story-scoped routes", () => {
  const store = createStoryEditorStore();
  const story = store.createStory();
  const created = handleStoryEditorRequest(
    request("PUT", "brand-overrides", {
      storyId: story.id,
      payload: {
        colors: ["#ffffff", "#111111"],
        fonts: { heading: "Inter" },
        logoUrl: "https://cdn.example/logo.svg",
        logoOpacity: 0.75,
        watermarkText: "VELORI",
      },
    }),
    store,
  );
  assert.equal(created.status, 200);
  assert.equal(created.body.colors, '["#ffffff","#111111"]');
  const updated = handleStoryEditorRequest(
    request("PATCH", "brand-overrides", {
      storyId: story.id,
      payload: { watermarkOpacity: 0.8 },
    }),
    store,
  );
  assert.equal(updated.status, 405);
  assert.equal(
    handleStoryEditorRequest(
      request("PUT", "brand-overrides", {
        storyId: story.id,
        payload: { watermarkOpacity: 0.8 },
      }),
      store,
    ).body.watermarkOpacity,
    0.8,
  );
  assert.equal(
    handleStoryEditorRequest(request("DELETE", "brand-overrides", { storyId: story.id }), store)
      .status,
    200,
  );
  assert.equal(store.getStory(story.id).brandOverride, null);
});

test("unknown resources, methods, and missing identifiers return explicit HTTP-shaped errors", () => {
  const store = createStoryEditorStore();
  assert.equal(handleStoryEditorRequest(request("GET", "missing"), store).status, 404);
  assert.equal(handleStoryEditorRequest(request("GET", "slides"), store).status, 400);
  const story = store.createStory();
  assert.equal(
    handleStoryEditorRequest(request("OPTIONS", "slides", { storyId: story.id }), store).status,
    405,
  );
});
