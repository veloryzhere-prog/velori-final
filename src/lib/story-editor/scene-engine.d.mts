export interface StorySceneHistory {
  past: Array<{
    slideId: string;
    before: unknown;
    after: unknown;
    action: string;
    committedAt: number;
  }>;
  future: StorySceneHistory["past"];
}

export interface StoryCanvasTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  [key: string]: unknown;
}

export function createStorySceneHistory(): StorySceneHistory;
export function recordStorySceneChange(
  history: StorySceneHistory,
  slideId: string,
  before: unknown,
  after: unknown,
  action?: string,
): StorySceneHistory;
export function undoStorySceneChange(history: StorySceneHistory): {
  history: StorySceneHistory;
  restore: { slideId: string; objects: unknown } | null;
};
export function redoStorySceneChange(history: StorySceneHistory): {
  history: StorySceneHistory;
  restore: { slideId: string; objects: unknown } | null;
};
export function storyCanvasPoint(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number };
export function storyCanvasPixel(
  point: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number };
export function moveStoryTransform<T extends StoryCanvasTransform>(
  transform: T,
  deltaX: number,
  deltaY: number,
): T;
export function resizeStoryTransform<T extends StoryCanvasTransform>(
  transform: T,
  handle: "nw" | "ne" | "sw" | "se",
  deltaX: number,
  deltaY: number,
  preserveAspectRatio?: boolean,
): T;
export function rotateStoryTransform<T extends StoryCanvasTransform>(
  transform: T,
  center: { x: number; y: number },
  startAngle: number,
  currentAngle: number,
): T;
export function normalizeStoryObjectOrder<T extends { id: string; zIndex: number }>(
  objects: T[],
): T[];
export function orderStoryObjects<
  T extends { id: string; kind: "text" | "shape" | "sticker"; zIndex: number },
>(objects: T[]): T[];
export function reorderStoryObject<T extends { id: string; zIndex: number }>(
  objects: T[],
  id: string,
  direction: "forward" | "backward" | "front" | "back",
): T[];
export function createStoryShape(
  id: string,
  shape: "rectangle" | "ellipse",
  now?: string,
): {
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
};
