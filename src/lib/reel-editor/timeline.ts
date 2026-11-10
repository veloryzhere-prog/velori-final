import {
  REEL_AUDIO_TRACK_ID,
  REEL_CANVAS_SIZES,
  REEL_CAPTION_TRACK_ID,
  REEL_OVERLAY_TRACK_ID,
  REEL_VIDEO_TRACK_ID,
  type ReelAdjustments,
  type ReelAspectRatio,
  type ReelAsset,
  type ReelAudioClip,
  type ReelCaption,
  type ReelClip,
  type ReelEffects,
  type ReelProject,
  type ReelSticker,
  type ReelTextOverlay,
  type ReelTransform,
  type ReelTransition,
} from "./types.ts";

/** Shortest clip the studio allows, in timeline seconds. */
export const MIN_CLIP_SECONDS = 0.2;
/** Smallest gap between two clips on the same track, in seconds. */
export const MIN_CLIP_GAP_SECONDS = 0.02;

export const DEFAULT_ADJUSTMENTS: ReelAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  temperature: 0,
};

export const DEFAULT_TRANSFORM: ReelTransform = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
  fit: "cover",
  flipX: false,
  flipY: false,
};

export const DEFAULT_EFFECTS: ReelEffects = {};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number, precision = 4) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const createId = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ??
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createReelProject(overrides: Partial<ReelProject> = {}): ReelProject {
  const aspectRatio: ReelAspectRatio = overrides.aspectRatio ?? "9:16";
  const size = REEL_CANVAS_SIZES[aspectRatio];
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? createId("reel"),
    name: overrides.name ?? "Untitled reel",
    aspectRatio,
    width: overrides.width ?? size.width,
    height: overrides.height ?? size.height,
    assets: overrides.assets ?? {},
    clips: overrides.clips ?? [],
    texts: overrides.texts ?? [],
    stickers: overrides.stickers ?? [],
    audio: overrides.audio ?? [],
    captions: overrides.captions ?? [],
    coverAssetId: overrides.coverAssetId ?? null,
    coverFrameSeconds: overrides.coverFrameSeconds ?? 0,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export function createReelClip(asset: ReelAsset, startSeconds = 0): ReelClip {
  const sourceOut =
    asset.kind === "image"
      ? asset.durationSeconds > 0
        ? Math.max(MIN_CLIP_SECONDS, asset.durationSeconds)
        : 5
      : asset.durationSeconds;
  return {
    id: createId("clip"),
    assetId: asset.id,
    trackId: REEL_VIDEO_TRACK_ID,
    startSeconds,
    sourceIn: 0,
    sourceOut,
    playbackRate: 1,
    volume: 1,
    muted: false,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    transform: { ...DEFAULT_TRANSFORM },
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    effects: { ...DEFAULT_EFFECTS },
    filterId: null,
    transitionIn: null,
    transitionOut: null,
  };
}

/** Timeline length of a clip. Always derived, never stored. */
export function clipDuration(clip: ReelClip): number {
  return Math.max(0, (clip.sourceOut - clip.sourceIn) / clip.playbackRate);
}

export function clipEnd(clip: ReelClip): number {
  return clip.startSeconds + clipDuration(clip);
}

/** Maps a timeline position inside a clip to the matching source position. */
export function clipSourceAt(clip: ReelClip, timelineSeconds: number): number {
  const offset = (timelineSeconds - clip.startSeconds) * clip.playbackRate;
  return clamp(clip.sourceIn + offset, clip.sourceIn, clip.sourceOut);
}

/** Maps a source position inside a clip back to the timeline. */
export function clipTimelineAt(clip: ReelClip, sourceSeconds: number): number {
  return clip.startSeconds + (sourceSeconds - clip.sourceIn) / clip.playbackRate;
}

/** The exported reel ends with its last visual frame. Audio and overlays cannot
 * silently extend the playhead into a blank, unpublishable tail. */
export function projectDuration(project: ReelProject): number {
  return round(project.clips.reduce((max, clip) => Math.max(max, clipEnd(clip)), 0));
}

/** The clip visible at a timeline position, if any. */
export function activeClipAt(project: ReelProject, timelineSeconds: number): ReelClip | null {
  const hit = project.clips.find(
    (clip) => timelineSeconds >= clip.startSeconds && timelineSeconds < clipEnd(clip),
  );
  return hit ?? null;
}

function assetDuration(project: ReelProject, clip: ReelClip): number {
  const asset = project.assets[clip.assetId];
  if (!asset) return clip.sourceOut;
  return asset.kind === "image"
    ? asset.durationSeconds > 0
      ? Math.max(MIN_CLIP_SECONDS, asset.durationSeconds)
      : 5
    : asset.durationSeconds;
}

/** Shifts every clip that starts at or after `fromSeconds` by `delta` seconds. */
function shiftClips(clips: ReelClip[], fromSeconds: number, delta: number): ReelClip[] {
  return clips.map((clip) =>
    clip.startSeconds >= fromSeconds - 0.0001
      ? { ...clip, startSeconds: round(Math.max(0, clip.startSeconds + delta)) }
      : clip,
  );
}

function shiftAudio(audio: ReelAudioClip[], fromSeconds: number, delta: number): ReelAudioClip[] {
  return audio.map((clip) =>
    clip.startSeconds >= fromSeconds - 0.0001
      ? { ...clip, startSeconds: round(Math.max(0, clip.startSeconds + delta)) }
      : clip,
  );
}

/**
 * Splits a clip into two independently editable segments at a timeline position.
 * The right segment keeps the same playback rate, transform and adjustments.
 */
export function splitClip(
  project: ReelProject,
  clipId: string,
  timelineSeconds: number,
): { project: ReelProject; newClipId: string | null } {
  const clip = project.clips.find((item) => item.id === clipId);
  if (!clip) return { project, newClipId: null };
  const duration = clipDuration(clip);
  const offset = timelineSeconds - clip.startSeconds;
  if (offset <= MIN_CLIP_SECONDS || offset >= duration - MIN_CLIP_SECONDS) {
    return { project, newClipId: null };
  }
  const sourceAt = clipSourceAt(clip, timelineSeconds);
  const left: ReelClip = {
    ...clip,
    sourceOut: sourceAt,
    transitionOut: clip.transitionIn ? { ...clip.transitionIn } : clip.transitionOut,
  };
  const right: ReelClip = {
    ...clip,
    id: createId("clip"),
    sourceIn: sourceAt,
    startSeconds: round(timelineSeconds),
    transitionIn: clip.transitionOut ? { ...clip.transitionOut } : clip.transitionIn,
  };
  const clips = project.clips
    .map((item) => (item.id === clipId ? left : item))
    .concat(right)
    .sort((a, b) => a.startSeconds - b.startSeconds);
  return { project: { ...project, clips }, newClipId: right.id };
}

/** Drags the in-point of a clip. The out-point and the following clips stay put. */
export function trimClipStart(
  project: ReelProject,
  clipId: string,
  nextStartSeconds: number,
): ReelProject {
  const clip = project.clips.find((item) => item.id === clipId);
  if (!clip) return project;
  const maxSourceIn = clip.sourceOut - MIN_CLIP_SECONDS * clip.playbackRate;
  const nextSourceIn = clamp(
    clip.sourceIn + (nextStartSeconds - clip.startSeconds) * clip.playbackRate,
    0,
    maxSourceIn,
  );
  const nextStart = clip.startSeconds + (nextSourceIn - clip.sourceIn) / clip.playbackRate;
  const clips = project.clips.map((item) =>
    item.id === clipId
      ? { ...item, sourceIn: round(nextSourceIn), startSeconds: round(Math.max(0, nextStart)) }
      : item,
  );
  return { ...project, clips };
}

/** Drags the out-point of a clip. The in-point and the following clips stay put. */
export function trimClipEnd(
  project: ReelProject,
  clipId: string,
  nextEndSeconds: number,
): ReelProject {
  const clip = project.clips.find((item) => item.id === clipId);
  if (!clip) return project;
  const limit = assetDuration(project, clip);
  const minSourceOut = clip.sourceIn + MIN_CLIP_SECONDS * clip.playbackRate;
  const nextSourceOut = clamp(
    clip.sourceOut + (nextEndSeconds - clipEnd(clip)) * clip.playbackRate,
    minSourceOut,
    limit,
  );
  const nextEnd = clip.startSeconds + (nextSourceOut - clip.sourceIn) / clip.playbackRate;
  const clips = project.clips.map((item) =>
    item.id === clipId ? { ...item, sourceOut: round(nextSourceOut) } : item,
  );
  return { ...project, clips };
}

/** Changes the playback rate and keeps the following clips contiguous. */
export function setClipPlaybackRate(
  project: ReelProject,
  clipId: string,
  playbackRate: number,
): ReelProject {
  const clip = project.clips.find((item) => item.id === clipId);
  if (!clip) return project;
  const rate = clamp(playbackRate, 0.25, 4);
  const before = clipDuration(clip);
  const after = Math.max(MIN_CLIP_SECONDS, (clip.sourceOut - clip.sourceIn) / rate);
  const delta = after - before;
  const clips = shiftClips(
    project.clips.map((item) => (item.id === clipId ? { ...item, playbackRate: rate } : item)),
    clipEnd(clip) - 0.0001,
    delta,
  );
  return { ...project, clips };
}

/**
 * Keeps the video track contiguous: clips run back to back from zero in their
 * current order. A reel has no gaps, so moving or deleting a clip reflows the
 * rest of the track instead of leaving a hole.
 */
export function reflowVideoTrack(project: ReelProject): ReelProject {
  const sorted = [...project.clips].sort((a, b) => a.startSeconds - b.startSeconds);
  let cursor = 0;
  const reflowed = sorted.map((clip) => {
    const next = { ...clip, startSeconds: round(cursor) };
    cursor += clipDuration(next);
    return next;
  });
  return { ...project, clips: reflowed };
}

/**
 * Moves a clip to a new timeline position. The clip takes the slot of the
 * neighbour it lands next to, and the video track reflows to stay contiguous.
 */
export function moveClip(
  project: ReelProject,
  clipId: string,
  nextStartSeconds: number,
): ReelProject {
  const clips = project.clips.map((clip) =>
    clip.id === clipId ? { ...clip, startSeconds: round(Math.max(0, nextStartSeconds)) } : clip,
  );
  return reflowVideoTrack({ ...project, clips });
}

/** Removes a clip and closes the gap it leaves behind. */
export function removeClip(project: ReelProject, clipId: string, ripple = true): ReelProject {
  const clip = project.clips.find((item) => item.id === clipId);
  if (!clip) return project;
  const removed = clipDuration(clip);
  const clips = project.clips.filter((item) => item.id !== clipId);
  const nextClips = ripple ? shiftClips(clips, clip.startSeconds + 0.0001, -removed) : clips;
  const audio = ripple
    ? shiftAudio(project.audio, clip.startSeconds + 0.0001, -removed)
    : project.audio;
  return { ...project, clips: nextClips, audio };
}

/** Duplicates a clip directly after the original. */
export function duplicateClip(project: ReelProject, clipId: string): ReelProject {
  const clip = project.clips.find((item) => item.id === clipId);
  if (!clip) return project;
  const copy: ReelClip = {
    ...clip,
    id: createId("clip"),
    startSeconds: round(clipEnd(clip)),
    transform: { ...clip.transform },
    adjustments: { ...clip.adjustments },
  };
  return {
    ...project,
    clips: [...project.clips, copy].sort((a, b) => a.startSeconds - b.startSeconds),
  };
}

export function updateClip(
  project: ReelProject,
  clipId: string,
  patch: Partial<Omit<ReelClip, "id" | "assetId">>,
): ReelProject {
  const clips = project.clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip));
  return { ...project, clips };
}

