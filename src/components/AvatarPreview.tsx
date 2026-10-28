import { useState } from "react";
import { ZoomIn, ZoomOut, UserRound } from "lucide-react";
import { Dialog } from "./ui";
export function AvatarPreview({
  src,
  name,
  onClose,
}: {
  src: string | null;
  name: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <Dialog
      open
      title={name}
      description="Profile picture"
      onClose={onClose}
      className="avatar-preview-dialog"
    >
      <div className={"avatar-preview-stage" + (zoom ? " is-zoomed" : "")}>
        {src && !failed ? (
          <img src={src} alt={name + "’s profile picture"} onError={() => setFailed(true)} />
        ) : (
          <div className="avatar-preview-empty">
            <UserRound size={54} />
            <p>No picture available</p>
          </div>
        )}
      </div>
      {src && !failed ? (
        <button type="button" className="button button-outline" onClick={() => setZoom(!zoom)}>
          {zoom ? <ZoomOut size={17} /> : <ZoomIn size={17} />}{" "}
          {zoom ? "Fit picture" : "Zoom picture"}
        </button>
      ) : null}
    </Dialog>
  );
}
