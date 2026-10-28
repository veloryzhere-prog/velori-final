export type PostEditorAspectRatio = "1:1" | "4:5" | "9:16" | "16:9";
export type PostEditorStatus = "draft" | "published" | "archived";
export type PostEditorLayerType = "text" | "image" | "shape";
export type PostEditorAnimationType = "fade" | "slide" | "zoom" | "rotate" | "bounce" | "elastic";
export type PostEditorEasingType = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "bezier";
export type PostEditorPageTransitionType = "slide" | "flip" | "fade" | "zoom";

export interface PostEditorLayerText {
  id: string;
  content: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
  stroke?: string | null;
  shadow?: string | null;
}

export interface PostEditorLayerImage {
  id: string;
  src: string;
  /** Optional source hint used to preview video media without changing older saved drafts. */
  mediaType?: "image" | "video";
  fit?: "cover" | "contain";
  crop?: string | null;
  rotation?: number;
  opacity?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
}

export interface PostEditorLayerShape {
  id: string;
  shapeType?: string;
  fill?: string;
  stroke?: string | null;
  strokeWidth?: number;
  radius?: number;
}

export interface PostEditorAnimation {
  id: string;
  targetId?: string | null;
  type: PostEditorAnimationType;
  startTime: number;
  duration: number;
  delay?: number;
  easing?: PostEditorEasingType;
  bezier?: [number, number, number, number];
  from?: string | null;
  to?: string | null;
  axis?: "x" | "y" | "scale" | "rotation" | null;
}

export interface PostEditorPageTransition {
  id: string;
  type: PostEditorPageTransitionType;
  direction?: "left" | "right" | "up" | "down" | "forward" | "backward";
  fromSlideId?: string | null;
  toSlideId?: string | null;
  startTime: number;
  duration: number;
  easing?: PostEditorEasingType;
}

export interface PostEditorLayer {
  id: string;
  slideId?: string;
  type: PostEditorLayerType;
  name: string;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  blendMode: string;
  visible: boolean;
  locked: boolean;
  text?: PostEditorLayerText | null;
  image?: PostEditorLayerImage | null;
  shape?: PostEditorLayerShape | null;
  animations?: PostEditorAnimation[];
}

export interface PostEditorSlide {
  id: string;
  postId?: string;
  order: number;
  background?: string;
  duration: number;
  layers: PostEditorLayer[];
  animations?: PostEditorAnimation[];
  pageTransitions?: PostEditorPageTransition[];
}

export interface PostEditorBrandKit {
  id: string;
  name: string;
  colors?: string[];
  fonts?: string[];
  logoUrl?: string | null;
}

export interface PostEditorTemplate {
  id: string;
  name: string;
  kind?: string;
  content?: string | null;
  brandKitId?: string | null;
}

export interface PostEditorPost {
  id: string;
  title: string;
  status: PostEditorStatus;
  aspectRatio: PostEditorAspectRatio;
  slides: PostEditorSlide[];
  brandKitId?: string | null;
  templateId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
