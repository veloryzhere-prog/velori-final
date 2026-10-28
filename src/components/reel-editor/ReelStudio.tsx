import { MusicPicker } from "../studio/MusicPicker";
import { StudioHeader } from "../../product/StudioHeader";
import { CreatorDestinations } from "../CreatorDestinations";
import { ArrowLeft, Undo2, Redo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { createReelAssetFromFile, releaseReelAsset } from "../../lib/reel-editor/assets.ts";
import {
  addAudioClip,
  addCaption,
  addSticker,
  addTextOverlay,
  clipEnd,
  createReelClip,
  createReelProject,
  projectDuration,
  removeClip,
  splitClip,
} from "../../lib/reel-editor/timeline.ts";
import { supportedReelMimeType } from "../../lib/reel-editor/publish.ts";
import { renderReelMp4 } from "../../lib/reel-editor/render-reel.ts";
import { type StudioMusicTrack } from "../../lib/studio-catalog";
import { supabase } from "../../lib/supabase";
import type { ReelAsset } from "../../lib/reel-editor/types.ts";
import ReelCanvas from "./ReelCanvas.tsx";
import ReelInspector from "./ReelInspector.tsx";
import ReelMediaLibrary from "./ReelMediaLibrary.tsx";
import ReelPublishDialog from "./ReelPublishDialog.tsx";
import ReelTimeline from "./ReelTimeline.tsx";
import type { ReelSelection } from "./types.ts";
import { useReelProject } from "./useReelProject.ts";
import "./reel-studio.css";

type PanelTab = "media" | "text" | "stickers" | "music" | "captions";
type MobileSheet = "tools" | "inspector" | null;

const STICKER_GLYPHS = ["✨", "🔥", "💫", "🎬", "🎧", "💬", "❤️", "😂", "👀", "🚀"];

const panelTabs: { id: PanelTab; label: string }[] = [
  { id: "media", label: "Media" },
  { id: "text", label: "Text" },
  { id: "stickers", label: "Stickers" },
  { id: "music", label: "Music" },
  { id: "captions", label: "Captions" },
];

export interface ReelStudioProps {
  userId: string;
  onClose: () => void;
  onPublished?: (reelId: string) => void;
}

export default function ReelStudio({ userId, onClose, onPublished }: ReelStudioProps) {
  const controller = useReelProject(userId, createReelProject());
  const {
    project,
    commit,
    preview,
    beginTransaction,
    undo,
    redo,
    canUndo,
    canRedo,
    saveStatus,
    saveNow,
  } = controller;
  const [selection, setSelection] = useState<ReelSelection>({ kind: "project", id: null });
  const [tab, setTab] = useState<PanelTab>("media");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [guidesOn, setGuidesOn] = useState(false);
  const [loopOn, setLoopOn] = useState(false);
  const [exportState, setExportState] = useState<{
    phase: "idle" | "rendering" | "done" | "error";
    percent: number;
    message?: string;
  }>({ phase: "idle", percent: 0 });
  const [addMusicSticker, setAddMusicSticker] = useState(true);
  const [musicError, setMusicError] = useState("");
  const [renderedDownload, setRenderedDownload] = useState<{ url: string; name: string } | null>(
    null,
  );
  useEffect(
    () => () => {
      if (renderedDownload) URL.revokeObjectURL(renderedDownload.url);
    },
    [renderedDownload],
  );
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const timeRef = useRef(0);
  const seekRevision = useRef(0);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const [time, setTime] = useState(0);
  const duration = projectDuration(project);
  const assets = Object.values(project.assets);

  const seek = useCallback(
    (seconds: number) => {
      const next = Math.max(
        0,
        Math.min(projectDuration(project), Number.isFinite(seconds) ? seconds : 0),
      );
      seekRevision.current += 1;
      timeRef.current = next;
      setTime(next);
    },
    [project],
  );

  useEffect(() => {
    if (timeRef.current > duration) seek(duration);
    if (duration <= 0) setPlaying(false);
  }, [duration, seek]);

  const importFiles = useCallback(
    async (files: File[]) => {
      setImporting(true);
      setImportError("");
      try {
        const created: ReelAsset[] = [];
        for (const file of files) {
          try {
            created.push(await createReelAssetFromFile(file));
          } catch (cause) {
            setImportError(
              cause instanceof Error ? cause.message : "A file could not be imported.",
            );
          }
        }
        if (!created.length) return;
        commit((current) => {
          const next = { ...current.assets };
          for (const asset of created) next[asset.id] = asset;
          return { ...current, assets: next };
        });
      } finally {
        setImporting(false);
      }
    },
    [commit],
  );

  const addToTimeline = useCallback(
    (assetId: string) => {
      commit((current) => {
        const asset = current.assets[assetId];
        if (!asset || asset.kind === "audio") return current;
        const start = current.clips.length
          ? Math.max(...current.clips.map((item) => clipEnd(item)))
          : 0;
        const clip = createReelClip(asset, start);
        return { ...current, clips: [...current.clips, clip] };
      });
    },
    [commit],
  );

  const addToAudioTrack = useCallback(
    (assetId: string) => {
      commit((current) => {
        const asset = current.assets[assetId];
        if (!asset) return current;
        const result = addAudioClip(current, {
          assetId,
          sourceIn: 0,
          sourceOut: asset.durationSeconds,
          startSeconds: 0,
        });
        return result.project;
      });
    },
    [commit],
  );

  const removeAsset = useCallback(
    (assetId: string) => {
      commit((current) => {
        const asset = current.assets[assetId];
        const next = { ...current.assets };
        delete next[assetId];
        return {
          ...current,
          assets: next,
          clips: current.clips.filter((clip) => clip.assetId !== assetId),
          audio: current.audio.filter((clip) => clip.assetId !== assetId),
        };
      });
      const asset = project.assets[assetId];
      releaseReelAsset(asset);
    },
    [commit, project.assets],
  );

  const splitSelected = useCallback(() => {
    if (selection.kind !== "clip") return;
    commit((current) => splitClip(current, selection.id, timeRef.current).project);
  }, [commit, selection]);

  /** Renders the edited reel in-browser and downloads the real MP4. */
  const runExport = useCallback(async () => {
    if (!project.clips.length || exportState.phase === "rendering") return;
    const mimeType = supportedReelMimeType();
    if (!mimeType) {
      setExportState({
        phase: "error",
        percent: 0,
        message:
          "This browser cannot record MP4, so export is unavailable here. Use Chrome, Edge, or Safari.",
      });
      return;
    }
    setExportState({ phase: "rendering", percent: 0 });
    try {
      const result = await renderReelMp4(project, {
        mimeType,
        frameRate: 30,
        onProgress: (percent) =>
          setExportState((current) =>
            current.phase === "rendering" ? { ...current, percent } : current,
          ),
      });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const base = (project.name || "velori-reel").replace(/[^\w\- ]+/g, "").trim();
      anchor.download = `${base || "velori-reel"}.mp4`;
      anchor.click();
      setRenderedDownload({ url, name: anchor.download });
      setExportState({
        phase: "done",
        percent: 100,
        message: `Rendered ${(result.blob.size / (1024 * 1024)).toFixed(1)} MB${
          result.includedAudio ? "" : " · no audio in this reel"
        }.`,
      });
    } catch (cause) {
      setExportState({
        phase: "error",
        percent: 0,
        message: cause instanceof Error ? cause.message : "The export failed.",
      });
    }
  }, [exportState.phase, project]);

  /** Imports an audio file and places it on the audio track in one step. */
  const attachAudioAsset = useCallback(
    async (
      file: File,
      excerptStart?: number,
      excerptEnd?: number,
      catalogTrack?: StudioMusicTrack,
    ) => {
      try {
        const asset = await createReelAssetFromFile(file);
        if (catalogTrack) asset.catalogTrackId = catalogTrack.id;
        // Catalog music is a 20-second selectable excerpt. Imported voiceovers
        // keep their full recorded duration unless explicitly trimmed.
        const safeStart =
          excerptStart === undefined
            ? 0
            : Math.min(Math.max(0, excerptStart), Math.max(0, asset.durationSeconds - 0.1));
        const safeEnd =
          excerptStart === undefined
            ? asset.durationSeconds
            : Math.min(asset.durationSeconds, excerptEnd ?? safeStart + 20, safeStart + 20);
        commit((current) => {
          const withAsset: typeof current = {
            ...current,
            assets: { ...current.assets, [asset.id]: asset },
          };
          return addAudioClip(withAsset, {
            assetId: asset.id,
            sourceIn: safeStart,
            sourceOut: safeEnd,
            startSeconds: 0,
            volume: catalogTrack?.volume ?? 1,
          }).project;
        });
        return true;
      } catch (cause) {
        setImportError(
          cause instanceof Error ? cause.message : "The audio file could not be added.",
        );
        return false;
      }
    },
    [commit],
  );

  const toggleVoiceover = useCallback(async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    setRecordError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        setRecording(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) {
          setRecordError("The recording was empty. Try again.");
          return;
        }
        const extension = (recorder.mimeType || "").includes("mp4") ? "m4a" : "webm";
        const stamp = new Date().toLocaleTimeString().replace(/[:.]/g, "-");
        await attachAudioAsset(
          new File([blob], `Voiceover ${stamp}.${extension}`, { type: blob.type }),
        );
      };
      recorder.start();
      setRecording(true);
    } catch {
      setRecordError(
        "Microphone permission was denied or recording is unavailable. Allow the microphone to record a voiceover.",
      );
    }
  }, [attachAudioAsset, recording]);

  const attachCatalogTrack = useCallback(
    async (track: StudioMusicTrack) => {
      if (!track.audioUrl) return;
      setMusicError("");
      try {
        const response = await fetch(track.audioUrl);
        if (!response.ok) throw new Error("This track could not be downloaded.");
        const blob = await response.blob();
        const type = blob.type || "audio/mpeg";
        const extension = type.includes("wav")
          ? "wav"
          : type.includes("ogg")
            ? "ogg"
            : type.includes("mp4")
              ? "m4a"
              : "mp3";
        const label = `${track.artistName} - ${track.title}`
          .replace(/[^\w\-. ]+/g, "")
          .trim()
          .slice(0, 80);
        const added = await attachAudioAsset(
          new File([blob], `${label || "Music track"}.${extension}`, { type }),
          track.excerptStartSeconds ?? 0,
          track.excerptEndSeconds ?? undefined,
          track,
        );
        if (added && addMusicSticker) {
          commit(
            (current) =>
              addSticker(current, {
                glyph: "🎵",
                x: 0.5,
                y: 0.82,
                scale: 0.8,
                startSeconds: 0,
                endSeconds: Math.min(20, Math.max(2, projectDuration(current))),
              }).project,
          );
        }
      } catch (cause) {
        setMusicError(cause instanceof Error ? cause.message : "This track could not be added.");
      }
    },
    [attachAudioAsset, addMusicSticker, commit],
  );

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCreatorName(data?.display_name || data?.username || null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const deleteSelection = useCallback(() => {
    if (selection.kind === "clip") {
      commit((current) => removeClip(current, selection.id));
      setSelection({ kind: "project", id: null });
      return;
    }
    if (selection.kind === "text") {
      commit((current) => ({
        ...current,
        texts: current.texts.filter((item) => item.id !== selection.id),
      }));
      setSelection({ kind: "project", id: null });
      return;
    }
    if (selection.kind === "sticker") {
      commit((current) => ({
        ...current,
        stickers: current.stickers.filter((item) => item.id !== selection.id),
      }));
      setSelection({ kind: "project", id: null });
      return;
    }
    if (selection.kind === "caption") {
      commit((current) => ({
        ...current,
        captions: current.captions.filter((item) => item.id !== selection.id),
      }));
      setSelection({ kind: "project", id: null });
    }
  }, [commit, selection]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNow();
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((value) => !value);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
        return;
      }
      if (event.key.toLowerCase() === "s" && selection.kind === "clip") {
        event.preventDefault();
        splitSelected();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        seek(Math.max(0, timeRef.current - 1 / 30));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        seek(Math.min(duration, timeRef.current + 1 / 30));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commit, deleteSelection, duration, redo, saveNow, seek, selection, splitSelected, undo]);

  const [focusCanvas, setFocusCanvas] = useState(false);
  const audioAssets = assets.filter((asset) => asset.kind === "audio");

  const canvasProps = {
    seekRevision,
    project,
    timeRef,
    playing,
    onPlayingChange: setPlaying,
    onSeek: seek,
    onTimeTick: setTime,
    playheadRef,
    muted,
    onMutedChange: setMuted,
    selection,
    onSelect: setSelection,
    onPreview: preview,
    onBeginTransaction: beginTransaction,
    showSafeZones: guidesOn,
    onToggleSafeZones: () => setGuidesOn((value) => !value),
    loop: loopOn,
    onLoopChange: setLoopOn,
    currentTime: time,
  };

  return (
    <div className="reel-studio" data-design="editorial-2026" data-focus-canvas={focusCanvas}>
      <div className="reel-studio-header-group">
        <StudioHeader
          className="reel-studio-topbar"
          back={
            <button
              type="button"
              className="reel-icon-button"
              onClick={onClose}
              aria-label="Leave the reel studio"
            >
              <ArrowLeft size={16} />
            </button>
          }
          title={
            <div className="reel-studio-project">
              <span className="reel-studio-kicker">VELORI / REELS</span>
              <input
                className="reel-studio-name"
                value={project.name}
                aria-label="Reel name"
                onChange={(event) =>
                  commit((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
          }
          status={
            <span className="reel-studio-save" data-status={saveStatus} role="status">
              {saveStatus === "saved"
                ? "All changes saved"
                : saveStatus === "saving"
                  ? "Saving…"
                  : "Unsaved changes"}
            </span>
          }
          actions={
            <div className="reel-studio-actions">
              <button
                type="button"
                className="reel-button"
                aria-pressed={focusCanvas}
                onClick={() => setFocusCanvas(!focusCanvas)}
              >
                {focusCanvas ? "Back to editing" : "Focus canvas"}
              </button>
              <Link className="reel-button" to="/create" aria-label="Open the Post Studio">
                Post Studio
              </Link>
              <button
                type="button"
                className="reel-button"
                onClick={undo}
                disabled={!canUndo}
                aria-label="Undo"
              >
                <Undo2 size={16} />
              </button>
              <button
                type="button"
                className="reel-button"
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
              >
                <Redo2 size={16} />
              </button>
              <button
                type="button"
                className="reel-button"
                onClick={() => void saveNow()}
                aria-label="Save the reel draft now"
              >
                Save
              </button>
              <button
                type="button"
                className="reel-button reel-action-preview"
                onClick={() => setPreviewOpen(true)}
                disabled={!project.clips.length}
              >
                Preview
              </button>
              <button
                type="button"
                className="reel-button"
                onClick={() => void runExport()}
                disabled={!project.clips.length || exportState.phase === "rendering"}
                aria-label="Export the edited reel as an MP4"
              >
                {exportState.phase === "rendering" ? `Exporting ${exportState.percent}%` : "Export"}
              </button>
              <button
                type="button"
                className="reel-button reel-button-primary"
                onClick={() => setPublishOpen(true)}
                disabled={!project.clips.length}
              >
                Publish
              </button>
            </div>
          }
        />
        {exportState.message ? (
          <p
            className="reel-export-note"
            data-phase={exportState.phase}
            role={exportState.phase === "error" ? "alert" : "status"}
          >
            {exportState.message}
            {renderedDownload && exportState.phase === "done" && (
              <a
                className="reel-button"
                href={renderedDownload.url}
                download={renderedDownload.name}
              >
                Download rendered video
              </a>
            )}
          </p>
        ) : null}

        <CreatorDestinations />
      </div>
      <div className="reel-studio-body">
        <aside
          className={`reel-studio-panel reel-studio-panel-left${
            mobileSheet === "tools" ? " is-mobile-open" : ""
          }`}
          aria-label="Creation tools"
        >
          <nav className="reel-studio-tabs" role="tablist" aria-label="Reel tools">
            {panelTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`reel-studio-tab${tab === item.id ? " is-active" : ""}`}
                onClick={() => {
                  setTab(item.id);
                  setMobileSheet("tools");
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="reel-studio-panel-body">
            {tab === "media" ? (
              <ReelMediaLibrary
                assets={assets}
                busy={importing}
                error={importError}
                onImport={(files) => void importFiles(files)}
                onAddToTimeline={addToTimeline}
                onAddToAudio={addToAudioTrack}
                onRemove={removeAsset}
              />
            ) : null}

            {tab === "text" ? (
              <div className="reel-tool-list">
                <button
                  type="button"
                  className="reel-button reel-button-primary"
                  onClick={() => {
                    const result = addTextOverlay(project, { startSeconds: timeRef.current });
                    commit(result.project);
                    setSelection({ kind: "text", id: result.id });
                  }}
                >
                  Add text layer
                </button>
                {project.texts.length ? (
                  <ul className="reel-asset-list">
                    {project.texts.map((overlay) => (
                      <li key={overlay.id}>
                        <button
                          type="button"
                          className="reel-list-button"
                          onClick={() => setSelection({ kind: "text", id: overlay.id })}
                        >
                          {overlay.text.slice(0, 26) || "Empty text"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="reel-empty-note">No text layers yet.</p>
                )}
              </div>
            ) : null}

            {tab === "stickers" ? (
              <div className="reel-tool-list">
                <div className="reel-sticker-grid">
                  {STICKER_GLYPHS.map((glyph) => (
                    <button
                      key={glyph}
                      type="button"
                      className="reel-sticker-button"
                      onClick={() => {
                        const result = addSticker(project, {
                          glyph,
                          startSeconds: timeRef.current,
                        });
                        commit(result.project);
                        setSelection({ kind: "sticker", id: result.id });
                      }}
                      aria-label={`Add the ${glyph} sticker`}
                    >
                      {glyph}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === "music" ? (
              <div className="reel-tool-list">
                <div className="reel-music-section">
                  <span className="reel-section-label">Voiceover</span>
                  <button
                    type="button"
                    className={`reel-button ${recording ? "reel-button-danger" : "reel-button-primary"}`}
                    onClick={() => void toggleVoiceover()}
                    aria-pressed={recording}
                  >
                    {recording ? "Stop recording" : "Record voiceover"}
                  </button>
                  {recording ? <p className="reel-empty-note">Recording — speak now.</p> : null}
                  {recordError ? (
                    <p className="reel-inline-error" role="alert">
                      {recordError}
                    </p>
                  ) : null}
                </div>
                <div className="reel-music-section">
                  <label className="reel-music-sticker-toggle">
                    <input
                      type="checkbox"
                      checked={addMusicSticker}
                      onChange={(event) => setAddMusicSticker(event.target.checked)}
                    />
                    Add a movable music sticker
                  </label>
                  {musicError && <p role="alert">{musicError}</p>}
                  <MusicPicker
                    studio="reel"
                    selected={null}
                    onSelect={(track) => {
                      if (track) void attachCatalogTrack(track);
                    }}
                  />
                </div>
                <div className="reel-music-section">
                  <span className="reel-section-label">Imported audio</span>
                  {audioAssets.length ? (
                    <ul className="reel-asset-list">
                      {audioAssets.map((asset) => (
                        <li key={asset.id} className="reel-asset-row">
                          <span className="reel-asset-meta">
                            <span className="reel-asset-name">{asset.name}</span>
                          </span>
                          <span className="reel-asset-actions">
                            <button
                              type="button"
                              className="reel-icon-button"
                              onClick={() => addToAudioTrack(asset.id)}
                              aria-label={`Add ${asset.name} to the audio track`}
                            >
                              +
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="reel-empty-note">
                      Import an audio file in the Media tab to add music to your reel.
                    </p>
                  )}
                  {project.audio.length ? (
                    <ul className="reel-asset-list">
                      {project.audio.map((clip) => (
                        <li key={clip.id}>
                          <button
                            type="button"
                            className="reel-list-button"
                            onClick={() => setSelection({ kind: "audio", id: clip.id })}
                          >
                            {project.assets[clip.assetId]?.name ?? "Track"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}

            {tab === "captions" ? (
              <div className="reel-tool-list">
                <button
                  type="button"
                  className="reel-button reel-button-primary"
                  onClick={() => {
                    const result = addCaption(project, { startSeconds: timeRef.current });
                    commit(result.project);
                    setSelection({ kind: "caption", id: result.id });
                  }}
                >
                  Add caption
                </button>
                <p className="reel-empty-note reel-unavailable-note">
                  Automatic captions are unavailable — no transcription service is connected to this
                  VELORI instance. Add timed captions manually below.
                </p>
                {project.captions.length ? (
                  <ul className="reel-asset-list">
                    {project.captions.map((caption) => (
                      <li key={caption.id}>
                        <button
                          type="button"
                          className="reel-list-button"
                          onClick={() => setSelection({ kind: "caption", id: caption.id })}
                        >
                          {caption.text.slice(0, 30)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="reel-empty-note">No captions yet.</p>
                )}
              </div>
            ) : null}
          </div>
        </aside>

        <main className="reel-studio-stage">
          {previewOpen ? (
            <div className="reel-fullscreen" role="dialog" aria-label="Reel preview">
              <button
                type="button"
                className="reel-button reel-fullscreen-close"
                onClick={() => {
                  setPreviewOpen(false);
                  setPlaying(false);
                }}
              >
                Close preview
              </button>
              <div className="reel-preview-frame">
                <ReelCanvas {...canvasProps} />
                <div className="reel-preview-chrome">
                  <div className="reel-preview-profile">
                    <span className="reel-preview-avatar" aria-hidden="true">
                      {(creatorName ?? "V").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="reel-preview-names">
                      <strong>{creatorName ?? "VELORI creator"}</strong>
                      <small>{project.name}</small>
                    </span>
                  </div>
                  <div className="reel-preview-actions" aria-hidden="true">
                    <span>♥</span>
                    <span>💬</span>
                    <span>↗</span>
                    <span>🔖</span>
                  </div>
                </div>
                <div className="reel-preview-progress" aria-hidden="true">
                  <span
                    style={{
                      width: `${duration ? Math.min(100, (time / duration) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <ReelCanvas {...canvasProps} />
          )}
        </main>

        <aside
          className={`reel-studio-panel reel-studio-panel-right${
            mobileSheet === "inspector" ? " is-mobile-open" : ""
          }`}
          aria-label="Properties inspector"
        >
          <ReelInspector
            project={project}
            selection={selection}
            currentTime={time}
            onChange={commit}
            onSelect={setSelection}
          />
        </aside>
      </div>

      <ReelTimeline
        project={project}
        timeRef={timeRef}
        playheadRef={playheadRef}
        selection={selection}
        pixelsPerSecond={70}
        currentTime={time}
        onSelect={setSelection}
        onSeek={seek}
        onPreview={preview}
        onBeginTransaction={beginTransaction}
        onSplit={splitSelected}
        onDelete={deleteSelection}
      />

      <nav className="reel-studio-mobilebar" aria-label="Reel studio panels">
        <button
          type="button"
          className="reel-studio-tab"
          onClick={() => setMobileSheet(mobileSheet === "tools" ? null : "tools")}
          aria-pressed={mobileSheet === "tools"}
        >
          Tools
        </button>
        <button
          type="button"
          className="reel-studio-tab"
          onClick={() => setMobileSheet(mobileSheet === "inspector" ? null : "inspector")}
          aria-pressed={mobileSheet === "inspector"}
        >
          Properties
        </button>
        <button
          type="button"
          className="reel-studio-tab"
          onClick={() => setPublishOpen(true)}
          disabled={!project.clips.length}
        >
          Publish
        </button>
      </nav>

      {mobileSheet ? (
        <button
          type="button"
          className="reel-scrim"
          aria-label="Close the panel"
          onClick={() => setMobileSheet(null)}
        />
      ) : null}

      {publishOpen ? (
        <ReelPublishDialog
          project={project}
          userId={userId}
          onClose={() => setPublishOpen(false)}
          onPublished={(reelId) => {
            setPublishOpen(false);
            onPublished?.(reelId);
          }}
        />
      ) : null}
    </div>
  );
}
