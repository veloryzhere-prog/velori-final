import assert from "node:assert/strict";
import test from "node:test";
import { createPostEditorStore, handlePostEditorRequest } from "./api.mjs";

test("post editor API creates, updates, and deletes post records", () => {
  const store = createPostEditorStore();

  const created = handlePostEditorRequest(
    {
      method: "POST",
      resource: "posts",
      payload: {
        title: "Launch Campaign",
        status: "draft",
        aspectRatio: "4:5",
      },
    },
    store,
  );

  assert.equal(created.status, 201);
  assert.equal(created.body.title, "Launch Campaign");
  assert.equal(created.body.slides.length, 0);

  const updated = handlePostEditorRequest(
    {
      method: "PUT",
      resource: "posts",
      id: created.body.id,
      payload: { title: "Launch Campaign 2" },
    },
    store,
  );

  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, "Launch Campaign 2");

  const deleted = handlePostEditorRequest(
    {
      method: "DELETE",
      resource: "posts",
      id: created.body.id,
    },
    store,
  );

  assert.equal(deleted.status, 200);
  const list = handlePostEditorRequest({ method: "GET", resource: "posts" }, store);
  assert.deepEqual(list.body, []);
});

test("slide and layer APIs persist nested editor state", () => {
  const store = createPostEditorStore();

  const post = handlePostEditorRequest(
    {
      method: "POST",
      resource: "posts",
      payload: { title: "Brand Story", status: "draft", aspectRatio: "9:16" },
    },
    store,
  ).body;

  const slide = handlePostEditorRequest(
    {
      method: "POST",
      resource: "slides",
      id: post.id,
      payload: {
        order: 0,
        background: "gradient",
        duration: 8,
      },
    },
    store,
  ).body;

  assert.equal(slide.background, "gradient");

  const layer = handlePostEditorRequest(
    {
      method: "POST",
      resource: "layers",
      id: post.id,
      slideId: slide.id,
      payload: {
        type: "text",
        name: "Headline",
        text: {
          content: "Hello VELORI",
          fontFamily: "Inter",
          fontSize: 64,
        },
      },
    },
    store,
  ).body;

  assert.equal(layer.type, "text");
  assert.equal(layer.text.content, "Hello VELORI");

  const updatedLayer = handlePostEditorRequest(
    {
      method: "PUT",
      resource: "layers",
      id: post.id,
      slideId: slide.id,
      layerId: layer.id,
      payload: {
        x: 120,
        y: 75,
        opacity: 0.8,
      },
    },
    store,
  );

  assert.equal(updatedLayer.status, 200);
  assert.equal(updatedLayer.body.x, 120);
  assert.equal(updatedLayer.body.opacity, 0.8);

  const fetchLayer = handlePostEditorRequest(
    {
      method: "GET",
      resource: "layers",
      id: post.id,
      slideId: slide.id,
      layerId: layer.id,
    },
    store,
  );

  assert.equal(fetchLayer.status, 200);
  assert.equal(fetchLayer.body.id, layer.id);
});
