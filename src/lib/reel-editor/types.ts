export type ReelAspectRatio = "9:16" | "1:1" | "16:9" | "4:5";

export interface ReelCanvasSize {
  width: number;
  height: number;
}

export const REEL_CANVAS_SIZES: Record<ReelAspectRatio, ReelCanvasSize> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export type ReelAssetKind = "video" | "image" | "audio";

export interface ReelAsset {
  id: string;
  kind: ReelAssetKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  /** Object URL for the local file. Revoked when the asset leaves the project. */
  url: string;
  /** Kept so a saved draft can be restored after a reload. */
  file?: File;
  posterUrl?: string;
  /** Stable catalog identity; signed audio URLs are never published as metadata. */
  catalogTrackId?: string;
}

export interface ReelTransform {
  /** Normalized offsets from the canvas centre, in 0..1 units. */
  offsetX: number;
  offsetY: number;
  scale: number;
  /** Degrees. */
  rotation: number;
  fit: "cover" | "contain";
  flipX: boolean;
  flipY: boolean;
}

export type ReelEffectId = "vignette" | "glow" | "grain" | "zoom";

/** Effect id to intensity, 0..1. */
export type ReelEffects = Partial<Record<ReelEffectId, number>>;

export interface ReelAdjustments {
  /** Percentages. 100 is neutral. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** Pixels. */
  blur: number;
  /** -100 (cool) to 100 (warm). */
  temperature: number;
}

export interface ReelTransition {
  id: "none" | "fade" | "slide-left" | "slide-right" | "zoom";
  durationSeconds: number;
}

export interface ReelClip {
  id: string;
  assetId: string;
  trackId: string;
  /** Position on the timeline, in seconds. */
  startSeconds: number;
  /** Source in/out points, in source seconds. */
  sourceIn: number;
  sourceOut: number;
  playbackRate: number;
  /** 0..1 */
  volume: number;
  muted: boolean;
  /** Seconds of audio fade at the head and tail of the clip. */
  fadeInSeconds: number;
  fadeOutSeconds: number;
  transform: ReelTransform;
  adjustments: ReelAdjustments;
  effects: ReelEffects;
  filterId: string | null;
  transitionIn: ReelTransition | null;
  transitionOut: ReelTransition | null;
}

export interface ReelTextOverlay {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  /** Normalized 0..1 coordinates of the text box top-left. */
  x: number;
  y: number;
  /** Normalized 0..1 width of the text box. */
  width: number;
  /** When locked the element cannot be dragged or resized on the canvas. */
  locked?: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  background: string | null;
  stroke: string | null;
  shadow: boolean;
  uppercase: boolean;
}

export interface ReelSticker {
  id: string;
  startSeconds: number;
  endSeconds: number;
  assetId: string | null;
  glyph: string | null;
  /** Normalized 0..1 centre coordinates. */
  x: number;
  y: number;
  scale: number;
  rotation: number;
  /** When locked the element cannot be dragged or resized on the canvas. */
  locked?: boolean;
}

export interface ReelAudioClip {
  id: string;
  assetId: string;
  startSeconds: number;
  sourceIn: number;
  sourceOut: number;
  volume: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
}

export interface ReelCaption {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  /** Normalized 0..1 centre coordinates. */
  x: number;
  y: number;
  fontSize: number;
  color: string;
  background: string | null;
}

export interface ReelProject {
  id: string;
  name: string;
  aspectRatio: ReelAspectRatio;
  width: number;
  height: number;
  assets: Record<string, ReelAsset>;
  clips: ReelClip[];
  texts: ReelTextOverlay[];
  stickers: ReelSticker[];
  audio: ReelAudioClip[];
  captions: ReelCaption[];
  coverAssetId: string | null;
  coverFrameSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReelFilterPreset {
  id: string;
  name: string;
  /** A CSS filter list. Canvas 2D `context.filter` and DOM `filter` accept the same syntax. */
  css: string;
}

export const REEL_FILTER_PRESETS: ReelFilterPreset[] = [
  { id: "none", name: "Original", css: "" },
  { id: "vivid", name: "Vivid", css: "saturate(1.35) contrast(1.08)" },
  { id: "warm", name: "Warm", css: "sepia(.2) saturate(1.12) brightness(1.03)" },
  { id: "cool", name: "Cool", css: "saturate(1.05) hue-rotate(-14deg)" },
  { id: "mono", name: "Mono", css: "grayscale(1)" },
  { id: "noir", name: "Noir", css: "grayscale(1) contrast(1.25)" },
  { id: "film", name: "Film", css: "contrast(1.15) saturate(.92) sepia(.1)" },
  { id: "fade", name: "Fade", css: "contrast(.94) saturate(.85) brightness(1.06)" },
  { id: "punch", name: "Punch", css: "contrast(1.2) saturate(1.25)" },
  { id: "dream", name: "Dream", css: "blur(.6px) brightness(1.05) saturate(1.1)" },
];

export const REEL_FILTERS_BY_ID = new Map(REEL_FILTER_PRESETS.map((preset) => [preset.id, preset]));

export const REEL_ADJUSTMENT_RANGE = {
  brightness: { min: 0, max: 200, step: 1 },
  contrast: { min: 0, max: 200, step: 1 },
  saturation: { min: 0, max: 200, step: 1 },
  blur: { min: 0, max: 20, step: 0.5 },
  temperature: { min: -100, max: 100, step: 1 },
} as const;

export const REEL_TRANSITION_PRESETS: ReelTransition[] = [
  { id: "none", durationSeconds: 0 },
  { id: "fade", durationSeconds: 0.4 },
  { id: "slide-left", durationSeconds: 0.4 },
  { id: "slide-right", durationSeconds: 0.4 },
  { id: "zoom", durationSeconds: 0.4 },
];

export const REEL_TEXT_FONTS = [
  "DM Sans",
  "Manrope",
  "Georgia",
  "Courier New",
  "Arial Black",
  "Impact",
];

export const REEL_EFFECT_PRESETS: { id: ReelEffectId; name: string }[] = [
  { id: "vignette", name: "Vignette" },
  { id: "glow", name: "Glow" },
  { id: "grain", name: "Grain" },
  { id: "zoom", name: "Zoom" },
];

export const REEL_VIDEO_TRACK_ID = "video";
export const REEL_AUDIO_TRACK_ID = "audio";
export const REEL_OVERLAY_TRACK_ID = "overlay";
export const REEL_CAPTION_TRACK_ID = "caption";
