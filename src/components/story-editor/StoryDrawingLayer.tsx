import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  appendStoryStrokePoint,
  createDrawingDocument,
  createStoryStroke,
  eraseStoryDrawingAt,
  normalizeStoryPoint,
  renderStoryDrawing,
  undoStoryDrawing,
  type StoryBrush,
  type StoryDrawingDocument,
  type StoryDrawingStroke,
} from "../../lib/story-editor/drawing-engine";
import { createStoryEditorId } from "../../lib/story-editor/id.mjs";

export interface StoryDrawingLayerProps {
  value: StoryDrawingDocument;
  onChange: (value: StoryDrawingDocument) => void;
  active: boolean;
  onActiveChange?: (active: boolean) => void;
  className?: string;
}

const COLORS = [
  "#FFFFFF",
  "#111111",
  "#FF375F",
  "#FF5CA8",
  "#FF9500",
  "#FFD60A",
  "#34C759",
  "#00C7BE",
  "#0A84FF",
  "#5E5CE6",
  "#BF5AF2",
];

const BRUSHES: Array<{
  id: StoryBrush;
  label: string;
}> = [
  { id: "pen", label: "Pen" },
  { id: "marker", label: "Marker" },
  { id: "highlighter", label: "Highlighter" },
  { id: "eraser", label: "Eraser" },
];

export default function StoryDrawingLayer({
  value,
  onChange,
  active,
  onActiveChange,
  className,
}: StoryDrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentStrokeRef = useRef<StoryDrawingStroke | null>(null);
  const lastErasePointRef = useRef<{ x: number; y: number } | null>(null);

  const [tool, setTool] = useState<StoryBrush>("pen");
  const [color, setColor] = useState("#FFFFFF");
  const [width, setWidth] = useState(4);
  const [opacity, setOpacity] = useState(1);

  const documentRef = useRef(value);

  useEffect(() => {
    documentRef.current = value;
  }, [value]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(rect.width * dpr);
    const pixelHeight = Math.round(rect.height * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const context = canvas.getContext("2d");

    if (!context) return;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    renderStoryDrawing(context, documentRef.current, rect.width, rect.height);
  }, []);

  useEffect(() => {
    render();
  }, [value, render]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const observer = new ResizeObserver(render);
    observer.observe(container);

    return () => observer.disconnect();
  }, [render]);

  const updateDocument = useCallback(
    (next: StoryDrawingDocument) => {
      documentRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const getPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    return normalizeStoryPoint(
      event.clientX,
      event.clientY,
      rect,
      event.pressure > 0 ? event.pressure : 0.5,
    );
  }, []);

  const eraseAt = useCallback(
    (point: { x: number; y: number }) => {
      const previous = lastErasePointRef.current;

      if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.008) {
        return;
      }

      lastErasePointRef.current = point;

      const next = eraseStoryDrawingAt(
        documentRef.current,
        {
          x: point.x,
          y: point.y,
          pressure: 0.5,
        },
        Math.max(0.008, width / 1200),
      );

      updateDocument(next);
    },
    [updateDocument, width],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active || event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      const point = getPoint(event);

      if (!point) return;

      event.currentTarget.setPointerCapture(event.pointerId);

      if (tool === "eraser") {
        lastErasePointRef.current = null;
        eraseAt(point);
        return;
      }

      const stroke = createStoryStroke({
        id: createStoryEditorId(),
        tool,
        color,
        width,
        opacity,
        point,
      });

      currentStrokeRef.current = stroke;

      updateDocument({
        ...documentRef.current,
        strokes: [...documentRef.current.strokes, stroke],
      });
    },
    [active, color, eraseAt, getPoint, opacity, tool, updateDocument, width],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active) return;
      event.stopPropagation();

      const point = getPoint(event);

      if (!point) return;

      if (tool === "eraser" && event.buttons !== 0) {
        event.preventDefault();
        eraseAt(point);
        return;
      }

      const current = currentStrokeRef.current;

      if (!current || event.buttons === 0) return;

      event.preventDefault();

      const updated = appendStoryStrokePoint(current, point);
      currentStrokeRef.current = updated;

      updateDocument({
        ...documentRef.current,
        strokes: documentRef.current.strokes.map((stroke) =>
          stroke.id === updated.id ? updated : stroke,
        ),
      });
    },
    [active, eraseAt, getPoint, tool, updateDocument],
  );

  const finishStroke = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation();
    currentStrokeRef.current = null;
    lastErasePointRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const undo = useCallback(() => {
    currentStrokeRef.current = null;
    updateDocument(undoStoryDrawing(documentRef.current));
  }, [updateDocument]);

  const clear = useCallback(() => {
    currentStrokeRef.current = null;
    updateDocument(createDrawingDocument());
  }, [updateDocument]);

  return (
    <div
      ref={containerRef}
      className={`velori-drawing-layer ${className ?? ""}`}
      data-active={active ? "true" : "false"}
    >
      <canvas
        ref={canvasRef}
        className="velori-drawing-canvas"
        aria-label="Story drawing canvas"
        style={{
          pointerEvents: active ? "auto" : "none",
          touchAction: active ? "none" : "auto",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={(event) => event.stopPropagation()}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onLostPointerCapture={() => {
          currentStrokeRef.current = null;
        }}
      />

      {active && (
        <div className="velori-drawing-toolbar" role="toolbar" aria-label="Drawing tools">
          <div className="velori-drawing-toolbar__top">
            {BRUSHES.map((brush) => (
              <button
                key={brush.id}
                type="button"
                className={
                  tool === brush.id ? "velori-drawing-tool is-active" : "velori-drawing-tool"
                }
                aria-pressed={tool === brush.id}
                onClick={() => setTool(brush.id)}
              >
                {brush.label}
              </button>
            ))}

            <button
              type="button"
              className="velori-drawing-tool"
              onClick={undo}
              disabled={value.strokes.length === 0}
              aria-label="Undo last drawing stroke"
            >
              Undo
            </button>

            <button
              type="button"
              className="velori-drawing-tool"
              onClick={clear}
              disabled={value.strokes.length === 0}
              aria-label="Clear drawing"
            >
              Clear
            </button>

            <button
              type="button"
              className="velori-drawing-tool"
              onClick={() => onActiveChange?.(false)}
              aria-label="Close drawing tools"
            >
              Done
            </button>
          </div>

          <div className="velori-drawing-colors" role="group" aria-label="Drawing colors">
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`Select ${item}`}
                aria-pressed={color === item}
                className={
                  color === item ? "velori-drawing-color is-active" : "velori-drawing-color"
                }
                style={{ backgroundColor: item }}
                onClick={() => setColor(item)}
              />
            ))}
          </div>

          <label className="velori-drawing-range">
            <span>Brush size</span>
            <input
              type="range"
              min="1"
              max="30"
              step="1"
              value={width}
              onChange={(event) => setWidth(Number(event.target.value))}
            />
          </label>

          <label className="velori-drawing-range">
            <span>Opacity</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  );
}
