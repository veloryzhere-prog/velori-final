import { useMemo, useState, type FormEvent, type InputHTMLAttributes } from "react";
import {
  adminCreateMusic,
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

function MusicCreate({ onCreated, canPublish }: { onCreated: () => void; canPublish: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("draft");
  const [targets, setTargets] = useState<StudioTarget[]>(["story", "reel", "post"]);
  const [duration, setDuration] = useState("");
  const [preview, setPreview] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("status", status);
    form.set("availableIn", targets.join(","));
    form.set("durationSeconds", duration);
    try {
      await adminCreateMusic(form, setProgress);
      formElement.reset();
      setPreview("");
      setDuration("");
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
      subtitle="Upload an authorized audio file. Publication requires licensing information and at least one studio target."
    >
      <form className="admin-form-grid" onSubmit={(event) => void submit(event)}>
        <FormText label="Track title" name="title" required />
        <FormText label="Artist name" name="artistName" required />
        <FormText label="Search aliases" name="searchAliases" placeholder="Comma separated" />
        <FormText label="Genre" name="genre" />
        <FormText label="Mood" name="mood" />
        <FormText label="Language" name="language" />
        <FormText label="Tags" name="tags" placeholder="Comma separated" />
        <FormText
          label="License reference / permitted uses"
          name="licenseReference"
          required={status === "published"}
        />
        <FormText label="Description" name="description" />
        <FormText
          label="Excerpt start (seconds)"
          name="excerptStartSeconds"
          type="number"
          min={0}
          defaultValue="0"
        />
        <FormText
          label="Excerpt end (optional seconds)"
          name="excerptEndSeconds"
          type="number"
          min={0}
        />
        <label className="admin-field">
          <span>Audio file (MP3, WAV, OGG, WebM, or M4A; up to 25 MB)</span>
          <input
            name="audioFile"
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4"
            required
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              setPreview(URL.createObjectURL(file));
              const audio = new Audio();
              audio.onloadedmetadata = () => setDuration(String(Math.round(audio.duration)));
              audio.src = URL.createObjectURL(file);
            }}
          />
        </label>
        <label className="admin-field">
          <span>Cover image (optional)</span>
          <input name="coverFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
        </label>
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
            <option value="published" disabled={!canPublish}>
              Publish
            </option>
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