export function updateClipTransform(
  project: ReelProject,
  clipId: string,
  patch: Partial<ReelTransform>,
): ReelProject {
  const clip = project.clips.find((item) => item.id === clipId);
  if (!clip) return project;
  return updateClip(project, clipId, { transform: { ...clip.transform, ...patch } });
}

export function updateClipAdjustments(
  project: ReelProject,
  clipId: string,
  patch: Partial<ReelAdjustments>,
): ReelProject {
  const clip = project.clips.find((item) => item.id === clipId);
  if (!clip) return project;
  return updateClip(project, clipId, { adjustments: { ...clip.adjustments, ...patch } });
}

export function setClipTransition(
  project: ReelProject,
  clipId: string,
  edge: "in" | "out",
  transition: ReelTransition | null,
): ReelProject {
  const clip = project.clips.find((item) => item.id === clipId);
  if (!clip) return project;
  if (edge === "in") return updateClip(project, clipId, { transitionIn: transition });
  return updateClip(project, clipId, { transitionOut: transition });
}

export function addTextOverlay(
  project: ReelProject,
  overlay: Partial<ReelTextOverlay> = {},
): { project: ReelProject; id: string } {
  const id = createId("text");
  const duration = projectDuration(project);
  const next: ReelTextOverlay = {
    id,
    startSeconds: 0,
    endSeconds: Math.max(2, Math.min(duration, 6)),
    text: "Add your text",
    x: 0.1,
    y: 0.4,
    width: 0.8,
    fontFamily: "DM Sans",
    fontSize: 64,
    fontWeight: 700,
    color: "#ffffff",
    align: "center",
    lineHeight: 1.2,
    background: null,
    stroke: null,
    shadow: true,
    uppercase: false,
    ...overlay,
  };
  return { project: { ...project, texts: [...project.texts, next] }, id };
}

