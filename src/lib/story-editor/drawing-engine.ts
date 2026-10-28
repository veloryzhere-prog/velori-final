export type StoryBrush = "pen" | "marker" | "highlighter" | "eraser";

export interface StoryDrawingPoint {
  x: number;
  y: number;
  pressure: number;
}

export interface StoryDrawingStroke {
  id: string;
  tool: StoryBrush;
  color: string;
  width: number;
  opacity: number;
  points: StoryDrawingPoint[];
  createdAt: string;
}

export interface StoryDrawingDocument {
  version: 1;
  strokes: StoryDrawingStroke[];
}

export const STORY_DRAWING_HISTORY_LIMIT = 100;

export function createDrawingDocument(): StoryDrawingDocument {
  return {
    version: 1,
    strokes: [],
  };
}

export function normalizeStoryPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  pressure = 0.5,
): StoryDrawingPoint {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    throw new TypeError("Valid pointer coordinates and canvas dimensions are required.");
  }

  return {
    x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    pressure: Math.max(0, Math.min(1, pressure)),
  };
}

export function createStoryStroke(options: {
  id: string;
  tool: StoryBrush;
  color: string;
  width: number;
  opacity: number;
  point: StoryDrawingPoint;
}): StoryDrawingStroke {
  if (!options.id.trim()) {
    throw new TypeError("A stroke ID is required.");
  }

  return {
    id: options.id,
    tool: options.tool,
    color: options.color,
    width: Math.max(1, Math.min(80, options.width)),
    opacity: Math.max(0.05, Math.min(1, options.opacity)),
    points: [options.point],
    createdAt: new Date().toISOString(),
  };
}

export function appendStoryStrokePoint(
  stroke: StoryDrawingStroke,
  point: StoryDrawingPoint,
): StoryDrawingStroke {
  const previous = stroke.points[stroke.points.length - 1];

  if (
    previous &&
    Math.abs(previous.x - point.x) < 0.0003 &&
    Math.abs(previous.y - point.y) < 0.0003
  ) {
    return stroke;
  }

  return {
    ...stroke,
    points: [...stroke.points, point],
  };
}

export function undoStoryDrawing(document: StoryDrawingDocument): StoryDrawingDocument {
  return {
    ...document,
    strokes: document.strokes.slice(0, -1),
  };
}

function distanceToSegment(
  point: StoryDrawingPoint,
  start: StoryDrawingPoint,
  end: StoryDrawingPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy;

  if (denominator === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator),
  );

  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

/**
 * Removes strokes touched by the eraser.
 *
 * The eraser radius is normalized to the story canvas.
 * This operation is immutable so React can detect changes.
 */
export function eraseStoryDrawingAt(
  document: StoryDrawingDocument,
  point: StoryDrawingPoint,
  radius: number,
): StoryDrawingDocument {
  const safeRadius = Math.max(0.001, Math.min(0.25, radius));

  const strokes = document.strokes.filter((stroke) => {
    if (stroke.points.length === 0) {
      return false;
    }

    if (stroke.points.length === 1) {
      const onlyPoint = stroke.points[0];

      return Math.hypot(onlyPoint.x - point.x, onlyPoint.y - point.y) > safeRadius;
    }

    for (let index = 1; index < stroke.points.length; index += 1) {
      const start = stroke.points[index - 1];
      const end = stroke.points[index];

      if (distanceToSegment(point, start, end) <= safeRadius) {
        return false;
      }
    }

    return true;
  });

  return {
    ...document,
    strokes,
  };
}

export function parseStoryDrawing(value: unknown): StoryDrawingDocument {
  if (typeof value !== "object" || value === null) {
    return createDrawingDocument();
  }

  const input = value as {
    version?: unknown;
    strokes?: unknown;
  };

  if (input.version !== 1 || !Array.isArray(input.strokes)) {
    return createDrawingDocument();
  }

  const validTools: StoryBrush[] = ["pen", "marker", "highlighter", "eraser"];

  const strokes: StoryDrawingStroke[] = [];

  for (const candidate of input.strokes) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }

    const stroke = candidate as Record<string, unknown>;

    if (
      typeof stroke.id !== "string" ||
      typeof stroke.color !== "string" ||
      typeof stroke.tool !== "string" ||
      !validTools.includes(stroke.tool as StoryBrush) ||
      typeof stroke.width !== "number" ||
      !Number.isFinite(stroke.width) ||
      typeof stroke.opacity !== "number" ||
      !Number.isFinite(stroke.opacity) ||
      !Array.isArray(stroke.points)
    ) {
      continue;
    }

    const points: StoryDrawingPoint[] = [];
    let valid = true;

    for (const candidatePoint of stroke.points) {
      if (typeof candidatePoint !== "object" || candidatePoint === null) {
        valid = false;
        break;
      }

      const point = candidatePoint as Record<string, unknown>;

      if (
        typeof point.x !== "number" ||
        typeof point.y !== "number" ||
        typeof point.pressure !== "number" ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !Number.isFinite(point.pressure) ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1 ||
        point.pressure < 0 ||
        point.pressure > 1
      ) {
        valid = false;
        break;
      }

      points.push({
        x: point.x,
        y: point.y,
        pressure: point.pressure,
      });
    }

    if (!valid || points.length === 0) {
      continue;
    }

    strokes.push({
      id: stroke.id,
      tool: stroke.tool as StoryBrush,
      color: stroke.color,
      width: Math.max(1, Math.min(80, stroke.width)),
      opacity: Math.max(0.05, Math.min(1, stroke.opacity)),
      points,
      createdAt:
        typeof stroke.createdAt === "string" ? stroke.createdAt : new Date(0).toISOString(),
    });
  }

  return {
    version: 1,
    strokes,
  };
}

/**
 * Renders a drawing in CSS-pixel coordinates.
 *
 * The caller must size the physical canvas using devicePixelRatio
 * and scale the context exactly once before calling this function.
 */
export function renderStoryDrawing(
  context: CanvasRenderingContext2D,
  document: StoryDrawingDocument,
  cssWidth: number,
  cssHeight: number,
): void {
  context.clearRect(0, 0, cssWidth, cssHeight);

  for (const stroke of document.strokes) {
    if (stroke.points.length === 0) {
      continue;
    }

    context.save();

    context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";

    context.globalAlpha =
      stroke.tool === "highlighter"
        ? stroke.opacity * 0.35
        : stroke.tool === "marker"
          ? stroke.opacity * 0.75
          : stroke.opacity;

    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;

    context.lineWidth = stroke.tool === "highlighter" ? stroke.width * 1.8 : stroke.width;

    context.lineCap = "round";
    context.lineJoin = "round";

    const first = stroke.points[0];

    context.beginPath();
    context.moveTo(first.x * cssWidth, first.y * cssHeight);

    if (stroke.points.length === 1) {
      context.lineTo(first.x * cssWidth + 0.01, first.y * cssHeight + 0.01);
    } else {
      for (let index = 1; index < stroke.points.length; index += 1) {
        const current = stroke.points[index];

        context.lineTo(current.x * cssWidth, current.y * cssHeight);
      }
    }

    context.stroke();
    context.restore();
  }
}
