import React, { useCallback, useEffect, useRef, useState } from "react";

export interface StoryStickerTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface StoryStickerObjectData {
  id: string;
  type: string;
  content: string;
  transform: StoryStickerTransform;
  config?: Record<string, unknown>;
  zIndex?: number;
}

export interface StoryStickerObjectProps {
  sticker: StoryStickerObjectData;
  selected: boolean;
  onSelect: (id: string) => void;
  onTransformChange: (id: string, transform: StoryStickerTransform) => void;
  onTransformEnd?: (id: string, transform: StoryStickerTransform) => void;
  onRemove?: (id: string) => void;
  onOrder?: (id: string, direction: "forward" | "backward" | "front" | "back") => void;
  children?: React.ReactNode;
}

type GestureMode = "move" | "resize" | "rotate";

interface GestureState {
  pointerId: number;
  mode: GestureMode;
  startClientX: number;
  startClientY: number;
  initialTransform: StoryStickerTransform;
  centerClientX: number;
  centerClientY: number;
  initialDistance: number;
  initialAngle: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export default function StoryStickerObject({
  sticker,
  selected,
  onSelect,
  onTransformChange,
  onTransformEnd,
  onRemove,
  onOrder,
  children,
}: StoryStickerObjectProps) {
  const objectRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const [liveTransform, setLiveTransform] = useState<StoryStickerTransform>(sticker.transform);

  useEffect(() => {
    if (!gestureRef.current) {
      setLiveTransform(sticker.transform);
    }
  }, [sticker.transform]);

  const startGesture = useCallback(
    (event: React.PointerEvent<HTMLElement>, mode: GestureMode) => {
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      onSelect(sticker.id);

      const rect = objectRef.current?.getBoundingClientRect();

      if (!rect) return;

      const centerClientX = rect.left + rect.width / 2;
      const centerClientY = rect.top + rect.height / 2;

      gestureRef.current = {
        pointerId: event.pointerId,
        mode,
        startClientX: event.clientX,
        startClientY: event.clientY,
        initialTransform: { ...liveTransform },
        centerClientX,
        centerClientY,
        initialDistance: Math.hypot(event.clientX - centerClientX, event.clientY - centerClientY),
        initialAngle:
          (Math.atan2(event.clientY - centerClientY, event.clientX - centerClientX) * 180) /
          Math.PI,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [liveTransform, onSelect, sticker.id],
  );

  const handleGestureMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const gesture = gestureRef.current;

      if (!gesture || gesture.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();

      const canvas = objectRef.current?.parentElement;

      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) return;

      const initial = gesture.initialTransform;
      let next = { ...initial };

      if (gesture.mode === "move") {
        next.x = clamp(initial.x + (event.clientX - gesture.startClientX) / rect.width, 0, 1);

        next.y = clamp(initial.y + (event.clientY - gesture.startClientY) / rect.height, 0, 1);
      }

      if (gesture.mode === "resize") {
        const distance = Math.hypot(
          event.clientX - gesture.centerClientX,
          event.clientY - gesture.centerClientY,
        );

        const ratio = gesture.initialDistance > 0 ? distance / gesture.initialDistance : 1;

        next.scale = clamp(initial.scale * ratio, 0.25, 5);
      }

      if (gesture.mode === "rotate") {
        const currentAngle =
          (Math.atan2(
            event.clientY - gesture.centerClientY,
            event.clientX - gesture.centerClientX,
          ) *
            180) /
          Math.PI;

        next.rotation = normalizeAngle(initial.rotation + currentAngle - gesture.initialAngle);
      }

      setLiveTransform(next);
      onTransformChange(sticker.id, next);
    },
    [onTransformChange, sticker.id],
  );

  const endGesture = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const gesture = gestureRef.current;

      if (!gesture || gesture.pointerId !== event.pointerId) {
        return;
      }

      gestureRef.current = null;
      onTransformEnd?.(sticker.id, liveTransform);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [liveTransform, onTransformEnd, sticker.id],
  );

  return (
    <div
      ref={objectRef}
      className={selected ? "velori-story-sticker is-selected" : "velori-story-sticker"}
      style={{
        left: `${liveTransform.x * 100}%`,
        top: `${liveTransform.y * 100}%`,
        transform: [
          "translate(-50%, -50%)",
          `rotate(${liveTransform.rotation}deg)`,
          `scale(${liveTransform.scale})`,
        ].join(" "),
        zIndex: sticker.zIndex ?? 40,
      }}
      onPointerDown={(event) => startGesture(event, "move")}
      onPointerMove={handleGestureMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onLostPointerCapture={() => {
        gestureRef.current = null;
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(sticker.id);
      }}
      role="group"
      aria-label={`${sticker.type} sticker`}
      tabIndex={0}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 0.02 : 0.005;
        let next = { ...liveTransform };

        switch (event.key) {
          case "ArrowLeft":
            next.x = clamp(next.x - step, 0, 1);
            break;
          case "ArrowRight":
            next.x = clamp(next.x + step, 0, 1);
            break;
          case "ArrowUp":
            next.y = clamp(next.y - step, 0, 1);
            break;
          case "ArrowDown":
            next.y = clamp(next.y + step, 0, 1);
            break;
          case "Delete":
          case "Backspace":
            if (selected && onRemove) {
              event.preventDefault();
              onRemove(sticker.id);
            }
            return;
          default:
            return;
        }

        event.preventDefault();
        setLiveTransform(next);
        onTransformChange(sticker.id, next);
        onTransformEnd?.(sticker.id, next);
      }}
    >
      <div className="velori-story-sticker__content">{children ?? sticker.content}</div>

      {selected && (
        <>
          {onOrder ? (
            <div
              className="velori-story-sticker__layer-actions"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button type="button" onClick={() => onOrder(sticker.id, "backward")}>
                Back
              </button>
              <button type="button" onClick={() => onOrder(sticker.id, "forward")}>
                Front
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="velori-story-sticker__handle velori-story-sticker__resize"
            aria-label="Resize sticker"
            onPointerDown={(event) => startGesture(event, "resize")}
            onPointerMove={handleGestureMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            onClick={(event) => event.stopPropagation()}
          >
            ↗
          </button>

          <button
            type="button"
            className="velori-story-sticker__handle velori-story-sticker__rotate"
            aria-label="Rotate sticker"
            onPointerDown={(event) => startGesture(event, "rotate")}
            onPointerMove={handleGestureMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            onClick={(event) => event.stopPropagation()}
          >
            ↻
          </button>

          {onRemove && (
            <button
              type="button"
              className="velori-story-sticker__handle velori-story-sticker__remove"
              aria-label="Remove sticker"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onRemove(sticker.id);
              }}
            >
              ×
            </button>
          )}
        </>
      )}
    </div>
  );
}
