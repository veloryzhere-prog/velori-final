import { Grid2X2, Move, ScanLine, Shrink, ZoomIn, ZoomOut } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { PostEditorLayer, PostEditorSlide } from "../../../types/post-editor";
import {
  CANVAS_SIZE,
  GRID_SIZE,
  SAFE_ZONE,
  canvasPointFromClient,
  clampZoom,
  duplicateLayer,
  fitToScreen,
  reorderLayers,
  resizeLayer,
  snapValue,
} from "./canvas-engine";
import { LayersPanel, type LayersPanelProps } from "./LayersPanel";
import "./Canvas.css";

export type PostEditorCanvasProps = {
  slide: PostEditorSlide;
  canvasHeight?: number;
  fitRequest?: number;
  selectedLayerId?: string | null;
  showSafeZone?: boolean;
  showGrid?: boolean;
  snapToGrid?: boolean;
  zoom?: number;
  workspaceHeight?: number | string;
  workspaceStyle?: CSSProperties;
  showToolbar?: boolean;
  showLayersPanel?: boolean;
  selectFirstLayer?: boolean;
  onZoomChange?: (zoom: number) => void;
  onSelectionChange?: (layer: PostEditorLayer | null) => void;
  onLayersPanelChange?: (props: LayersPanelProps) => void;
  onLayersChange?: (layers: PostEditorLayer[]) => void;
};

type DragState =
  | {
      mode: "move" | "resize";
      layerId: string;
      handle?: string;
      startPointer: { x: number; y: number };
      startLayer: PostEditorLayer;
    }
  | {
      mode: "pan";
      startPointer: { x: number; y: number };
      startOffset: { x: number; y: number };
    };

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.matches("input, textarea, select, button") ||
      Boolean(target.closest("[contenteditable='true']")))
  );
}

function shapeStyle(layer: PostEditorLayer): CSSProperties {
  const shape = layer.shape;
  const type = shape?.shapeType ?? "rectangle";
  const isRound = type === "circle" || type === "ellipse";
  const isTriangle = type === "triangle";
  const isDiamond = type === "diamond";
  const isLine = type === "line";
  return {
    width: "100%",
    height: "100%",
    border:
      isTriangle || isDiamond
        ? 0
        : `${shape?.strokeWidth ?? 0}px solid ${shape?.stroke ?? "transparent"}`,
    borderRadius: isRound ? "50%" : type === "rounded-rectangle" ? (shape?.radius ?? 18) : 0,
    background: shape?.fill ?? "#dff3ff",
    clipPath: isTriangle
      ? "polygon(50% 0, 100% 100%, 0 100%)"
      : isDiamond
        ? "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)"
        : undefined,
    transform: isLine ? "scaleY(0.06)" : undefined,
    transformOrigin: "center",
  };
}

function LayerContent({ layer }: { layer: PostEditorLayer }): ReactNode {
  if (layer.type === "image") {
    const imageStyle: CSSProperties = {
      width: "100%",
      height: "100%",
      objectFit: layer.image?.fit ?? "cover",
      objectPosition: layer.image?.crop ?? "center",
      opacity: layer.image?.opacity ?? 1,
      filter: `brightness(${layer.image?.brightness ?? 100}%) contrast(${layer.image?.contrast ?? 100}%) saturate(${layer.image?.saturation ?? 100}%) blur(${layer.image?.blur ?? 0}px)`,
      transform: `rotate(${layer.image?.rotation ?? 0}deg)`,
    };
    return layer.image?.src ? (
      layer.image.mediaType === "video" ? (
        <video src={layer.image.src} muted playsInline preload="metadata" style={imageStyle} />
      ) : (
        <img src={layer.image.src} alt="" draggable={false} style={imageStyle} />
      )
    ) : (
      <span className="post-canvas-image-placeholder">Select an image to fill this frame</span>
    );
  }

  if (layer.type === "shape") return <span style={shapeStyle(layer)} aria-hidden="true" />;

  return (
    <span
      className="post-canvas-text"
      style={{
        color: layer.text?.color ?? "#202b3c",
        fontFamily: layer.text?.fontFamily ?? "Inter, sans-serif",
        fontSize: layer.text?.fontSize ?? 40,
        fontWeight: layer.text?.fontWeight ?? 600,
        letterSpacing: layer.text?.letterSpacing ?? 0,
        lineHeight: layer.text?.lineHeight ?? 1.2,
        textAlign: layer.text?.align ?? "left",
        WebkitTextStroke: layer.text?.stroke ?? undefined,
        textShadow: layer.text?.shadow ?? undefined,
      }}
    >
      {layer.text?.content ?? "Text"}
    </span>
  );
}

