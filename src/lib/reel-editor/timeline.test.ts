import assert from "node:assert/strict";
import test from "node:test";
import {
  activeClipAt,
  clipDuration,
  clipEnd,
  clipSourceAt,
  clipTimelineAt,
  createReelClip,
  createReelProject,
  duplicateClip,
  moveClip,
  projectDuration,
  removeClip,
  setClipPlaybackRate,
  snapTime,
  splitClip,
  trimClipEnd,
  trimClipStart,
} from "./timeline.ts";
import type { ReelAsset, ReelProject } from "./types.ts";

const makeAsset = (overrides: Partial<ReelAsset> = {}): ReelAsset => ({
  id: "asset-1",
  kind: "video",
  name: "clip.mp4",
  mimeType: "video/mp4",
  sizeBytes: 1024,
  durationSeconds: 10,
  width: 1080,
  height: 1920,
  url: "blob:asset-1",
  ...overrides,
});

const makeProject = (durationSeconds = 10): ReelProject => {
  const project = createReelProject();
  const asset = makeAsset({ durationSeconds });
  const clip = createReelClip(asset, 0);
  return { ...project, assets: { [asset.id]: asset }, clips: [clip] };
};

const closeTo = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );

test("clip duration is derived from the source range and the playback rate", () => {
  const project = makeProject();
  const clip = project.clips[0];
  closeTo(clipDuration(clip), 10);
  const faster = { ...clip, playbackRate: 2 };
  closeTo(clipDuration(faster), 5);
  const slower = { ...clip, playbackRate: 0.5 };
  closeTo(clipDuration(slower), 20);
});

test("source time and timeline time stay separate", () => {
  const project = makeProject();
  const clip = { ...project.clips[0], sourceIn: 2, sourceOut: 8, playbackRate: 2 };
  closeTo(clipDuration(clip), 3);
  closeTo(clipSourceAt(clip, 1), 4);
  closeTo(clipTimelineAt(clip, 4), 1);
  closeTo(clipSourceAt(clip, clipTimelineAt(clip, 5.5)), 5.5);
});

test("splitting a clip produces two independently editable segments", () => {
  const project = makeProject();
  const { project: split, newClipId } = splitClip(project, project.clips[0].id, 4);
  assert.ok(newClipId, "a second clip id is returned");
  assert.equal(split.clips.length, 2);
  const [left, right] = split.clips;
  closeTo(left.sourceIn, 0);
  closeTo(left.sourceOut, 4);
  closeTo(right.sourceIn, 4);
  closeTo(right.sourceOut, 10);
  closeTo(left.startSeconds, 0);
  closeTo(right.startSeconds, 4);
  closeTo(clipDuration(left) + clipDuration(right), clipDuration(project.clips[0]));
  assert.notEqual(left.id, right.id);
});

test("splitting near a clip edge is rejected", () => {
  const project = makeProject();
  assert.equal(splitClip(project, project.clips[0].id, 0.05).newClipId, null);
  assert.equal(splitClip(project, project.clips[0].id, 9.95).newClipId, null);
  assert.equal(splitClip(project, "missing", 4).newClipId, null);
});

test("trimming the in-point keeps the out-point and the next clip in place", () => {
  const project = makeProject();
  const second = { ...createReelClip(makeAsset({ id: "asset-2" }), 10), id: "clip-2" };
  const withTwo = { ...project, clips: [...project.clips, second] };
  const trimmed = trimClipStart(withTwo, project.clips[0].id, 2);
  const clip = trimmed.clips[0];
  closeTo(clip.sourceIn, 2);
  closeTo(clip.sourceOut, 10);
  closeTo(clip.startSeconds, 2);
  closeTo(clipEnd(clip), 10);
  closeTo(trimmed.clips[1].startSeconds, 10);
});

