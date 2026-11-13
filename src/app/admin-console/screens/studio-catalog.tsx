import { useEffect, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { readAudioFileMetadata } from "../../../lib/audio-metadata";
import {
  adminCreateMusic,
  adminImportMusicMetadata,
  adminCreateSticker,
  adminCreateStickerCategory,
  adminDeleteStudioCatalog,
  adminPatchStudioCatalog,
  adminPatchStickerCategory,
  adminReplaceStudioCatalogAsset,
  adminStudioCatalog,
  type StudioTarget,
} from "../../../lib/admin-api";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen, useScreenReauth } from "../frame";
import { usePermission } from "../session";
import { Card, Notice, useGuardedAction, useResource } from "../widgets";

const TARGETS: Array<{ id: StudioTarget; label: string }> = [
  { id: "story", label: "Story" },
  { id: "reel", label: "Reel" },
  { id: "post", label: "Post" },
];

function FormText({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function TargetFields({
  value,
  onChange,
  disabled = false,
}: {
  value: StudioTarget[];
  onChange: (next: StudioTarget[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="admin-field">
      <legend>Available in</legend>
      <div className="admin-row-actions">
        {TARGETS.map((target) => (
          <label key={target.id}>
            <input
              type="checkbox"
              checked={value.includes(target.id)}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, target.id]
                    : value.filter((item) => item !== target.id),
                )
              }
            />{" "}
            {target.label} Studio
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type MusicMetadataForm = {
  title: string;
  artistName: string;
  searchAliases: string;
  genre: string;
  mood: string;
  language: string;
  tags: string;
  licenseReference: string;
  description: string;
  excerptStartSeconds: string;
  excerptEndSeconds: string;
};

const EMPTY_MUSIC_METADATA: MusicMetadataForm = {
  title: "",
  artistName: "",
  searchAliases: "",
  genre: "",
  mood: "",
  language: "",
  tags: "",
  licenseReference: "",
  description: "",
  excerptStartSeconds: "0",
  excerptEndSeconds: "",
};

function MusicCreate({ onCreated, canPublish }: { onCreated: () => void; canPublish: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [metadataNotice, setMetadataNotice] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [importedSourceUrl, setImportedSourceUrl] = useState("");
  const [importingLink, setImportingLink] = useState(false);
  const [linkArtworkUrl, setLinkArtworkUrl] = useState<string | null>(null);
  const [linkProvider, setLinkProvider] = useState("");
  const [status, setStatus] = useState("draft");
  const [targets, setTargets] = useState<StudioTarget[]>(["story", "reel", "post"]);
  const [duration, setDuration] = useState("");
  const [preview, setPreview] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<MusicMetadataForm>(EMPTY_MUSIC_METADATA);
  const [progress, setProgress] = useState<number | null>(null);
  const previewUrl = useRef<string | null>(null);
  const durationProbe = useRef<HTMLAudioElement | null>(null);
  const metadataRequest = useRef(0);

  useEffect(
    () => () => {
      metadataRequest.current += 1;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      durationProbe.current?.pause();
      durationProbe.current?.removeAttribute("src");
      durationProbe.current?.load();
    },
    [],
  );

  function updateMetadata<K extends keyof MusicMetadataForm>(key: K, value: MusicMetadataForm[K]) {
    setMetadata((current) => ({ ...current, [key]: value }));
  }

  async function importLinkMetadata() {
    const link = sourceUrl.trim();
    if (!link) {
      setError("Paste a YouTube Music, Spotify, SoundCloud, or Apple Music track link first.");
      return;
    }
    setImportingLink(true);
    setError("");
    setMetadataNotice("");
    try {
      const imported = await adminImportMusicMetadata(link);
      setImportedSourceUrl(link);
      setLinkProvider(imported.provider);
      setLinkArtworkUrl(imported.artworkUrl);
      setMetadata((current) => {
        const referenceDuration = imported.durationSeconds && imported.durationSeconds > 0
          ? `Provider reference duration: ${Math.floor(imported.durationSeconds / 60)}:${String(imported.durationSeconds % 60).padStart(2, "0")}`
          : "";
        const existingDescription = current.description
          .replace(/(?:^|\s·\s)Album: [^·]*/gi, " ")
          .replace(/(?:^|\s·\s)Provider reference duration: [^·]*/gi, " ")
          .replace(/\s·\s·\s/g, " · ")
          .trim();
        return {
          ...current,
          // Replace link-derived values on every new import. This prevents the
          // previous track's artist/genre from silently carrying into the next.
          title: imported.title || "",
          artistName: imported.artistName || "",
          genre: imported.genre || "",
          description: [
            imported.album ? `Album: ${imported.album}` : "",
            referenceDuration,
            existingDescription,
          ].filter(Boolean).join(" · ").slice(0, 2000),
        };
      });
      setMetadataNotice(`${imported.provider}: track information imported. ${imported.note} All fields remain editable.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Music metadata could not be imported.");
    } finally {
      setImportingLink(false);
    }
  }

  async function useLinkArtwork() {
    if (!linkArtworkUrl) return;
    setError("");
    try {
      const response = await fetch(linkArtworkUrl, { mode: "cors", credentials: "omit" });
      if (!response.ok) throw new Error("The provider's artwork could not be downloaded. Upload a cover image manually instead.");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || blob.size < 1 || blob.size > 8 * 1024 * 1024) {
        throw new Error("The imported artwork is not a supported image or exceeds 8 MB.");
      }
      const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : blob.type.includes("gif") ? "gif" : "jpg";
      setCoverFile(new File([blob], `imported-${linkProvider.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-cover.${extension}`, { type: blob.type }));
      setMetadataNotice("Provider artwork selected. You can replace it with your own cover image before saving.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Artwork could not be imported.");
    }
  }

  async function handleAudioSelection(file: File | null) {
    const requestId = ++metadataRequest.current;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    durationProbe.current?.pause();
    durationProbe.current?.removeAttribute("src");
    durationProbe.current?.load();
    durationProbe.current = null;
    setPreview("");
    setDuration("");
    if (!linkProvider) setCoverFile(null);
    setMetadataNotice("");
    if (!linkProvider) {
      setMetadata((current) => ({
        ...EMPTY_MUSIC_METADATA,
        // Keep an admin-entered licence reference when swapping the audio file.
        licenseReference: current.licenseReference,
      }));
    }
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    previewUrl.current = objectUrl;
    setPreview(objectUrl);
    const probe = new Audio();
    probe.preload = "metadata";
    durationProbe.current = probe;
    probe.onloadedmetadata = () => {
      if (requestId !== metadataRequest.current) return;
      if (Number.isFinite(probe.duration) && probe.duration > 0)
        setDuration(String(Math.round(probe.duration)));
    };
    probe.onerror = () => {
      if (requestId === metadataRequest.current)
        setMetadataNotice("Track duration could not be read. You can still enter the details manually.");
    };
    probe.src = objectUrl;

    try {
      const embedded = await readAudioFileMetadata(file);
      if (requestId !== metadataRequest.current) return;
      const detailTags = [
        embedded.album ? `Album: ${embedded.album}` : "",
        embedded.year ? `Year: ${embedded.year}` : "",
        embedded.bpm ? `BPM: ${embedded.bpm}` : "",
        embedded.trackNumber ? `Track: ${embedded.trackNumber}` : "",
        embedded.composer ? `Composer: ${embedded.composer}` : "",
      ].filter(Boolean);
      const importedDescription = [embedded.comment, ...detailTags].filter(Boolean).join(" · ");
      setMetadata((current) => ({
        ...current,
        title: embedded.title || current.title || file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
        artistName: embedded.artist || current.artistName,
        genre: embedded.genre || current.genre,
        mood: embedded.mood || current.mood,
        language: embedded.language || current.language,
        tags: detailTags.length ? [...new Set([...current.tags.split(",").map((tag) => tag.trim()).filter(Boolean), ...detailTags])].join(", ") : current.tags,
        description: [current.description, importedDescription].filter(Boolean).join(" · ").slice(0, 2000),
      }));
      if (embedded.cover) {
        const importedCover = new File([embedded.cover.blob], `embedded-cover.${embedded.cover.extension}`, {
          type: embedded.cover.mimeType,
        });
        setCoverFile(importedCover);
      }
      const found = [
        embedded.title && "title",
        embedded.artist && "artist",
        embedded.genre && "genre",
        embedded.mood && "mood",
        embedded.language && "language",
        embedded.album && "album",
        embedded.cover && "cover artwork",
      ].filter(Boolean);
      setMetadataNotice(
        found.length
          ? `Imported ${found.join(", ")}. All fields are editable before saving.`
          : "No embedded track tags were found. The filename was used as a title suggestion; fill in the remaining details manually.",
      );
    } catch {
      if (requestId === metadataRequest.current)
        setMetadataNotice("Track tags could not be read. You can enter all details manually.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("status", status);
    form.set("availableIn", targets.join(","));
    form.set("durationSeconds", duration);
    const sourceLink = String(form.get("sourceUrl") ?? "").trim();
    if (sourceLink && importedSourceUrl !== sourceLink) {
      setError("Import details from this exact link before saving, or clear the link and enter the details manually.");
      setBusy(false);
      return;
    }
    if (sourceLink) {
      const description = String(form.get("description") ?? "").trim();
      const sourceNote = `Source link (${linkProvider || "music provider"}): ${sourceLink}`;
      form.set("description", [description, sourceNote].filter(Boolean).join(" · ").slice(0, 2000));
    }
    if (coverFile) form.set("coverFile", coverFile, coverFile.name);
    try {
      await adminCreateMusic(form, setProgress);
      formElement.reset();
      metadataRequest.current += 1;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = null;
      durationProbe.current?.pause();
      durationProbe.current?.removeAttribute("src");
      durationProbe.current?.load();
      durationProbe.current = null;
      setPreview("");
      setDuration("");
      setCoverFile(null);
      setMetadata(EMPTY_MUSIC_METADATA);
      setMetadataNotice("");
      setSourceUrl("");
      setImportedSourceUrl("");
      setLinkArtworkUrl(null);
      setLinkProvider("");
      setProgress(null);
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Track upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Add music"
      subtitle="Upload an authorized audio file. Embedded tags can prefill the form; every imported value remains editable. Publication requires licensing information and at least one studio target."
    >
      <form className="admin-form-grid" onSubmit={(event) => void submit(event)}>
        <div className="admin-field admin-music-link-import">
          <span>Import track details from a music link</span>
          <div className="admin-row-actions">
            <input
              type="url"
              name="sourceUrl"
              value={sourceUrl}
              onChange={(event) => {
                setSourceUrl(event.target.value);
                setImportedSourceUrl("");
                setLinkArtworkUrl(null);
                setLinkProvider("");
              }}
              placeholder="Paste YouTube Music, Spotify, SoundCloud or Apple Music link"
              aria-label="Music source link"
            />
            <Button type="button" className="admin-secondary" disabled={importingLink || !sourceUrl.trim()} onClick={() => void importLinkMetadata()}>
              {importingLink ? "Importing…" : "Import details"}
            </Button>
          </div>
          {linkProvider ? <small>Imported from {linkProvider}. This link supplies metadata only; upload an audio file you are authorised to use.</small> : <small>Track title, artist/channel, artwork link, album and duration may be available depending on the provider.</small>}
        </div>
        {linkArtworkUrl ? (
          <div className="admin-field admin-music-link-artwork">
            <span>Artwork from provider</span>
            <div className="admin-row-actions">
              <img src={linkArtworkUrl} alt="Imported track artwork preview" loading="lazy" />
              <Button type="button" className="admin-secondary" onClick={() => void useLinkArtwork()}>Use artwork</Button>
            </div>
          </div>
        ) : null}
        <FormText label="Track title" name="title" value={metadata.title} onChange={(event) => updateMetadata("title", event.target.value)} required />
        <FormText label="Artist name" name="artistName" value={metadata.artistName} onChange={(event) => updateMetadata("artistName", event.target.value)} required />
        <FormText label="Search aliases" name="searchAliases" value={metadata.searchAliases} onChange={(event) => updateMetadata("searchAliases", event.target.value)} placeholder="Comma separated" />
        <FormText label="Genre" name="genre" value={metadata.genre} onChange={(event) => updateMetadata("genre", event.target.value)} />
        <FormText label="Mood" name="mood" value={metadata.mood} onChange={(event) => updateMetadata("mood", event.target.value)} />
        <FormText label="Language" name="language" value={metadata.language} onChange={(event) => updateMetadata("language", event.target.value)} />
        <FormText label="Tags and imported track details" name="tags" value={metadata.tags} onChange={(event) => updateMetadata("tags", event.target.value)} placeholder="Comma separated" />
        <FormText label="License reference / permitted uses" name="licenseReference" value={metadata.licenseReference} onChange={(event) => updateMetadata("licenseReference", event.target.value)} required={status === "published"} />
        <FormText label="Description / album details" name="description" value={metadata.description} onChange={(event) => updateMetadata("description", event.target.value)} />
        <FormText label="Excerpt start (seconds)" name="excerptStartSeconds" type="number" min={0} value={metadata.excerptStartSeconds} onChange={(event) => updateMetadata("excerptStartSeconds", event.target.value)} />
        <FormText label="Excerpt end (optional seconds)" name="excerptEndSeconds" type="number" min={0} value={metadata.excerptEndSeconds} onChange={(event) => updateMetadata("excerptEndSeconds", event.target.value)} />
        <label className="admin-field">
          <span>Audio file (MP3, WAV, OGG, WebM, or M4A; up to 25 MB)</span>
          <input
            name="audioFile"
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4"
            required
            onChange={(event) => void handleAudioSelection(event.currentTarget.files?.[0] ?? null)}
          />
        </label>
        <label className="admin-field">
          <span>Cover image (optional)</span>
          <input
            name="coverFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => setCoverFile(event.currentTarget.files?.[0] ?? null)}
          />
          {coverFile ? <small>{coverFile.name} {coverFile.name.startsWith("embedded-cover.") ? "(embedded artwork imported)" : ""}</small> : null}
        </label>
        {metadataNotice ? <Notice tone="info">{metadataNotice}</Notice> : null}
        {preview ? <audio controls src={preview} aria-label="Preview uploaded track" /> : null}
        {progress !== null ? (
          <label className="admin-field">
            <span>Upload progress: {progress}%</span>
            <progress max={100} value={progress} />
          </label>
        ) : null}
        <input type="hidden" name="durationSeconds" value={duration} />
        <TargetFields value={targets} onChange={setTargets} />
        <label className="admin-field">
          <span>Save status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="draft">Draft</option>
            <option value="published" disabled={!canPublish}>Publish</option>
          </select>
        </label>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button className="admin-primary" disabled={busy}>
          {busy ? "Uploading and saving…" : "Save music"}
        </Button>
      </form>
    </Card>
  );
}

function StickerCreate({
  categories,
  onCreated,
  canPublish,
}: {
  categories: Array<{ id: string; name: string }>;
  onCreated: () => void;
  canPublish: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("draft");
  const [targets, setTargets] = useState<StudioTarget[]>(["story", "reel", "post"]);
  const [progress, setProgress] = useState<number | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("status", status);
    form.set("availableIn", targets.join(","));
    try {
      await adminCreateSticker(form, setProgress);
      formElement.reset();
      setProgress(null);
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sticker upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card
      title="Add sticker"
      subtitle="PNG, WebP, JPEG, or GIF assets are checked by content signature. SVG and embedded HTML are not accepted."
    >
      <form className="admin-form-grid" onSubmit={(event) => void submit(event)}>
        <FormText label="Sticker name" name="name" required />
        <FormText label="Search aliases" name="searchAliases" placeholder="Comma separated" />
        <label className="admin-field">
          <span>Category</span>
          <select name="categoryId" required defaultValue="">
            <option value="" disabled>
              Select category
            </option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Sticker file (up to 8 MB)</span>
          <input
            name="assetFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            required
          />
        </label>
        <label className="admin-field">
          <span>Optional thumbnail</span>
          <input
            name="thumbnailFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => setCoverFile(event.currentTarget.files?.[0] ?? null)}
          />
        </label>
        <FormText label="Accessibility description" name="altText" />
        <FormText label="Tags" name="tags" placeholder="Comma separated" />
        <FormText label="Creator / attribution" name="attribution" />
        <TargetFields value={targets} onChange={setTargets} />
        <label className="admin-field">
          <span>Save status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="draft">Draft</option>
            <option value="published" disabled={!canPublish}>
              Publish
            </option>
          </select>
        </label>
        {progress !== null ? (
          <label className="admin-field">
            <span>Upload progress: {progress}%</span>
            <progress max={100} value={progress} />
          </label>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button className="admin-primary" disabled={busy}>
          {busy ? "Uploading and saving…" : "Save sticker"}
        </Button>
      </form>
    </Card>
  );
}

function CatalogMetadataEditor({
  type,
  item,
  categories,
  onSave,
}: {
  type: "music" | "stickers";
  item: Record<string, unknown>;
  categories: Array<{ id: string; name: string }>;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const isMusic = type === "music";
  const [targets, setTargets] = useState<StudioTarget[]>(
    Array.isArray(item.available_in) ? (item.available_in as StudioTarget[]) : [],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const values: Record<string, unknown> = {
      [isMusic ? "title" : "name"]: String(form.get(isMusic ? "title" : "name") ?? ""),
      searchAliases: String(form.get("searchAliases") ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
      tags: String(form.get("tags") ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
      availableIn: targets,
    };
    if (isMusic)
      Object.assign(values, {
        artistName: String(form.get("artistName") ?? ""),
        genre: String(form.get("genre") ?? ""),
        mood: String(form.get("mood") ?? ""),
        language: String(form.get("language") ?? ""),
        licenseReference: String(form.get("licenseReference") ?? ""),
        description: String(form.get("description") ?? ""),
        excerptStartSeconds: Number(form.get("excerptStartSeconds")) || 0,
        excerptEndSeconds: form.get("excerptEndSeconds")
          ? Number(form.get("excerptEndSeconds"))
          : null,
      });
    else
      Object.assign(values, {
        categoryId: String(form.get("categoryId") ?? ""),
        altText: String(form.get("altText") ?? ""),
        attribution: String(form.get("attribution") ?? ""),
      });
    try {
      await onSave(values);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="admin-form-details">
      <summary>Edit metadata</summary>
      <form className="admin-form-grid" onSubmit={(event) => void submit(event)}>
        <FormText
          label={isMusic ? "Track title" : "Sticker name"}
          name={isMusic ? "title" : "name"}
          defaultValue={String(item.title ?? item.name ?? "")}
          required
        />
        {isMusic ? (
          <>
            <FormText
              label="Artist"
              name="artistName"
              defaultValue={String(item.artist_name ?? "")}
              required
            />
            <FormText label="Genre" name="genre" defaultValue={String(item.genre ?? "")} />
            <FormText label="Mood" name="mood" defaultValue={String(item.mood ?? "")} />
            <FormText label="Language" name="language" defaultValue={String(item.language ?? "")} />
            <FormText
              label="Licensing information"
              name="licenseReference"
              defaultValue={String(item.license_reference ?? "")}
            />
            <FormText
              label="Description"
              name="description"
              defaultValue={String(item.description ?? "")}
            />
            <FormText
              label="Excerpt start (seconds)"
              name="excerptStartSeconds"
              type="number"
              min={0}
              defaultValue={String(item.excerpt_start_seconds ?? 0)}
            />
            <FormText
              label="Excerpt end (optional seconds)"
              name="excerptEndSeconds"
              type="number"
              min={0}
              defaultValue={String(item.excerpt_end_seconds ?? "")}
            />
          </>
        ) : (
          <>
            <label className="admin-field">
              <span>Category</span>
              <select name="categoryId" defaultValue={String(item.category_id ?? "")} required>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <FormText
              label="Accessibility description"
              name="altText"
              defaultValue={String(item.alt_text ?? "")}
            />
            <FormText
              label="Attribution"
              name="attribution"
              defaultValue={String(item.attribution ?? "")}
            />
          </>
        )}
        <FormText
          label="Aliases"
          name="searchAliases"
          defaultValue={Array.isArray(item.search_aliases) ? item.search_aliases.join(", ") : ""}
        />
        <FormText
          label="Tags"
          name="tags"
          defaultValue={Array.isArray(item.tags) ? item.tags.join(", ") : ""}
        />
        <TargetFields value={targets} onChange={setTargets} />
        <Button className="admin-secondary" disabled={busy}>
          {busy ? "Saving…" : "Save metadata"}
        </Button>
      </form>
    </details>
  );
}

function CatalogAssetReplacement({
  type,
  id,
  onReplaced,
}: {
  type: "music" | "stickers";
  id: string;
  onReplaced: () => void;
}) {
  const canWrite = usePermission("motion.write");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="admin-form-actions"
      onSubmit={(event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        if (
          !(form.get("assetFile") instanceof File) ||
          (form.get("assetFile") as File).size === 0
        ) {
          setError("Choose a replacement asset first.");
          return;
        }
        setBusy(true);
        setError("");
        void adminReplaceStudioCatalogAsset(type, id, form, setProgress)
          .then(onReplaced)
          .catch((cause: unknown) =>
            setError(cause instanceof Error ? cause.message : "Asset replacement failed."),
          )
          .finally(() => setBusy(false));
      }}
    >
      <label className="admin-field">
        <span>Replace {type === "music" ? "audio file" : "image asset"}</span>
        <input
          name="assetFile"
          type="file"
          accept={
            type === "music"
              ? "audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4"
              : "image/jpeg,image/png,image/webp,image/gif"
          }
          disabled={!canWrite || busy}
          required
        />
      </label>
      {type === "music" ? (
        <label className="admin-field">
          <span>Replace cover (optional)</span>
          <input
            name="coverFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={!canWrite || busy}
          />
        </label>
      ) : (
        <label className="admin-field">
          <span>Replace thumbnail (optional)</span>
          <input
            name="thumbnailFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={!canWrite || busy}
          />
        </label>
      )}
      <Button className="admin-secondary" disabled={!canWrite || busy}>
        {busy ? "Uploading…" : "Replace asset"}
      </Button>
      {progress !== null ? (
        <progress max={100} value={progress} aria-label={`Upload ${progress}%`} />
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </form>
  );
}

function StickerCategoryManager({
  categories,
  onChange,
}: {
  categories: Array<{ id: string; name: string; sort_order: number; archived_at?: string | null }>;
  onChange: () => void;
}) {
  const canWrite = usePermission("motion.write");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminCreateStickerCategory(name);
      setName("");
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category could not be added.");
    } finally {
      setBusy(false);
    }
  }
  async function update(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await adminPatchStickerCategory(id, body);
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category could not be updated.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card
      title="Sticker categories"
      subtitle="Rename, reorder, and archive categories. A category with linked stickers stays active until those references are moved."
    >
      <form className="admin-form-actions" onSubmit={(event) => void add(event)}>
        <FormText
          label="New category"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          disabled={!canWrite || busy}
        />
        <Button className="admin-primary" disabled={!canWrite || busy || !name.trim()}>
          Add category
        </Button>
      </form>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Order</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>
                  <FormText
                    label=""
                    aria-label={`Category name ${category.name}`}
                    maxLength={60}
                    defaultValue={category.name}
                    disabled={!canWrite || busy || Boolean(category.archived_at)}
                    onBlur={(event) => {
                      if (event.target.value.trim() && event.target.value !== category.name)
                        void update(category.id, { name: event.target.value });
                    }}
                  />
                </td>
                <td>
                  <FormText
                    label=""
                    aria-label={`Sort order for ${category.name}`}
                    type="number"
                    min={0}
                    max={10000}
                    defaultValue={String(category.sort_order)}
                    disabled={!canWrite || busy || Boolean(category.archived_at)}
                    onBlur={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isInteger(next) && next !== category.sort_order)
                        void update(category.id, { sortOrder: next });
                    }}
                  />
                </td>
                <td>{category.archived_at ? "Archived" : "Active"}</td>
                <td>
                  <Button
                    className="admin-secondary"
                    disabled={!canWrite || busy || Boolean(category.archived_at)}
                    onClick={() => {
                      if (window.confirm(`Archive “${category.name}”?`))
                        void update(category.id, { archived: true });
                    }}
                  >
                    Archive
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!categories.length ? (
        <p>No sticker categories yet. Add one before uploading stickers.</p>
      ) : null}
    </Card>
  );
}

export function StudioCatalogBody({ initialTab = "music" }: { initialTab?: "music" | "stickers" }) {
  const resource = useResource(() => adminStudioCatalog(), []);
  const canWrite = usePermission("motion.write");
  const canPublish = usePermission("motion.publish");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [tab, setTab] = useState<"music" | "stickers">(initialTab);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const entries = useMemo(
    () => (tab === "music" ? resource.data?.music : resource.data?.stickers) ?? [],
    [resource.data, tab],
  );
  const categories = resource.data?.categories ?? [];
  const visible = entries.filter((item) => {
    const targets = Array.isArray(item.available_in) ? item.available_in : [];
    return (
      JSON.stringify(item).toLowerCase().includes(search.toLowerCase()) &&
      (statusFilter === "all" || item.status === statusFilter) &&
      (targetFilter === "all" || targets.includes(targetFilter)) &&
      (tab === "music" || categoryFilter === "all" || item.category_id === categoryFilter)
    );
  });
  const publishedMusic =
    resource.data?.music.filter((item) => item.status === "published").length ?? 0;
  const draftMusic = resource.data?.music.filter((item) => item.status !== "published").length ?? 0;
  const publishedStickers =
    resource.data?.stickers.filter((item) => item.status === "published").length ?? 0;
  async function patch(type: "music" | "stickers", id: string, body: Record<string, unknown>) {
    setError("");
    try {
      await guarded(async () => {
        await adminPatchStudioCatalog(type, id, body);
      });
      resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Catalog update failed.");
    }
  }
  async function remove(type: "music" | "stickers", id: string) {
    if (!window.confirm("Remove this catalog item? Existing content references are retained."))
      return;
    setError("");
    try {
      await guarded(async () => {
        await adminDeleteStudioCatalog(type, id);
      });
      resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Catalog item could not be removed.");
    }
  }
  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Studio Asset Catalog</Heading1>
          <p>Manage the published resources shared by the Story, Reel, and Post studios.</p>
        </div>
        <div className="admin-row-actions">
          <Button
            className={tab === "music" ? "admin-primary" : "admin-secondary"}
            onClick={() => setTab("music")}
          >
            Music Library
          </Button>
          <Button
            className={tab === "stickers" ? "admin-primary" : "admin-secondary"}
            onClick={() => setTab("stickers")}
          >
            Sticker Library
          </Button>
          <Button
            className="admin-primary"
            disabled={!canWrite}
            onClick={() => setCreating((open) => !open)}
          >
            {creating ? "Close form" : tab === "music" ? "+ Add track" : "+ Add sticker"}
          </Button>
        </div>
      </div>
      <div className="admin-grid" aria-label="Catalog overview">
        <button type="button" className="admin-card" onClick={() => setTab("music")}>
          <strong>{resource.data?.music.length ?? 0}</strong>
          <span>Total tracks</span>
        </button>
        <button type="button" className="admin-card" onClick={() => setTab("music")}>
          <strong>{publishedMusic}</strong>
          <span>Published tracks</span>
        </button>
        <button type="button" className="admin-card" onClick={() => setTab("music")}>
          <strong>{draftMusic}</strong>
          <span>Draft or unpublished tracks</span>
        </button>
        <button type="button" className="admin-card" onClick={() => setTab("stickers")}>
          <strong>{resource.data?.stickers.length ?? 0}</strong>
          <span>Total stickers</span>
        </button>
        <button type="button" className="admin-card" onClick={() => setTab("stickers")}>
          <strong>{publishedStickers}</strong>
          <span>Published stickers</span>
        </button>
      </div>
      {resource.loading ? <Notice>Loading catalog…</Notice> : null}
      {resource.error || error ? <Notice tone="error">{error || resource.error}</Notice> : null}
      {creating && tab === "music" ? (
        <MusicCreate
          canPublish={canPublish}
          onCreated={() => {
            setCreating(false);
            resource.reload();
          }}
        />
      ) : creating ? (
        <StickerCreate
          categories={categories.filter((item) => !item.archived_at)}
          canPublish={canPublish}
          onCreated={() => {
            setCreating(false);
            resource.reload();
          }}
        />
      ) : null}
      {tab === "stickers" ? (
        <Card
          title="Sticker categories"
          subtitle="Rename, reorder, and archive categories. Categories with active sticker references cannot be archived."
        >
          <form
            className="admin-form-actions"
            onSubmit={(event) => {
              event.preventDefault();
              const input = new FormData(event.currentTarget).get("categoryName");
              const name = typeof input === "string" ? input.trim() : "";
              if (!name) return;
              void adminCreateStickerCategory(name)
                .then(resource.reload)
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : "Category could not be added."),
                );
              event.currentTarget.reset();
            }}
          >
            <FormText
              label="New category"
              name="categoryName"
              maxLength={60}
              disabled={!canWrite}
              required
            />
            <Button className="admin-secondary" disabled={!canWrite}>
              Add category
            </Button>
          </form>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <FormText
                        label=""
                        aria-label={`Category ${category.name}`}
                        defaultValue={category.name}
                        maxLength={60}
                        disabled={!canWrite || Boolean(category.archived_at)}
                        onBlur={(event) => {
                          const name = event.target.value.trim();
                          if (name && name !== category.name)
                            void adminPatchStickerCategory(category.id, { name })
                              .then(resource.reload)
                              .catch((cause: unknown) =>
                                setError(
                                  cause instanceof Error
                                    ? cause.message
                                    : "Category could not be renamed.",
                                ),
                              );
                        }}
                      />
                    </td>
                    <td>
                      <FormText
                        label=""
                        aria-label={`Order for ${category.name}`}
                        type="number"
                        min={0}
                        max={10000}
                        defaultValue={String(category.sort_order)}
                        disabled={!canWrite || Boolean(category.archived_at)}
                        onBlur={(event) => {
                          const sortOrder = Number(event.target.value);
                          if (Number.isInteger(sortOrder) && sortOrder !== category.sort_order)
                            void adminPatchStickerCategory(category.id, { sortOrder })
                              .then(resource.reload)
                              .catch((cause: unknown) =>
                                setError(
                                  cause instanceof Error
                                    ? cause.message
                                    : "Category order could not be saved.",
                                ),
                              );
                        }}
                      />
                    </td>
                    <td>{category.archived_at ? "Archived" : "Active"}</td>
                    <td>
                      <Button
                        className="admin-secondary"
                        disabled={!canWrite || Boolean(category.archived_at)}
                        onClick={() => {
                          if (window.confirm(`Archive “${category.name}”?`))
                            void adminPatchStickerCategory(category.id, { archived: true })
                              .then(resource.reload)
                              .catch((cause: unknown) =>
                                setError(
                                  cause instanceof Error
                                    ? cause.message
                                    : "Category could not be archived.",
                                ),
                              );
                        }}
                      >
                        Archive
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!categories.length ? <p>No categories yet. Add one before uploading stickers.</p> : null}
        </Card>
      ) : null}
      <Card
        title={tab === "music" ? "Music tracks" : "Sticker assets"}
        subtitle={`${visible.length} shown · unpublished items remain private`}
      >
        <FormText
          label="Search catalog"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="admin-grid">
          <label className="admin-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Studio target</span>
            <select value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)}>
              <option value="all">All studios</option>
              {TARGETS.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
          {tab === "stickers" ? (
            <label className="admin-field">
              <span>Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">All categories</option>
                {categories
                  .filter((category) => !category.archived_at)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
        </div>
        {visible.map((item) => {
          const id = String(item.id);
          const status = String(item.status);
          const targets = Array.isArray(item.available_in)
            ? (item.available_in as StudioTarget[])
            : [];
          return (
            <article className="admin-card" key={id}>
              <div className="admin-grid">
                <strong>{String(item.title ?? item.name)}</strong>
                <span>
                  {tab === "music"
                    ? String(item.artist_name ?? "")
                    : String(item.category_name ?? item.category_id ?? "")}
                </span>
                <span>{status}</span>
                <span>
                  Available:{" "}
                  {targets.map((target) => target[0].toUpperCase() + target.slice(1)).join(", ") ||
                    "None"}
                </span>
                {tab === "music" && item.audio_url ? (
                  <audio
                    controls
                    preload="none"
                    src={String(item.audio_url)}
                    aria-label={`Preview ${String(item.title)}`}
                  />
                ) : tab === "stickers" && item.asset_url ? (
                  <img
                    src={String(item.thumbnail_url || item.asset_url)}
                    alt={String(item.alt_text || item.name)}
                    width={64}
                    height={64}
                  />
                ) : null}
              </div>
              <CatalogMetadataEditor
                type={tab}
                item={item}
                categories={categories.filter((category) => !category.archived_at)}
                onSave={async (values) => patch(tab, id, values)}
              />
              <CatalogAssetReplacement type={tab} id={id} onReplaced={resource.reload} />
              <div className="admin-row-actions">
                {status === "published" ? (
                  <Button
                    className="admin-secondary"
                    disabled={!canPublish || busy}
                    onClick={() => void patch(tab, id, { status: "unpublished" })}
                  >
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    className="admin-secondary"
                    disabled={
                      !canPublish ||
                      busy ||
                      targets.length === 0 ||
                      (tab === "music" && !item.license_reference)
                    }
                    onClick={() =>
                      void patch(tab, id, {
                        status: "published",
                        availableIn: targets,
                        ...(tab === "music" ? { licenseReference: item.license_reference } : {}),
                      })
                    }
                  >
                    Publish
                  </Button>
                )}
                <Button
                  className="admin-danger"
                  disabled={!canWrite || busy}
                  onClick={() => void remove(tab, id)}
                >
                  Remove
                </Button>
              </div>
            </article>
          );
        })}
        {!visible.length && !resource.loading ? (
          <p>No {tab === "music" ? "music tracks" : "stickers"} match this search.</p>
        ) : null}
      </Card>
    </>
  );
}

export function StudioCatalogScreen() {
  return (
    <ConsoleScreen anyOf={["motion.read"]}>
      <StudioCatalogBody />
    </ConsoleScreen>
  );
}
