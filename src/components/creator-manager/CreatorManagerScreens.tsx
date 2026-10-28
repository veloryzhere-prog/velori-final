import { useState, type FormEvent } from "react";
import { ArrowUpRight, BadgeCheck, Code2, Image, RotateCcw, Upload } from "lucide-react";
import {
  adminBranding,
  adminMotionCms,
  adminRestoreBrandingVersion,
  adminRestoreMotionVersion,
  adminUploadBranding,
} from "../../lib/admin-api";
import { STORY_TEMPLATES } from "../../lib/story-editor/templates.mjs";
import { usePermission } from "../../app/admin-console/session";
import { useScreenReauth } from "../../app/admin-console/frame";
import { Button, Heading1 } from "../../app/admin-console/primitives";
import { Card, Notice, useGuardedAction, useResource } from "../../app/admin-console/widgets";
import type { CreatorSection, StudioTarget } from "./CreatorManager.types";

type AssetRecord = Record<string, unknown> & {
  id?: string;
  slot?: string;
  public_url?: string;
  history?: Array<Record<string, unknown>>;
};

function BrandKitManager() {
  const resource = useResource(() => adminBranding(), []);
  const canEdit = usePermission("branding.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [slot, setSlot] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!slot || !file) return;
    setError("");
    try {
      await guarded(async () => {
        await adminUploadBranding(slot, file);
      });
      setFile(null);
      form.reset();
      resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Brand asset could not be uploaded.");
    }
  }
  async function restore(assetId: string, version: number) {
    if (!window.confirm(`Restore brand asset version ${version}?`)) return;
    try {
      await guarded(async () => {
        await adminRestoreBrandingVersion(assetId, version);
      });
      resource.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Brand asset version could not be restored.",
      );
    }
  }
  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Brand Kit Manager</Heading1>
          <p>Manage the existing versioned brand asset slots used by the VELORI shell.</p>
        </div>
      </div>
      {resource.loading ? <Notice>Loading brand assets…</Notice> : null}
      {resource.error || error ? <Notice tone="error">{error || resource.error}</Notice> : null}
      <Card
        title="Upload brand asset"
        subtitle="Uses the existing secure Branding upload and version history service."
      >
        <form className="admin-form-grid" onSubmit={(event) => void upload(event)}>
          <label className="admin-field">
            <span>Asset slot</span>
            <select required value={slot} onChange={(event) => setSlot(event.target.value)}>
              <option value="">Choose an existing slot</option>
              {(resource.data?.slots ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Approved image file</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </label>
          <Button className="admin-primary" disabled={!canEdit || busy || !slot || !file}>
            <Upload size={14} /> {busy ? "Uploading…" : "Upload new version"}
          </Button>
        </form>
      </Card>
      <div className="cm-brand-assets">
        {(resource.data?.assets ?? []).map((raw) => {
          const asset = raw as AssetRecord;
          return (
            <Card
              key={String(asset.id ?? asset.slot)}
              title={String(asset.slot ?? "Brand asset")}
              subtitle={String(asset.public_url ?? "No active file")}
            >
              {asset.public_url ? (
                <img
                  className="cm-brand-preview"
                  src={asset.public_url}
                  alt={`${asset.slot ?? "Brand"} preview`}
                />
              ) : null}
              <p>
                Current slot value:{" "}
                {String(resource.data?.live?.[`${asset.slot}_url`] ?? "Not set")}
              </p>
              <div className="cm-version-list">
                {(asset.history ?? []).map((version) => (
                  <div className="cm-version-item" key={String(version.version)}>
                    <div>
                      <strong>Version {String(version.version)}</strong>
                      <p>
                        {String(version.created_at ?? "")} · {String(version.note ?? "")}
                      </p>
                    </div>
                    <Button
                      className="admin-secondary"
                      disabled={!canEdit || busy}
                      onClick={() => void restore(String(asset.id), Number(version.version))}
                    >
                      <RotateCcw size={13} /> Restore
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
      {!resource.loading && !resource.data?.assets.length ? (
        <div className="cm-unsupported">
          No brand assets are configured in the existing branding service.
        </div>
      ) : null}
    </>
  );
}

function TemplatesManager({ onOpenStudio }: { onOpenStudio: (target: StudioTarget) => void }) {
  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Templates</Heading1>
          <p>
            Existing templates from the repository’s actual editor implementation. New template
            authoring uses those studio editors and their current document schemas.
          </p>
        </div>
      </div>
      <Card title="Story templates" subtitle={`${STORY_TEMPLATES.length} bundled template presets`}>
        <div className="cm-overview-grid">
          {STORY_TEMPLATES.map((template) => (
            <article className="cm-template-card" key={template.id}>
              <span className="cm-template-preview" aria-hidden="true">
                <span>{template.text[0]?.content ?? template.name}</span>
              </span>
              <div>
                <strong>{template.name}</strong>
                <p>{template.description}</p>
              </div>
              <button className="cm-button" onClick={() => onOpenStudio("story")}>
                Open in Story Studio <ArrowUpRight size={13} />
              </button>
            </article>
          ))}
        </div>
      </Card>
      <div className="cm-unsupported">
        The current application has working template presets inside Story Studio and Post Studio. It
        does not yet provide a backend template registry, publication status, or version history, so
        this manager does not invent editable records.
      </div>
    </>
  );
}

function CustomToolManager({ onOpenSource }: { onOpenSource: (target: StudioTarget) => void }) {
  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Custom Tool Builder</Heading1>
          <p>Review trusted editor implementations and open their real source files.</p>
        </div>
      </div>
      <div className="cm-tool-grid">
        {(
          [
            [
              "story",
              "Story Studio",
              "Text, drawing, shapes, stickers, media, timing, music, export, and publishing tools.",
            ],
            [
              "reel",
              "Reel Studio",
              "Timeline, text, media, audio, stickers, effects, and VELORI publishing.",
            ],
            [
              "post",
              "Post Studio",
              "Post canvas layers, text, image stickers, audience settings, and existing publish workflow.",
            ],
          ] as const
        ).map(([target, label, summary]) => (
          <Card key={target} title={label} subtitle={summary}>
            <button className="cm-button" onClick={() => onOpenSource(target)}>
              <Code2 size={14} /> Inspect registered implementation files
            </button>
          </Card>
        ))}
      </div>
      <div className="cm-unsupported">
        <strong>Runtime extension builder unavailable.</strong> The app has no validated custom-tool
        schema or registered extension API. Administrator-authored JavaScript will not execute in
        the main application. Implement a reviewed tool in the selected studio source and connect it
        to that studio’s actual editor state.
      </div>
    </>
  );
}

export function ConnectedManagerScreen({
  section,
  onOpenStudio,
  onOpenSource,
}: {
  section: Extract<CreatorSection, "templates" | "brand-kit" | "tools">;
  onOpenStudio: (target: StudioTarget) => void;
  onOpenSource: (target: StudioTarget) => void;
}) {
  if (section === "brand-kit") return <BrandKitManager />;
  if (section === "templates") return <TemplatesManager onOpenStudio={onOpenStudio} />;
  return <CustomToolManager onOpenSource={onOpenSource} />;
}

export function VersionHistoryPanel() {
  const resource = useResource(() => adminMotionCms(), []);
  const canPublish = usePermission("motion.publish");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [error, setError] = useState("");
  async function restore(version: number) {
    if (!window.confirm(`Restore and publish Motion CMS version ${version}?`)) return;
    setError("");
    try {
      await guarded(async () => {
        await adminRestoreMotionVersion(version);
      });
      resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Version restore failed.");
    }
  }
  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Version History</Heading1>
          <p>
            Motion CMS versions and rollback are served by the existing audited configuration
            publisher.
          </p>
        </div>
      </div>
      {resource.loading ? <Notice>Loading version history…</Notice> : null}
      {resource.error || error ? <Notice tone="error">{error || resource.error}</Notice> : null}
      <div className="cm-version-list">
        {(resource.data?.versions ?? []).map((item) => {
          const version = Number(item.version);
          return (
            <article className="cm-version-item" key={String(item.version)}>
              <div>
                <strong>
                  Version {version}{" "}
                  {version === resource.data?.publishedVersion ? (
                    <span className="cm-status cm-status-published">Current</span>
                  ) : null}
                </strong>
                <p>
                  {String(item.change_summary ?? "No summary")} ·{" "}
                  {String(item.published_at ?? item.created_at ?? "")}
                </p>
                <small>{String(item.event ?? "publish")}</small>
              </div>
              <Button
                className="admin-secondary"
                disabled={!canPublish || busy || version === resource.data?.publishedVersion}
                onClick={() => void restore(version)}
              >
                <RotateCcw size={13} /> Restore
              </Button>
            </article>
          );
        })}
      </div>
      {!resource.loading && !resource.data?.versions.length ? (
        <div className="cm-unsupported">No published Motion CMS versions are available.</div>
      ) : null}
    </>
  );
}