function CanvasLayer({
  layer,
  selected,
  editing,
  onEdit,
  onEditCommit,
}: {
  layer: PostEditorLayer;
  selected: boolean;
  editing: boolean;
  onEdit: (id: string, content: string) => void;
  onEditCommit: () => void;
}) {
  const layerStyle: CSSProperties = {
    left: layer.x,
    top: layer.y,
    width: Math.max(24, layer.width),
    height: Math.max(24, layer.height),
    zIndex: layer.order + 1,
    opacity: layer.opacity,
    transform: `rotate(${layer.rotation}deg)`,
    mixBlendMode: layer.blendMode as CSSProperties["mixBlendMode"],
  };

  return (
    <div
      className={`post-canvas-layer${selected ? " is-selected" : ""}${layer.locked ? " is-locked" : ""}`}
      data-canvas-layer={layer.id}
      data-layer-type={layer.type}
      role="button"
      tabIndex={0}
      aria-label={`${layer.name}${layer.locked ? ", locked" : ""}`}
      aria-pressed={selected}
      style={layerStyle}
    >
      {editing && layer.type === "text" ? (
        <textarea
          autoFocus
          aria-label={`Edit ${layer.name}`}
          value={layer.text?.content ?? ""}
          onChange={(event) => onEdit(layer.id, event.target.value)}
          onBlur={onEditCommit}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      ) : (
        <LayerContent layer={layer} />
      )}
      {selected && !layer.locked && !editing && (
        <>
          <span className="post-canvas-selection-outline" aria-hidden="true" />
          {(["nw", "ne", "sw", "se"] as const).map((handle) => (
            <button
              key={handle}
              type="button"
              className={`post-canvas-resize-handle is-${handle}`}
              data-resize-handle={handle}
              aria-label={`Resize ${layer.name} ${handle}`}
              tabIndex={-1}
            />
          ))}
        </>
      )}
    </div>
  );
}

