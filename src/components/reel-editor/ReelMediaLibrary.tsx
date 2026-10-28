import { useRef, useState } from "react";
import { createVideoPoster } from "../../lib/reel-editor/assets.ts";
import type { ReelAsset } from "../../lib/reel-editor/types.ts";

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
};

export interface ReelMediaLibraryProps {
  assets: ReelAsset[];
  busy: boolean;
  error: string;
  onImport: (files: File[]) => void;
  onAddToTimeline: (assetId: string) => void;
  onAddToAudio: (assetId: string) => void;
  onRemove: (assetId: string) => void;
}

function AssetThumb({ asset, poster }: { asset: ReelAsset; poster: string | null }) {
  if (asset.kind === "image" && asset.url) {
    return <img className="reel-asset-thumb" src={asset.url} alt="" loading="lazy" />;
  }
  if (asset.kind === "video" && poster) {
    return <img className="reel-asset-thumb" src={poster} alt="" loading="lazy" />;
  }
  return (
    <span className="reel-asset-thumb reel-asset-thumb-empty" aria-hidden="true">
      {asset.kind === "video" ? "▶" : asset.kind === "audio" ? "♪" : "▢"}
    </span>
  );
}

export default function ReelMediaLibrary({
  assets,
  busy,
  error,
  onImport,
  onAddToTimeline,
  onAddToAudio,
  onRemove,
}: ReelMediaLibraryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [posters, setPosters] = useState<Record<string, string | null>>({});

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    onImport([...files]);
  };

  const ensurePoster = (asset: ReelAsset) => {
    if (asset.kind !== "video" || posters[asset.id] !== undefined) return;
    setPosters((current) => ({ ...current, [asset.id]: null }));
    void createVideoPoster(asset.url).then((poster) => {
      setPosters((current) => ({ ...current, [asset.id]: poster }));
    });
  };

  return (
    <div className="reel-media-library">
      <div
        className={`reel-dropzone${dragging ? " is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <button
          type="button"
          className="reel-button reel-button-primary"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Importing…" : "Import media"}
        </button>
        <p className="reel-dropzone-hint">Drop video, images, or music here</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,image/*,audio/*"
          className="reel-visually-hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {error ? (
        <p className="reel-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {assets.length ? (
        <ul className="reel-asset-list">
          {assets.map((asset) => {
            ensurePoster(asset);
            return (
              <li key={asset.id} className="reel-asset-row">
                <AssetThumb asset={asset} poster={posters[asset.id] ?? null} />
                <span className="reel-asset-meta">
                  <span className="reel-asset-name" title={asset.name}>
                    {asset.name}
                  </span>
                  <span className="reel-asset-detail">
                    {asset.kind} · {formatDuration(asset.durationSeconds)}
                    {asset.width ? ` · ${asset.width}×${asset.height}` : ""} ·{" "}
                    {(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </span>
                <span className="reel-asset-actions">
                  {asset.kind === "audio" ? (
                    <button
                      type="button"
                      className="reel-icon-button"
                      onClick={() => onAddToAudio(asset.id)}
                      aria-label={`Add ${asset.name} to the audio track`}
                    >
                      +
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="reel-icon-button"
                      onClick={() => onAddToTimeline(asset.id)}
                      aria-label={`Add ${asset.name} to the timeline`}
                    >
                      +
                    </button>
                  )}
                  <button
                    type="button"
                    className="reel-icon-button reel-icon-button-danger"
                    onClick={() => onRemove(asset.id)}
                    aria-label={`Remove ${asset.name}`}
                  >
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="reel-empty-note">Import a video to start editing.</p>
      )}
    </div>
  );
}
