import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Copy,
  Lock,
  Unlock,
} from "lucide-react";
import type { Layer } from "../models";

export function PostLayerControls({
  layer,
  onChange,
  onDuplicate,
  onOrder,
}: {
  layer: Layer;
  onChange: (change: Partial<Layer>) => void;
  onDuplicate: () => void;
  onOrder: (direction: -1 | 1) => void;
}) {
  return (
    <div className="post-precise-tools">
      <div className="post-icon-tools">
        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Duplicate selected layer"
          title="Duplicate layer"
        >
          <Copy size={15} />
        </button>
        <button
          type="button"
          onClick={() => onChange({ locked: !layer.locked })}
          aria-label={layer.locked ? "Unlock selected layer" : "Lock selected layer"}
          aria-pressed={Boolean(layer.locked)}
          title="Lock position"
        >
          {layer.locked ? <Lock size={15} /> : <Unlock size={15} />}
        </button>
        <button
          type="button"
          onClick={() => onOrder(1)}
          aria-label="Bring layer forward"
          title="Bring forward"
        >
          <ArrowUp size={15} />
        </button>
        <button
          type="button"
          onClick={() => onOrder(-1)}
          aria-label="Send layer backward"
          title="Send backward"
        >
          <ArrowDown size={15} />
        </button>
      </div>
      <label>
        Rotation <span>{layer.rotation ?? 0}°</span>
        <input
          aria-label="Layer rotation"
          type="range"
          min={-180}
          max={180}
          value={layer.rotation ?? 0}
          onChange={(event) => onChange({ rotation: Number(event.target.value) })}
        />
      </label>
      {layer.kind === "text" && (
        <>
          <label>
            Typeface
            <select
              aria-label="Text typeface"
              value={layer.fontFamily ?? "Manrope"}
              onChange={(event) => onChange({ fontFamily: event.target.value })}
            >
              <option>Manrope</option>
              <option>Arial</option>
              <option>Georgia</option>
            </select>
          </label>
          <div className="post-icon-tools" role="group" aria-label="Text alignment">
            {(
              [
                ["left", AlignLeft],
                ["center", AlignCenter],
                ["right", AlignRight],
              ] as const
            ).map(([align, Icon]) => (
              <button
                type="button"
                aria-label={"Align text " + align}
                aria-pressed={(layer.textAlign ?? "center") === align}
                key={align}
                onClick={() => onChange({ textAlign: align })}
              >
                <Icon size={16} />
              </button>
            ))}
            <button
              type="button"
              aria-label="Bold text"
              aria-pressed={(layer.fontWeight ?? 800) >= 700}
              onClick={() => onChange({ fontWeight: (layer.fontWeight ?? 800) >= 700 ? 400 : 800 })}
            >
              <strong>B</strong>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
