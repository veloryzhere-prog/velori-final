import { Button, Dialog, Textarea } from "../ui";
import type { StoryAudience } from "../../lib/story-publishing";

interface StoryStudioPublishDialogProps {
  open: boolean;
  authenticated: boolean;
  enabled: boolean;
  currentSlide: number;
  slideCount: number;
  video: boolean;
  audience: StoryAudience;
  caption: string;
  busy: boolean;
  progress: number | null;
  status: string;
  error: string;
  success: boolean;
  onAudienceChange: (audience: StoryAudience) => void;
  onCaptionChange: (caption: string) => void;
  onClose: () => void;
  onSignIn: () => void;
  onPublish: () => void;
  onDone: () => void;
}

const audiences: Array<{ value: StoryAudience; label: string; detail: string }> = [
  { value: "followers", label: "Followers", detail: "People who follow you" },
  { value: "close_friends", label: "Close friends", detail: "Your close-friends list" },
  { value: "public", label: "Public", detail: "Anyone who can view your profile" },
  { value: "private", label: "Only me", detail: "Visible only to you" },
];

export function StoryStudioPublishDialog({
  open,
  authenticated,
  enabled,
  currentSlide,
  slideCount,
  video,
  audience,
  caption,
  busy,
  progress,
  status,
  error,
  success,
  onAudienceChange,
  onCaptionChange,
  onClose,
  onSignIn,
  onPublish,
  onDone,
}: StoryStudioPublishDialogProps) {
  return (
    <Dialog
      actions={
        success ? (
          <Button onClick={onDone}>Done</Button>
        ) : (
          <>
            <Button disabled={busy} onClick={onClose} variant="secondary">
              Back to editing
            </Button>
            {!enabled ? (
              <span className="story-editor-publish-destination">
                Story publishing is currently unavailable.
              </span>
            ) : authenticated ? (
              <Button disabled={busy} loading={busy} onClick={onPublish}>
                Publish story
              </Button>
            ) : (
              <Button onClick={onSignIn}>Sign in to publish</Button>
            )}
          </>
        )
      }
      className="story-editor-mobile-publish-dialog"
      description="Review the story sequence, choose who can see it, then publish to VELORI Stories."
      dismissOnBackdrop={!busy && !success}
      onClose={() => {
        if (!busy && !success) onClose();
      }}
      open={open}
      title={success ? "Your story is live" : "Review your story"}
    >
      <div className="story-editor-publish-preview">
        <span aria-hidden="true" className="story-editor-publish-preview-mark">
          {video ? "▶" : "▧"}
        </span>
        <div>
          <strong>
            Slide {currentSlide} of {slideCount}
          </strong>
          <span>
            {slideCount === 1
              ? "This slide will be published"
              : `All ${slideCount} slides publish in order`}
          </span>
        </div>
      </div>
      {success ? (
        <p className="story-editor-publish-success" role="status">
          Your story was published successfully.
        </p>
      ) : (
        <>
          {!enabled ? (
            <p className="story-editor-publish-error" role="status">
              Story publishing is currently unavailable.
            </p>
          ) : null}
          {video ? (
            <p className="story-editor-publish-note">
              This browser renders the edited clip without its original audio.
            </p>
          ) : null}
          <fieldset className="story-editor-publish-audiences" disabled={busy}>
            <legend>Who can see this story?</legend>
            {audiences.map((option) => (
              <label key={option.value}>
                <input
                  checked={audience === option.value}
                  name="story-audience"
                  onChange={() => onAudienceChange(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="story-editor-publish-caption">
            <span>Caption (optional)</span>
            <Textarea
              disabled={busy}
              maxLength={2000}
              onChange={(event) => onCaptionChange(event.target.value)}
              rows={2}
              value={caption}
            />
          </label>
          {progress !== null ? (
            <div
              aria-label={`Publishing progress ${progress}%`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progress}
              className="story-editor-publish-progress"
              role="progressbar"
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          ) : null}
          {status ? (
            <p className="story-editor-publish-status" role="status">
              {status}
            </p>
          ) : null}
          {error ? (
            <p className="story-editor-publish-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="story-editor-publish-destination">Destination: VELORI Stories</p>
        </>
      )}
    </Dialog>
  );
}
