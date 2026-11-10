import { studioId } from "./identity.ts";
import { useEffect, useRef, useState } from "react";
import { CloudUpload, Link2, ShieldX, Copy, ExternalLink } from "lucide-react";
import { Dialog } from "../../components/ui";
import { studioEnabled, studioRequest } from "./api";
import { normalizeProject, type Project } from "./model";
export function CloudControls({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: (stamp: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [share, setShare] = useState<{ token: string; expiresAt: string } | null>(null);
  const pending = useRef(false);
  const retrySave = useRef<{ fingerprint: string; id: string } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function action(kind: "save" | "share" | "revoke") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice("");
    try {
      if (kind === "save") {
        const fingerprint = JSON.stringify(project);
        if (retrySave.current?.fingerprint !== fingerprint)
          retrySave.current = { fingerprint, id: studioId() };
        const r = await studioRequest<{ updatedAt: string }>("save", {
          requestId: retrySave.current.id,
          project,
        });
        retrySave.current = null;
        if (alive.current) {
          onSaved(r.updatedAt);
          setNotice("Account copy saved. Browser drafts continue to save locally.");
        }
      } else if (kind === "share") {
        const r = await studioRequest<{ token: string; expiresAt: string }>("share", {
          projectId: project.id,
        });
        if (alive.current) {
          setShare(r);
          setConfirm(false);
          setNotice("Link created. Previous links were revoked.");
        }
      } else {
        await studioRequest("revoke", { projectId: project.id });
        if (alive.current) {
          setShare(null);
          setNotice("All project share links were revoked.");
        }
      }
    } catch (e) {
      if (alive.current) setNotice(e instanceof Error ? e.message : "The account action failed.");
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const url = share ? `${location.origin}/s/${share.token}` : "";
  return (
    <section className="vf-cloud" aria-label="Account copy">
      <div>
        <button disabled={busy} onClick={() => void action("save")}>
          <CloudUpload size={14} />
          Save to account
        </button>
        <button disabled={busy || !project.cloudUpdatedAt} onClick={() => setConfirm(true)}>
          <Link2 size={14} />
          Share saved copy
        </button>
        <button disabled={busy || !project.cloudUpdatedAt} onClick={() => void action("revoke")}>
          <ShieldX size={14} />
          Revoke links
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {share && (
        <div className="vf-share">
          <input aria-label="Share link" value={url} readOnly />
          <button
            aria-label="Copy share link"
            onClick={() =>
              void navigator.clipboard
                .writeText(url)
                .then(() => setNotice("Share link copied."))
                .catch(() => setNotice("Select and copy the link manually."))
            }
          >
            <Copy size={14} />
          </button>
          <a aria-label="Open shared preview" href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} />
          </a>
          <small>
            Anyone with this link can view the saved app until{" "}
            {new Date(share.expiresAt).toLocaleDateString()}.
          </small>
        </div>
      )}
      <Dialog
        open={confirm}
        title="Create a public preview link?"
        description="Anyone with this link can view your last saved account copy and inspect its browser code. The link expires in seven days. Existing links will be revoked."
        onClose={() => setConfirm(false)}
        actions={
          <>
            <button className="button" onClick={() => setConfirm(false)}>
              Keep private
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => void action("share")}
            >
              Create preview link
            </button>
          </>
        }
      />
    </section>
  );
}
export function CloudLibrary({ onOpen }: { onOpen: (p: Project) => void }) {
  const [items, setItems] = useState<Project[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const current = useRef(0);
  async function load() {
    const seq = ++current.current;
    setBusy(true);
    setNotice("");
    try {
      const r = await studioRequest<unknown[]>("list");
      if (!Array.isArray(r)) throw new Error("Account projects are unavailable.");
      const next = r.map(normalizeProject);
      if (seq === current.current) setItems(next);
    } catch (e) {
      if (seq === current.current)
        setNotice(e instanceof Error ? e.message : "Account projects are unavailable.");
    } finally {
      if (seq === current.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (studioEnabled) void load();
    return () => {
      current.current++;
    };
  }, []);
  if (!studioEnabled) return null;
  return (
    <section className="vf-account-library">
      <div className="vf-section-heading">
        <h2>Saved to your account</h2>
        <button disabled={busy} onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <p className="vf-muted">
        Open a saved copy. Different browser drafts are backed up before replacement.
      </p>
      {busy && <p role="status">Loading account projects…</p>}
      {notice && <p role="status">{notice}</p>}
      {!busy && !notice && !items.length && <p>No account projects yet.</p>}
      <div className="vf-projects">
        {items.map((p) => (
          <button className="vf-account-card" key={p.id} onClick={() => onOpen(p)}>
            <strong>{p.title}</strong>
            <small>{p.pages.length} pages · Open saved copy ↗</small>
          </button>
        ))}
      </div>
    </section>
  );
}
