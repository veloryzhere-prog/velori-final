import { useEffect, useState } from "react";
import { Button, Dialog } from "../ui";

export function DraftExitDialog({
  open,
  title,
  description,
  onKeepEditing,
  onSaveDraft,
  onDiscardDraft,
  discardDisabled = false,
}: {
  open: boolean;
  title: string;
  description: string;
  onKeepEditing: () => void;
  onSaveDraft: () => Promise<void>;
  onDiscardDraft: () => Promise<void>;
  discardDisabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) setError("");
  }, [open]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The draft action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={busy ? () => {} : onKeepEditing}
      dismissOnBackdrop={!busy}
      actions={
        <>
          <Button variant="secondary" onClick={onKeepEditing} disabled={busy}>
            Keep editing
          </Button>
          <Button variant="outline" onClick={() => void run(onSaveDraft)} disabled={busy}>
            {busy ? "Saving…" : "Save draft & leave"}
          </Button>
          {!discardDisabled ? (
            <Button variant="danger" onClick={() => void run(onDiscardDraft)} disabled={busy}>
              {busy ? "Leaving…" : "Discard draft & leave"}
            </Button>
          ) : null}
        </>
      }
    >
      {error ? <p role="alert">{error}</p> : null}
    </Dialog>
  );
}
