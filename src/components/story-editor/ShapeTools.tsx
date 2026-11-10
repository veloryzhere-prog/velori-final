import { Circle, RectangleHorizontal, Trash2 } from "lucide-react";
import type { StoryShape } from "../../lib/story-editor/types";

interface ShapeToolsProps {
  shapes: StoryShape[];
  selectedId: string | null;
  onAdd: (shape: StoryShape["shape"]) => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<StoryShape>) => void;
  onDelete: (id: string) => void;
}

export function ShapeTools({
  shapes,
  selectedId,
  onAdd,
  onSelect,
  onUpdate,
  onDelete,
}: ShapeToolsProps) {
  const selected = shapes.find((shape) => shape.id === selectedId) ?? null;

  return (
    <section aria-label="Shape tools" className="story-editor-shape-tools">
      <header className="story-editor-section-heading">
        <div>
          <span className="story-editor-eyebrow">CANVAS OBJECTS</span>
          <h2>Shapes</h2>
        </div>
      </header>
      <div aria-label="Add a shape" className="story-editor-shape-actions">
        <button onClick={() => onAdd("rectangle")} type="button">
          <RectangleHorizontal size={17} />
          Rectangle
        </button>
        <button onClick={() => onAdd("ellipse")} type="button">
          <Circle size={17} />
          Ellipse
        </button>
      </div>
      {selected ? (
        <div className="story-editor-shape-properties">
          <label>
            <span>Fill</span>
            <input
              aria-label="Shape fill"
              onChange={(event) => onUpdate(selected.id, { fill: event.target.value })}
              type="color"
              value={selected.fill}
            />
          </label>
          <label>
            <span>Stroke</span>
            <input
              aria-label="Shape stroke"
              onChange={(event) => onUpdate(selected.id, { stroke: event.target.value })}
              type="color"
              value={selected.stroke}
            />
          </label>
          <label>
            <span>Stroke width</span>
            <input
              aria-label="Shape stroke width"
              max={12}
              min={0}
              onChange={(event) =>
                onUpdate(selected.id, { strokeWidth: Number(event.target.value) })
              }
              type="range"
              value={selected.strokeWidth}
            />
          </label>
          <button
            aria-label="Delete selected shape"
            className="story-editor-icon-button"
            onClick={() => onDelete(selected.id)}
            type="button"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      ) : (
        <p className="story-editor-tool-hint">Choose a shape to add it to your story.</p>
      )}
      {shapes.length ? (
        <div aria-label="Shape objects" className="story-editor-shape-list">
          {shapes.map((shape, index) => (
            <button
              aria-pressed={shape.id === selectedId}
              key={shape.id}
              onClick={() => onSelect(shape.id)}
              type="button"
            >
              {shape.shape} {index + 1}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
