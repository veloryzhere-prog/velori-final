export type StoryStatus = "draft" | "published" | "archived";
export type StoryAspectRatio = "9:16";
export type StorySlideMediaType = "image" | "video" | "gif" | "camera";
export type StoryBackgroundType = "solid" | "gradient" | "image" | "video" | "pattern";
export type StoryStickerType =
  | "poll"
  | "question"
  | "quiz"
  | "slider"
  | "link"
  | "countdown"
  | "music"
  | "mention"
  | "location"
  | "hashtag"
  | "emoji"
  | "custom";
export type StoryTransitionType = "fade" | "slide" | "zoom" | "spin" | "wipe" | "glitch";

export interface Story {
  id: string;
  ownerId: string | null;
  title: string;
  status: StoryStatus;
  aspectRatio: StoryAspectRatio;
  width: number;
  height: number;
  loop: boolean;
  slides: Slide[];
  audioTracks: AudioTrack[];
  transitions: Transition[];
  brandOverride: BrandOverride | null;
  createdAt: string;
  updatedAt: string;
}

export interface Slide {
  id: string;
  storyId: string;
  order: number;
  mediaType: StorySlideMediaType;
  mediaUrl: string | null;
  duration: number;
  backgroundType: StoryBackgroundType;
  background: string | null;
  stickers: Sticker[];
  createdAt: string;
  updatedAt: string;
}

export type StoryCollageLayout = "2x2" | "1x3" | "3x1" | "custom";
export type StoryMediaFilter = "none" | "warm" | "cool" | "mono" | "vivid" | "fade";

export interface StorySlideMediaSettings {
  mediaFit?: "cover" | "contain" | "fill";
  mediaOpacity?: number;
  cropZoom: number;
  cropX: number;
  cropY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  filter: StoryMediaFilter;
  videoStart: number;
  videoEnd: number;
  sourceDuration: number;
  videoSpeed: number;
  reverse: boolean;
  stabilize: boolean;
  backgroundBlur: number;
  backgroundAssetUrl: string | null;
  collageLayout: StoryCollageLayout;
  collageImageUrls: string[];
}

export type StoryTextAnimation =
  | "none"
  | "fade-in"
  | "fade-out"
  | "fade-in-out"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "pop"
  | "bounce"
  | "pulse"
  | "rotate-in"
  | "float"
  | "typewriter"
  | "fade"
  | "slide";
export type StoryTextPosition =
  | "top"
  | "upper"
  | "center"
  | "lower"
  | "bottom"
  | "top-left"
  | "top-right";

export interface StoryTextOverlay {
  id: string;
  content: string;
  styleId: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  italic: boolean;
  uppercase: boolean;
  background: string | null;
  stroke: string | null;
  shadow: string | null;
  animation: StoryTextAnimation;
  animationDuration: number;
  animationDelay?: number;
  animationLoop?: boolean;
  startAt: number;
  position: StoryTextPosition;
  x: number;
  y: number;
  width: number;
  height: number;
  autoSize: boolean;
  rotation?: number;
  zIndex?: number;
  visible?: boolean;
  opacity?: number;
  backgroundOpacity?: number;
  backgroundRadius?: number;
}

export interface StoryShape {
  id: string;
  type: "shape";
  shape: "rectangle" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  visible: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
  createdAt: string;
  updatedAt: string;
}

export interface Sticker {
  id: string;
  slideId: string;
  type: StoryStickerType;
  content: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  visible: boolean;
  config: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoryStickerConfig {
  options?: string[];
  votes?: number[];
  showResults?: boolean;
  selectedOption?: number | null;
  correctAnswer?: number;
  reaction?: string;
  reactionText?: string;
  url?: string;
  displayText?: string;
  title?: string;
  artist?: string;
  volume?: number;
  account?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  targetDate?: string;
  emoji?: string;
  animation?: StoryTextAnimation | "spin";
  animationStartAt?: number;
  animationDuration?: number;
  animationDelay?: number;
  animationLoop?: boolean;
  catalogId?: string;
  category?: string;
  color?: string;
  background?: string;
  assetUrl?: string;
  customType?: "image";
}

export interface StoryBrandOverlay {
  logoUrl: string | null;
  logoX: number;
  logoY: number;
  logoScale: number;
  logoOpacity: number;
  watermarkText: string;
  watermarkOpacity: number;
}

export interface AudioTrack {
  id: string;
  storyId: string;
  slideId: string | null;
  name: string;
  sourceUrl: string;
  startTime: number;
  endTime: number | null;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  crossfadeIn: number;
  crossfadeOut: number;
  muted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transition {
  id: string;
  storyId: string;
  fromSlideId: string;
  toSlideId: string;
  type: StoryTransitionType;
  duration: number;
  parameters: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandOverride {
  id: string;
  storyId: string;
  brandKitId: string | null;
  colors: string | null;
  fonts: string | null;
  logoUrl: string | null;
  logoX: number;
  logoY: number;
  logoScale: number;
  logoOpacity: number;
  watermarkText: string | null;
  watermarkOpacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryEditorRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | string;
  resource: "stories" | "slides" | "stickers" | "audio-tracks" | "transitions" | "brand-overrides";
  id?: string;
  storyId?: string;
  slideId?: string;
  payload?: Record<string, unknown>;
}

export interface StoryEditorResponse<T = unknown> {
  status: number;
  body: T;
}
