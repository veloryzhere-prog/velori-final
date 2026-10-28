import { Dialog } from "../../components/ui";
import { ShieldCheck, Trash2, Sparkles } from "lucide-react";
export function ChatDeleteDialog({
  own,
  busy,
  error,
  onClose,
  onDelete,
}: {
  own: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onDelete: (scope: "me" | "everyone") => void;
}) {
  return (
    <Dialog
      open
      title="Let this message go?"
      description="Choose which copy to remove."
      onClose={() => {
        if (!busy) onClose();
      }}
      className="chat-delete-dialog"
      dismissOnBackdrop={!busy}
    >
      <div className="chat-delete-art" aria-hidden="true">
        <Sparkles />
        <b>velori</b>
      </div>
      <button className="chat-delete-choice" disabled={busy} onClick={() => onDelete("me")}>
        <Trash2 />
        <span>
          <strong>Delete for me</strong>
          <small>
            Hide it for your account. Other devices update when settings sync. Others keep their
            copy.
          </small>
        </span>
      </button>
      {own ? (
        <button
          className="chat-delete-choice is-danger"
          disabled={busy}
          onClick={() => onDelete("everyone")}
        >
          <Trash2 />
          <span>
            <strong>Delete for everyone</strong>
            <small>
              Remove your message from this conversation. People may already have seen or saved it.
            </small>
          </span>
        </button>
      ) : null}
      {busy ? <p role="status">Removing message…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </Dialog>
  );
}
export function ChildModeNotice({
  onDisable,
  onSettings,
  onClose,
}: {
  onDisable: () => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  return (
    <div className="chat-child-notice" role="status">
      <ShieldCheck size={22} />
      <div>
        <strong>Let’s keep this space kind.</strong>
        <p>Child Mode found blocked language. Edit your message to send it.</p>
        <button onClick={onSettings}>Child Mode settings</button>
        <button onClick={onDisable}>Turn off Child Mode</button>
      </div>
      <button aria-label="Dismiss Child Mode notice" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