export function PostEditorCanvas({
  slide,
  canvasHeight = CANVAS_SIZE.height,
  fitRequest = 0,
  selectedLayerId,
  showSafeZone = false,
  showGrid = false,
  snapToGrid = false,
  zoom: zoomProp,
  workspaceHeight = 720,
  workspaceStyle,
  showToolbar = true,
  showLayersPanel = true,
  selectFirstLayer = true,
  onZoomChange,
  onSelectionChange,
  onLayersPanelChange,
  onLayersChange,
}: PostEditorCanvasProps) {
  const width = CANVAS_SIZE.width;
  const height = Math.max(1, canvasHeight);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const layersRef = useRef(slide.layers);
  const sourceSlideRef = useRef({ id: slide.id, layers: slide.layers });
  const previousFitRequest = useRef(fitRequest);
  const previousSlideId = useRef(slide.id);
  const hasManualView = useRef(false);
  const pendingTextEdit = useRef(false);
  const [layers, setLayers] = useState(slide.layers);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectFirstLayer ? (slide.layers[0]?.id ?? null) : null,
  );
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [spacePanning, setSpacePanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(zoomProp ?? 0.3);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [gridVisible, setGridVisible] = useState(showGrid);
  const [safeZoneVisible, setSafeZoneVisible] = useState(showSafeZone);
  const selectedId = selectedLayerId === undefined ? internalSelectedId : selectedLayerId;

  const updateZoom = useCallback(
    (value: number) => {
      const next = clampZoom(value);
      hasManualView.current = true;
      setZoom(next);
      onZoomChange?.(next);
    },
    [onZoomChange],
  );

  const fitCanvas = useCallback(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const fit = fitToScreen(viewport.width, viewport.height, width, height);
    hasManualView.current = true;
    setZoom(fit.zoom);
    setOffset(fit.offset);
    onZoomChange?.(fit.zoom);
  }, [height, onZoomChange, viewport.height, viewport.width, width]);

  useEffect(() => {
    if (zoomProp !== undefined) setZoom(clampZoom(zoomProp));
  }, [zoomProp]);

  useEffect(() => {
    setGridVisible(showGrid);
  }, [showGrid]);

  useEffect(() => {
    setSafeZoneVisible(showSafeZone);
  }, [showSafeZone]);

  useEffect(() => {
    if (sourceSlideRef.current.id === slide.id && sourceSlideRef.current.layers === slide.layers) {
      return;
    }
    sourceSlideRef.current = { id: slide.id, layers: slide.layers };
    layersRef.current = slide.layers;
    setLayers(slide.layers);
    const nextSelected = slide.layers.some((layer) => layer.id === selectedId)
      ? selectedId
      : selectFirstLayer
        ? (slide.layers[0]?.id ?? null)
        : null;
    setInternalSelectedId(nextSelected);
    if (previousSlideId.current !== slide.id) {
      previousSlideId.current = slide.id;
      hasManualView.current = false;
    }
  }, [selectFirstLayer, selectedId, slide.id, slide.layers]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const updateSize = () => {
      const rect = workspace.getBoundingClientRect();
      setViewport((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasManualView.current && viewport.width > 0 && viewport.height > 0) fitCanvas();
  }, [fitCanvas, viewport.height, viewport.width]);

  useEffect(() => {
    if (previousFitRequest.current === fitRequest) return;
    previousFitRequest.current = fitRequest;
    fitCanvas();
  }, [fitCanvas, fitRequest]);

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedId) ?? null,
    [layers, selectedId],
  );

  useEffect(() => {
    onSelectionChange?.(selectedLayer);
  }, [onSelectionChange, selectedLayer]);

  const updateLayerState = useCallback(
    (updater: (current: PostEditorLayer[]) => PostEditorLayer[]) => {
      const next = updater(layersRef.current);
      layersRef.current = next;
      setLayers(next);
      return next;
    },
    [],
  );

  const selectLayer = useCallback(
    (id: string | null) => {
      setInternalSelectedId(id);
      onSelectionChange?.(id ? (layersRef.current.find((layer) => layer.id === id) ?? null) : null);
    },
    [onSelectionChange],
  );

  const pointerToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return canvasPointFromClient(clientX, clientY, rect.left, rect.top, offset, zoom);
    },
    [offset, zoom],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLElement)) return;
    const workspace = event.currentTarget;
    const layerElement = event.target.closest<HTMLElement>("[data-canvas-layer]");
    const layerId = layerElement?.dataset.canvasLayer ?? null;
    const layer = layerId ? layersRef.current.find((item) => item.id === layerId) : null;
    const handle = event.target.closest<HTMLElement>("[data-resize-handle]")?.dataset.resizeHandle;

    if (!layer || event.button === 1 || spacePanning || event.altKey) {
      if (layer) selectLayer(layer.id);
      else if (!spacePanning && event.button !== 1 && !event.altKey) selectLayer(null);
      if (event.button === 1 || spacePanning || event.altKey) {
        event.preventDefault();
        workspace.setPointerCapture(event.pointerId);
        dragRef.current = {
          mode: "pan",
          startPointer: { x: event.clientX, y: event.clientY },
          startOffset: offset,
        };
        setIsDragging(true);
      }
      return;
    }

    selectLayer(layer.id);
    if (layer.locked || (isEditableTarget(event.target) && !handle) || !event.isPrimary) {
      return;
    }
    event.preventDefault();
    workspace.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: handle ? "resize" : "move",
      layerId: layer.id,
      ...(handle ? { handle } : {}),
      startPointer: pointerToWorld(event.clientX, event.clientY),
      startLayer: layer,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.mode === "pan") {
      setOffset({
        x: drag.startOffset.x + event.clientX - drag.startPointer.x,
        y: drag.startOffset.y + event.clientY - drag.startPointer.y,
      });
      return;
    }

    const currentPoint = pointerToWorld(event.clientX, event.clientY);
    const deltaX = currentPoint.x - drag.startPointer.x;
    const deltaY = currentPoint.y - drag.startPointer.y;
    updateLayerState((current) =>
      current.map((layer) => {
        if (layer.id !== drag.layerId) return layer;
        if (drag.mode === "resize") {
          const resized = resizeLayer(drag.startLayer, drag.handle ?? "se", deltaX, deltaY);
          return {
            ...layer,
            x: snapToGrid ? snapValue(resized.x, GRID_SIZE) : resized.x,
            y: snapToGrid ? snapValue(resized.y, GRID_SIZE) : resized.y,
            width: snapToGrid ? Math.max(24, snapValue(resized.width, GRID_SIZE)) : resized.width,
            height: snapToGrid
              ? Math.max(24, snapValue(resized.height, GRID_SIZE))
              : resized.height,
          };
        }
        const x = drag.startLayer.x + deltaX;
        const y = drag.startLayer.y + deltaY;
        return {
          ...layer,
          x: snapToGrid ? snapValue(x, GRID_SIZE) : x,
          y: snapToGrid ? snapValue(y, GRID_SIZE) : y,
        };
      }),
    );
  };

  const finishPointerGesture = () => {
    const completed = dragRef.current;
    if (!completed) return;
    dragRef.current = null;
    setIsDragging(false);
    if (completed.mode === "move" || completed.mode === "resize") {
      onLayersChange?.(layersRef.current);
    }
  };

  const updateText = (id: string, content: string) => {
    pendingTextEdit.current = true;
    updateLayerState((current) =>
      current.map((layer) =>
        layer.id === id
          ? { ...layer, text: { ...layer.text, id: layer.text?.id ?? `${id}-text`, content } }
          : layer,
      ),
    );
  };

  const finishTextEdit = () => {
    setEditingLayerId(null);
    if (!pendingTextEdit.current) return;
    pendingTextEdit.current = false;
    onLayersChange?.(layersRef.current);
  };

  const changeLayerPosition = (dx: number, dy: number) => {
    if (!selectedLayer || selectedLayer.locked) return;
    const step = snapToGrid ? GRID_SIZE : 1;
    const next = updateLayerState((current) =>
      current.map((layer) =>
        layer.id === selectedLayer.id
          ? { ...layer, x: layer.x + dx * step, y: layer.y + dy * step }
          : layer,
      ),
    );
    onLayersChange?.(next);
  };

  const handleWorkspaceKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditableTarget(event.target)) return;
    if (event.code === "Space") {
      event.preventDefault();
      setSpacePanning(true);
      return;
    }
    if (event.key === "Escape") {
      setEditingLayerId(null);
      selectLayer(null);
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
      const next = updateLayerState((current) =>
        current.filter((layer) => layer.id !== selectedId),
      );
      selectLayer(null);
      onLayersChange?.(next);
      return;
    }
    if (selectedId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      changeLayerPosition(
        event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
        event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
      );
      return;
    }
    if (event.key === "Enter" && selectedLayer?.type === "text" && !selectedLayer.locked) {
      setEditingLayerId(selectedLayer.id);
    }
  };

  const handleDuplicate = useCallback(
    (id: string) => {
      const source = layersRef.current.find((layer) => layer.id === id);
      if (!source) return;
      const duplicated = duplicateLayer(source);
      const next = updateLayerState((current) => {
        const index = current.findIndex((layer) => layer.id === id);
        const updated = [...current];
        updated.splice(index + 1, 0, duplicated);
        return updated.map((layer, order) => ({ ...layer, order }));
      });
      selectLayer(duplicated.id);
      onLayersChange?.(next);
    },
    [onLayersChange, selectLayer, updateLayerState],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const next = updateLayerState((current) => current.filter((layer) => layer.id !== id));
      if (selectedId === id) selectLayer(null);
      onLayersChange?.(next);
    },
    [onLayersChange, selectLayer, selectedId, updateLayerState],
  );

  const handleLockToggle = useCallback(
    (id: string) => {
      const next = updateLayerState((current) =>
        current.map((layer) => (layer.id === id ? { ...layer, locked: !layer.locked } : layer)),
      );
      onLayersChange?.(next);
    },
    [onLayersChange, updateLayerState],
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const next = updateLayerState((current) => reorderLayers(current, fromIndex, toIndex));
      onLayersChange?.(next);
    },
    [onLayersChange, updateLayerState],
  );

  const layerPanelProps = useMemo<LayersPanelProps>(
    () => ({
      layers,
      selectedId,
      onSelect: selectLayer,
      onReorder: handleReorder,
      onLockToggle: handleLockToggle,
      onDelete: handleDelete,
      onDuplicate: handleDuplicate,
    }),
    [
      handleDelete,
      handleDuplicate,
      handleLockToggle,
      handleReorder,
      layers,
      selectLayer,
      selectedId,
    ],
  );

  useEffect(() => {
    onLayersPanelChange?.(layerPanelProps);
  }, [layerPanelProps, onLayersPanelChange]);

  const orderedLayers = useMemo(
    () => [...layers].filter((layer) => layer.visible).sort((a, b) => a.order - b.order),
    [layers],
  );

  return (
    <div
      className="post-canvas-shell"
      style={{ height: workspaceHeight, ...workspaceStyle }}
      onKeyDown={handleWorkspaceKeyDown}
      onKeyUp={(event) => {
        if (event.code === "Space") setSpacePanning(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setSpacePanning(false);
        }
      }}
    >
      {showToolbar && (
        <div className="post-canvas-toolbar" role="toolbar" aria-label="Canvas controls">
          <span className="post-canvas-toolbar-title">Canvas</span>
          <button type="button" onClick={() => updateZoom(zoom / 1.2)} aria-label="Zoom out">
            <ZoomOut size={15} />
          </button>
          <span className="post-canvas-zoom-value" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={() => updateZoom(zoom * 1.2)} aria-label="Zoom in">
            <ZoomIn size={15} />
          </button>
          <button type="button" onClick={fitCanvas} aria-label="Fit canvas to workspace">
            <Shrink size={15} />
            <span>Fit</span>
          </button>
          <button
            type="button"
            className={gridVisible ? "is-active" : ""}
            aria-label="Toggle canvas grid"
            aria-pressed={gridVisible}
            onClick={() => setGridVisible((visible) => !visible)}
          >
            <Grid2X2 size={15} />
          </button>
          <button
            type="button"
            className={safeZoneVisible ? "is-active" : ""}
            aria-label="Toggle safe zone"
            aria-pressed={safeZoneVisible}
            onClick={() => setSafeZoneVisible((visible) => !visible)}
          >
            <ScanLine size={15} />
          </button>
          {spacePanning && (
            <span className="post-canvas-pan-hint">
              <Move size={13} /> Pan
            </span>
          )}
        </div>
      )}
      <div
        ref={workspaceRef}
        className={`post-canvas-workspace${isDragging ? " is-dragging" : ""}`}
        role="application"
        aria-label="Post canvas. Drag layers to move, use arrow keys for precise movement, and double-click text to edit."
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerGesture}
        onPointerCancel={finishPointerGesture}
        onLostPointerCapture={finishPointerGesture}
        onDoubleClick={(event) => {
          if (!(event.target instanceof HTMLElement)) return;
          const layerElement = event.target.closest<HTMLElement>("[data-canvas-layer]");
          const layerId = layerElement?.dataset.canvasLayer;
          const layer = layerId ? layersRef.current.find((item) => item.id === layerId) : null;
          if (layer?.type === "text" && !layer.locked) {
            selectLayer(layer.id);
            setEditingLayerId(layer.id);
          }
        }}
        onWheel={(event) => {
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          updateZoom(zoom * (event.deltaY < 0 ? 1.08 : 0.92));
        }}
      >
        <div
          className={`post-canvas-artboard${gridVisible ? " has-grid" : ""}`}
          style={{
            width,
            height,
            left: offset.x,
            top: offset.y,
            transform: `scale(${zoom})`,
            backgroundColor: slide.background || "var(--ps-paper, #fff)",
          }}
        >
          {safeZoneVisible && (
            <span
              className="post-canvas-safe-zone"
              aria-hidden="true"
              style={{
                left: SAFE_ZONE.left,
                top: SAFE_ZONE.top,
                width: width - SAFE_ZONE.left - SAFE_ZONE.right,
                height: height - SAFE_ZONE.top - SAFE_ZONE.bottom,
              }}
            />
          )}
          {orderedLayers.map((layer) => (
            <CanvasLayer
              key={layer.id}
              layer={layer}
              selected={selectedId === layer.id}
              editing={editingLayerId === layer.id}
              onEdit={updateText}
              onEditCommit={finishTextEdit}
            />
          ))}
          {orderedLayers.length === 0 && (
            <div className="post-canvas-empty">
              <span>Add a photo, text, or a shape to start designing.</span>
            </div>
          )}
        </div>
      </div>
      {showLayersPanel && (
        <LayersPanel
          layers={layers}
          selectedId={selectedId}
          onSelect={selectLayer}
          onReorder={handleReorder}
          onLockToggle={handleLockToggle}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      )}
    </div>
  );
}

export const __testHarness = {
  CANVAS_SIZE,
  fitToScreen,
};
