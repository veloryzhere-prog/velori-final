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

export function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function fitToScreen(
  viewportWidth,
  viewportHeight,
  contentWidth = CANVAS_SIZE.width,
  contentHeight = CANVAS_SIZE.height,
) {
  const padding = 60;
  const widthScale = Math.max(0, viewportWidth - padding) / contentWidth;
  const heightScale = Math.max(0, viewportHeight - padding) / contentHeight;
  const zoom = clampZoom(Math.min(widthScale, heightScale));
  return {
    zoom,
    offset: {
      x: (viewportWidth - contentWidth * zoom) / 2,
      y: (viewportHeight - contentHeight * zoom) / 2,
    },
  };
}

export function canvasPointFromClient(clientX, clientY, viewportLeft, viewportTop, offset, zoom) {
  const safeZoom = Math.max(MIN_ZOOM, zoom);
  return {
    x: (clientX - viewportLeft - offset.x) / safeZoom,
    y: (clientY - viewportTop - offset.y) / safeZoom,
  };
}

export function snapValue(value, size = GRID_SIZE) {
  return Math.round(value / size) * size;
}

export function getLayerBounds(layer) {
  const width = Math.max(24, layer.width || 120);
  const height = Math.max(24, layer.height || 120);
  return {
    x: layer.x,
    y: layer.y,
    width,
    height,
    right: layer.x + width,
    bottom: layer.y + height,
  };
}

export function reorderLayers(layers, fromIndex, toIndex) {
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

export function duplicateLayer(layer) {
  return {
    ...layer,
    id: `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: `${layer.name} Copy`,
    x: layer.x + 24,
    y: layer.y + 24,
    order: layer.order + 1,
  };
}

export function layerUnderPoint(layers, point) {
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

export function selectionHandleAtPoint(layer, point) {
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

export function resizeLayer(layer, handle, dx, dy) {
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
