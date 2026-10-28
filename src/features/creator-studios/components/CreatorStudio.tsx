import { CreatorDestinations } from "../../../components/CreatorDestinations";
import { useEffect, useState } from "react";
import { Button } from "./Shared";
import { PostStudio } from "./PostStudio";
import { ReelStudio } from "./ReelStudio";
import {
  type PostDraft,
  type PublishingAdapter,
  type PublishingPayload,
  type ReelDraft,
  type StudioMode,
} from "../models";
import { useHistory } from "../hooks/useHistory";
import { UnrenderedReelEditsError } from "../services/reelRendering";

export function CreatorStudio({
  initialPost,
  initialReelDraft,
  onDraftChange,
  publishingAdapter,
  mode,
  onModeChange,
}: {
  initialPost: PostDraft;
  initialReelDraft: ReelDraft;
  onDraftChange: (post: PostDraft, reel: ReelDraft) => Promise<void>;
  publishingAdapter?: PublishingAdapter;
  mode: StudioMode;
  onModeChange: (next: StudioMode) => void;
}) {
  const postHistory = useHistory(initialPost);
  const [postStage, setPostStage] = useState<"media" | "edit" | "publish">("media");
  const [reel, setReel] = useState(initialReelDraft);
  const [error, setError] = useState<string>();
  const [saveState, setSaveState] = useState("Saved locally");
  const [publishNotice, setPublishNotice] = useState<string>();
  const [unrenderedEdits, setUnrenderedEdits] = useState<string[]>();
  const [isPublishing, setIsPublishing] = useState(false);

  const changeMode = (next: StudioMode) => {
    if (next === mode) return;
    setError(undefined);
    setPublishNotice(undefined);
    setUnrenderedEdits(undefined);
    onModeChange(next);
  };

  useEffect(() => {
    setSaveState("Saving…");
    const timer = window.setTimeout(async () => {
      try {
        await onDraftChange(postHistory.present, reel);
        setSaveState("Saved locally");
      } catch {
        setSaveState("Draft could not be saved");
        setError(
          "This browser could not persist the current draft. Free storage or use smaller media files.",
        );
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [postHistory.present, reel, onDraftChange]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (mode !== "post" || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) postHistory.redo();
        else postHistory.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, postHistory.undo, postHistory.redo]);

  const publish = async (options?: { acknowledgeUnrendered?: boolean }) => {
    if (!publishingAdapter?.isConfigured()) {
      setPublishNotice(
        "Publishing is not configured. Connect a VELORI PublishingAdapter to send this draft to the platform.",
      );
      return;
    }
    setIsPublishing(true);
    setPublishNotice(undefined);
    setError(undefined);
    setUnrenderedEdits(undefined);
    try {
      const payload: PublishingPayload = {
        kind: mode,
        draft: mode === "post" ? postHistory.present : reel,
        acknowledgeUnrendered: options?.acknowledgeUnrendered,
      };
      const result = await publishingAdapter.publish(payload);
      const warning = (result as { warning?: string }).warning;
      setPublishNotice(
        warning
          ? `Published (ID: ${result.id}). ${warning}`
          : `Published successfully (ID: ${result.id}).`,
      );
    } catch (cause) {
      if (cause instanceof UnrenderedReelEditsError) setUnrenderedEdits(cause.edits);
      else
        setError(
          cause instanceof Error
            ? cause.message
            : "Publishing failed. Your draft was not discarded.",
        );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <main className="studio-page page-enter">
      <div className="studio-heading">
        <div>
          <span className="eyebrow">
            <span className="eyebrow-line" /> CREATOR STUDIO
          </span>
          <h1>
            Create a post<span>.</span>
          </h1>
        </div>
        <div className="studio-actions">
          <span className="save-state" aria-live="polite">
            {saveState}
          </span>
          <Button
            variant="primary"
            onClick={() =>
              mode === "post" && postStage !== "publish"
                ? setPostStage(postStage === "media" ? "edit" : "publish")
                : void publish()
            }
            disabled={isPublishing}
          >
            {isPublishing
              ? "Publishing…"
              : mode === "post" && postStage !== "publish"
                ? "Next"
                : "Publish"}
          </Button>
        </div>
      </div>
      <CreatorDestinations />
      {error && (
        <div className="studio-message error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(undefined)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {publishNotice && (
        <div className="studio-message info" role="status">
          <span>{publishNotice}</span>
          <button
            onClick={() => setPublishNotice(undefined)}
            aria-label="Dismiss publishing notice"
          >
            ×
          </button>
        </div>
      )}
      {unrenderedEdits && (
        <div className="studio-message error" role="alert">
          <span>
            These edits cannot be rendered into the video file by the current pipeline:{" "}
            {unrenderedEdits.join(", ")}. Publish the source video without them?
          </span>
          <span className="studio-message-actions">
            <Button variant="quiet" onClick={() => setUnrenderedEdits(undefined)}>
              Keep editing
            </Button>
            <Button variant="outline" onClick={() => void publish({ acknowledgeUnrendered: true })}>
              Publish without them
            </Button>
          </span>
        </div>
      )}
      {mode === "post" ? (
        <PostStudio
          history={postHistory}
          setError={setError}
          stage={postStage}
          onStageChange={setPostStage}
        />
      ) : (
        <ReelStudio draft={reel} setDraft={setReel} setError={setError} />
      )}
    </main>
  );
}
