import { createUuid } from "../../lib/uuid.mjs";
import { useEffect, useMemo, useState } from "react";
import {
  checkStoryBrandConsistency,
  getStoryCollaborationStorageKey,
  mergeStoryCollaborationEvents,
  normalizeStoryCollaborationEvent,
  type StoryCollaborationEvent,
} from "../../lib/story-editor/collaboration.mjs";
import type { Slide, StoryTextOverlay } from "../../lib/story-editor/types";

interface CollaborationPanelProps {
  projectId: string;
  slides: Slide[];
  activeSlideId: string;
  overlays: StoryTextOverlay[];
  snapshot: Record<string, unknown>;
  onRestore: (snapshot: Record<string, unknown>) => void;
  onRetainVersion: (snapshot: Record<string, unknown>) => void;
  onShareProject: () => void;
  onCopyClientPreview: () => void;
  onClientPreview: () => void;
  error: string;
  notice: string;
  onError: (message: string) => void;
}

function metadataKey(projectId: string) {
  return `${getStoryCollaborationStorageKey(projectId)}:metadata`;
}

export function CollaborationPanel({
  projectId,
  slides,
  activeSlideId,
  overlays,
  snapshot,
  onRestore,
  onRetainVersion,
  onShareProject,
  onCopyClientPreview,
  onClientPreview,
  error,
  notice,
  onError,
}: CollaborationPanelProps) {
  const [events, setEvents] = useState<StoryCollaborationEvent[]>([]);
  const [assignee, setAssignee] = useState("");
  const [comment, setComment] = useState("");
  const [guidelineColors, setGuidelineColors] = useState("#ffffff, #1d2130, #7968e8");
  const [guidelineFonts, setGuidelineFonts] = useState("Inter, Arial");
  const channelName = `velori-story:${projectId}`;
  const slideNumber = slides.findIndex((slide) => slide.id === activeSlideId) + 1;
  const slideAssignments = useMemo(
    () =>
      Object.fromEntries(
        events
          .filter((event) => event.type === "assignment")
          .map((event) => [event.payload.slideId, event.payload.assignee]),
      ),
    [events],
  );
  const comments = useMemo(
    () =>
      events
        .filter((event) => event.type === "comment" && event.payload.slideId === activeSlideId)
        .slice()
        .reverse(),
    [activeSlideId, events],
  );
  const approval = [...events].reverse().find((event) => event.type === "approval");
  const versions = events
    .filter((event) => event.type === "version")
    .slice(-10)
    .reverse();
  const brandIssues = checkStoryBrandConsistency(
    overlays,
    guidelineColors.split(","),
    guidelineFonts.split(","),
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(metadataKey(projectId));
      if (saved) setEvents(mergeStoryCollaborationEvents([], JSON.parse(saved)));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not load collaboration updates.");
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== metadataKey(projectId) || !event.newValue) return;
      try {
        const incoming = JSON.parse(event.newValue);
        setEvents((current) => mergeStoryCollaborationEvents(current, incoming));
      } catch (cause) {
        onError(cause instanceof Error ? cause.message : "Could not sync collaboration updates.");
      }
    };
    window.addEventListener("storage", onStorage);
    if (typeof BroadcastChannel === "undefined") {
      return () => window.removeEventListener("storage", onStorage);
    }
    const channel = new BroadcastChannel(channelName);
    channel.onmessage = (message: MessageEvent<unknown>) => {
      const payload = message.data;
      if (!payload || typeof payload !== "object" || !("events" in payload)) return;
      setEvents((current) =>
        mergeStoryCollaborationEvents(current, (payload as { events: unknown[] }).events),
      );
    };
    return () => {
      window.removeEventListener("storage", onStorage);
      channel.close();
    };
  }, [channelName, onError, projectId]);

  function publish(type: StoryCollaborationEvent["type"], payload: Record<string, unknown>) {
    try {
      const event = normalizeStoryCollaborationEvent({
        id: createUuid(),
        type,
        payload,
        createdAt: new Date().toISOString(),
      });
      const next = mergeStoryCollaborationEvents(events, [event]);
      window.localStorage.setItem(metadataKey(projectId), JSON.stringify(next));
      setEvents(next);
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(channelName);
        channel.postMessage({ events: [event] });
        channel.close();
      }
      onError("");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not save this collaboration update.");
    }
  }

  function saveVersion(scope: "slide" | "project") {
    const slide = slides.find((item) => item.id === activeSlideId);
    const versionSnapshot =
      scope === "slide" && slide
        ? {
            scope,
            projectId,
            slide,
            textOverlays: snapshot.textOverlaysBySlide
              ? (snapshot.textOverlaysBySlide as Record<string, unknown>)[slide.id]
              : [],
            mediaSettings: snapshot.mediaSettingsBySlide
              ? (snapshot.mediaSettingsBySlide as Record<string, unknown>)[slide.id]
              : null,
            transition: snapshot.transitionsBySlide
              ? (snapshot.transitionsBySlide as Record<string, unknown>)[slide.id]
              : null,
            slideLoop: snapshot.slideLoops
              ? (snapshot.slideLoops as Record<string, unknown>)[slide.id]
              : null,
          }
        : { scope, project: snapshot };
    onRetainVersion(versionSnapshot);
    publish("version", {
      name: scope === "slide" ? `Slide ${slideNumber} version` : "Project version",
      scope,
      slideId: scope === "slide" ? activeSlideId : null,
      snapshot: versionSnapshot,
    });
  }

  const assignedTo = slideAssignments[activeSlideId];

  return (
    <section aria-label="Story collaboration" className="story-editor-collaboration">
      <div className="story-editor-section-heading">
        <div>
          <span className="story-editor-eyebrow">COLLABORATION</span>
          <h2>Shared story</h2>
        </div>
        <span className="story-editor-collaboration-status">
          {typeof BroadcastChannel === "undefined" ? "Local draft" : "Browser sync"}
        </span>
      </div>
      <p className="story-editor-tool-hint">
        Shared across tabs on this browser and origin only. Cross-device access and durable cloud
        collaboration are not enabled.
      </p>

      <div className="story-editor-collab-assignment">
        <label>
          Slide {slideNumber} assignment
          <input
            aria-label={`Assign slide ${slideNumber}`}
            onChange={(event) => setAssignee(event.target.value)}
            placeholder="@name"
            value={assignee}
          />
        </label>
        <button
          className="story-editor-tool-button"
          disabled={!assignee.trim()}
          onClick={() => {
            publish("assignment", { slideId: activeSlideId, assignee: assignee.trim() });
            setAssignee("");
          }}
          type="button"
        >
          Assign
        </button>
        <small>{assignedTo ? `Assigned to ${assignedTo}` : "Unassigned"}</small>
      </div>

      <div className="story-editor-collab-comments">
        <strong>Slide {slideNumber} comments</strong>
        {comments.map((event) => (
          <p key={event.id}>
            <span>{String(event.payload.author ?? "Collaborator")}</span>
            {String(event.payload.body ?? "")}
          </p>
        ))}
        <label>
          <span className="sr-only">Add a slide comment</span>
          <input
            onChange={(event) => setComment(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && comment.trim()) {
                publish("comment", {
                  slideId: activeSlideId,
                  author: "Collaborator",
                  body: comment.trim(),
                });
                setComment("");
              }
            }}
            placeholder="Add comment and press Enter"
            value={comment}
          />
        </label>
      </div>

      <div className="story-editor-collab-approval">
        <strong>Approval · {String(approval?.payload.status ?? "draft")}</strong>
        <div>
          <button
            className="story-editor-tool-button"
            onClick={() => publish("approval", { status: "in review" })}
            type="button"
          >
            Request approval
          </button>
          <button
            className="story-editor-tool-button"
            onClick={() => publish("approval", { status: "approved" })}
            type="button"
          >
            Approve
          </button>
          <button
            className="story-editor-tool-button"
            onClick={() => publish("approval", { status: "changes requested" })}
            type="button"
          >
            Request changes
          </button>
        </div>
      </div>

      <div className="story-editor-collab-versions">
        <div>
          <strong>Version history</strong>
          <button
            aria-label="Save project version"
            className="story-editor-tool-button"
            onClick={() => saveVersion("project")}
            type="button"
          >
            Save project
          </button>
          <button
            aria-label={`Save slide ${slideNumber} version`}
            className="story-editor-tool-button"
            onClick={() => saveVersion("slide")}
            type="button"
          >
            Save slide
          </button>
        </div>
        {versions.map((event) => (
          <div className="story-editor-collab-version" key={event.id}>
            <span>
              {String(event.payload.name)} · {new Date(event.createdAt).toLocaleString()}
            </span>
            <button
              className="story-editor-tool-button"
              onClick={() => {
                if (event.payload.snapshot && typeof event.payload.snapshot === "object") {
                  onRestore(event.payload.snapshot as Record<string, unknown>);
                }
              }}
              type="button"
            >
              Restore
            </button>
          </div>
        ))}
      </div>

      <details className="story-editor-collab-brand">
        <summary>
          Brand consistency · {brandIssues.length ? `${brandIssues.length} flags` : "No flags"}
        </summary>
        <label>
          Approved colors
          <input
            onChange={(event) => setGuidelineColors(event.target.value)}
            value={guidelineColors}
          />
        </label>
        <label>
          Approved fonts
          <input
            onChange={(event) => setGuidelineFonts(event.target.value)}
            value={guidelineFonts}
          />
        </label>
        {brandIssues.map((issue) => (
          <small key={issue.id}>{issue.message}</small>
        ))}
      </details>

      <button className="story-editor-tool-button" onClick={onClientPreview} type="button">
        Open client preview
      </button>
      <button className="story-editor-tool-button" onClick={onShareProject} type="button">
        Copy shared project link
      </button>
      <button className="story-editor-tool-button" onClick={onCopyClientPreview} type="button">
        Copy client preview link
      </button>
      {notice ? (
        <p className="story-editor-collab-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? <p className="story-editor-media-error">{error}</p> : null}
    </section>
  );
}
