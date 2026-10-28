/* Copyright © 2026 VELORYZ. Opt-in cleanup of older cloud-saved Forge sources. */
import { useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Dialog } from "../../components/ui";
import { studioRequest } from "./api";
const CONFIRM = "DELETE MY LEGACY FORGE COPIES";
export function LegacyPrivacy({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [receipts, setReceipts] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!signedIn) return null;
  async function show() {
    setOpen(true);
    setError("");
    setTyped("");
    setCount(null);
    setReceipts(null);
    try {
      const r = await studioRequest<{ legacyCopies: number; legacyGenerationResults: number }>(
        "legacyDataStatus",
      );
      setCount(r.legacyCopies);
      setReceipts(r.legacyGenerationResults);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check legacy project copies.");
    }
  }
  async function erase() {
    if (typed !== CONFIRM || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await studioRequest<{ deleted: number; receiptsCleared: number }>(
        "deleteLegacyCopies",
        { confirm: CONFIRM },
      );
      setCount(0);
      setReceipts(0);
      setTyped("");
      setError(
        `Removed ${r.deleted} cloud project copies and cleared ${r.receiptsCleared} stored generation results. Device drafts are unchanged.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deletion could not be verified.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="vf-legacy-privacy">
      <ShieldCheck size={19} />
      <div>
        <strong>Local source privacy</strong>
        <p>
          New FORGE source stays on this device. If you used the older cloud-save feature, you can
          inspect and erase legacy account copies separately.
        </p>
      </div>
      <button onClick={() => void show()}>Manage old cloud copies</button>
      <Dialog open={open} title="Older cloud project copies" onClose={() => setOpen(false)}>
        <div className="vf-legacy-dialog">
          <p>
            {count === null
              ? "Checking legacy copies…"
              : `${count} old cloud project copies and ${receipts ?? 0} old generation results are associated with this account.`}
          </p>
          <p>
            Deletion is permanent and also revokes their shared links. Export the projects you want
            to keep before deleting. This will not affect device files or purchase history.
          </p>
          {count !== null && (count > 0 || (receipts ?? 0) > 0) && (
            <>
              <label htmlFor="vf-delete-legacy">
                Type <strong>{CONFIRM}</strong> to permanently delete them:
              </label>
              <input
                id="vf-delete-legacy"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
              <button disabled={busy || typed !== CONFIRM} onClick={() => void erase()}>
                <Trash2 size={15} />
                {busy ? "Deleting…" : "Delete older cloud copies"}
              </button>
            </>
          )}
          {error && <p role="status">{error}</p>}
          <button type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </Dialog>
    </section>
  );
}
