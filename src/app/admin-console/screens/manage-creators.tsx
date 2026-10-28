import { createUuid } from "../../../lib/uuid.mjs";
import { useEffect, useState } from "react";
import { adminMotionCms, adminPublishMotion, adminSaveMotionDraft } from "../../../lib/admin-api";
import {
  DEFAULT_MOTION_CONFIG,
  normalizeMotionConfig,
  type MotionConfig,
} from "../../../../supabase/functions/_shared/motion-config.mjs";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen, useScreenReauth } from "../frame";
import { usePermission } from "../session";
import { Card, Notice, TextField, ToggleField, useGuardedAction, useResource } from "../widgets";

const EDITORS = ["story", "reel", "post"] as const;
const CATEGORIES = [
  "Emoji",
  "Happy",
  "Laughing",
  "Sad",
  "Love",
  "Reactions",
  "Celebration",
  "Animals",
  "Food",
  "Travel",
  "Decorative",
  "Aesthetic",
  "Text",
  "Frames",
  "Symbols",
];

function ManageCreatorsBody() {
  const resource = useResource(() => adminMotionCms(), []);
  const canWrite = usePermission("motion.write");
  const canPublish = usePermission("motion.publish");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [config, setConfig] = useState<MotionConfig>(DEFAULT_MOTION_CONFIG);
  const [dirty, setDirty] = useState(false);
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!resource.data || dirty) return;
    try {
      setConfig(normalizeMotionConfig(resource.data.draft));
    } catch {
      setConfig(DEFAULT_MOTION_CONFIG);
    }
  }, [resource.data, dirty]);

  const changeCreatorStudio = (creatorStudio: MotionConfig["creatorStudio"]) => {
    setConfig((current) => ({ ...current, creatorStudio }));
    setDirty(true);
    setStatus("");
    setError("");
  };

  const updateTheme = (
    editor: (typeof EDITORS)[number],
    key: "primary" | "accent" | "background" | "surface" | "text",
    value: string,
  ) => {
    changeCreatorStudio({
      ...config.creatorStudio,
      themes: {
        ...config.creatorStudio.themes,
        [editor]: { ...config.creatorStudio.themes[editor], [key]: value },
      },
    });
  };

  const updateSticker = (
    index: number,
    patch: Partial<MotionConfig["creatorStudio"]["stickers"][number]>,
  ) => {
    changeCreatorStudio({
      ...config.creatorStudio,
      stickers: config.creatorStudio.stickers.map((sticker, itemIndex) =>
        itemIndex === index ? { ...sticker, ...patch } : sticker,
      ),
    });
  };

  const addSticker = () => {
    if (config.creatorStudio.stickers.length >= 120) return;
    changeCreatorStudio({
      ...config.creatorStudio,
      stickers: [
        ...config.creatorStudio.stickers,
        {
          id: `creator-${createUuid()}`,
          name: "New sticker",
          emoji: "✨",
          category: "Decorative",
          style: "VELORI",
          color: "#f05a9d",
          background: "#fce7f1",
          enabled: true,
          editors: ["story"],
        },
      ],
    });
  };

  const save = async (publish: boolean) => {
    setError("");
    if (publish && !summary.trim()) {
      setError("Add a change summary before publishing.");
      return;
    }
    try {
      const safe = normalizeMotionConfig(config);
      await guarded(async () => {
        await adminSaveMotionDraft({
          config: safe as unknown as Record<string, unknown>,
          summary: summary.trim() || "Updated creator studio content",
        });
        if (publish) await adminPublishMotion(summary.trim());
      });
      setConfig(safe);
      setDirty(false);
      setSummary("");
      setStatus(
        publish
          ? "Published. Story, Reel, and Post editors will refresh from this version."
          : "Draft saved. Editors continue using the published version until you publish.",
      );
      resource.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const version = Number(resource.data?.publishedVersion ?? 0);

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Manage Creators</Heading1>
          <p>
            Manage editor themes and sticker content separately from the Story, Reel, and Post
            creation experiences.
          </p>
        </div>
        <div className="admin-row-actions">
          <Button
            className="admin-secondary"
            disabled={!canWrite || !dirty || busy}
            onClick={() => void save(false)}
          >
            Save draft
          </Button>
          <Button
            className="admin-primary"
            disabled={!canWrite || !canPublish || busy}
            onClick={() => void save(true)}
          >
            Publish version
          </Button>
        </div>
      </div>
      {resource.loading ? <Notice>Loading creator configuration…</Notice> : null}
      {resource.error ? <Notice tone="error">{resource.error}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {status ? <Notice>{status}</Notice> : null}
      <Card
        title="Shared configuration service"
        subtitle="Versioned with the existing secure Motion CMS publisher; no editor rebuild or database schema change is needed for routine updates."
      >
        <p>
          Published version: <strong>{version || "Not published yet"}</strong>. Draft changes stay
          private until published. Existing Motion CMS permissions and reauthentication protect
          writes and publishes.
        </p>
        <TextField
          label="Change summary"
          value={summary}
          onChange={setSummary}
          placeholder="Example: Add summer story stickers"
        />
      </Card>
      <Card
        title="Creator themes"
        subtitle="Scoped to each editor, so a published theme does not alter the rest of the app."
      >
        <div className="admin-grid">
          {EDITORS.map((editor) => (
            <section className="admin-card" key={editor}>
              <h3>{editor[0].toUpperCase() + editor.slice(1)} editor</h3>
              {(["primary", "accent", "background", "surface", "text"] as const).map((key) => (
                <label className="admin-field" key={key}>
                  <span>{key[0].toUpperCase() + key.slice(1)}</span>
                  <input
                    type="color"
                    value={config.creatorStudio.themes[editor][key]}
                    disabled={!canWrite}
                    onChange={(event) => updateTheme(editor, key, event.target.value)}
                  />
                </label>
              ))}
            </section>
          ))}
        </div>
      </Card>
      <Card
        title="Sticker catalog"
        subtitle="Published catalog stickers appear in Story Studio. Themes are available in Story, Reel, and Post editors."
      >
        <div className="admin-form-actions">
          <Button
            className="admin-secondary"
            disabled={!canWrite || config.creatorStudio.stickers.length >= 120}
            onClick={addSticker}
          >
            Add sticker
          </Button>
          <span>{config.creatorStudio.stickers.length} / 120</span>
        </div>
        {config.creatorStudio.stickers.map((sticker, index) => (
          <section className="admin-card" key={sticker.id}>
            <div className="admin-grid">
              <TextField
                label="Name"
                value={sticker.name}
                disabled={!canWrite}
                onChange={(name) => updateSticker(index, { name })}
              />
              <TextField
                label="Emoji"
                value={sticker.emoji}
                disabled={!canWrite}
                onChange={(emoji) => updateSticker(index, { emoji })}
              />
              <label className="admin-field">
                <span>Category</span>
                <select
                  value={sticker.category}
                  disabled={!canWrite}
                  onChange={(event) => updateSticker(index, { category: event.target.value })}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <TextField
                label="Style label"
                value={sticker.style}
                disabled={!canWrite}
                onChange={(style) => updateSticker(index, { style })}
              />
              <label className="admin-field">
                <span>Text color</span>
                <input
                  type="color"
                  value={sticker.color}
                  disabled={!canWrite}
                  onChange={(event) => updateSticker(index, { color: event.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Background</span>
                <input
                  type="color"
                  value={sticker.background}
                  disabled={!canWrite}
                  onChange={(event) => updateSticker(index, { background: event.target.value })}
                />
              </label>
            </div>
            <div className="admin-grid">
              <ToggleField
                label="Available in Story Studio"
                checked={sticker.editors.includes("story")}
                disabled={!canWrite}
                onChange={(checked) =>
                  updateSticker(index, {
                    editors: checked
                      ? [...new Set<"story" | "reel" | "post">([...sticker.editors, "story"])]
                      : sticker.editors.filter((item) => item !== "story"),
                  })
                }
              />
              <ToggleField
                label="Published / enabled"
                checked={sticker.enabled}
                disabled={!canWrite}
                onChange={(enabled) => updateSticker(index, { enabled })}
              />
            </div>
            {canWrite ? (
              <Button
                className="admin-danger"
                onClick={() =>
                  changeCreatorStudio({
                    ...config.creatorStudio,
                    stickers: config.creatorStudio.stickers.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                Remove
              </Button>
            ) : null}
          </section>
        ))}
        {!config.creatorStudio.stickers.length ? (
          <p>No managed stickers yet. Add one and publish to make it available in Story Studio.</p>
        ) : null}
      </Card>
    </>
  );
}

export function ManageCreatorsScreen() {
  return (
    <ConsoleScreen anyOf={["motion.read"]}>
      <ManageCreatorsBody />
    </ConsoleScreen>
  );
}