test("trimming the in-point cannot move before the start of the source", () => {
  const project = makeProject();
  const trimmed = trimClipStart(project, project.clips[0].id, -5);
  closeTo(trimmed.clips[0].sourceIn, 0);
  closeTo(trimmed.clips[0].startSeconds, 0);
});

test("trimming the out-point clamps to the asset duration", () => {
  const project = makeProject();
  const trimmed = trimClipEnd(project, project.clips[0].id, 60);
  closeTo(trimmed.clips[0].sourceOut, 10);
  closeTo(clipEnd(trimmed.clips[0]), 10);
});

test("changing the playback rate keeps following clips contiguous", () => {
  const project = makeProject();
  const second = { ...createReelClip(makeAsset({ id: "asset-2" }), 10), id: "clip-2" };
  const withTwo = { ...project, clips: [...project.clips, second] };
  const faster = setClipPlaybackRate(withTwo, project.clips[0].id, 2);
  closeTo(clipDuration(faster.clips[0]), 5);
  closeTo(faster.clips[1].startSeconds, 5);
});

test("removing a clip closes the gap it leaves behind", () => {
  const project = makeProject();
  const second = { ...createReelClip(makeAsset({ id: "asset-2" }), 10), id: "clip-2" };
  const withTwo = { ...project, clips: [...project.clips, second] };
  const removed = removeClip(withTwo, project.clips[0].id);
  assert.equal(removed.clips.length, 1);
  closeTo(removed.clips[0].startSeconds, 0);
});

test("moving a clip keeps the video track contiguous", () => {
  const project = makeProject();
  const second = { ...createReelClip(makeAsset({ id: "asset-2" })), id: "clip-2" };
  const withTwo = { ...project, clips: [project.clips[0], second] };
  const moved = moveClip(withTwo, second.id, 3);
  closeTo(moved.clips[0].startSeconds, 0);
  closeTo(moved.clips[1].startSeconds, 10);
  closeTo(projectDuration(moved), 20);
});

test("duplicating a clip places the copy directly after the original", () => {
  const project = makeProject();
  const duplicated = duplicateClip(project, project.clips[0].id);
  assert.equal(duplicated.clips.length, 2);
  closeTo(duplicated.clips[1].startSeconds, 10);
});

test("the active clip is resolved from the timeline position", () => {
  const project = makeProject();
  assert.equal(activeClipAt(project, 0)?.id, project.clips[0].id);
  assert.equal(activeClipAt(project, 9.9)?.id, project.clips[0].id);
  assert.equal(activeClipAt(project, 10), null);
});

test("snapping locks a dragged position to a nearby clip edge", () => {
  const project = makeProject();
  closeTo(snapTime(project, 9.94, 0.2), 10);
  closeTo(snapTime(project, 0.05, 0.2), 0);
  closeTo(snapTime(project, 5, 0.2), 5);
});

test("a newly imported still image stays visible for five seconds and can be trimmed", () => {
  const asset = makeAsset({ kind: "image", durationSeconds: 0 });
  const clip = createReelClip(asset);
  const project = { ...createReelProject(), assets: { [asset.id]: asset }, clips: [clip] };
  closeTo(projectDuration(project), 5);
  assert.equal(activeClipAt(project, 4.9)?.id, clip.id);
  closeTo(clipDuration(trimClipEnd(project, clip.id, 3).clips[0]), 3);
});

test("music and captions cannot extend playback beyond the last visual frame", () => {
  const project = makeProject(3);
  const longAudio = {
    id: "music",
    assetId: "audio",
    trackId: "audio",
    startSeconds: 0,
    sourceIn: 20,
    sourceOut: 80,
    volume: 1,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
  };
  assert.equal(projectDuration({ ...project, audio: [longAudio] }), 3);
  assert.equal(projectDuration({ ...project, texts: [{ endSeconds: 100 } as never] }), 3);
  assert.equal(projectDuration({ ...project, clips: [], audio: [longAudio] }), 0);
});
