import { ImagePlus, Search, Upload, X } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import "@/styles/tokens.css";
import "./MediaTab.css";

export type MediaAssetKind = "photo" | "video";
export type MediaFilter = "all" | MediaAssetKind;

export interface MediaAsset {
  id: string;
  name: string;
  kind: MediaAssetKind;
  thumbnailUrl?: string;
}

export interface MediaTabProps {
  assets?: MediaAsset[];
  onAssetSelect: (assetId: string) => void;
  onUpload?: (files: File[]) => void;
}

const filters: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "photo", label: "Photos" },
  { id: "video", label: "Videos" },
];

export default function MediaTab({ assets = [], onAssetSelect, onUpload }: MediaTabProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MediaFilter>("all");
  const fileInput = useRef<HTMLInputElement>(null);

  const visibleAssets = useMemo(() => {
    const searchTerm = query.trim().toLocaleLowerCase();
    return assets.filter(
      (asset) =>
        (filter === "all" || asset.kind === filter) &&
        (!searchTerm || asset.name.toLocaleLowerCase().includes(searchTerm)),
    );
  }, [assets, filter, query]);

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length) onUpload?.(files);
    event.currentTarget.value = "";
  };

  return (
    <section className="studio-media-tab" aria-label="Media library">
      <div className="studio-media-heading">
        <h2>Media</h2>
        <button
          className="studio-media-upload"
          type="button"
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={14} aria-hidden="true" />
          Upload
        </button>
        <input
          ref={fileInput}
          className="studio-media-file-input"
          type="file"
          multiple
          aria-label="Upload media files"
          accept="image/*,video/*"
          onChange={handleUpload}
        />
      </div>

      <label className="studio-media-search-wrap">
        <Search className="studio-media-search-icon" size={16} aria-hidden="true" />
        <input
          className="studio-media-search"
          type="search"
          value={query}
          placeholder="Search assets..."
          aria-label="Search assets"
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button
            className="studio-media-clear"
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
          >
            <X size={14} />
          </button>
        )}
      </label>

      <div className="studio-media-filters" aria-label="Filter media by type">
        {filters.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="studio-media-filter"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="studio-media-grid">
        {visibleAssets.length ? (
          visibleAssets.map((asset) => (
            <button
              key={asset.id}
              className="studio-media-asset"
              type="button"
              title={asset.name}
              aria-label={`Select ${asset.name}`}
              onClick={() => onAssetSelect(asset.id)}
            >
              {asset.thumbnailUrl ? (
                <img src={asset.thumbnailUrl} alt="" />
              ) : (
                <span>
                  <ImagePlus size={20} aria-hidden="true" />
                  <br />
                  {asset.name}
                </span>
              )}
            </button>
          ))
        ) : (
          <p className="studio-media-empty">No matching assets</p>
        )}
      </div>
    </section>
  );
}
