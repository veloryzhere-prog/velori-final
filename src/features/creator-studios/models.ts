import { createUuid } from "../../lib/uuid.mjs";
import type { StudioMusicTrack } from "../../lib/studio-catalog";
export type StudioMode = "post" | "reel";
export type LayerKind = "text" | "image";

export interface Layer {
  id: string;
  kind: LayerKind;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  src?: string;
  color?: string;
  fontSize?: number;
  opacity: number;
  rotation?: number;
  locked?: boolean;
  fontFamily?: string;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
}

export interface Slide {
  id: string;
  background: string;
  layers: Layer[];
}

export interface PostDraft {
  documentVersion?: 2;
  soundtrack?: StudioMusicTrack | null;
  slides: Slide[];
  activeSlideId: string;
  selectedLayerId?: string;
  caption: string;
  settings?: {
    visibility: "public" | "followers" | "private";
    allowComments: boolean;
    allowLikes: boolean;
    hideLikeCount: boolean;
    allowSharing: boolean;
  };
}

export interface ReelCaption {
  id: string;
  text: string;
  start: number;
  end: number;
}

export interface ReelDraft {
  source?: string;
  fileName?: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  splits: number[];
  overlayText: string;
  overlayX: number;
  overlayY: number;
  captions: ReelCaption[];
  volume: number;
  muted: boolean;
  cover?: string;
  caption: string;
}

export interface PublishingPayload {
  kind: "post" | "reel";
  draft: PostDraft | ReelDraft;
  /**
   * Set by the user after an explicit confirmation when a reel draft contains
   * edits (trim points, split markers, overlays, timed captions, volume) that
   * the available video pipeline cannot render into the uploaded file.
   */
  acknowledgeUnrendered?: boolean;
}

export interface PublishingAdapter {
  id: string;
  label: string;
  isConfigured(): boolean;
  publish(payload: PublishingPayload): Promise<{ id: string; url?: string }>;
}

export const STORAGE_KEY = "velori-creator-studio-v1";
export const DATABASE_NAME = "velori-creator-studio";
export const MAX_FILE_BYTES = 80 * 1024 * 1024;
export const uid = createUuid;
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  return `${mins}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
};

export const initialSlide = (): Slide => ({
  id: uid(),
  background: "#ece8d6",
  layers: [
    {
      id: uid(),
      kind: "text",
      name: "Headline",
      x: 12,
      y: 14,
      width: 72,
      height: 24,
      text: "Your story, beautifully told.",
      color: "#24271e",
      fontSize: 30,
      opacity: 1,
    },
  ],
});

export const createInitialPost = (): PostDraft => {
  const slide = initialSlide();
  return { slides: [slide], activeSlideId: slide.id, caption: "" };
};

export const initialReel: ReelDraft = {
  duration: 0,
  trimStart: 0,
  trimEnd: 0,
  splits: [],
  overlayText: "",
  overlayX: 50,
  overlayY: 68,
  captions: [],
  volume: 1,
  muted: false,
  caption: "",
};
