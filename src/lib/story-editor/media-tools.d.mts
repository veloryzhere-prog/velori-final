import type { StoryCollageLayout, StoryMediaFilter, StorySlideMediaSettings } from "./types";

export const MAX_STORY_MEDIA_BYTES: number;
export const MAX_STORY_VIDEO_SECONDS: number;
export const MAX_STORY_SLIDE_SECONDS: number;
export const DEFAULT_STORY_MEDIA_SETTINGS: Readonly<StorySlideMediaSettings>;
export function validateStoryMediaHeader(
  file: Pick<File, "type" | "size">,
  headerBytes: Uint8Array,
): "image" | "video" | "gif";
export function clampStoryVideoTrim(
  start: number,
  end: number,
  mediaDuration: number,
): { start: number; end: number };
export function getStoryCollageGrid(
  layout: StoryCollageLayout,
  itemCount: number,
): { columns: number; rows: number };
export function getStoryMediaFilter(
  settings: Pick<
    StorySlideMediaSettings,
    "brightness" | "contrast" | "saturation" | "blur" | "filter"
  >,
): string;

export function storyMediaPlacement(
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
  fit?: string,
  cropX?: number,
  cropY?: number,
): { x: number; y: number; width: number; height: number };
