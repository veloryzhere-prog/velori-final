import { PostMusicPreview } from "../../../components/studio/PostMusicPreview";
import { MusicPicker } from "../../../components/studio/MusicPicker";
import { PostLayerControls } from "./PostLayerControls";
import { PostTemplates } from "./PostTemplates";
import { PostPreviewActions } from "./PostPreviewActions";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { defaultPostPublishSettings } from "../services/publishing";
import { Button } from "./Shared";
import { type Layer, type PostDraft, initialSlide, uid, clamp, MAX_FILE_BYTES } from "../models";
import { fileToDataUrl } from "../services/media";
import { useHistory } from "../hooks/useHistory";

function LayerCanvas({
  draft,
  replace,
  commit,
  checkpoint,
}: {
  draft: PostDraft;
  replace: (updater: (draft: PostDraft) => PostDraft) => void;
  commit: (updater: (draft: PostDraft) => PostDraft) => void;
  checkpoint: (snapshot: PostDraft) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(570);
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => setCanvasWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const draftRef = useRef(draft);
  const gesture = useRef<
    | {
        layerId: string;
        mode: "move" | "resize";
        x: number;
        y: number;
        layer: Layer;
        snapshot: PostDraft;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const slide = draft.slides.find((item) => item.id === draft.activeSlideId) ?? draft.slides[0];

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = gesture.current;
      const canvas = canvasRef.current;
      if (!current || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = ((event.clientX - current.x) / rect.width) * 100;
      const dy = ((event.clientY - current.y) / rect.height) * 100;
      replace((value) => ({
        ...value,
        slides: value.slides.map((item) =>
          item.id !== value.activeSlideId
            ? item
            : {
                ...item,
                layers: item.layers.map((layer) => {
                  if (layer.id !== current.layerId) return layer;
                  if (current.mode === "move") {
                    return {
                      ...layer,
                      x: clamp(current.layer.x + dx, 0, 100 - layer.width),
                      y: clamp(current.layer.y + dy, 0, 100 - layer.height),
                    };
                  }
                  return {
                    ...layer,
                    width: clamp(current.layer.width + dx, 8, 100 - layer.x),
                    height: clamp(current.layer.height + dy, 8, 100 - layer.y),
                  };
                }),
              },
        ),
      }));
    };
    const up = () => {
      if (gesture.current) checkpoint(gesture.current.snapshot);
      gesture.current = undefined;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [checkpoint, replace]);

  const startGesture = (event: ReactPointerEvent, layer: Layer, mode: "move" | "resize") => {
    if (layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.current = {
      layerId: layer.id,
      mode,
      x: event.clientX,
      y: event.clientY,
      layer,
      snapshot: draftRef.current,
    };
    replace((value) => ({ ...value, selectedLayerId: layer.id }));
  };

  const nudge = (event: KeyboardEvent, layer: Layer) => {
    const direction: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (!direction[event.key] || layer.locked) return;
    event.preventDefault();
    const [dx, dy] = direction[event.key];
    commit((value) => ({
      ...value,
      slides: value.slides.map((item) =>
        item.id !== value.activeSlideId
          ? item
          : {
              ...item,
              layers: item.layers.map((entry) =>
                entry.id === layer.id
                  ? {
                      ...entry,
                      x: clamp(entry.x + dx, 0, 100 - entry.width),
                      y: clamp(entry.y + dy, 0, 100 - entry.height),
                    }
                  : entry,
              ),
            },
      ),
    }));
  };

  return (
    <div
      ref={canvasRef}
      className="post-canvas"
      style={{ background: slide.background }}
      onPointerDown={() => replace((value) => ({ ...value, selectedLayerId: undefined }))}
      aria-label="Editable post canvas"
    >
      {slide.layers.map((layer) => (
        <div
          key={layer.id}
          className={`canvas-layer ${draft.selectedLayerId === layer.id ? "selected" : ""}`}
          style={{
            left: `${layer.x}%`,
            top: `${layer.y}%`,
            width: `${layer.width}%`,
            height: `${layer.height}%`,
            opacity: layer.opacity,
            transform: `rotate(${layer.rotation ?? 0}deg)`,
            cursor: layer.locked ? "default" : "move",
          }}
          tabIndex={0}
          role="button"
          aria-label={`${layer.name} layer. Use arrow keys to move.`}
          onKeyDown={(event) => nudge(event, layer)}
          onPointerDown={(event) => startGesture(event, layer, "move")}
        >
          {layer.kind === "image" ? (
            <img src={layer.src} alt="" draggable={false} />
          ) : (
            <span
              style={{
                color: layer.color,
                fontSize: `${((layer.fontSize ?? 20) * canvasWidth) / 570}px`,
                fontFamily: layer.fontFamily ?? "Manrope",
                fontWeight: layer.fontWeight ?? 800,
                textAlign: layer.textAlign ?? "center",
                width: "100%",
              }}
            >
              {layer.text}
            </span>
          )}
          {draft.selectedLayerId === layer.id && !layer.locked && (
            <button
              className="resize-handle"
              aria-label={`Resize ${layer.name}`}
              onPointerDown={(event) => startGesture(event, layer, "resize")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function PostStudio({
  history,
  setError,
  stage,
  onStageChange,
}: {
  stage: "media" | "edit" | "publish";
  onStageChange: (stage: "media" | "edit" | "publish") => void;
  history: ReturnType<typeof useHistory<PostDraft>>;
  setError: (error?: string) => void;
}) {
  const { present: draft, commit, replace, checkpoint, undo, redo, canUndo, canRedo } = history;
  const { user } = useAuth();
  const [creatorName, setCreatorName] = useState("Your post");
  useEffect(() => {
    let active = true;
    if (user)
      void supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (active && data) setCreatorName(data.username);
        });
    return () => {
      active = false;
    };
  }, [user?.id]);
  const publishSettings = draft.settings ?? defaultPostPublishSettings;
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(280);
  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => setPreviewWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const uploadRef = useRef<HTMLInputElement>(null);
  const slide = draft.slides.find((item) => item.id === draft.activeSlideId) ?? draft.slides[0];
  const selected = slide.layers.find((item) => item.id === draft.selectedLayerId);

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file for a post layer.");
    if (file.size > MAX_FILE_BYTES) return setError("That image is larger than 80 MB.");
    try {
      const src = await fileToDataUrl(file);
      commit((value) => ({
        ...value,
        slides: value.slides.map((item) =>
          item.id !== value.activeSlideId
            ? item
            : {
                ...item,
                layers: [
                  ...item.layers,
                  {
                    id: uid(),
                    kind: "image",
                    name: file.name,
                    src,
                    x: 15,
                    y: 15,
                    width: 70,
                    height: 70,
                    opacity: 1,
                  },
                ],
              },
        ),
      }));
      setError();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Image upload failed.");
    }
  };

  const updateLayer = (changes: Partial<Layer>) => {
    if (!selected) return;
    commit((value) => ({
      ...value,
      slides: value.slides.map((item) =>
        item.id !== value.activeSlideId
          ? item
          : {
              ...item,
              layers: item.layers.map((layer) =>
                layer.id === selected.id ? { ...layer, ...changes } : layer,
              ),
            },
      ),
    }));
  };

  const addText = () => {
    const layer: Layer = {
      id: uid(),
      kind: "text",
      name: "Text",
      text: "Add your message",
      x: 18,
      y: 40,
      width: 64,
      height: 18,
      fontSize: 24,
      color: "#26314e",
      opacity: 1,
    };
    commit((value) => ({
      ...value,
      selectedLayerId: layer.id,
      slides: value.slides.map((item) =>
        item.id === value.activeSlideId ? { ...item, layers: [...item.layers, layer] } : item,
      ),
    }));
  };

  const addSlide = () => {
    if (draft.slides.length >= 10) return setError("A carousel can contain up to 10 slides.");
    const next = initialSlide();
    commit((value) => ({
      ...value,
      slides: [...value.slides, next],
      activeSlideId: next.id,
      selectedLayerId: undefined,
    }));
  };

  const duplicateSlide = () => {
    if (draft.slides.length >= 10) return setError("A carousel can contain up to 10 slides.");
    const next = {
      ...slide,
      id: uid(),
      layers: slide.layers.map((layer) => ({ ...layer, id: uid() })),
    };
    commit((value) => ({
      ...value,
      slides: [...value.slides, next],
      activeSlideId: next.id,
      selectedLayerId: undefined,
    }));
  };

  const deleteSlide = () => {
    if (draft.slides.length === 1) return;
    commit((value) => {
      const slides = value.slides.filter((item) => item.id !== value.activeSlideId);
      return {
        ...value,
        slides,
        activeSlideId: slides[0].id,
        selectedLayerId: undefined,
      };
    });
  };

  const moveSlide = (offset: number) => {
    const index = draft.slides.findIndex((item) => item.id === draft.activeSlideId);
    const target = index + offset;
    if (target < 0 || target >= draft.slides.length) return;
    commit((value) => {
      const slides = [...value.slides];
      [slides[index], slides[target]] = [slides[target], slides[index]];
      return { ...value, slides };
    });
  };

  return (
    <div
      className="post-editor-rebuilt"
      data-editor-panel={stage === "publish" ? "caption" : "design"}
      data-stage={stage}
    >
      <nav className="post-workspace-toolbar" aria-label="Post workspace">
        <div>
          <span>01 / MAKE IT YOURS</span>
          <strong>Post studio.</strong>
        </div>
        <div className="post-workspace-insert">
          <Button onClick={addText}>Add text</Button>
          <Button onClick={() => uploadRef.current?.click()}>Add photo</Button>
        </div>
        <div className="post-workspace-modes" aria-label="Post creation steps">
          {(
            [
              ["media", "1 · Add media"],
              ["edit", "2 · Edit"],
              ["publish", "3 · Caption & publish"],
            ] as const
          ).map(([value, label]) => (
            <Button key={value} aria-pressed={stage === value} onClick={() => onStageChange(value)}>
              {label}
            </Button>
          ))}
        </div>
      </nav>
      {stage === "media" && (
        <section className="post-media-step">
          <h2>Start with a moment.</h2>
          <p>Add a photo, then crop, move and layer it on the canvas.</p>
          <div>
            <Button variant="primary" onClick={() => uploadRef.current?.click()}>
              Choose photo
            </Button>
            <Button onClick={() => onStageChange("edit")}>Create on a blank canvas</Button>
          </div>
        </section>
      )}
      <div className="studio-layout">
        <section className="studio-panel tools-panel">
          <PostTemplates
            onApply={(next) =>
              commit((value) => ({
                ...value,
                selectedLayerId: undefined,
                slides: value.slides.map((item) =>
                  item.id === value.activeSlideId ? { ...next, id: item.id } : item,
                ),
              }))
            }
          />
          <div className="panel-section">
            <span className="panel-label">ADD TO CANVAS</span>
            <div className="tool-grid">
              <Button variant="soft" onClick={addText}>
                Add text
              </Button>
              <Button variant="soft" onClick={() => uploadRef.current?.click()}>
                Upload image
              </Button>
              <input
                ref={uploadRef}
                className="visually-hidden"
                type="file"
                accept="image/*"
                onChange={uploadImage}
              />
            </div>
          </div>
          <div className="panel-section">
            <span className="panel-label">HISTORY</span>
            <div className="inline-controls">
              <Button onClick={undo} disabled={!canUndo} aria-label="Undo last edit">
                Undo
              </Button>
              <Button onClick={redo} disabled={!canRedo} aria-label="Redo last edit">
                Redo
              </Button>
            </div>
          </div>
          <div className="panel-section">
            <span className="panel-label">BACKGROUND</span>
            <input
              aria-label="Slide background color"
              type="color"
              value={slide.background}
              onChange={(event) =>
                commit((value) => ({
                  ...value,
                  slides: value.slides.map((item) =>
                    item.id === value.activeSlideId
                      ? { ...item, background: event.target.value }
                      : item,
                  ),
                }))
              }
            />
          </div>
          <div className="panel-section">
            <span className="panel-label">LAYERS</span>
            <div className="layer-list">
              {[...slide.layers].reverse().map((layer) => (
                <button
                  key={layer.id}
                  className={`layer-row ${selected?.id === layer.id ? "active" : ""}`}
                  onClick={() => replace((value) => ({ ...value, selectedLayerId: layer.id }))}
                >
                  <span>{layer.kind === "text" ? "T" : "▧"}</span>
                  <span>{layer.name}</span>
                </button>
              ))}
            </div>
            {selected && (
              <div className="property-stack">
                <PostLayerControls
                  layer={selected}
                  onChange={updateLayer}
                  onDuplicate={() => {
                    const copy = {
                      ...selected,
                      id: uid(),
                      name: selected.name + " copy",
                      x: clamp(selected.x + 3, 0, 100 - selected.width),
                      y: clamp(selected.y + 3, 0, 100 - selected.height),
                    };
                    commit((value) => ({
                      ...value,
                      selectedLayerId: copy.id,
                      slides: value.slides.map((item) =>
                        item.id === value.activeSlideId
                          ? { ...item, layers: [...item.layers, copy] }
                          : item,
                      ),
                    }));
                  }}
                  onOrder={(direction) =>
                    commit((value) => ({
                      ...value,
                      slides: value.slides.map((item) => {
                        if (item.id !== value.activeSlideId) return item;
                        const layers = [...item.layers];
                        const index = layers.findIndex((layer) => layer.id === selected.id);
                        const target = clamp(index + direction, 0, layers.length - 1);
                        [layers[index], layers[target]] = [layers[target], layers[index]];
                        return { ...item, layers };
                      }),
                    }))
                  }
                />
                {selected.kind === "text" && (
                  <>
                    <label>
                      Text
                      <textarea
                        value={selected.text}
                        onChange={(event) => updateLayer({ text: event.target.value })}
                      />
                    </label>
                    <label>
                      Text color
                      <input
                        type="color"
                        value={selected.color}
                        onChange={(event) => updateLayer({ color: event.target.value })}
                      />
                    </label>
                    <label>
                      Size
                      <input
                        type="range"
                        min="12"
                        max="72"
                        value={selected.fontSize}
                        onChange={(event) => updateLayer({ fontSize: Number(event.target.value) })}
                      />
                    </label>
                  </>
                )}
                <label>
                  Opacity
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={selected.opacity}
                    onChange={(event) => updateLayer({ opacity: Number(event.target.value) })}
                  />
                </label>
                <Button
                  variant="quiet"
                  onClick={() =>
                    commit((value) => ({
                      ...value,
                      selectedLayerId: undefined,
                      slides: value.slides.map((item) =>
                        item.id === value.activeSlideId
                          ? {
                              ...item,
                              layers: item.layers.filter((layer) => layer.id !== selected.id),
                            }
                          : item,
                      ),
                    }))
                  }
                >
                  Delete layer
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="studio-workspace">
          <div className="workspace-toolbar">
            <span>
              Slide {draft.slides.findIndex((item) => item.id === draft.activeSlideId) + 1} of{" "}
              {draft.slides.length}
            </span>
            <span>Drag layers · use handles to resize</span>
          </div>
          <LayerCanvas draft={draft} replace={replace} commit={commit} checkpoint={checkpoint} />
          <div className="carousel-strip" aria-label="Carousel slides">
            {draft.slides.map((item, index) => (
              <button
                key={item.id}
                className={`slide-thumb ${item.id === draft.activeSlideId ? "active" : ""}`}
                style={{ background: item.background }}
                onClick={() =>
                  replace((value) => ({
                    ...value,
                    activeSlideId: item.id,
                    selectedLayerId: undefined,
                  }))
                }
              >
                {index + 1}
              </button>
            ))}
            <button className="slide-add" onClick={addSlide} aria-label="Add slide">
              ＋
            </button>
          </div>
          <div className="inline-controls centered">
            <Button
              onClick={() => moveSlide(-1)}
              disabled={draft.slides[0].id === draft.activeSlideId}
            >
              Move left
            </Button>
            <Button
              onClick={() => moveSlide(1)}
              disabled={draft.slides[draft.slides.length - 1]?.id === draft.activeSlideId}
            >
              Move right
            </Button>
            <Button onClick={duplicateSlide}>Duplicate</Button>
            <Button variant="quiet" onClick={deleteSlide} disabled={draft.slides.length === 1}>
              Delete
            </Button>
          </div>
        </section>

        <aside className="studio-panel preview-panel">
          <span className="panel-label">POST PREVIEW</span>
          <PostPreviewActions draft={draft} onError={setError} />
          <div className="social-preview">
            <div className="preview-header">
              <span className="avatar avatar-pink">VL</span>
              <div>
                <strong>{creatorName}</strong>
                <small>Just now</small>
              </div>
            </div>
            <div
              ref={previewRef}
              className="preview-media"
              style={{ background: slide.background }}
            >
              {slide.layers.map((layer) => (
                <div
                  key={layer.id}
                  className="preview-layer"
                  style={{
                    left: `${layer.x}%`,
                    top: `${layer.y}%`,
                    width: `${layer.width}%`,
                    height: `${layer.height}%`,
                    opacity: layer.opacity,
                    transform: `rotate(${layer.rotation ?? 0}deg)`,
                  }}
                >
                  {layer.kind === "image" ? (
                    <img src={layer.src} alt="" />
                  ) : (
                    <span
                      style={{
                        color: layer.color,
                        fontSize: `${((layer.fontSize ?? 20) * previewWidth) / 570}px`,
                        fontFamily: layer.fontFamily ?? "Manrope",
                        fontWeight: layer.fontWeight ?? 800,
                        textAlign: layer.textAlign ?? "center",
                        width: "100%",
                      }}
                    >
                      {layer.text}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="preview-dots">
              {draft.slides.map((item) => (
                <i key={item.id} className={item.id === slide.id ? "active" : ""} />
              ))}
            </div>
            <textarea
              className="caption-input"
              aria-label="Post caption"
              maxLength={2000}
              placeholder="Write a caption… Mention someone with @"
              value={draft.caption}
              onChange={(event) => commit((value) => ({ ...value, caption: event.target.value }))}
            />
          </div>
          <details className="post-music-details">
            <summary>Music · {draft.soundtrack?.title || "Add a soundtrack"}</summary>
            <MusicPicker
              studio="post"
              selected={draft.soundtrack ?? null}
              onSelect={(soundtrack) =>
                commit((value) => ({ ...value, documentVersion: 2, soundtrack }))
              }
            />
          </details>
          <PostMusicPreview track={draft.soundtrack ?? null} />
          <div className="post-publish-settings">
            <label>
              Who can see this post?
              <select
                aria-label="Post audience"
                value={publishSettings.visibility}
                onChange={(event) =>
                  commit((value) => ({
                    ...value,
                    settings: {
                      ...publishSettings,
                      visibility: event.target.value as "public" | "followers" | "private",
                    },
                  }))
                }
              >
                <option value="public">Public</option>
                <option value="followers">Followers</option>
                <option value="private">Only me</option>
              </select>
            </label>
            {(
              [
                ["allowComments", "Allow comments"],
                ["allowLikes", "Allow likes"],
                ["hideLikeCount", "Hide like count"],
                ["allowSharing", "Allow sharing"],
              ] as const
            ).map(([key, label]) => (
              <label className="post-publish-toggle" key={key}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={publishSettings[key]}
                  onChange={(event) =>
                    commit((value) => ({
                      ...value,
                      settings: { ...publishSettings, [key]: event.target.checked },
                    }))
                  }
                />
              </label>
            ))}
            <small>Private posts stay visible only to you.</small>
          </div>
        </aside>
      </div>
    </div>
  );
}
