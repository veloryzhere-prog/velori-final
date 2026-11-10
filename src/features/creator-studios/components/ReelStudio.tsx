import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "./Shared";
import { type ReelDraft, initialReel, uid, clamp, formatTime, MAX_FILE_BYTES } from "../models";
import { fileToDataUrl } from "../services/media";

export function ReelStudio({
  draft,
  setDraft,
  setError,
}: {
  draft: ReelDraft;
  setDraft: Dispatch<SetStateAction<ReelDraft>>;
  setError: (error?: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [captionText, setCaptionText] = useState("");

  // React does not support the `volume` DOM prop; apply it imperatively so
  // the preview keeps honoring the draft's volume slider.
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.volume = clamp(draft.volume, 0, 1);
  }, [draft.volume, draft.source]);

  const uploadVideo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) return setError("Choose a video file for Reel Studio.");
    if (file.size > MAX_FILE_BYTES)
      return setError("That video is larger than 80 MB. Use a shorter or compressed sample.");
    try {
      const source = await fileToDataUrl(file);
      setDraft({ ...initialReel, source, fileName: file.name });
      setCurrentTime(0);
      setError();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Video upload failed.");
    }
  };

  const seek = (time: number) => {
    const next = clamp(time, draft.trimStart, draft.trimEnd || draft.duration);
    setCurrentTime(next);
    if (videoRef.current) videoRef.current.currentTime = next;
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < draft.trimStart || video.currentTime >= draft.trimEnd)
        video.currentTime = draft.trimStart;
      try {
        await video.play();
      } catch {
        setError("Playback could not start in this browser.");
      }
    } else video.pause();
  };

  const selectCover = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth)
      return setError("Play or seek the video before selecting a cover.");
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth, 720);
    canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setDraft((value) => ({
      ...value,
      cover: canvas.toDataURL("image/jpeg", 0.82),
    }));
    setError();
  };

  const addCaption = () => {
    const text = captionText.trim();
    if (!text || !draft.source || currentTime >= draft.trimEnd) return;
    setDraft((value) => ({
      ...value,
      captions: [
        ...value.captions,
        {
          id: uid(),
          text,
          start: currentTime,
          end: Math.min(value.trimEnd, currentTime + 3),
        },
      ],
    }));
    setCaptionText("");
  };

  const activeCaption = draft.captions.find(
    (item) => currentTime >= item.start && currentTime <= item.end,
  );
  const segmentPoints = [draft.trimStart, ...draft.splits, draft.trimEnd]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  return (
    <div className="studio-layout reel-layout">
      <section className="studio-panel tools-panel">
        <div className="panel-section">
          <span className="panel-label">SOURCE VIDEO</span>
          <Button variant="soft" onClick={() => inputRef.current?.click()}>
            {draft.source ? "Replace video" : "Upload video"}
          </Button>
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept="video/*"
            onChange={uploadVideo}
          />
          {draft.fileName && <small className="file-name">{draft.fileName}</small>}
        </div>
        <div className="panel-section">
          <span className="panel-label">OVERLAY</span>
          <label className="field-label">
            Text
            <input
              value={draft.overlayText}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  overlayText: event.target.value,
                }))
              }
              placeholder="Add title text"
            />
          </label>
          <label className="field-label">
            Horizontal position
            <input
              type="range"
              min="5"
              max="95"
              value={draft.overlayX}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  overlayX: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="field-label">
            Vertical position
            <input
              type="range"
              min="5"
              max="95"
              value={draft.overlayY}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  overlayY: Number(event.target.value),
                }))
              }
            />
          </label>
        </div>
        <div className="panel-section">
          <span className="panel-label">AUDIO</span>
          <label className="field-label">
            Volume
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={draft.volume}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  volume: Number(event.target.value),
                  muted: false,
                }))
              }
            />
          </label>
          <Button onClick={() => setDraft((value) => ({ ...value, muted: !value.muted }))}>
            {draft.muted ? "Unmute" : "Mute"}
          </Button>
        </div>
      </section>

      <section className="studio-workspace">
        <div className="workspace-toolbar">
          <span>
            {formatTime(currentTime)} / {formatTime(draft.duration)}
          </span>
          <span>{playing ? "Playing" : "Paused"}</span>
        </div>
        <div className="reel-editor-frame">
          {draft.source ? (
            <>
              <video
                ref={videoRef}
                src={draft.source}
                playsInline
                onLoadedMetadata={(event) => {
                  const duration = event.currentTarget.duration;
                  setDraft((value) => ({
                    ...value,
                    duration,
                    trimEnd:
                      value.duration === 0 || value.trimEnd === 0
                        ? duration
                        : Math.min(value.trimEnd, duration),
                    trimStart: Math.min(value.trimStart, Math.max(0, duration - 0.1)),
                  }));
                }}
                onTimeUpdate={(event) => {
                  const time = event.currentTarget.currentTime;
                  setCurrentTime(time);
                  if (draft.trimEnd && time >= draft.trimEnd) {
                    event.currentTarget.pause();
                    event.currentTarget.currentTime = draft.trimStart;
                  }
                }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                muted={draft.muted}
              />
              {draft.overlayText && (
                <span
                  className="reel-overlay"
                  style={{
                    left: `${draft.overlayX}%`,
                    top: `${draft.overlayY}%`,
                  }}
                >
                  {draft.overlayText}
                </span>
              )}
              {activeCaption && <span className="reel-caption">{activeCaption.text}</span>}
              <button
                className="video-play-control"
                onClick={togglePlayback}
                aria-label={playing ? "Pause video" : "Play video"}
              >
                {playing ? "Ⅱ" : "▶"}
              </button>
            </>
          ) : (
            <button className="video-empty" onClick={() => inputRef.current?.click()}>
              <strong>Upload a video to begin</strong>
              <span>MP4, WebM, or another browser-supported format · up to 80 MB</span>
            </button>
          )}
        </div>
        <div className="timeline-panel">
          <div className="timeline-ruler">
            {segmentPoints.slice(0, -1).map((start, index) => {
              const end = segmentPoints[index + 1];
              return (
                <span
                  key={`${start}-${end}`}
                  style={{
                    left: `${(start / (draft.duration || 1)) * 100}%`,
                    width: `${((end - start) / (draft.duration || 1)) * 100}%`,
                  }}
                >
                  Clip {index + 1}
                </span>
              );
            })}
            {draft.splits.map((split) => (
              <i key={split} style={{ left: `${(split / (draft.duration || 1)) * 100}%` }} />
            ))}
          </div>
          <input
            aria-label="Timeline playhead"
            type="range"
            min={draft.trimStart}
            max={draft.trimEnd || 0}
            step="0.01"
            value={currentTime}
            disabled={!draft.source}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <div className="trim-grid">
            <label>
              In{" "}
              <input
                type="number"
                min="0"
                max={draft.trimEnd}
                step="0.1"
                value={draft.trimStart.toFixed(1)}
                onChange={(event) => {
                  const next = clamp(Number(event.target.value), 0, draft.trimEnd - 0.1);
                  setDraft((value) => ({
                    ...value,
                    trimStart: next,
                    splits: value.splits.filter((time) => time > next),
                  }));
                  seek(next);
                }}
              />
            </label>
            <label>
              Out{" "}
              <input
                type="number"
                min={draft.trimStart}
                max={draft.duration}
                step="0.1"
                value={draft.trimEnd.toFixed(1)}
                onChange={(event) =>
                  setDraft((value) => {
                    const next = clamp(
                      Number(event.target.value),
                      value.trimStart + 0.1,
                      value.duration,
                    );
                    return {
                      ...value,
                      trimEnd: next,
                      splits: value.splits.filter((time) => time < next),
                    };
                  })
                }
              />
            </label>
          </div>
          <div className="inline-controls">
            <Button onClick={togglePlayback} disabled={!draft.source}>
              {playing ? "Pause" : "Play"}
            </Button>
            <Button
              onClick={() =>
                setDraft((value) => {
                  const minimumGap = Math.min(0.05, Math.max(0.002, value.duration / 20));
                  if (
                    currentTime <= value.trimStart + minimumGap ||
                    currentTime >= value.trimEnd - minimumGap ||
                    value.splits.some((item) => Math.abs(item - currentTime) < minimumGap)
                  )
                    return value;
                  return {
                    ...value,
                    splits: [...value.splits, currentTime].sort((a, b) => a - b),
                  };
                })
              }
              disabled={!draft.source}
            >
              Split at playhead
            </Button>
            <Button
              onClick={() => setDraft((value) => ({ ...value, splits: [] }))}
              disabled={!draft.splits.length}
            >
              Clear splits
            </Button>
          </div>
        </div>
      </section>

      <aside className="studio-panel preview-panel">
        <span className="panel-label">REEL DETAILS</span>
        <div className="panel-section">
          <label className="field-label">
            Timed caption
            <input
              value={captionText}
              onChange={(event) => setCaptionText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addCaption();
              }}
              placeholder={`Start at ${formatTime(currentTime)}`}
            />
          </label>
          <Button variant="soft" onClick={addCaption}>
            Add caption
          </Button>
          <div className="caption-list">
            {draft.captions.map((caption) => (
              <div key={caption.id}>
                <button onClick={() => seek(caption.start)}>
                  <strong>{caption.text}</strong>
                  <small>
                    {formatTime(caption.start)}–{formatTime(caption.end)}
                  </small>
                </button>
                <button
                  aria-label={`Delete caption ${caption.text}`}
                  onClick={() =>
                    setDraft((value) => ({
                      ...value,
                      captions: value.captions.filter((item) => item.id !== caption.id),
                    }))
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="panel-section">
          <span className="panel-label">COVER</span>
          {draft.cover ? (
            <img className="cover-preview" src={draft.cover} alt="Selected Reel cover" />
          ) : (
            <div className="cover-placeholder">Seek to a frame, then select it.</div>
          )}
          <Button onClick={selectCover} disabled={!draft.source}>
            Use current frame
          </Button>
        </div>
        <label className="field-label">
          Post caption
          <textarea
            value={draft.caption}
            onChange={(event) => setDraft((value) => ({ ...value, caption: event.target.value }))}
            placeholder="Write a caption…"
          />
        </label>
      </aside>
    </div>
  );
}
