const HISTORY_LIMIT = 50;
const MIN_OBJECT_SIZE = 0.04;
const roundCoordinate = (value) => Math.round(value * 1_000_000) / 1_000_000;

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function createStorySceneHistory() {
  return { past: [], future: [] };
}

export function recordStorySceneChange(history, slideId, before, after, action = "edit") {
  if (!slideId || JSON.stringify(before) === JSON.stringify(after)) return history;
  const entry = {
    slideId,
    before: clone(before),
    after: clone(after),
    action,
    committedAt: Date.now(),
  };
  const past = [...history.past, entry].slice(-HISTORY_LIMIT);
  return { past, future: [] };
}

export function undoStorySceneChange(history) {
  const entry = history.past.at(-1);
  if (!entry) return { history, restore: null };
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, entry],
    },
    restore: { slideId: entry.slideId, objects: clone(entry.before) },
  };
}

export function redoStorySceneChange(history) {
  const entry = history.future.at(-1);
  if (!entry) return { history, restore: null };
  return {
    history: {
      past: [...history.past, entry].slice(-HISTORY_LIMIT),
      future: history.future.slice(0, -1),
    },
    restore: { slideId: entry.slideId, objects: clone(entry.after) },
  };
}

export function storyCanvasPoint(rect, clientX, clientY) {
  if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
    throw new TypeError("A finite canvas rectangle is required.");
  }
  if (rect.width <= 0 || rect.height <= 0) {
    throw new RangeError("Canvas dimensions must be positive.");
  }
  return {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
  };
}

export function storyCanvasPixel(point, width, height) {
  if (
    !Number.isFinite(point?.x) ||
    !Number.isFinite(point?.y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new TypeError("Finite canvas coordinates and positive dimensions are required.");
  }
  return { x: point.x * width, y: point.y * height };
}

function finiteTransform(transform) {
  const values = [
    transform?.x,
    transform?.y,
    transform?.width,
    transform?.height,
    transform?.rotation ?? 0,
  ];
  if (!values.every(Number.isFinite)) throw new TypeError("Object transforms must be finite.");
}

export function moveStoryTransform(transform, deltaX, deltaY) {
  finiteTransform(transform);
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    throw new TypeError("Object movement must be finite.");
  }
  const width = Math.min(1, Math.max(MIN_OBJECT_SIZE, transform.width));
  const height = Math.min(1, Math.max(MIN_OBJECT_SIZE, transform.height));
  return {
    ...transform,
    x: roundCoordinate(Math.min(1 - width, Math.max(0, transform.x + deltaX))),
    y: roundCoordinate(Math.min(1 - height, Math.max(0, transform.y + deltaY))),
    width,
    height,
    rotation: transform.rotation ?? 0,
  };
}

export function resizeStoryTransform(
  transform,
  handle,
  deltaX,
  deltaY,
  preserveAspectRatio = false,
) {
  finiteTransform(transform);
  if (!["nw", "ne", "sw", "se"].includes(handle)) {
    throw new TypeError("A supported corner handle is required.");
  }
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    throw new TypeError("Object resizing must be finite.");
  }
  const west = handle.endsWith("w");
  const north = handle.startsWith("n");
  const fixedX = west ? transform.x + transform.width : transform.x;
  const fixedY = north ? transform.y + transform.height : transform.y;
  let width = Math.max(MIN_OBJECT_SIZE, transform.width + (west ? -deltaX : deltaX));
  let height = Math.max(MIN_OBJECT_SIZE, transform.height + (north ? -deltaY : deltaY));
  if (preserveAspectRatio) {
    const ratio = transform.width / transform.height;
    if (Math.abs(deltaX) >= Math.abs(deltaY)) height = width / ratio;
    else width = height * ratio;
  }
  width = Math.min(1, width);
  height = Math.min(1, height);
  const x = west ? fixedX - width : fixedX;
  const y = north ? fixedY - height : fixedY;
  const boundedX = Math.min(1 - width, Math.max(0, x));
  const boundedY = Math.min(1 - height, Math.max(0, y));
  return {
    ...transform,
    x: roundCoordinate(boundedX),
    y: roundCoordinate(boundedY),
    width,
    height,
    rotation: transform.rotation ?? 0,
  };
}

export function rotateStoryTransform(transform, center, startAngle, currentAngle) {
  finiteTransform(transform);
  if (![center?.x, center?.y, startAngle, currentAngle].every(Number.isFinite)) {
    throw new TypeError("Rotation coordinates must be finite.");
  }
  const delta = ((currentAngle - startAngle) * 180) / Math.PI;
  return {
    ...transform,
    rotation: ((((transform.rotation + delta + 180) % 360) + 360) % 360) - 180,
  };
}

export function normalizeStoryObjectOrder(objects) {
  return [...objects]
    .sort((left, right) => left.zIndex - right.zIndex || left.id.localeCompare(right.id))
    .map((object, index) => ({ ...object, zIndex: index }));
}

export function orderStoryObjects(objects) {
  const kindOrder = { text: 0, shape: 1, sticker: 2 };
  return [...objects].sort(
    (left, right) => left.zIndex - right.zIndex || kindOrder[left.kind] - kindOrder[right.kind],
  );
}

export function reorderStoryObject(objects, id, direction) {
  if (!["forward", "backward", "front", "back"].includes(direction)) {
    throw new TypeError("A supported layer-order action is required.");
  }
  const ordered = normalizeStoryObjectOrder(objects);
  const index = ordered.findIndex((object) => object.id === id);
  if (index < 0) return ordered;
  const target =
    direction === "front"
      ? ordered.length - 1
      : direction === "back"
        ? 0
        : Math.min(ordered.length - 1, Math.max(0, index + (direction === "forward" ? 1 : -1)));
  if (target === index) return ordered;
  const [object] = ordered.splice(index, 1);
  ordered.splice(target, 0, object);
  return ordered.map((item, zIndex) => ({ ...item, zIndex }));
}

export function createStoryShape(id, shape, now = new Date().toISOString()) {
  if (!id || !["rectangle", "ellipse"].includes(shape)) {
    throw new TypeError("A stable ID and supported shape are required.");
  }
  return {
    id,
    type: "shape",
    shape,
    x: 0.3,
    y: 0.42,
    width: 0.4,
    height: 0.16,
    rotation: 0,
    zIndex: 0,
    visible: true,
    fill: "#F05A9D",
    stroke: "#FFFFFF",
    strokeWidth: 2,
    createdAt: now,
    updatedAt: now,
  };
}