export function updateTextOverlay(
  project: ReelProject,
  id: string,
  patch: Partial<ReelTextOverlay>,
): ReelProject {
  return {
    ...project,
    texts: project.texts.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  };
}

export function removeTextOverlay(project: ReelProject, id: string): ReelProject {
  return { ...project, texts: project.texts.filter((item) => item.id !== id) };
}

export function addSticker(
  project: ReelProject,
  sticker: Partial<ReelSticker> = {},
): { project: ReelProject; id: string } {
  const id = createId("sticker");
  const next: ReelSticker = {
    id,
    startSeconds: 0,
    endSeconds: Math.max(2, Math.min(projectDuration(project), 6)),
    assetId: null,
    glyph: "✨",
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    ...sticker,
  };
  return { project: { ...project, stickers: [...project.stickers, next] }, id };
}

export function updateSticker(
  project: ReelProject,
  id: string,
  patch: Partial<ReelSticker>,
): ReelProject {
  return {
    ...project,
    stickers: project.stickers.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  };
}

export function removeSticker(project: ReelProject, id: string): ReelProject {
  return { ...project, stickers: project.stickers.filter((item) => item.id !== id) };
}

export function addAudioClip(
  project: ReelProject,
  audio: Partial<ReelAudioClip> = {},
): { project: ReelProject; id: string } {
  const id = createId("audio");
  const next: ReelAudioClip = {
    id,
    assetId: "",
    startSeconds: 0,
    sourceIn: 0,
    sourceOut: 0,
    volume: 0.8,
    fadeInSeconds: 0.3,
    fadeOutSeconds: 0.5,
    ...audio,
  };
  return { project: { ...project, audio: [...project.audio, next] }, id };
}

