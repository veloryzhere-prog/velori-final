/* Copyright © 2026 VELORYZ. All rights reserved. */
import { useEffect, useId, useRef, useState } from "react";
import { Music2, Play, Pause, Search, Check, RefreshCw, Bookmark } from "lucide-react";
import { fetchStudioCatalog, type StudioMusicTrack } from "../../lib/studio-catalog";
import { musicExcerpt, musicTimestamp } from "../../lib/music-range";
import type { StudioTarget } from "../../lib/admin-api";
import { useMusicLibrary } from "./useMusicLibrary";
import "./music-picker.css";

function MusicClipSelector({
  track,
  onSelect,
}: {
  track: StudioMusicTrack;
  onSelect: (track: StudioMusicTrack) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(track.durationSeconds);
  const [start, setStart] = useState(track.excerptStartSeconds || 0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const range = musicExcerpt({ ...track, durationSeconds: duration }, start);
  useEffect(() => {
    const player = audio.current;
    return () => {
      player?.pause();
      player?.removeAttribute("src");
      player?.load();
    };
  }, []);
  return (
    <div className="v-music-clip">
      <audio
        ref={audio}
        src={track.audioUrl || undefined}
        preload="metadata"
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onError={() => {
          setError("This track could not load. Select another track or retry.");
          setPlaying(false);
        }}
        onTimeUpdate={(e) => {
          if (range && e.currentTarget.currentTime >= range.end) e.currentTarget.pause();
        }}
      />
      {range ? (
        <>
          <div className="v-music-range-label">
            <span>{musicTimestamp(range.start)}</span>
            <strong>{Number(range.duration.toFixed(1))} seconds</strong>
            <span>{musicTimestamp(range.end)}</span>
          </div>
          <label>
            <span className="v-music-sr">Excerpt start for {track.title}</span>
            <input
              type="range"
              min={range.minStart}
              max={range.maxStart}
              step={0.1}
              value={range.start}
              onChange={(e) => {
                const next = Number(e.target.value);
                setStart(next);
                if (audio.current) audio.current.currentTime = next;
              }}
            />
          </label>
          <div className="v-music-clip-actions">
            <button
              type="button"
              aria-label={`${playing ? "Pause" : "Preview"} excerpt of ${track.title}`}
              onClick={() => {
                const player = audio.current;
                if (!player) return;
                if (!player.paused) {
                  player.pause();
                  return;
                }
                player.currentTime = range.start;
                setError("");
                void player
                  .play()
                  .catch(() =>
                    setError("Playback was blocked. Tap Preview again to enable audio."),
                  );
              }}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />} {playing ? "Pause" : "Preview"}
            </button>
            <button
              type="button"
              className="v-music-confirm"
              onClick={() => {
                audio.current?.pause();
                onSelect({
                  ...track,
                  durationSeconds: duration,
                  excerptStartSeconds: range.start,
                  excerptEndSeconds: range.end,
                });
              }}
            >
              <Check size={17} />
              Use excerpt
            </button>
          </div>
        </>
      ) : (
        <p role="status">Loading the actual track duration…</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function MusicPicker({
  studio,
  selected,
  onSelect,
  loadCatalog = fetchStudioCatalog,
}: {
  loadCatalog?: typeof fetchStudioCatalog;
  studio: StudioTarget;
  selected: StudioMusicTrack | null;
  onSelect: (track: StudioMusicTrack | null) => void;
}) {
  const library = useMusicLibrary();
  const panelId = useId();
  const [view, setView] = useState<"all" | "trending" | "categories" | "saved" | "recent">("all");
  const [genre, setGenre] = useState("");
  const libraryIds = view === "saved" ? library.saved : view === "recent" ? library.recent : null;
  const libraryKey = libraryIds?.join("|") ?? "";
  const [search, setSearch] = useState("");
  const [tracks, setTracks] = useState<StudioMusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  useEffect(() => {
    if (!selected?.id) return;
    const controller = new AbortController();
    void loadCatalog({ studio, trackId: selected.id, limit: 1, signal: controller.signal })
      .then((catalog) => {
        const latest = catalog.music[0],
          current = selectedRef.current;
        if (
          !controller.signal.aborted &&
          latest &&
          current?.id === latest.id &&
          latest.audioUrl !== current.audioUrl
        )
          selectRef.current({ ...current, audioUrl: latest.audioUrl, coverUrl: latest.coverUrl });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [selected?.id, studio, loadCatalog]);
  useEffect(() => {
    const controller = new AbortController();
    const ids = libraryKey ? libraryKey.split("|") : [];
    const isLibrary = view === "saved" || view === "recent";
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        setError("");
        const load = async () => {
          if (!isLibrary)
            return (await loadCatalog({ studio, search, limit: 50, signal: controller.signal }))
              .music;
          if (!library.signedIn || !ids.length) return [];
          let cursor = 0;
          const found: StudioMusicTrack[] = [];
          await Promise.all(
            Array.from({ length: Math.min(4, ids.length) }, async () => {
              while (cursor < ids.length && !controller.signal.aborted) {
                const id = ids[cursor++];
                const catalog = await loadCatalog({
                  studio,
                  trackId: id,
                  limit: 1,
                  signal: controller.signal,
                });
                const track = catalog.music.find((item) => item.id === id);
                if (track) found.push(track);
              }
            }),
          );
          const query = search.trim().toLowerCase();
          return found
            .filter(
              (track) =>
                !query ||
                [track.title, track.artistName, ...track.searchAliases, ...track.tags]
                  .join(" ")
                  .toLowerCase()
                  .includes(query),
            )
            .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        };
        void load()
          .then((rows) => {
            if (!controller.signal.aborted)
              setTracks(rows.filter((track) => Boolean(track.audioUrl)));
          })
          .catch((cause) => {
            if (!controller.signal.aborted) {
              setTracks([]);
              setError(cause instanceof Error ? cause.message : "Music could not be loaded.");
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      search ? 280 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [studio, search, retry, view, libraryKey, library.signedIn, loadCatalog]);
  const visibleTracks = tracks.filter((track) =>
    view === "trending"
      ? track.tags.some((tag) => tag.toLowerCase().trim() === "trending")
      : view === "categories" && genre
        ? track.genre === genre
        : true,
  );
  const genres = [...new Set(tracks.map((track) => track.genre).filter(Boolean))].sort();
  return (
    <section className="v-music-picker" aria-label="Music library">
      <header>
        <Music2 size={22} />
        <div>
          <h2>Find your soundtrack</h2>
          <p>Choose up to 20 seconds from the published catalog.</p>
        </div>
      </header>
      <label className="v-music-search">
        <Search size={18} />
        <input
          type="search"
          aria-label="Search music"
          placeholder="Search tracks or artists"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div
        role="tablist"
        aria-label="Music collections"
        className="v-music-library-tabs"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          const tabs = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
          );
          const index = tabs.indexOf(event.target as HTMLButtonElement);
          if (index < 0) return;
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          event.preventDefault();
          tabs[next].focus();
          tabs[next].click();
        }}
      >
        {(
          [
            ["all", "For You"],
            ["trending", "Trending"],
            ["categories", "Categories"],
            ["saved", "Saved"],
            ["recent", "Recent"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            role="tab"
            id={`${panelId}-${value}`}
            aria-controls={`${panelId}-tracks`}
            aria-selected={view === value}
            tabIndex={view === value ? 0 : -1}
            key={value}
            onClick={() => {
              setView(value);
              setExpanded(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {(view === "saved" || view === "recent") && (
        <p>Saved and recent choices stay on this device for your signed-in account.</p>
      )}
      {view === "all" && <p>Published music available for this editor.</p>}
      {view === "trending" && <p>Tracks marked Trending in the published catalog.</p>}
      {view === "categories" && (
        <label>
          Genre
          <select
            aria-label="Music genre"
            value={genre}
            onChange={(event) => {
              setGenre(event.target.value);
              setExpanded(null);
            }}
          >
            <option value="">All genres</option>
            {genres.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      )}
      {library.notice && <p role="status">{library.notice}</p>}
      {selected && (
        <div className="v-music-selected">
          <Music2 size={18} />
          <span>
            <strong>{selected.title}</strong>
            <small>
              {selected.artistName} · {musicTimestamp(selected.excerptStartSeconds)}–
              {musicTimestamp(selected.excerptEndSeconds ?? selected.durationSeconds ?? 0)}
            </small>
          </span>
          <button type="button" onClick={() => onSelect(null)}>
            Remove
          </button>
        </div>
      )}
      {selected && (
        <label>
          Music volume
          <input
            aria-label="Music volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={selected.volume ?? 0.8}
            onChange={(e) => onSelect({ ...selected, volume: Number(e.target.value) })}
          />
        </label>
      )}
      {loading && <p role="status">Loading music…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}
      {!loading && !error && visibleTracks.length === 0 && (
        <p>
          No published tracks are currently available in this collection
          {search ? " for this search" : ""}.
        </p>
      )}
      <div
        className="v-music-tracks"
        role="tabpanel"
        id={`${panelId}-tracks`}
        aria-labelledby={`${panelId}-${view}`}
      >
        {visibleTracks.map((track) => (
          <article key={track.id}>
            <div className="v-music-track-heading">
              <button
                type="button"
                className="v-music-row"
                aria-expanded={expanded === track.id}
                onClick={() => setExpanded((id) => (id === track.id ? null : track.id))}
              >
                {track.coverUrl ? (
                  <img src={track.coverUrl} alt="" loading="lazy" />
                ) : (
                  <span className="v-music-cover">
                    <Music2 size={22} />
                  </span>
                )}
                <span>
                  <strong>{track.title}</strong>
                  <small>
                    {track.artistName}
                    {track.durationSeconds !== null
                      ? ` · ${musicTimestamp(track.durationSeconds)}`
                      : ""}
                  </small>
                </span>
                {selected?.id === track.id ? <Check size={18} /> : <Play size={18} />}
              </button>
              <button
                type="button"
                className="v-music-save"
                disabled={!library.signedIn}
                aria-pressed={library.saved.includes(track.id)}
                aria-label={`${library.saved.includes(track.id) ? "Unsave" : "Save"} ${track.title}`}
                onClick={() => library.change(track.id, "save")}
              >
                <Bookmark
                  size={18}
                  fill={library.saved.includes(track.id) ? "currentColor" : "none"}
                />
              </button>
            </div>
            {expanded === track.id && (
              <MusicClipSelector
                track={track}
                onSelect={(next) => {
                  onSelect(next);
                  library.change(next.id, "recent");
                  setExpanded(null);
                }}
              />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
