import type { PostEditorLayer } from "../../../types/post-editor";

export type LayersPanelProps = {
  layers: PostEditorLayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onLockToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
};

export function LayersPanel({
  layers,
  selectedId,
  onSelect,
  onReorder,
  onLockToggle,
  onDelete,
  onDuplicate,
}: LayersPanelProps) {
  return (
    <div
      style={{
        width: 270,
        borderLeft: "1px solid rgba(15,23,42,0.1)",
        padding: 12,
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(18px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <strong>Layers</strong>
        <span style={{ color: "#64748b", fontSize: 12 }}>{layers.length}</span>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {[...layers]
          .sort((a, b) => a.order - b.order)
          .map((layer, index) => (
            <div
              key={layer.id}
              onClick={() => onSelect(layer.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                borderRadius: 10,
                padding: "10px 8px",
                background:
                  selectedId === layer.id ? "rgba(147, 197, 253, 0.25)" : "rgba(148,163,184,0.06)",
                border:
                  selectedId === layer.id
                    ? "1px solid rgba(59,130,246,0.5)"
                    : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <span style={{ fontSize: 12, color: "#475569" }}>{index + 1}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {layer.name}
                </span>
              </div>

              <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                <button
                  type="button"
                  aria-label={`Move ${layer.name} up`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onReorder(index, Math.max(0, index - 1));
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${layer.name} down`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onReorder(index, Math.min(layers.length - 1, index + 1));
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onLockToggle(layer.id);
                  }}
                >
                  {layer.locked ? "🔒" : "🔓"}
                </button>
                <button
                  type="button"
                  aria-label={`Duplicate ${layer.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDuplicate(layer.id);
                  }}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${layer.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(layer.id);
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