export function updateAudioClip(
  project: ReelProject,
  id: string,
  patch: Partial<ReelAudioClip>,
): ReelProject {
  return {
    ...project,
    audio: project.audio.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  };
}

export function removeAudioClip(project: ReelProject, id: string): ReelProject {
  return { ...project, audio: project.audio.filter((item) => item.id !== id) };
}

export function addCaption(
  project: ReelProject,
  caption: Partial<ReelCaption> = {},
): { project: ReelProject; id: string } {
  const id = createId("caption");
  const next: ReelCaption = {
    id,
    startSeconds: 0,
    endSeconds: 3,
    text: "Caption",
    x: 0.5,
    y: 0.82,
    fontSize: 40,
    color: "#ffffff",
    background: "rgba(0,0,0,.55)",
    ...caption,
  };
  return { project: { ...project, captions: [...project.captions, next] }, id };
}

export function updateCaption(
  project: ReelProject,
  id: string,
  patch: Partial<ReelCaption>,
): ReelProject {
  return {
    ...project,
    captions: project.captions.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  };
}

export function removeCaption(project: ReelProject, id: string): ReelProject {
  return { ...project, captions: project.captions.filter((item) => item.id !== id) };
}

/** Applies the aspect ratio to the project canvas. */
export function setAspectRatio(project: ReelProject, aspectRatio: ReelAspectRatio): ReelProject {
  const size = REEL_CANVAS_SIZES[aspectRatio];
  return { ...project, aspectRatio, width: size.width, height: size.height };
}

/**
 * Snaps a candidate timeline position to a clip edge when it lands close to one.
 * Used while dragging so clips line up instead of drifting a few pixels away.
 */
export function snapTime(
  project: ReelProject,
  time: number,
  threshold: number,
  extra: number[] = [],
): number {
  const edges: number[] = [0, ...extra];
  for (const clip of project.clips) {
    edges.push(clip.startSeconds, clipEnd(clip));
  }
  let best = time;
  let bestDistance = threshold;
  for (const edge of edges) {
    const distance = Math.abs(edge - time);
    if (distance < bestDistance) {
      best = edge;
      bestDistance = distance;
    }
  }
  return best;
}

/** Sorts tracks and clamps overlay timings to the project duration. */
export function normalizeProject(project: ReelProject): ReelProject {
  const duration = projectDuration(project);
  const clampItem = <T extends { startSeconds: number; endSeconds: number }>(item: T): T => ({
    ...item,
    startSeconds: round(Math.max(0, item.startSeconds)),
    endSeconds: round(
      Math.max(item.startSeconds + 0.2, Math.min(item.endSeconds, Math.max(duration, 0.2))),
    ),
  });
  return {
    ...project,
    clips: [...project.clips].sort((a, b) => a.startSeconds - b.startSeconds),
    texts: project.texts.map(clampItem),
    stickers: project.stickers.map(clampItem),
    captions: project.captions.map(clampItem),
  };
}

export const REEL_TRACKS = [
  { id: REEL_VIDEO_TRACK_ID, label: "Video" },
  { id: REEL_OVERLAY_TRACK_ID, label: "Overlays" },
  { id: REEL_CAPTION_TRACK_ID, label: "Captions" },
  { id: REEL_AUDIO_TRACK_ID, label: "Audio" },
] as const;
