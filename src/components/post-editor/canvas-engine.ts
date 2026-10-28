import type { PostEditorLayer } from "../../../types/post-editor";

export const CANVAS_SIZE = { width: 1080, height: 1920 };
export const GRID_SIZE = 24;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const SAFE_ZONE = {
  left: 120,
  top: 220,
  right: 120,
  bottom: 220,
};

export type Point = { x: number; y: number };

export function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function snapValue(value: number, size: number = GRID_SIZE) {
  return Math.round(value / size) * size;
}

export function getLayerBounds(layer: PostEditorLayer) {
  return {
    x: layer.x,
    y: layer.y,
    width: Math.max(24, layer.width || 120),
    height: Math.max(24, layer.height || 120),
    right: layer.x + Math.max(24, layer.width || 120),
    bottom: layer.y + Math.max(24, layer.height || 120),
  };
}

export function getSelectionBounds(layers: PostEditorLayer[], selectedId: string | null) {
  const selectedLayer = layers.find((layer) => layer.id === selectedId);
  if (!selectedLayer) return null;
  return getLayerBounds(selectedLayer);
}

export function fitToScreen(
  viewportWidth: number,
  viewportHeight: number,
  contentWidth = CANVAS_SIZE.width,
  contentHeight = CANVAS_SIZE.height,
) {
  const padding = 60;
  const widthScale = Math.max(0, viewportWidth - padding) / contentWidth;
  const heightScale = Math.max(0, viewportHeight - padding) / contentHeight;
  const nextZoom = clampZoom(Math.min(widthScale, heightScale));
  const offset = {
    x: (viewportWidth - contentWidth * nextZoom) / 2,
    y: (viewportHeight - contentHeight * nextZoom) / 2,
  };
  return { zoom: nextZoom, offset };
}

export function canvasPointFromClient(
  clientX: number,
  clientY: number,
  viewportLeft: number,
  viewportTop: number,
  offset: Point,
  zoom: number,
): Point {
  const safeZoom = Math.max(MIN_ZOOM, zoom);
  return {
    x: (clientX - viewportLeft - offset.x) / safeZoom,
    y: (clientY - viewportTop - offset.y) / safeZoom,
  };
}

export function reorderLayers(layers: PostEditorLayer[], fromIndex: number, toIndex: number) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= layers.length ||
    toIndex >= layers.length
  ) {
    return layers;
  }

  const next = [...layers];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((layer, index) => ({ ...layer, order: index }));
}

export function duplicateLayer(layer: PostEditorLayer) {
  return {
    ...layer,
    id: `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: `${layer.name} Copy`,
    x: layer.x + 24,
    y: layer.y + 24,
    order: layer.order + 1,
  };
}

export function layerUnderPoint(layers: PostEditorLayer[], point: Point) {
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    const bounds = getLayerBounds(layer);
    if (
      point.x >= bounds.x &&
      point.x <= bounds.right &&
      point.y >= bounds.y &&
      point.y <= bounds.bottom
    ) {
      return layer.id;
    }
  }
  return null;
}

export function selectionHandleAtPoint(layer: PostEditorLayer, point: Point) {
  const { x, y, right, bottom } = getLayerBounds(layer);
  const handles = [
    { name: "nw", x, y },
    { name: "ne", x: right, y },
    { name: "sw", x, y: bottom },
    { name: "se", x: right, y: bottom },
  ];

  return (
    handles.find((handle) => {
      const dx = Math.abs(point.x - handle.x);
      const dy = Math.abs(point.y - handle.y);
      return dx <= 18 && dy <= 18;
    })?.name ?? null
  );
}

export function resizeLayer(layer: PostEditorLayer, handle: string, dx: number, dy: number) {
  const next = { ...layer };
  const currentWidth = Math.max(24, layer.width || 120);
  const currentHeight = Math.max(24, layer.height || 120);

  if (handle.includes("e")) {
    next.width = Math.max(24, currentWidth + dx);
  }
  if (handle.includes("s")) {
    next.height = Math.max(24, currentHeight + dy);
  }
  if (handle.includes("w")) {
    next.x = layer.x + dx;
    next.width = Math.max(24, currentWidth - dx);
  }
  if (handle.includes("n")) {
    next.y = layer.y + dy;
    next.height = Math.max(24, currentHeight - dy);
  }

  if (next.width < 24) {
    next.x = layer.x + layer.width - 24;
    next.width = 24;
  }
  if (next.height < 24) {
    next.y = layer.y + layer.height - 24;
    next.height = 24;
  }

  return next;
}
