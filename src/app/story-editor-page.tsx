import { compositionMetadata } from "../lib/composition";
import { SoundtrackTransport } from "../components/studio/SoundtrackTransport";
import { useInterfaceMotion } from "../motion/InterfaceMotion";
import {
  ArrowLeft,
  Camera,
  Ellipsis,
  Eye,
  LayoutTemplate,
  MousePointer2,
  Music2,
  Palette,
  Pencil,
  Play,
  Redo2,
  Send,
  Shapes,
  Sticker as StickerIcon,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { StoryCanvas } from "../components/story-editor/Canvas";
import StoryDrawingLayer from "../components/story-editor/StoryDrawingLayer";
import StoryStickerPicker from "../components/story-editor/StoryStickerPicker";
import { CollaborationPanel } from "../components/story-editor/CollaborationPanel";
import { ShapeTools } from "../components/story-editor/ShapeTools";
import { StoryStudioPublishDialog } from "../components/story-editor/StoryStudioPublishDialog";
import {
  StoryStudioDeviceSelector,
  type StoryStudioDeviceLayout,
} from "../components/story-editor/StoryStudioDeviceSelector";
import {
  ExportPublishPanel,
  type StoryLocalSchedule,
} from "../components/story-editor/ExportPublishPanel";
import { MediaTools } from "../components/story-editor/MediaTools";
import { StoryMusicBrowser } from "../components/story-editor/StoryMusicBrowser";
import { StickerTools } from "../components/story-editor/StickerTools";
import { TemplatesBrandKitPanel } from "../components/story-editor/TemplatesBrandKitPanel";
import { TimingTools, type StoryTransitionSettings } from "../components/story-editor/TimingTools";
import { TextTools } from "../components/story-editor/TextTools";
import { SlideNavigator } from "../components/story-editor/SlideNavigator";
import StoryTextStudio, { type StoryTextDraft } from "../components/story-editor/StoryTextStudio";
import StoryStudio from "../components/story-editor/StoryStudio";
import StorySlideRail from "../components/story-editor/StorySlideRail";
import StoryMediaControls, {
  type StoryMediaTransform,
} from "../components/story-editor/StoryMediaControls";
import useStoryEditorShortcuts from "../components/story-editor/StoryEditorShortcuts";
import {
  createEditorHistory,
  pushEditorHistory,
  undoEditorHistory,
  redoEditorHistory,
} from "../lib/story-editor/editor-history";
import {
  deleteStoryDraftMedia,
  getStoryDraftMedia,
  putStoryDraftMedia,
} from "../lib/story-editor/draft-media.mjs";
import { Button, Dialog, IconButton } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useCreatorStudioTheme } from "../lib/motion-provider";
import { useFeatureFlag } from "../lib/feature-flags";
import {
  getStoryEditorShortcut,
  isStoryEditorEditableTarget,
} from "../lib/story-editor/keyboard-shortcuts.mjs";
import { createStoryEditorId } from "../lib/story-editor/id.mjs";
import {
  getAdjacentStorySlideIndex,
  getStoryPlaybackAdvance,
  getStoryPreviewProgress,
  MAX_STORY_SLIDES,
} from "../lib/story-editor/navigation.mjs";
import type {
  Slide,
  StoryBrandOverlay,
  StoryBackgroundType,
  StorySlideMediaSettings,
  StoryStickerConfig,
  StoryStickerType,
  StoryTextOverlay,
  StoryShape,
  Sticker,
} from "../lib/story-editor/types";
import {
  createDrawingDocument,
  parseStoryDrawing,
  type StoryDrawingDocument,
} from "../lib/story-editor/drawing-engine";
import {
  createStoryStickerFromDefinition,
  type StoryStickerDefinition,
} from "../lib/story-editor/sticker-catalog";
import {
  createStorySceneHistory,
  createStoryShape,
  normalizeStoryObjectOrder,
  recordStorySceneChange,
  reorderStoryObject,
  redoStorySceneChange,
  undoStorySceneChange,
} from "../lib/story-editor/scene-engine.mjs";
import type { StorySceneHistory } from "../lib/story-editor/scene-engine.mjs";
import { getStoryTextPosition, getStoryTextStyle } from "../lib/story-editor/text-tools.mjs";
import {
  DEFAULT_STORY_MEDIA_SETTINGS,
  MAX_STORY_VIDEO_SECONDS,
  clampStoryVideoTrim,
  validateStoryMediaHeader,
} from "../lib/story-editor/media-tools.mjs";
import { getStoryExportDimensions, getStoryMp4MimeType } from "../lib/story-editor/export.mjs";
import {
  canvasToPng,
  drawStoryExportFrame,
  prepareStoryExportAssets,
  renderStoryMp4,
  type StoryExportFrame,
} from "../lib/story-editor/export-renderer";
import { deleteStoryAndMedia, publishStory, type StoryAudience } from "../lib/story-publishing";
import { fetchStudioCatalog, type StudioMusicTrack } from "../lib/studio-catalog";
import {
  createStorySticker,
  MAX_STORY_STICKERS_PER_SLIDE,
  parseStoryStickerConfig,
  sanitizeStoryStickerSvg,
  STORY_INTERACTIVE_STICKER_TYPES,
  type StoryStickerCatalogItem,
  validateStoryStickerPng,
} from "../lib/story-editor/stickers.mjs";
import {
  mergeStoryProjectSnapshots,
  readStoryCollaborationProject,
  writeStoryCollaborationProject,
} from "../lib/story-editor/collaboration.mjs";
import {
  applyStoryBrandKitToOverlays,
  createStoryTemplateOverlays,
  DEFAULT_STORY_BRAND_KIT,
  DEFAULT_STORY_TEMPLATE_LOCKS,
  getStoryTemplate,
} from "../lib/story-editor/templates.mjs";
import type { StoryBrandKit, StoryTemplateLocks } from "../lib/story-editor/templates.mjs";
import "./story-editor.css";

interface StoryProjectSnapshot {
  projectId: string;
  storyId: string;
  actorId: string;
  updatedAt: string;
  slides: Slide[];
  draftMediaBySlide?: Record<string, string>;
  slideRevisions: Record<string, string>;
  removedSlides: Record<string, string>;
  textOverlaysBySlide: Record<string, StoryTextOverlay[]>;
  shapesBySlide?: Record<string, StoryShape[]>;
  drawingsBySlide?: Record<string, StoryDrawingDocument>;
  mediaSettingsBySlide: Record<string, StorySlideMediaSettings>;
  transitionsBySlide: Record<string, StoryTransitionSettings>;
  slideLoops: Record<string, boolean>;
  storyLoop: boolean;
  brandOverlay: StoryBrandOverlay;
  archived?: boolean;
  schedules?: StoryLocalSchedule[];
  highlightCover?: { slideId: string; title: string; background: string; updatedAt: string } | null;
  brandKit?: StoryBrandKit;
  templateLocks?: StoryTemplateLocks;
  onboardingComplete?: boolean;
  soundtrack?: StudioMusicTrack | null;
}

interface EditableSceneSnapshot {
  text: StoryTextOverlay[];
  stickers: Sticker[];
  shapes: StoryShape[];
}

interface StoryEditorSceneState {
  activeTool: string | null;
  selectedObjectId: string | null;
  selectedObjectKind: "text" | "sticker" | "shape" | null;
  shapesBySlide: Record<string, StoryShape[]>;
  history: StorySceneHistory;
}

function createSlide(storyId: string, order: number): Slide {
  const timestamp = new Date().toISOString();
  return {
    id: createStoryEditorId(),
    storyId,
    order,
    mediaType: "image",
    mediaUrl: null,
    duration: 15,
    backgroundType: "solid",
    background: null,
    stickers: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createTextOverlay(): StoryTextOverlay {
  const style = getStoryTextStyle("editorial");
  const position = getStoryTextPosition("center");
  return {
    id: createStoryEditorId(),
    content: "Your story text",
    styleId: style.id,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    color: style.color,
    align: style.align,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    italic: style.italic,
    uppercase: style.uppercase,
    background: style.background,
    stroke: style.stroke,
    shadow: style.shadow,
    animation: "fade",
    animationDuration: 0.7,
    startAt: 0,
    position: position.id,
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height,
    autoSize: true,
  };
}

function nextSceneZIndex(scene: EditableSceneSnapshot) {
  return (
    Math.max(
      -1,
      ...scene.text.map((item, index) => item.zIndex ?? index),
      ...scene.stickers.map((item) => item.zIndex),
      ...scene.shapes.map((item) => item.zIndex),
    ) + 1
  );
}

const studioTools = [
  { id: "media", label: "Media", icon: Camera },
  { id: "text", label: "Text", icon: Type },
  { id: "sticker", label: "Sticker", icon: StickerIcon },
  { id: "draw", label: "Draw", icon: Pencil },
  { id: "shape", label: "Shape", icon: Shapes },
  { id: "music", label: "Music", icon: Music2 },
  { id: "layout", label: "Layout", icon: LayoutTemplate },
  { id: "more", label: "More", icon: Ellipsis },
] as const;
const mobileStudioTools = [
  { id: "media", label: "Media", icon: Camera },
  { id: "text", label: "Text", icon: Type },
  { id: "sticker", label: "Stickers", icon: StickerIcon },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "background", label: "Background", icon: Palette },
  { id: "music", label: "Music", icon: Music2 },
  { id: "more", label: "More", icon: Ellipsis },
] as const;

const studioPanelTransition = { type: "spring", stiffness: 300, damping: 30 } as const;
const studioPanelVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 16 },
};

export function StoryEditorPage() {
  const creatorTheme = useCreatorStudioTheme("story");
  const reducedMotion = useInterfaceMotion().reduced;
  const { user } = useAuth();
  const storiesEnabled = useFeatureFlag("stories_enabled", true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isClientPreview = searchParams.has("clientPreview");
  const [deviceLayout, setDeviceLayout] = useState<StoryStudioDeviceLayout | null>(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches
      ? "mobile"
      : "computer",
  );
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishAudience, setPublishAudience] = useState<StoryAudience>("followers");
  const [publishCaption, setPublishCaption] = useState("");
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishProgress, setPublishProgress] = useState<number | null>(null);
  const [publishStatus, setPublishStatus] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [textStudioOpen, setTextStudioOpen] = useState(false);
  const [slideHistory, setSlideHistory] = useState(() => createEditorHistory<Slide[]>([]));
  const publishLock = useRef(false);
  const [projectId] = useState(() => {
    const sharedId = searchParams.get("collab") ?? searchParams.get("clientPreview");
    if (sharedId) return sharedId;
    try {
      const storedId = window.localStorage.getItem("velori-story-editor-draft-id");
      if (storedId) return storedId;
      const nextId = createStoryEditorId();
      window.localStorage.setItem("velori-story-editor-draft-id", nextId);
      return nextId;
    } catch {
      return createStoryEditorId();
    }
  });
  const [initialLoad] = useState(() => {
    try {
      return { project: readStoryCollaborationProject(projectId), error: "" };
    } catch (cause) {
      return {
        project: null,
        error: cause instanceof Error ? cause.message : "Could not load the shared story.",
      };
    }
  });
  const initialProject = initialLoad.project as StoryProjectSnapshot | null;
  const initialPreviewError =
    isClientPreview && !initialProject && !initialLoad.error
      ? "This client preview is unavailable in this browser or the shared draft has not been saved."
      : initialLoad.error;
  const [storyId] = useState(() => initialProject?.storyId ?? projectId);
  const [actorId] = useState(() => createStoryEditorId());
  const [slides, setSlides] = useState<Slide[]>(
    () => initialProject?.slides ?? [createSlide(storyId, 0)],
  );
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const [draftMediaBySlide, setDraftMediaBySlide] = useState<Record<string, string>>(
    () => initialProject?.draftMediaBySlide ?? {},
  );
  const draftMediaBySlideRef = useRef(draftMediaBySlide);
  draftMediaBySlideRef.current = draftMediaBySlide;
  const [drawingsBySlide, setDrawingsBySlide] = useState<Record<string, StoryDrawingDocument>>(() =>
    Object.fromEntries(
      Object.entries(initialProject?.drawingsBySlide ?? {}).map(([id, value]) => [
        id,
        parseStoryDrawing(value),
      ]),
    ),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.dataset.theme === "dark");
  const [interactivePreview, setInteractivePreview] = useState(true);
  const [immersive, setImmersive] = useState(false);
  const [animationPreviewActive, setAnimationPreviewActive] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);
  const [safeZonesVisible, setSafeZonesVisible] = useState(false);
  const [mobileStoryboardExpanded, setMobileStoryboardExpanded] = useState(false);
  const [sceneModel, setSceneModel] = useState<StoryEditorSceneState>(() => ({
    activeTool: null,
    selectedObjectId: null,
    selectedObjectKind: null,
    shapesBySlide: initialProject?.shapesBySlide ?? {},
    history: createStorySceneHistory(),
  }));
  const activeTool = sceneModel.activeTool;
  const selectedObjectId = sceneModel.selectedObjectId;
  const selectedObjectKind = sceneModel.selectedObjectKind;
  const shapesBySlide = sceneModel.shapesBySlide;
  const sceneHistory = sceneModel.history;
  const sceneHistoryRef = useRef(sceneHistory);
  const setActiveTool = useCallback((activeTool: string | null) => {
    setSceneModel((current) => ({ ...current, activeTool }));
  }, []);
  const setShapesBySlide = useCallback(
    (
      update:
        | Record<string, StoryShape[]>
        | ((current: Record<string, StoryShape[]>) => Record<string, StoryShape[]>),
    ) => {
      setSceneModel((current) => ({
        ...current,
        shapesBySlide: typeof update === "function" ? update(current.shapesBySlide) : update,
      }));
    },
    [],
  );
  const setSceneHistory = useCallback((history: StorySceneHistory) => {
    sceneHistoryRef.current = history;
    setSceneModel((current) => ({ ...current, history }));
  }, []);
  const [moreSection, setMoreSection] = useState<"brand" | "collaborate" | "post">("brand");
  const [tapAreasVisible, setTapAreasVisible] = useState(false);
  const [textOverlaysBySlide, setTextOverlaysBySlide] = useState<
    Record<string, StoryTextOverlay[]>
  >(() => initialProject?.textOverlaysBySlide ?? {});
  const [transitionsBySlide, setTransitionsBySlide] = useState<
    Record<string, StoryTransitionSettings>
  >(() => initialProject?.transitionsBySlide ?? {});
  const [storyLoop, setStoryLoop] = useState(() => initialProject?.storyLoop ?? false);
  const [soundtrack, setSoundtrack] = useState<StudioMusicTrack | null>(
    () => initialProject?.soundtrack ?? null,
  );
  useEffect(() => {
    let active = true;
    void fetchStudioCatalog({ studio: "story", limit: 100 })
      .then((catalog) => {
        if (!active) return;
        const assets = new Map(
          catalog.stickers.map((item) => [`catalog-${item.id}`, item.assetUrl]),
        );
        setSlides((current) =>
          current.map((slide) => ({
            ...slide,
            stickers: slide.stickers.map((sticker) => {
              const config = parseStoryStickerConfig(sticker.config);
              const assetUrl = config.catalogId ? assets.get(config.catalogId) : null;
              return assetUrl && config.assetUrl !== assetUrl
                ? { ...sticker, config: JSON.stringify({ ...config, assetUrl }) }
                : sticker;
            }),
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const [slideLoops, setSlideLoops] = useState<Record<string, boolean>>(
    () => initialProject?.slideLoops ?? {},
  );
  const [transitionPreview, setTransitionPreview] = useState<{
    type: StoryTransitionSettings["type"];
    duration: number;
    fromLeft: boolean;
    sequence: number;
  }>({ type: "fade", duration: 0.5, fromLeft: false, sequence: 0 });
  const [brandOverlay, setBrandOverlay] = useState<StoryBrandOverlay>(
    () =>
      initialProject?.brandOverlay ?? {
        logoUrl: null,
        logoX: 0.9,
        logoY: 0.1,
        logoScale: 1,
        logoOpacity: 1,
        watermarkText: "",
        watermarkOpacity: 0.5,
      },
  );
  const [brandKit, setBrandKit] = useState<StoryBrandKit>(
    () => initialProject?.brandKit ?? { ...DEFAULT_STORY_BRAND_KIT },
  );
  const [templateLocks, setTemplateLocks] = useState<StoryTemplateLocks>(
    () => initialProject?.templateLocks ?? { ...DEFAULT_STORY_TEMPLATE_LOCKS },
  );
  const [onboardingComplete, setOnboardingComplete] = useState(
    () => initialProject?.onboardingComplete ?? false,
  );
  const [archived, setArchived] = useState(() => initialProject?.archived ?? false);
  const [schedules, setSchedules] = useState<StoryLocalSchedule[]>(
    () => initialProject?.schedules ?? [],
  );
  const [highlightCover, setHighlightCover] = useState<StoryProjectSnapshot["highlightCover"]>(
    () => initialProject?.highlightCover ?? null,
  );
  const [mediaSettingsBySlide, setMediaSettingsBySlide] = useState<
    Record<string, StorySlideMediaSettings>
  >(() => initialProject?.mediaSettingsBySlide ?? {});
  const [removedSlides, setRemovedSlides] = useState<Record<string, string>>(
    () => initialProject?.removedSlides ?? {},
  );
  const [mediaError, setMediaError] = useState(initialPreviewError);
  const [collaborationNotice, setCollaborationNotice] = useState("");
  const objectUrls = useRef(new Set<string>());
  const animationPreviewTimer = useRef<number | null>(null);
  const retainedVersionUrls = useRef(new Set<string>());
  const canvasRef = useRef<HTMLDivElement>(null);
  const catalogStickerTransformStartRef = useRef<{
    slideId: string;
    snapshot: EditableSceneSnapshot;
  } | null>(null);
  const projectSnapshotRef = useRef<StoryProjectSnapshot | null>(initialProject);
  const suppressProjectBroadcastRef = useRef(false);
  const reportMediaError = useCallback((message: string) => setMediaError(message), []);
  const activeSlide = slides[activeIndex];
  const activeDurationMs = Math.max(1, (activeSlide?.duration ?? 15) * 1000);
  const progress = getStoryPreviewProgress(elapsedMs, activeDurationMs);
  const activeTextOverlays = activeSlide ? (textOverlaysBySlide[activeSlide.id] ?? []) : [];
  const activeStickers = activeSlide?.stickers ?? [];
  const activeDrawing = activeSlide
    ? (drawingsBySlide[activeSlide.id] ?? createDrawingDocument())
    : createDrawingDocument();
  const activeShapes = activeSlide ? (shapesBySlide[activeSlide.id] ?? []) : [];
  const selectedTextId =
    selectedObjectKind === "text" && activeTextOverlays.some((item) => item.id === selectedObjectId)
      ? selectedObjectId
      : null;
  const selectedStickerId =
    selectedObjectKind === "sticker" && activeStickers.some((item) => item.id === selectedObjectId)
      ? selectedObjectId
      : null;
  const activeMediaSettings = activeSlide
    ? (mediaSettingsBySlide[activeSlide.id] ??
      (DEFAULT_STORY_MEDIA_SETTINGS as StorySlideMediaSettings))
    : (DEFAULT_STORY_MEDIA_SETTINGS as StorySlideMediaSettings);

  function captureSceneSnapshot(): EditableSceneSnapshot {
    return {
      text: structuredClone(activeTextOverlays),
      stickers: structuredClone(activeStickers),
      shapes: structuredClone(activeShapes),
    };
  }

  function recordSceneEdit(
    before: EditableSceneSnapshot,
    after: EditableSceneSnapshot,
    action: string,
  ) {
    if (!activeSlide) return;
    const next = recordStorySceneChange(
      sceneHistoryRef.current,
      activeSlide.id,
      before,
      after,
      action,
    );
    if (next === sceneHistoryRef.current) return;
    sceneHistoryRef.current = next;
    setSceneHistory(next);
  }

  function selectSceneObject(id: string | null, type?: "text" | "sticker" | "shape") {
    setSceneModel((current) => ({
      ...current,
      selectedObjectId: id,
      selectedObjectKind: id ? (type ?? null) : null,
    }));
  }

  function restoreSceneSnapshot(slideId: string, snapshot: EditableSceneSnapshot) {
    const slideIndex = slides.findIndex((slide) => slide.id === slideId);
    if (slideIndex < 0) return;
    if (slideIndex !== activeIndex) setActiveIndex(slideIndex);
    setTextOverlaysBySlide((current) => ({ ...current, [slideId]: snapshot.text }));
    setSlides((current) =>
      current.map((slide) =>
        slide.id === slideId
          ? { ...slide, stickers: snapshot.stickers, updatedAt: new Date().toISOString() }
          : slide,
      ),
    );
    setShapesBySlide((current) => ({ ...current, [slideId]: snapshot.shapes }));
    selectSceneObject(null);
  }

  function undoSceneEdit() {
    const result = undoStorySceneChange(sceneHistoryRef.current);
    if (!result.restore) {
      setSlideHistory((history) => {
        const next = undoEditorHistory(history);
        if (next !== history) setSlides(next.present);
        return next;
      });
      return;
    }
    const next = result.history;
    sceneHistoryRef.current = next;
    setSceneHistory(next);
    restoreSceneSnapshot(result.restore.slideId, result.restore.objects as EditableSceneSnapshot);
  }

  function redoSceneEdit() {
    const result = redoStorySceneChange(sceneHistoryRef.current);
    if (!result.restore) {
      setSlideHistory((history) => {
        const next = redoEditorHistory(history);
        if (next !== history) setSlides(next.present);
        return next;
      });
      return;
    }
    const next = result.history;
    sceneHistoryRef.current = next;
    setSceneHistory(next);
    restoreSceneSnapshot(result.restore.slideId, result.restore.objects as EditableSceneSnapshot);
  }

  function addShape(shape: StoryShape["shape"]) {
    if (!activeSlide) return;
    const before = captureSceneSnapshot();
    const created = createStoryShape(createStoryEditorId(), shape);
    created.zIndex = nextSceneZIndex(before);
    const after = { ...before, shapes: [...before.shapes, created] };
    recordSceneEdit(before, after, "create-shape");
    setShapesBySlide((current) => ({
      ...current,
      [activeSlide.id]: after.shapes,
    }));
    selectSceneObject(created.id, "shape");
  }

  function updateShape(id: string, patch: Partial<StoryShape>) {
    if (!activeSlide) return;
    const before = captureSceneSnapshot();
    const after = {
      ...before,
      shapes: before.shapes.map((shape) =>
        shape.id === id ? { ...shape, ...patch, updatedAt: new Date().toISOString() } : shape,
      ),
    };
    recordSceneEdit(before, after, "update-shape");
    setShapesBySlide((current) => ({ ...current, [activeSlide.id]: after.shapes }));
  }

  function deleteShape(id: string) {
    if (!activeSlide) return;
    const before = captureSceneSnapshot();
    const after = { ...before, shapes: before.shapes.filter((shape) => shape.id !== id) };
    recordSceneEdit(before, after, "delete-shape");
    setShapesBySlide((current) => ({ ...current, [activeSlide.id]: after.shapes }));
    selectSceneObject(null);
  }

  function transformSceneObject(
    id: string,
    kind: "text" | "sticker" | "shape",
    transform: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      scale?: unknown;
    },
  ) {
    if (!activeSlide) return;
    const before = captureSceneSnapshot();
    let after = before;
    if (kind === "text") {
      after = {
        ...before,
        text: before.text.map((overlay) =>
          overlay.id === id
            ? {
                ...overlay,
                x: (transform.x + transform.width / 2) * 100,
                y: (transform.y + transform.height / 2) * 100,
                width: transform.width * 100,
                height: transform.height * 100,
                rotation: transform.rotation,
              }
            : overlay,
        ),
      };
      setTextOverlaysBySlide((current) => ({ ...current, [activeSlide.id]: after.text }));
    } else if (kind === "sticker") {
      after = {
        ...before,
        stickers: before.stickers.map((sticker) =>
          sticker.id === id
            ? {
                ...sticker,
                x: transform.x + transform.width / 2,
                y: transform.y + transform.height / 2,
                rotation: transform.rotation,
                scale:
                  typeof transform.scale === "number"
                    ? Math.min(3, Math.max(0.25, transform.scale))
                    : sticker.scale,
                updatedAt: new Date().toISOString(),
              }
            : sticker,
        ),
      };
      setSlides((current) =>
        current.map((slide) =>
          slide.id === activeSlide.id
            ? { ...slide, stickers: after.stickers, updatedAt: new Date().toISOString() }
            : slide,
        ),
      );
    } else {
      after = {
        ...before,
        shapes: before.shapes.map((shape) =>
          shape.id === id
            ? {
                ...shape,
                x: transform.x,
                y: transform.y,
                width: transform.width,
                height: transform.height,
                rotation: transform.rotation,
                updatedAt: new Date().toISOString(),
              }
            : shape,
        ),
      };
      setShapesBySlide((current) => ({ ...current, [activeSlide.id]: after.shapes }));
    }
    recordSceneEdit(before, after, `transform-${kind}`);
    selectSceneObject(id, kind);
    touchActiveSlide();
  }

  function orderSceneObject(id: string, direction: "forward" | "backward" | "front" | "back") {
    if (!activeSlide) return;
    const before = captureSceneSnapshot();
    const objects = normalizeStoryObjectOrder([
      ...before.text.map((item, index) => ({
        id: item.id,
        kind: "text" as const,
        zIndex: item.zIndex ?? index,
      })),
      ...before.stickers.map((item) => ({
        id: item.id,
        kind: "sticker" as const,
        zIndex: item.zIndex,
      })),
      ...before.shapes.map((item) => ({
        id: item.id,
        kind: "shape" as const,
        zIndex: item.zIndex,
      })),
    ]);
    const ordered = reorderStoryObject(objects, id, direction);
    const zIndexById = new Map(ordered.map((item) => [item.id, item.zIndex]));
    const after: EditableSceneSnapshot = {
      text: before.text.map((item) => ({
        ...item,
        zIndex: zIndexById.get(item.id) ?? item.zIndex ?? 0,
      })),
      stickers: before.stickers.map((item) => ({
        ...item,
        zIndex: zIndexById.get(item.id) ?? item.zIndex,
      })),
      shapes: before.shapes.map((item) => ({
        ...item,
        zIndex: zIndexById.get(item.id) ?? item.zIndex,
      })),
    };
    recordSceneEdit(before, after, "reorder-layer");
    setTextOverlaysBySlide((current) => ({ ...current, [activeSlide.id]: after.text }));
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? { ...slide, stickers: after.stickers, updatedAt: new Date().toISOString() }
          : slide,
      ),
    );
    setShapesBySlide((current) => ({ ...current, [activeSlide.id]: after.shapes }));
  }

  const activeStorySnapshot = useMemo(
    () =>
      ({
        projectId,
        storyId,
        actorId,
        updatedAt: new Date().toISOString(),
        slides: slides.map((slide) => ({
          ...slide,
          mediaUrl: slide.mediaUrl?.startsWith("blob:") ? null : slide.mediaUrl,
        })),
        draftMediaBySlide,
        slideRevisions: Object.fromEntries(slides.map((slide) => [slide.id, slide.updatedAt])),
        removedSlides,
        textOverlaysBySlide,
        shapesBySlide,
        drawingsBySlide,
        mediaSettingsBySlide,
        transitionsBySlide,
        slideLoops,
        storyLoop,
        soundtrack,
        brandOverlay,
        archived,
        schedules,
        highlightCover,
        brandKit,
        templateLocks,
        onboardingComplete,
      }) satisfies StoryProjectSnapshot,
    [
      actorId,
      archived,
      brandOverlay,
      brandKit,
      highlightCover,
      mediaSettingsBySlide,
      projectId,
      removedSlides,
      slideLoops,
      slides,
      draftMediaBySlide,
      schedules,
      storyId,
      storyLoop,
      soundtrack,
      textOverlaysBySlide,
      shapesBySlide,
      drawingsBySlide,
      templateLocks,
      onboardingComplete,
      transitionsBySlide,
    ],
  );

  useEffect(() => {
    if (isClientPreview || !deviceLayout) return undefined;
    const content = JSON.stringify({ ...activeStorySnapshot, updatedAt: "" });
    const previousContent = projectSnapshotRef.current
      ? JSON.stringify({ ...projectSnapshotRef.current, updatedAt: "" })
      : "";
    if (suppressProjectBroadcastRef.current) {
      suppressProjectBroadcastRef.current = false;
      projectSnapshotRef.current = activeStorySnapshot;
      return undefined;
    }
    if (content === previousContent) return undefined;
    projectSnapshotRef.current = activeStorySnapshot;
    try {
      writeStoryCollaborationProject(activeStorySnapshot);
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(`velori-story:${projectId}`);
        channel.postMessage({ type: "project", snapshot: activeStorySnapshot });
        channel.close();
      }
    } catch (cause) {
      setMediaError(cause instanceof Error ? cause.message : "Could not sync the shared story.");
    }
    return undefined;
  }, [
    activeStorySnapshot,
    brandOverlay,
    archived,
    schedules,
    highlightCover,
    brandKit,
    templateLocks,
    onboardingComplete,
    isClientPreview,
    deviceLayout,
    mediaSettingsBySlide,
    projectId,
    removedSlides,
    slideLoops,
    slides,
    storyId,
    storyLoop,
    textOverlaysBySlide,
    shapesBySlide,
    transitionsBySlide,
  ]);

  useEffect(() => {
    if (isClientPreview) {
      setSafeZonesVisible(false);
      setTapAreasVisible(false);
      setPlaying(true);
    }
    const applyRemoteSnapshot = (incoming: unknown) => {
      if (!incoming || typeof incoming !== "object") return;
      const candidate = incoming as StoryProjectSnapshot;
      if (candidate.projectId !== projectId || !Array.isArray(candidate.slides)) return;
      const merged = mergeStoryProjectSnapshots(
        projectSnapshotRef.current,
        candidate,
      ) as StoryProjectSnapshot | null;
      if (!merged) return;
      projectSnapshotRef.current = merged;
      suppressProjectBroadcastRef.current = true;
      const mediaKeys = merged.draftMediaBySlide ?? {};
      const currentSlides = new Map(slidesRef.current.map((slide) => [slide.id, slide]));
      const hydratedSlides = merged.slides.map((slide) => {
        const current = currentSlides.get(slide.id);
        const sameMedia =
          current &&
          current.mediaUrl?.startsWith("blob:") &&
          draftMediaBySlideRef.current[slide.id] === mediaKeys[slide.id];
        return sameMedia ? { ...slide, mediaUrl: current.mediaUrl } : slide;
      });
      setSlides(hydratedSlides);
      setDraftMediaBySlide(mediaKeys);
      void Promise.all(
        hydratedSlides.map(async (slide) => {
          if (slide.mediaUrl?.startsWith("blob:")) return null;
          const key = mediaKeys[slide.id];
          if (!key) return null;
          const blob = await getStoryDraftMedia(key);
          if (!blob) return null;
          return {
            slideId: slide.id,
            key,
            url: createManagedUrl(new File([blob], "story-media", { type: blob.type })),
          };
        }),
      )
        .then((restored) => {
          const available = restored.filter(
            (item): item is NonNullable<typeof item> => item !== null,
          );
          if (!available.length) return;
          setSlides((current) =>
            current.map((slide) => {
              const restoredMedia = available.find((item) => item.slideId === slide.id);
              return restoredMedia && draftMediaBySlideRef.current[slide.id] === restoredMedia.key
                ? { ...slide, mediaUrl: restoredMedia.url }
                : slide;
            }),
          );
        })
        .catch((cause: unknown) => {
          setMediaError(
            cause instanceof Error ? cause.message : "Could not restore shared story media.",
          );
        });
      setTextOverlaysBySlide(merged.textOverlaysBySlide);
      setShapesBySlide(merged.shapesBySlide ?? {});
      setDrawingsBySlide(
        Object.fromEntries(
          Object.entries(merged.drawingsBySlide ?? {}).map(([id, drawing]) => [
            id,
            parseStoryDrawing(drawing),
          ]),
        ),
      );
      setMediaSettingsBySlide(merged.mediaSettingsBySlide);
      setTransitionsBySlide(merged.transitionsBySlide);
      setSlideLoops(merged.slideLoops);
      setStoryLoop(merged.storyLoop);
      setBrandOverlay(merged.brandOverlay);
      setBrandKit(merged.brandKit ?? { ...DEFAULT_STORY_BRAND_KIT });
      setTemplateLocks(merged.templateLocks ?? { ...DEFAULT_STORY_TEMPLATE_LOCKS });
      setOnboardingComplete(merged.onboardingComplete ?? false);
      setRemovedSlides(merged.removedSlides);
      setArchived(merged.archived ?? false);
      setSchedules(merged.schedules ?? []);
      setHighlightCover(merged.highlightCover ?? null);
      try {
        writeStoryCollaborationProject(merged);
      } catch (cause) {
        setMediaError(cause instanceof Error ? cause.message : "Could not save the shared update.");
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.newValue || event.key !== `velori:story-collaboration:${projectId}`) return;
      try {
        applyRemoteSnapshot(JSON.parse(event.newValue));
      } catch (cause) {
        setMediaError(cause instanceof Error ? cause.message : "Could not read the shared update.");
      }
    };
    window.addEventListener("storage", onStorage);
    if (typeof BroadcastChannel === "undefined") {
      return () => window.removeEventListener("storage", onStorage);
    }
    const channel = new BroadcastChannel(`velori-story:${projectId}`);
    channel.onmessage = (message: MessageEvent<unknown>) => {
      if (
        message.data &&
        typeof message.data === "object" &&
        "type" in message.data &&
        message.data.type === "project" &&
        "snapshot" in message.data
      ) {
        applyRemoteSnapshot(message.data.snapshot);
      }
    };
    return () => {
      window.removeEventListener("storage", onStorage);
      channel.close();
    };
  }, [isClientPreview, projectId]);

  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
      objectUrls.current.clear();
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const syncImmersiveState = () => setImmersive(document.fullscreenElement === canvas);
    document.addEventListener("fullscreenchange", syncImmersiveState);
    return () => document.removeEventListener("fullscreenchange", syncImmersiveState);
  }, [deviceLayout, isClientPreview]);

  function createManagedUrl(file: File) {
    const url = URL.createObjectURL(file);
    objectUrls.current.add(url);
    return url;
  }

  function revokeManagedUrl(url: string | null) {
    if (!url || retainedVersionUrls.current.has(url) || !objectUrls.current.delete(url)) return;
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!initialProject?.draftMediaBySlide) return;
    let cancelled = false;
    void Promise.all(
      Object.entries(initialProject.draftMediaBySlide).map(async ([slideId, key]) => {
        const blob = await getStoryDraftMedia(key);
        if (!blob || cancelled) return null;
        return {
          slideId,
          url: createManagedUrl(new File([blob], "story-media", { type: blob.type })),
        };
      }),
    )
      .then((restored) => {
        if (cancelled) return;
        const urls = new Map(
          restored
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .map(({ slideId, url }) => [slideId, url]),
        );
        setSlides((current) =>
          current.map((slide) =>
            urls.has(slide.id) ? { ...slide, mediaUrl: urls.get(slide.id)! } : slide,
          ),
        );
      })
      .catch((cause: unknown) => {
        setMediaError(
          cause instanceof Error ? cause.message : "Could not restore saved story media.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [initialProject]);

  function retainVersionAssets(snapshot: Record<string, unknown>) {
    const collect = (value: unknown) => {
      if (typeof value === "string" && value.startsWith("blob:")) {
        retainedVersionUrls.current.add(value);
      } else if (Array.isArray(value)) {
        value.forEach(collect);
      } else if (value && typeof value === "object") {
        Object.values(value).forEach(collect);
      }
    };
    collect(snapshot);
  }

  async function validateMediaFile(file: File) {
    return validateStoryMediaHeader(file, new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  }

  function inspectVideo(url: string) {
    return new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
      const video = document.createElement("video");
      const cleanup = () => {
        video.removeAttribute("src");
        video.load();
      };
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const dimensions = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        };
        cleanup();
        if (
          !Number.isFinite(dimensions.duration) ||
          dimensions.duration <= 0 ||
          dimensions.duration > MAX_STORY_VIDEO_SECONDS ||
          dimensions.width <= 0 ||
          dimensions.height <= 0
        ) {
          reject(new Error("Choose a playable MP4 video up to 60 seconds long."));
          return;
        }
        resolve(dimensions);
      };
      video.onerror = () => {
        cleanup();
        reject(new Error("This MP4 could not be opened by the browser."));
      };
      video.src = url;
    });
  }

  async function uploadMedia(files: File[]) {
    if (!activeSlide || files.length !== 1) {
      setMediaError("Choose one photo, GIF, or video for this slide.");
      return;
    }
    let url: string | null = null;
    let storedMediaKey: string | null = null;
    try {
      const file = files[0];
      const mediaType = await validateMediaFile(file);
      storedMediaKey = `${projectId}:${activeSlide.id}:${createStoryEditorId()}`;
      await putStoryDraftMedia(storedMediaKey, file);
      url = createManagedUrl(file);
      let videoDuration = 15;
      if (mediaType === "video") videoDuration = (await inspectVideo(url)).duration;
      const nextMediaUrl = url;
      const boundedDuration = Math.min(videoDuration, 15);
      const previousSettings = mediaSettingsBySlide[activeSlide.id] ?? DEFAULT_STORY_MEDIA_SETTINGS;
      const oldMediaKey = draftMediaBySlide[activeSlide.id];
      if (oldMediaKey) void deleteStoryDraftMedia(oldMediaKey);
      setDraftMediaBySlide((current) => ({ ...current, [activeSlide.id]: storedMediaKey! }));
      for (const collageUrl of previousSettings.collageImageUrls) revokeManagedUrl(collageUrl);
      setSlides((current) =>
        current.map((slide) =>
          slide.id === activeSlide.id
            ? {
                ...slide,
                mediaType,
                mediaUrl: nextMediaUrl,
                duration: 15,
                updatedAt: new Date().toISOString(),
              }
            : slide,
        ),
      );
      setMediaSettingsBySlide((current) => ({
        ...current,
        [activeSlide.id]: {
          ...DEFAULT_STORY_MEDIA_SETTINGS,
          collageLayout:
            current[activeSlide.id]?.collageLayout ?? DEFAULT_STORY_MEDIA_SETTINGS.collageLayout,
          backgroundBlur: current[activeSlide.id]?.backgroundBlur ?? 0,
          backgroundAssetUrl: current[activeSlide.id]?.backgroundAssetUrl ?? null,
          videoStart: 0,
          videoEnd: boundedDuration,
          sourceDuration: videoDuration,
          reverse: false,
          stabilize: false,
          collageImageUrls: [],
        },
      }));
      if (activeSlide.mediaUrl) revokeManagedUrl(activeSlide.mediaUrl);
      setMediaError("");
    } catch (cause) {
      if (url) revokeManagedUrl(url);
      if (storedMediaKey) void deleteStoryDraftMedia(storedMediaKey);
      setMediaError(cause instanceof Error ? cause.message : "Could not load this media.");
    }
  }

  async function uploadCollage(files: File[]) {
    if (!activeSlide) return;
    if (files.length < 1 || files.length > 4) {
      setMediaError("Choose between one and four photos for a collage.");
      return;
    }
    const urls: string[] = [];
    try {
      for (const file of files) {
        const mediaType = await validateMediaFile(file);
        if (mediaType !== "image") throw new Error("Collage supports JPEG, PNG, or WebP photos.");
        urls.push(createManagedUrl(file));
      }
      const previous = mediaSettingsBySlide[activeSlide.id] ?? DEFAULT_STORY_MEDIA_SETTINGS;
      for (const previousUrl of previous.collageImageUrls) revokeManagedUrl(previousUrl);
      setMediaSettingsBySlide((current) => ({
        ...current,
        [activeSlide.id]: { ...previous, collageImageUrls: urls },
      }));
      touchActiveSlide();
      setMediaError("");
    } catch (cause) {
      for (const url of urls) revokeManagedUrl(url);
      setMediaError(cause instanceof Error ? cause.message : "Could not create this collage.");
    }
  }

  async function uploadBackground(file: File, type: "image" | "video") {
    if (!activeSlide) return;
    let url: string | null = null;
    try {
      const mediaType = await validateMediaFile(file);
      if (
        (type === "video" && mediaType !== "video") ||
        (type === "image" && mediaType !== "image")
      ) {
        throw new Error(`Choose a supported background ${type}.`);
      }
      url = createManagedUrl(file);
      if (mediaType === "video") await inspectVideo(url);
      const nextUrl = url;
      const previous = mediaSettingsBySlide[activeSlide.id] ?? DEFAULT_STORY_MEDIA_SETTINGS;
      revokeManagedUrl(previous.backgroundAssetUrl);
      setMediaSettingsBySlide((current) => ({
        ...current,
        [activeSlide.id]: { ...previous, backgroundAssetUrl: nextUrl },
      }));
      setSlides((current) =>
        current.map((slide) =>
          slide.id === activeSlide.id
            ? {
                ...slide,
                backgroundType: type,
                background: nextUrl,
                updatedAt: new Date().toISOString(),
              }
            : slide,
        ),
      );
      setMediaError("");
    } catch (cause) {
      if (url) revokeManagedUrl(url);
      setMediaError(cause instanceof Error ? cause.message : "Could not load this background.");
    }
  }

  async function uploadStickerAsset(file: File) {
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      throw new Error("Custom stickers must be smaller than 5 MB.");
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (file.type === "image/png" && extension === "png") {
      validateStoryStickerPng(new Uint8Array(await file.slice(0, 8).arrayBuffer()));
      return createManagedUrl(file);
    }
    if ((file.type === "image/svg+xml" || extension === "svg") && extension === "svg") {
      const sanitized = sanitizeStoryStickerSvg(await file.text());
      return createManagedUrl(new File([sanitized], file.name, { type: "image/svg+xml" }));
    }
    throw new Error("Choose a PNG or SVG sticker image.");
  }

  async function uploadBrandLogo(file: File) {
    try {
      const url = await uploadStickerAsset(file);
      revokeManagedUrl(brandOverlay.logoUrl);
      setBrandOverlay((current) => ({ ...current, logoUrl: url }));
      setMediaError("");
    } catch (cause) {
      setMediaError(cause instanceof Error ? cause.message : "Could not load the logo.");
    }
  }

  function addInteractiveSticker(type: StoryStickerType) {
    if (!activeSlide || !STORY_INTERACTIVE_STICKER_TYPES.includes(type)) return;
    if (activeSlide.stickers.length >= MAX_STORY_STICKERS_PER_SLIDE) {
      setMediaError("A slide can contain at most 100 stickers.");
      return;
    }
    const before = captureSceneSnapshot();
    const sticker = createStorySticker(type, activeSlide.id);
    sticker.zIndex = nextSceneZIndex(before);
    const after = { ...before, stickers: [...before.stickers, sticker] };
    recordSceneEdit(before, after, "create-sticker");
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? {
              ...slide,
              stickers: after.stickers,
              updatedAt: new Date().toISOString(),
            }
          : slide,
      ),
    );
    selectSceneObject(sticker.id, "sticker");
  }

  function addCatalogSticker(item: StoryStickerCatalogItem) {
    if (!activeSlide) return;
    if (activeSlide.stickers.length >= MAX_STORY_STICKERS_PER_SLIDE) {
      setMediaError("A slide can contain at most 100 stickers.");
      return;
    }
    const before = captureSceneSnapshot();
    const sticker = createStorySticker("emoji", activeSlide.id, item.emoji);
    sticker.zIndex = nextSceneZIndex(before);
    const config: StoryStickerConfig = {
      catalogId: item.id,
      category: item.category,
      color: item.color,
      background: item.background,
      animation: item.animation,
      assetUrl: item.assetUrl,
    };
    sticker.config = JSON.stringify(config);
    const after = { ...before, stickers: [...before.stickers, sticker] };
    recordSceneEdit(before, after, "create-sticker");
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? {
              ...slide,
              stickers: after.stickers,
              updatedAt: new Date().toISOString(),
            }
          : slide,
      ),
    );
    selectSceneObject(sticker.id, "sticker");
  }

  function addStickerDefinition(definition: StoryStickerDefinition) {
    if (!activeSlide || activeSlide.stickers.length >= MAX_STORY_STICKERS_PER_SLIDE) {
      if (activeSlide) setMediaError("A slide can contain at most 100 stickers.");
      return;
    }
    const before = captureSceneSnapshot();
    const sticker = createStoryStickerFromDefinition(definition, activeSlide.id);
    sticker.zIndex = nextSceneZIndex(before);
    const after = { ...before, stickers: [...before.stickers, sticker] };
    recordSceneEdit(before, after, "create-sticker");
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? { ...slide, stickers: after.stickers, updatedAt: new Date().toISOString() }
          : slide,
      ),
    );
    selectSceneObject(sticker.id, "sticker");
  }

  function updateStoryDrawing(value: StoryDrawingDocument) {
    if (!activeSlide) return;
    setDrawingsBySlide((current) => ({ ...current, [activeSlide.id]: value }));
    touchActiveSlide();
  }

  function updateCatalogStickerTransform(
    id: string,
    transform: { x: number; y: number; scale: number; rotation: number },
  ) {
    if (!activeSlide) return;
    if (!catalogStickerTransformStartRef.current) {
      catalogStickerTransformStartRef.current = {
        slideId: activeSlide.id,
        snapshot: captureSceneSnapshot(),
      };
    }
    const updatedAt = new Date().toISOString();
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? {
              ...slide,
              stickers: slide.stickers.map((item) =>
                item.id === id ? { ...item, ...transform, updatedAt } : item,
              ),
              updatedAt,
            }
          : slide,
      ),
    );
  }

  function commitCatalogStickerTransform(
    id: string,
    transform: { x: number; y: number; scale: number; rotation: number },
  ) {
    const start = catalogStickerTransformStartRef.current;
    catalogStickerTransformStartRef.current = null;
    if (!start || start.slideId !== activeSlide?.id) return;
    const after = {
      ...start.snapshot,
      stickers: start.snapshot.stickers.map((item) =>
        item.id === id ? { ...item, ...transform, updatedAt: new Date().toISOString() } : item,
      ),
    };
    recordSceneEdit(start.snapshot, after, "transform-sticker");
  }

  function addCustomSticker(url: string) {
    if (!activeSlide || activeSlide.stickers.length >= MAX_STORY_STICKERS_PER_SLIDE) {
      revokeManagedUrl(url);
      if (activeSlide) setMediaError("A slide can contain at most 100 stickers.");
      return;
    }
    const before = captureSceneSnapshot();
    const sticker = createStorySticker("custom", activeSlide.id);
    sticker.zIndex = nextSceneZIndex(before);
    sticker.config = JSON.stringify({ customType: "image", assetUrl: url });
    const after = { ...before, stickers: [...before.stickers, sticker] };
    recordSceneEdit(before, after, "create-sticker");
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? {
              ...slide,
              stickers: after.stickers,
              updatedAt: new Date().toISOString(),
            }
          : slide,
      ),
    );
    selectSceneObject(sticker.id, "sticker");
  }

  function updateSticker(id: string, patch: Partial<Sticker>) {
    if (!activeSlide) return;
    const before = captureSceneSnapshot();
    const after = {
      ...before,
      stickers: before.stickers.map((sticker) =>
        sticker.id === id ? { ...sticker, ...patch, updatedAt: new Date().toISOString() } : sticker,
      ),
    };
    recordSceneEdit(before, after, "update-sticker");
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? {
              ...slide,
              stickers: after.stickers,
              updatedAt: new Date().toISOString(),
            }
          : slide,
      ),
    );
  }

  function deleteSticker(id: string) {
    if (!activeSlide) return;
    const before = captureSceneSnapshot();
    const after = { ...before, stickers: before.stickers.filter((item) => item.id !== id) };
    recordSceneEdit(before, after, "delete-sticker");
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? {
              ...slide,
              stickers: after.stickers,
              updatedAt: new Date().toISOString(),
            }
          : slide,
      ),
    );
    if (selectedObjectId === id) selectSceneObject(null);
  }

  function updateBrandOverlay(patch: Partial<StoryBrandOverlay>) {
    if (templateLocks.logoPosition && (patch.logoX !== undefined || patch.logoY !== undefined)) {
      setMediaError("Unlock template logo position before moving the logo.");
      return;
    }
    if (patch.logoUrl === null) revokeManagedUrl(brandOverlay.logoUrl);
    setBrandOverlay((current) => ({ ...current, ...patch }));
  }

  function applyBrandKitToStory(kit: StoryBrandKit) {
    setTextOverlaysBySlide((current) =>
      Object.fromEntries(
        Object.entries(current).map(([slideId, overlays]) => [
          slideId,
          applyStoryBrandKitToOverlays(overlays, kit, templateLocks.colors),
        ]),
      ),
    );
    if (!templateLocks.colors) {
      setSlides((current) =>
        current.map((slide) =>
          slide.backgroundType === "solid"
            ? { ...slide, background: kit.secondaryColor, updatedAt: new Date().toISOString() }
            : slide,
        ),
      );
    }
  }

  function updateBrandKit(patch: Partial<StoryBrandKit>) {
    if (
      templateLocks.colors &&
      Object.keys(patch).some((key) =>
        ["primaryColor", "secondaryColor", "accentColor"].includes(key),
      )
    ) {
      setMediaError("Unlock template colors before changing the brand palette.");
      return;
    }
    const nextKit = { ...brandKit, ...patch };
    setBrandKit(nextKit);
    const styleChanged = Object.keys(patch).some((key) => key !== "name");
    if (nextKit.autoApply && styleChanged) {
      applyBrandKitToStory(nextKit);
    }
  }

  function applyBrandKitNow() {
    applyBrandKitToStory(brandKit);
    setMediaError("");
  }

  function applyStoryTemplate(templateId: string) {
    if (!activeSlide) return;
    const template = getStoryTemplate(templateId);
    if (!template) {
      setMediaError("Choose a supported story template.");
      return;
    }
    if (
      activeTextOverlays.length &&
      !window.confirm(
        "Replace text overlays on this slide with the template? Media and stickers will stay.",
      )
    ) {
      return;
    }
    if (
      template.poll &&
      !activeStickers.some((sticker) => sticker.type === "poll") &&
      activeStickers.length >= MAX_STORY_STICKERS_PER_SLIDE
    ) {
      setMediaError("Remove a sticker before applying the poll campaign template.");
      return;
    }
    const overlays = createStoryTemplateOverlays(templateId, brandKit);
    setTextOverlaysBySlide((current) => ({ ...current, [activeSlide.id]: overlays }));
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? {
              ...slide,
              backgroundType: "solid",
              background: brandKit[template.backgroundRole],
              stickers:
                template.poll && !slide.stickers.some((sticker) => sticker.type === "poll")
                  ? [
                      ...slide.stickers,
                      {
                        ...createStorySticker("poll", slide.id, "Which do you prefer?"),
                        config: JSON.stringify({
                          options: ["Option A", "Option B"],
                          votes: [0, 0],
                          showResults: true,
                          selectedOption: null,
                        }),
                      },
                    ]
                  : slide.stickers,
              updatedAt: new Date().toISOString(),
            }
          : slide,
      ),
    );
    if (brandKit.autoApply) applyBrandKitToStory(brandKit);
    selectSceneObject(overlays[0]?.id ?? null, overlays.length ? "text" : undefined);
    setMediaError("");
  }

  function touchActiveSlide() {
    if (!activeSlide) return;
    const updatedAt = new Date().toISOString();
    setSlides((current) =>
      current.map((slide) => (slide.id === activeSlide.id ? { ...slide, updatedAt } : slide)),
    );
  }

  function updateSlideDuration(duration: number) {
    if (!activeSlide || ![3, 5, 10, 15].includes(duration)) return;
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? { ...slide, duration, updatedAt: new Date().toISOString() }
          : slide,
      ),
    );
    if (elapsedRef.current > duration * 1000) {
      elapsedRef.current = duration * 1000;
      setElapsedMs(duration * 1000);
    }
  }

  function updateTransition(transition: StoryTransitionSettings) {
    if (!activeSlide) return;
    const bounded = {
      type: transition.type,
      duration: Math.min(1.5, Math.max(0.3, transition.duration)),
    };
    setTransitionsBySlide((current) => ({ ...current, [activeSlide.id]: bounded }));
    touchActiveSlide();
  }

  function updateSlideLoop(loop: boolean) {
    if (!activeSlide) return;
    setSlideLoops((current) => ({ ...current, [activeSlide.id]: loop }));
    touchActiveSlide();
  }

  function navigateToSlide(nextIndex: number, fromIndex = activeIndex, animate = true) {
    if (nextIndex < 0 || nextIndex >= slides.length) return;
    if (animate && nextIndex !== fromIndex) {
      const fromSlide = slides[fromIndex];
      const settings = fromSlide
        ? (transitionsBySlide[fromSlide.id] ?? { type: "fade" as const, duration: 0.5 })
        : { type: "fade" as const, duration: 0.5 };
      setTransitionPreview((current) => ({
        type: settings.type,
        duration: settings.duration,
        fromLeft: nextIndex < fromIndex,
        sequence: current.sequence + 1,
      }));
    }
    setActiveIndex(nextIndex);
    selectSceneObject(null);
    elapsedRef.current = 0;
    setElapsedMs(0);
    setAnimationPreviewActive(playing);
  }

  function updateMediaSettings(patch: Partial<StorySlideMediaSettings>) {
    if (!activeSlide) return;
    const previous = mediaSettingsBySlide[activeSlide.id] ?? DEFAULT_STORY_MEDIA_SETTINGS;
    if (patch.collageImageUrls?.length === 0 && previous.collageImageUrls.length) {
      for (const url of previous.collageImageUrls) revokeManagedUrl(url);
    }
    setMediaSettingsBySlide((current) => {
      return { ...current, [activeSlide.id]: { ...previous, ...patch } };
    });
    touchActiveSlide();
  }

  function updateBackground(type: StoryBackgroundType, value: string | null) {
    if (!activeSlide) return;
    if (templateLocks.colors && ["solid", "gradient", "pattern"].includes(type)) {
      setMediaError("Unlock template colors before changing this slide background.");
      return;
    }
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? {
              ...slide,
              backgroundType: type,
              background: value,
              updatedAt: new Date().toISOString(),
            }
          : slide,
      ),
    );
    if (type !== "image" && type !== "video") {
      const previous = mediaSettingsBySlide[activeSlide.id] ?? DEFAULT_STORY_MEDIA_SETTINGS;
      revokeManagedUrl(previous.backgroundAssetUrl);
      setMediaSettingsBySlide((current) => {
        return {
          ...current,
          [activeSlide.id]: { ...previous, backgroundAssetUrl: null },
        };
      });
    }
  }

  function addStyledText(draft: StoryTextDraft) {
    if (!activeSlide || activeTextOverlays.length >= 20) return;
    const before = captureSceneSnapshot();
    const created = createTextOverlay();
    const overlay: StoryTextOverlay = {
      ...created,
      content: draft.content,
      fontFamily: draft.fontFamily,
      fontSize: draft.fontSize,
      fontWeight: draft.bold ? 700 : 400,
      color: draft.color,
      background: draft.backgroundColor,
      italic: draft.italic,
      align: draft.alignment,
      zIndex: nextSceneZIndex(before),
    };
    const after = { ...before, text: [...before.text, overlay] };
    recordSceneEdit(before, after, "create-text");
    setTextOverlaysBySlide((current) => ({ ...current, [activeSlide.id]: after.text }));
    touchActiveSlide();
    selectSceneObject(overlay.id, "text");
    setTextStudioOpen(false);
  }

  function selectSlideById(id: string) {
    const index = slides.findIndex((slide) => slide.id === id);
    if (index >= 0) selectSlide(index);
  }

  function duplicateSlide(id: string) {
    if (slides.length >= MAX_STORY_SLIDES) return;
    const source = slides.find((slide) => slide.id === id);
    if (!source) return;
    const nextId = createStoryEditorId();
    const copy: Slide = {
      ...source,
      id: nextId,
      order: source.order + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stickers: source.stickers.map((item) => ({ ...item, id: createStoryEditorId() })),
    };
    setSlideHistory((history) => pushEditorHistory(history, slides));
    setSlides((current) =>
      [...current.slice(0, source.order + 1), copy, ...current.slice(source.order + 1)].map(
        (slide, order) => ({ ...slide, order }),
      ),
    );
    if (textOverlaysBySlide[id])
      setTextOverlaysBySlide((current) => ({
        ...current,
        [nextId]: current[id].map((item) => ({ ...item, id: createStoryEditorId() })),
      }));
    if (shapesBySlide[id])
      setShapesBySlide((current) => ({
        ...current,
        [nextId]: current[id].map((item) => ({ ...item, id: createStoryEditorId() })),
      }));
    if (drawingsBySlide[id])
      setDrawingsBySlide((current) => ({ ...current, [nextId]: current[id] }));
    if (mediaSettingsBySlide[id])
      setMediaSettingsBySlide((current) => ({ ...current, [nextId]: { ...current[id] } }));
    if (draftMediaBySlide[id])
      setDraftMediaBySlide((current) => ({ ...current, [nextId]: current[id] }));
    setActiveIndex(source.order + 1);
  }

  function moveSlideById(id: string, direction: -1 | 1) {
    const index = slides.findIndex((slide) => slide.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= slides.length) return;
    setSlideHistory((history) => pushEditorHistory(history, slides));
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    setSlides(next.map((slide, order) => ({ ...slide, order })));
    setActiveIndex((current) =>
      current === index ? target : current === target ? index : current,
    );
  }

  function updateTextOverlay(id: string, patch: Partial<StoryTextOverlay>) {
    if (!activeSlide) return;
    const before = captureSceneSnapshot();
    const safePatch = templateLocks.colors
      ? Object.fromEntries(
          Object.entries(patch).filter(([key]) => !["color", "background", "stroke"].includes(key)),
        )
      : patch;
    const after = {
      ...before,
      text: before.text.map((overlay) =>
        overlay.id === id ? { ...overlay, ...safePatch } : overlay,
      ),
    };
    recordSceneEdit(before, after, "update-text");
    setTextOverlaysBySlide((current) => ({
      ...current,
      [activeSlide.id]: after.text,
    }));
    touchActiveSlide();
  }

  function deleteTextOverlay(id: string) {
    if (!activeSlide) return;
    const before = captureSceneSnapshot();
    const after = { ...before, text: before.text.filter((overlay) => overlay.id !== id) };
    recordSceneEdit(before, after, "delete-text");
    setTextOverlaysBySlide((current) => ({
      ...current,
      [activeSlide.id]: after.text,
    }));
    touchActiveSlide();
    if (selectedObjectId === id) selectSceneObject(null);
  }

  function duplicateTextOverlay(id: string) {
    if (!activeSlide || activeTextOverlays.length >= 20) return;
    const source = activeTextOverlays.find((item) => item.id === id);
    if (!source) return;
    const before = captureSceneSnapshot();
    const copy: StoryTextOverlay = {
      ...source,
      id: createStoryEditorId(),
      x: Math.min(90, source.x + 4),
      y: Math.min(90, source.y + 4),
      zIndex: nextSceneZIndex(before),
    };
    const after = { ...before, text: [...before.text, copy] };
    recordSceneEdit(before, after, "duplicate-text");
    setTextOverlaysBySlide((current) => ({ ...current, [activeSlide.id]: after.text }));
    touchActiveSlide();
    selectSceneObject(copy.id, "text");
  }

  function previewSelectedTextAnimation() {
    if (animationPreviewTimer.current !== null) {
      window.clearTimeout(animationPreviewTimer.current);
    }
    const selected = activeTextOverlays.find((overlay) => overlay.id === selectedTextId);
    const previewDuration = selected
      ? Math.min(
          20,
          (selected.startAt + (selected.animationDelay ?? 0) + selected.animationDuration + 0.15) *
            1000,
        )
      : 1200;
    elapsedRef.current = 0;
    setElapsedMs(0);
    setAnimationPreviewActive(true);
    setPlaying(true);
    animationPreviewTimer.current = window.setTimeout(
      () => {
        setPlaying(false);
        setAnimationPreviewActive(false);
        animationPreviewTimer.current = null;
      },
      Math.max(400, previewDuration),
    );
  }

  useEffect(
    () => () => {
      if (animationPreviewTimer.current !== null)
        window.clearTimeout(animationPreviewTimer.current);
    },
    [],
  );

  const selectSlide = useCallback(
    (index: number) => {
      navigateToSlide(index, activeIndex);
    },
    [activeIndex, playing, slides, transitionsBySlide],
  );

  const moveSlide = useCallback(
    (direction: -1 | 1) => {
      const index = getAdjacentStorySlideIndex(activeIndex, slides.length, direction);
      navigateToSlide(index, activeIndex);
    },
    [activeIndex, playing, slides, transitionsBySlide],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const editable = isStoryEditorEditableTarget(
        event.target instanceof Element ? event.target : null,
      );
      if (!editable && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoSceneEdit();
        else undoSceneEdit();
        return;
      }
      if (!editable && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoSceneEdit();
        return;
      }
      const action = getStoryEditorShortcut(event.key, {
        editable,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      });
      if (!action) return;
      if (action === "exit-preview" && !immersive) return;
      event.preventDefault();
      if (isClientPreview && action === "delete-selection") return;
      if (action === "previous-slide") moveSlide(-1);
      else if (action === "next-slide") moveSlide(1);
      else if (action === "first-slide") navigateToSlide(0);
      else if (action === "last-slide") navigateToSlide(slides.length - 1);
      else if (action === "toggle-playback") togglePlayback();
      else if (action === "delete-selection") {
        if (selectedTextId && activeTextOverlays.some((overlay) => overlay.id === selectedTextId)) {
          deleteTextOverlay(selectedTextId);
        } else if (
          selectedStickerId &&
          activeStickers.some((sticker) => sticker.id === selectedStickerId)
        ) {
          deleteSticker(selectedStickerId);
        } else if (
          selectedObjectId &&
          activeShapes.some((shape) => shape.id === selectedObjectId)
        ) {
          deleteShape(selectedObjectId);
        }
      } else if (action === "exit-preview") void exitImmersivePreview();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeStickers,
    activeTextOverlays,
    activeShapes,
    deleteShape,
    deleteSticker,
    deleteTextOverlay,
    immersive,
    isClientPreview,
    moveSlide,
    navigateToSlide,
    selectedStickerId,
    selectedObjectId,
    selectedTextId,
    slides.length,
    togglePlayback,
    sceneHistory,
  ]);

  useEffect(() => {
    if (!playing) return undefined;
    if (!activeSlide) return undefined;
    let frame = 0;
    let lastUiUpdate = 0;
    let startedAt = performance.now() - elapsedRef.current;
    const tick = (now: number) => {
      const nextElapsed = now - startedAt;
      if (nextElapsed >= activeDurationMs) {
        const advance = getStoryPlaybackAdvance(
          activeIndex,
          slides.length,
          slideLoops[activeSlide.id] ?? false,
          storyLoop,
        );
        if (advance.repeatSlide) {
          elapsedRef.current = 0;
          setElapsedMs(0);
          startedAt = now;
          frame = window.requestAnimationFrame(tick);
          return;
        }
        if (advance.continuePlaying) {
          navigateToSlide(advance.nextIndex, activeIndex);
          return;
        }
        elapsedRef.current = activeDurationMs;
        setElapsedMs(activeDurationMs);
        setPlaying(false);
        return;
      }
      elapsedRef.current = nextElapsed;
      if (now - lastUiUpdate >= 100) {
        lastUiUpdate = now;
        setElapsedMs(nextElapsed);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeDurationMs,
    activeIndex,
    activeSlide,
    playing,
    slideLoops,
    storyLoop,
    slides,
    transitionsBySlide,
  ]);

  function addSlide() {
    if (slides.length >= MAX_STORY_SLIDES) return;
    setSlideHistory((history) => pushEditorHistory(history, slides));
    const nextSlide = createSlide(storyId, slides.length);
    setSlides((current) => [...current, nextSlide]);
    setActiveIndex(slides.length);
    elapsedRef.current = 0;
    setElapsedMs(0);
    setAnimationPreviewActive(false);
    setPlaying(false);
    selectSceneObject(null);
  }

  function removeActiveSlide(slideId?: string) {
    if (slides.length <= 1) return;
    const removalIndex = slideId ? slides.findIndex((slide) => slide.id === slideId) : activeIndex;
    if (removalIndex < 0) return;
    setSlideHistory((history) => pushEditorHistory(history, slides));
    const nextSlides = slides
      .filter((_, index) => index !== removalIndex)
      .map((slide, order) => ({ ...slide, order, updatedAt: new Date().toISOString() }));
    const deletedSlideId = slides[removalIndex]?.id;
    if (deletedSlideId) {
      const deletedSlide = slides[removalIndex];
      const mediaSettings = mediaSettingsBySlide[deletedSlideId];
      const draftMediaKey = draftMediaBySlide[deletedSlideId];
      if (
        draftMediaKey &&
        !slides.some(
          (slide, index) => index !== removalIndex && draftMediaBySlide[slide.id] === draftMediaKey,
        )
      ) {
        void deleteStoryDraftMedia(draftMediaKey);
      }
      setDraftMediaBySlide((current) => {
        const next = { ...current };
        delete next[deletedSlideId];
        return next;
      });
      revokeManagedUrl(deletedSlide?.mediaUrl ?? null);
      revokeManagedUrl(mediaSettings?.backgroundAssetUrl ?? null);
      for (const url of mediaSettings?.collageImageUrls ?? []) revokeManagedUrl(url);
      for (const sticker of deletedSlide?.stickers ?? []) {
        revokeManagedUrl(parseStoryStickerConfig(sticker.config).assetUrl ?? null);
      }
      setTextOverlaysBySlide((current) => {
        const next = { ...current };
        delete next[deletedSlideId];
        return next;
      });
      setShapesBySlide((current) => {
        const next = { ...current };
        delete next[deletedSlideId];
        return next;
      });
      setMediaSettingsBySlide((current) => {
        const next = { ...current };
        delete next[deletedSlideId];
        return next;
      });
      selectSceneObject(null);
      setSlideLoops((current) => {
        const next = { ...current };
        delete next[deletedSlideId];
        return next;
      });
      setTransitionsBySlide((current) => {
        const next = { ...current };
        delete next[deletedSlideId];
        return next;
      });
      setRemovedSlides((current) => ({ ...current, [deletedSlideId]: new Date().toISOString() }));
    }
    setSlides(nextSlides);
    setActiveIndex((current) => Math.min(current, nextSlides.length - 1));
    elapsedRef.current = 0;
    setElapsedMs(0);
    setAnimationPreviewActive(false);
    setPlaying(false);
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (elapsedMs >= activeDurationMs) {
      elapsedRef.current = 0;
      setElapsedMs(0);
    }
    setAnimationPreviewActive(true);
    setPlaying(true);
  }

  function restoreStorySnapshot(snapshot: Record<string, unknown>) {
    if (snapshot.scope === "slide" && snapshot.slide && typeof snapshot.slide === "object") {
      const restoredSlide = {
        ...(snapshot.slide as Slide),
        updatedAt: new Date().toISOString(),
      };
      setSlides((current) => {
        const exists = current.some((slide) => slide.id === restoredSlide.id);
        const next = exists
          ? current.map((slide) => (slide.id === restoredSlide.id ? restoredSlide : slide))
          : [...current, restoredSlide];
        return next.map((slide, order) => ({ ...slide, order }));
      });
      setTextOverlaysBySlide((current) => ({
        ...current,
        [restoredSlide.id]: Array.isArray(snapshot.textOverlays)
          ? (snapshot.textOverlays as StoryTextOverlay[])
          : [],
      }));
      if (snapshot.mediaSettings) {
        setMediaSettingsBySlide((current) => ({
          ...current,
          [restoredSlide.id]: snapshot.mediaSettings as StorySlideMediaSettings,
        }));
      } else {
        setMediaSettingsBySlide((current) => {
          const next = { ...current };
          delete next[restoredSlide.id];
          return next;
        });
      }
      if (snapshot.transition) {
        setTransitionsBySlide((current) => ({
          ...current,
          [restoredSlide.id]: snapshot.transition as StoryTransitionSettings,
        }));
      } else {
        setTransitionsBySlide((current) => {
          const next = { ...current };
          delete next[restoredSlide.id];
          return next;
        });
      }
      if (typeof snapshot.slideLoop === "boolean") {
        setSlideLoops((current) => ({
          ...current,
          [restoredSlide.id]: snapshot.slideLoop as boolean,
        }));
      } else {
        setSlideLoops((current) => {
          const next = { ...current };
          delete next[restoredSlide.id];
          return next;
        });
      }
      setRemovedSlides((current) => {
        const next = { ...current };
        delete next[restoredSlide.id];
        return next;
      });
      const existingIndex = slides.findIndex((slide) => slide.id === restoredSlide.id);
      setActiveIndex(existingIndex >= 0 ? existingIndex : slides.length);
      setMediaError("");
      return;
    }
    const project =
      snapshot.project && typeof snapshot.project === "object"
        ? (snapshot.project as Record<string, unknown>)
        : snapshot;
    if (!Array.isArray(project.slides) || project.slides.length === 0) {
      setMediaError("This version does not contain a restorable story.");
      return;
    }
    const restored = project as unknown as StoryProjectSnapshot;
    const restoredAt = new Date().toISOString();
    setSlides(restored.slides.map((slide, order) => ({ ...slide, order, updatedAt: restoredAt })));
    setTextOverlaysBySlide(restored.textOverlaysBySlide ?? {});
    setMediaSettingsBySlide(restored.mediaSettingsBySlide ?? {});
    setTransitionsBySlide(restored.transitionsBySlide ?? {});
    setSlideLoops(restored.slideLoops ?? {});
    setStoryLoop(restored.storyLoop ?? false);
    if (restored.brandOverlay) setBrandOverlay(restored.brandOverlay);
    setBrandKit(restored.brandKit ?? { ...DEFAULT_STORY_BRAND_KIT });
    setTemplateLocks(restored.templateLocks ?? { ...DEFAULT_STORY_TEMPLATE_LOCKS });
    const restoredSlideIds = new Set(restored.slides.map((slide) => slide.id));
    setRemovedSlides(
      Object.fromEntries(
        Object.entries(restored.removedSlides ?? {}).filter(([id]) => !restoredSlideIds.has(id)),
      ),
    );
    setActiveIndex(0);
    elapsedRef.current = 0;
    setElapsedMs(0);
    setPlaying(false);
    setMediaError("");
  }

  async function copyCollaborationLink(clientPreview: boolean) {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set(clientPreview ? "clientPreview" : "collab", projectId);
    try {
      await navigator.clipboard.writeText(url.toString());
      setMediaError("");
      setCollaborationNotice(
        clientPreview ? "Client preview link copied." : "Shared project link copied.",
      );
    } catch (cause) {
      setCollaborationNotice("");
      setMediaError(
        cause instanceof Error
          ? `Could not copy the sharing link: ${cause.message}`
          : "Could not copy the sharing link.",
      );
    }
  }

  function openClientPreview() {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("clientPreview", projectId);
    const previewWindow = window.open(url.toString(), "_blank", "noopener,noreferrer");
    if (!previewWindow) {
      setMediaError("The preview tab was blocked. Copy the client preview link instead.");
      return;
    }
    setMediaError("");
    setCollaborationNotice("");
  }

  function openPublishReview() {
    setActiveTool(null);
    setPublishError("");
    setPublishStatus("");
    setPublishProgress(null);
    setPublishSuccess(false);
    setPublishOpen(true);
  }

  async function publishStorySequence() {
    if (publishLock.current) return;
    if (!user) {
      setPublishError("Sign in before publishing a story.");
      return;
    }
    if (!storiesEnabled) {
      setPublishError("Story publishing is currently unavailable.");
      return;
    }
    const slide = slides[activeIndex];
    if (!slide) {
      setPublishError("Select a slide before publishing.");
      return;
    }

    publishLock.current = true;
    setPublishBusy(true);
    setPublishError("");
    setPublishStatus("Preparing your story…");
    setPublishProgress(2);
    const publishedStoryIds: string[] = [];
    try {
      const dimensions = getStoryExportDimensions("1080p");
      if (!dimensions) throw new Error("Story image export is unavailable.");
      for (const [index, storySlide] of slides.entries()) {
        setPublishStatus(`Preparing slide ${index + 1} of ${slides.length}…`);
        const frame: StoryExportFrame = {
          slide: storySlide,
          textOverlays: textOverlaysBySlide[storySlide.id] ?? [],
          shapes: shapesBySlide[storySlide.id] ?? [],
          drawing: drawingsBySlide[storySlide.id],
          mediaSettings: mediaSettingsBySlide[storySlide.id] ?? DEFAULT_STORY_MEDIA_SETTINGS,
          brand: brandOverlay,
        };
        const hasAnimatedOverlays = frame.textOverlays.some(
          (overlay) => overlay.visible !== false && overlay.animation !== "none",
        );
        const hasAnimatedStickers = storySlide.stickers.some((sticker) => {
          const animation = parseStoryStickerConfig(sticker.config).animation;
          return sticker.visible && animation && animation !== "none";
        });
        const soundtrackOffset = slides
          .slice(0, index)
          .reduce((total, previous) => total + Math.max(1, previous.duration), 0);
        const soundtrackEnd = soundtrack?.excerptEndSeconds ?? soundtrack?.durationSeconds ?? null;
        const soundtrackMix =
          soundtrack?.audioUrl &&
          (soundtrackEnd === null ||
            soundtrack.excerptStartSeconds + soundtrackOffset < soundtrackEnd)
            ? {
                url: soundtrack.audioUrl,
                startSeconds: soundtrack.excerptStartSeconds + soundtrackOffset,
                endSeconds: soundtrackEnd,
                volume: soundtrack.volume ?? 0.8,
              }
            : undefined;
        const needsVideoExport =
          storySlide.mediaType === "video" ||
          hasAnimatedOverlays ||
          hasAnimatedStickers ||
          Boolean(soundtrackMix);
        let file: File;
        const segmentStart = (index / slides.length) * 100;
        const segmentSize = 100 / slides.length;
        if (needsVideoExport) {
          const mp4Mime =
            typeof MediaRecorder === "undefined"
              ? null
              : getStoryMp4MimeType((type) => MediaRecorder.isTypeSupported(type));
          if (!mp4Mime) {
            throw new Error(
              "This browser cannot render an edited MP4 for VELORI Stories. Try a browser with MP4 recording support.",
            );
          }
          const blob = await renderStoryMp4(
            [frame],
            dimensions,
            mp4Mime,
            (percent) =>
              setPublishProgress(Math.round(segmentStart + (percent / 100) * segmentSize * 0.55)),
            soundtrackMix,
          );
          file = new File([blob], `velori-story-${storySlide.id}.mp4`, { type: "video/mp4" });
        } else {
          const canvas = document.createElement("canvas");
          [canvas.width, canvas.height] = dimensions;
          const assets = await prepareStoryExportAssets([frame], brandOverlay.logoUrl);
          drawStoryExportFrame(canvas, frame, assets);
          const blob = await canvasToPng(canvas);
          file = new File([blob], `velori-story-${storySlide.id}.png`, { type: "image/png" });
        }
        const id = await publishStory({
          userId: user.id,
          file,
          audience: publishAudience,
          visualDurationSeconds: storySlide.duration,
          composition: compositionMetadata(
            soundtrack,
            storySlide.stickers.find((item) => item.type === "music"),
            soundtrackOffset,
          ),
          caption: publishCaption,
          onStatus: (status) => {
            setPublishStatus(`Slide ${index + 1} of ${slides.length}: ${status}`);
            setPublishProgress(
              Math.round(
                segmentStart +
                  (status.includes("Uploading")
                    ? segmentSize * 0.7
                    : status.includes("Publishing")
                      ? segmentSize * 0.94
                      : segmentSize * 0.6),
              ),
            );
          },
        });
        publishedStoryIds.push(id);
        setPublishProgress(Math.round(segmentStart + segmentSize));
      }
      setPublishProgress(100);
      setPublishStatus(
        slides.length === 1 ? "Your story is live." : `All ${slides.length} story slides are live.`,
      );
      setPublishSuccess(true);
    } catch (cause) {
      setPublishProgress(null);
      const details = [
        cause instanceof Error ? cause.message : "Your story could not be published.",
      ];
      for (const id of publishedStoryIds.reverse()) {
        try {
          await deleteStoryAndMedia(id, user.id, []);
        } catch (cleanupFailure) {
          details.push(
            `A previously published slide could not be removed: ${
              cleanupFailure instanceof Error ? cleanupFailure.message : "cleanup failed"
            }`,
          );
        }
      }
      setPublishError(details.join(" "));
    } finally {
      publishLock.current = false;
      setPublishBusy(false);
    }
  }

  async function enterImmersivePreview() {
    const canvas = canvasRef.current;
    if (!canvas?.requestFullscreen) {
      setMediaError("Full-screen preview is not available in this browser.");
      return;
    }
    try {
      await canvas.requestFullscreen();
      setMediaError("");
    } catch (cause) {
      setMediaError(
        cause instanceof Error ? cause.message : "Could not enter full-screen preview.",
      );
    }
  }

  async function exitImmersivePreview() {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch (cause) {
      setMediaError(cause instanceof Error ? cause.message : "Could not exit full-screen preview.");
    }
  }

  function startPreview() {
    if (!playing) togglePlayback();
    void enterImmersivePreview();
  }

  function leaveStudio() {
    setExitConfirmationOpen(false);
    navigate("/stories");
  }

  function resetCurrentSlideEdits() {
    if (!activeSlide) return;
    const before = captureSceneSnapshot();
    const after = { text: [], stickers: [], shapes: [] } satisfies EditableSceneSnapshot;
    recordSceneEdit(before, after, "reset-scene");
    setTextOverlaysBySlide((current) => ({ ...current, [activeSlide.id]: [] }));
    setSlides((current) =>
      current.map((slide) =>
        slide.id === activeSlide.id
          ? { ...slide, stickers: [], updatedAt: new Date().toISOString() }
          : slide,
      ),
    );
    setShapesBySlide((current) => ({ ...current, [activeSlide.id]: [] }));
    setDrawingsBySlide((current) => ({ ...current, [activeSlide.id]: createDrawingDocument() }));
    selectSceneObject(null);
  }

  const saveDraft = useCallback(() => {
    try {
      writeStoryCollaborationProject(activeStorySnapshot);
      setCollaborationNotice("Draft saved on this device.");
    } catch (cause) {
      setMediaError(cause instanceof Error ? cause.message : "Could not save this draft.");
    }
  }, [activeStorySnapshot]);
  const shortcutActions = useMemo(
    () => ({
      undo: undoSceneEdit,
      redo: redoSceneEdit,
      deleteSelected: () => {
        if (!selectedObjectId || !selectedObjectKind) return;
        if (selectedObjectKind === "text") deleteTextOverlay(selectedObjectId);
        else if (selectedObjectKind === "sticker") deleteSticker(selectedObjectId);
        else deleteShape(selectedObjectId);
      },
      deselect: () => selectSceneObject(null),
      saveDraft,
    }),
    [selectedObjectId, selectedObjectKind, saveDraft],
  );
  useStoryEditorShortcuts(shortcutActions);

  const studioTool =
    activeTool === "media"
      ? "Media"
      : activeTool === "text"
        ? "Text"
        : activeTool === "sticker"
          ? "Stickers"
          : activeTool === "draw"
            ? "Draw"
            : activeTool === "music"
              ? "Music"
              : activeTool === "background"
                ? "Background"
                : null;
  const toolTitle =
    activeTool === "shape"
      ? "Shapes"
      : activeTool === "layout"
        ? "Slides & timing"
        : activeTool === "templates"
          ? "Templates"
          : activeTool === "more"
            ? moreSection === "brand"
              ? "Brand Kit"
              : moreSection === "collaborate"
                ? "Collaborate"
                : "Share & export"
            : undefined;
  const canvasPreview = (
    <StoryCanvas
      activeIndex={activeIndex}
      onNext={() => moveSlide(1)}
      onPrevious={() => moveSlide(-1)}
      playing={playing}
      animationPreviewActive={animationPreviewActive}
      elapsedMs={elapsedMs}
      mediaSettings={activeMediaSettings}
      drawing={activeDrawing}
      drawingActive={activeTool === "draw"}
      onDrawingChange={updateStoryDrawing}
      onDrawingActiveChange={(active) => setActiveTool(active ? "draw" : null)}
      onCatalogStickerTransformChange={updateCatalogStickerTransform}
      onCatalogStickerTransformEnd={commitCatalogStickerTransform}
      brand={brandOverlay}
      onMediaError={reportMediaError}
      onStickerUpdate={updateSticker}
      onSelectObject={selectSceneObject}
      onObjectTransform={transformSceneObject}
      onObjectOrder={orderSceneObject}
      onDeleteObject={(id, kind) => {
        if (kind === "text") deleteTextOverlay(id);
        else if (kind === "sticker") deleteSticker(id);
        else deleteShape(id);
      }}
      onEmptyCanvasClick={() => {}}
      transition={transitionPreview.type}
      transitionDuration={transitionPreview.duration}
      transitionSequence={transitionPreview.sequence}
      transitionFromLeft={transitionPreview.fromLeft}
      containerRef={canvasRef}
      interactivePreview={interactivePreview || isClientPreview}
      immersive={immersive}
      onTogglePlayback={togglePlayback}
      onStartPreview={startPreview}
      onAddMedia={isClientPreview ? undefined : () => setActiveTool("media")}
      onExitImmersive={() => void exitImmersivePreview()}
      onClosePreview={() => {
        setPlaying(false);
        void exitImmersivePreview();
      }}
      progress={progress}
      safeZonesVisible={isClientPreview ? false : safeZonesVisible}
      slides={slides}
      tapAreasVisible={isClientPreview ? false : tapAreasVisible}
      textOverlays={activeTextOverlays}
      shapes={activeShapes}
      selectedObjectId={selectedObjectId}
      editable={!isClientPreview && !playing && !immersive}
    />
  );
  const mediaPanel = activeSlide ? (
    <>
      <MediaTools
        mode={activeTool === "background" ? "background" : "all"}
        error={mediaError}
        onBackgroundChange={updateBackground}
        onCapture={(file) => void uploadMedia([file])}
        onSettingsChange={updateMediaSettings}
        onUploadBackground={(file, type) => void uploadBackground(file, type)}
        onUploadCollage={(files) => void uploadCollage(files)}
        onUploadMedia={(files) => void uploadMedia(files)}
        settings={activeMediaSettings}
        slide={activeSlide}
      />
      {activeTool === "media" && activeSlide.mediaUrl ? (
        <StoryMediaControls
          value={{
            x: activeMediaSettings.cropX / 100,
            y: activeMediaSettings.cropY / 100,
            width: 1,
            height: 1,
            scale: activeMediaSettings.cropZoom,
            rotation: activeMediaSettings.rotation,
            opacity: activeMediaSettings.mediaOpacity ?? 1,
            fit: activeMediaSettings.mediaFit ?? "cover",
          }}
          onChange={(value) =>
            updateMediaSettings({
              cropX: value.x * 100,
              cropY: value.y * 100,
              cropZoom: value.scale,
              rotation: value.rotation,
              mediaOpacity: value.opacity,
              mediaFit: value.fit,
            })
          }
        />
      ) : null}
    </>
  ) : null;
  const textPanel = (
    <>
      <button
        className="ss-primary-light"
        onClick={() => setTextStudioOpen((open) => !open)}
        type="button"
      >
        {textStudioOpen ? "Close text studio" : "Create styled text"}
      </button>
      {textStudioOpen ? (
        <StoryTextStudio onAdd={addStyledText} onClose={() => setTextStudioOpen(false)} />
      ) : null}
      <TextTools
        lockedColors={templateLocks.colors}
        onAdd={() => setTextStudioOpen(true)}
        onDelete={deleteTextOverlay}
        onDuplicate={duplicateTextOverlay}
        onPreviewAnimation={previewSelectedTextAnimation}
        onSelect={(id) => selectSceneObject(id, "text")}
        onUpdate={updateTextOverlay}
        overlays={activeTextOverlays}
        selectedId={selectedTextId}
      />
    </>
  );
  const stickerPanel = (
    <>
      <StoryStickerPicker onSelect={addStickerDefinition} />
      <StickerTools
        mode="stickers"
        brand={brandOverlay}
        lockedLogoPosition={templateLocks.logoPosition}
        onAdd={addInteractiveSticker}
        onAddCatalog={addCatalogSticker}
        onAddCustom={addCustomSticker}
        onBrandChange={updateBrandOverlay}
        onBrandUpload={(file) => void uploadBrandLogo(file)}
        onDelete={deleteSticker}
        onError={setMediaError}
        onSelect={(id) => selectSceneObject(id, "sticker")}
        onUpdate={updateSticker}
        onUploadAsset={uploadStickerAsset}
        selectedId={selectedStickerId}
        stickers={activeStickers}
      />
    </>
  );
  const selectStoryMusic = (track: StudioMusicTrack | null) => {
    setSoundtrack(track);
    if (!track || !activeSlide) return;
    // The soundtrack is audible media; its badge is a real draggable story
    // sticker managed by the same scene editor as other sticker objects.
    setSlides((current) =>
      current.map((slide) => {
        if (slide.id !== activeSlide.id) return slide;
        slide = {
          ...slide,
          duration:
            slide.mediaType === "video"
              ? slide.duration
              : Math.min(
                  20,
                  Math.max(
                    1,
                    (track.excerptEndSeconds ?? track.durationSeconds ?? 15) -
                      track.excerptStartSeconds,
                  ),
                ),
        };
        const existing = slide.stickers.find((sticker) => sticker.type === "music");
        const configured = { title: track.title, artist: track.artistName, volume: 80 };
        if (existing)
          return {
            ...slide,
            stickers: slide.stickers.map((sticker) =>
              sticker.id === existing.id
                ? { ...sticker, config: JSON.stringify(configured) }
                : sticker,
            ),
          };
        if (slide.stickers.length >= MAX_STORY_STICKERS_PER_SLIDE) return slide;
        const next = createStorySticker("music", slide.id, track.title);
        next.config = JSON.stringify(configured);
        next.zIndex =
          slide.stickers.reduce((highest, sticker) => Math.max(highest, sticker.zIndex ?? 0), 0) +
          1;
        return { ...slide, stickers: [...slide.stickers, next] };
      }),
    );
  };
  const musicPanel = <StoryMusicBrowser selected={soundtrack} onSelect={selectStoryMusic} />;
  const layoutPanel = (
    <>
      <StorySlideRail
        slides={slides.map((slide, index) => ({
          id: slide.id,
          thumbnailUrl: slide.mediaUrl,
          label: `Slide ${index + 1}`,
        }))}
        activeSlideId={activeSlide?.id ?? ""}
        canAdd={slides.length < MAX_STORY_SLIDES}
        onSelect={(id) => {
          const index = slides.findIndex((slide) => slide.id === id);
          if (index >= 0) selectSlide(index);
        }}
        onAdd={addSlide}
        onDuplicate={duplicateSlide}
        onDelete={removeActiveSlide}
        onMove={moveSlideById}
      />
      <TemplatesBrandKitPanel
        mode="templates"
        brandKit={brandKit}
        locks={templateLocks}
        onApplyBrandKit={applyBrandKitNow}
        onApplyTemplate={applyStoryTemplate}
        onBrandKitChange={updateBrandKit}
        onLocksChange={(patch) => setTemplateLocks((current) => ({ ...current, ...patch }))}
      />
      {activeSlide ? (
        <TimingTools
          hasNextSlide={activeIndex < slides.length - 1 || storyLoop}
          loopSlide={slideLoops[activeSlide.id] ?? false}
          loopStory={storyLoop}
          onLoopSlideChange={updateSlideLoop}
          onLoopStoryChange={setStoryLoop}
          onSlideDurationChange={updateSlideDuration}
          onTransitionChange={updateTransition}
          slideDuration={activeSlide.duration}
          transition={transitionsBySlide[activeSlide.id] ?? { type: "fade", duration: 0.5 }}
        />
      ) : null}
    </>
  );
  const morePanel = (
    <>
      <nav className="ss-more-nav" aria-label="Additional editor options">
        {(
          [
            ["brand", "Brand Kit"],
            ["collaborate", "Collaborate"],
            ["post", "Share & export"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={moreSection === id}
            onClick={() => setMoreSection(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      {moreSection === "brand" ? (
        <>
          <TemplatesBrandKitPanel
            mode="brand"
            brandKit={brandKit}
            locks={templateLocks}
            onApplyBrandKit={applyBrandKitNow}
            onApplyTemplate={applyStoryTemplate}
            onBrandKitChange={updateBrandKit}
            onLocksChange={(patch) => setTemplateLocks((current) => ({ ...current, ...patch }))}
          />
          <StickerTools
            mode="brand"
            brand={brandOverlay}
            lockedLogoPosition={templateLocks.logoPosition}
            onAdd={addInteractiveSticker}
            onAddCatalog={addCatalogSticker}
            onAddCustom={addCustomSticker}
            onBrandChange={updateBrandOverlay}
            onBrandUpload={(file) => void uploadBrandLogo(file)}
            onDelete={deleteSticker}
            onError={setMediaError}
            onSelect={(id) => selectSceneObject(id, "sticker")}
            onUpdate={updateSticker}
            onUploadAsset={uploadStickerAsset}
            selectedId={selectedStickerId}
            stickers={activeStickers}
          />
        </>
      ) : null}
      {moreSection === "collaborate" ? (
        <CollaborationPanel
          activeSlideId={activeSlide?.id ?? ""}
          notice={collaborationNotice}
          error={mediaError}
          onCopyClientPreview={() => void copyCollaborationLink(true)}
          onClientPreview={openClientPreview}
          onError={setMediaError}
          onRetainVersion={retainVersionAssets}
          onRestore={restoreStorySnapshot}
          onShareProject={() => void copyCollaborationLink(false)}
          overlays={Object.values(textOverlaysBySlide).flat()}
          projectId={projectId}
          slides={slides}
          snapshot={activeStorySnapshot}
        />
      ) : null}
      {moreSection === "post" ? (
        <ExportPublishPanel
          archived={archived}
          brand={brandOverlay}
          soundtrack={soundtrack}
          mediaSettingsBySlide={mediaSettingsBySlide}
          onArchiveChange={setArchived}
          onSaveHighlightCover={(slideId, title, background) =>
            setHighlightCover({ slideId, title, background, updatedAt: new Date().toISOString() })
          }
          onSchedulesChange={setSchedules}
          projectId={projectId}
          schedules={schedules}
          slides={slides}
          shapesBySlide={shapesBySlide}
          drawingsBySlide={drawingsBySlide}
          textOverlaysBySlide={textOverlaysBySlide}
        />
      ) : null}
    </>
  );
  const currentPanel =
    activeTool === "media" || activeTool === "background" ? (
      mediaPanel
    ) : activeTool === "text" ? (
      textPanel
    ) : activeTool === "sticker" ? (
      stickerPanel
    ) : activeTool === "music" ? (
      musicPanel
    ) : activeTool === "shape" ? (
      <ShapeTools
        onAdd={addShape}
        onDelete={deleteShape}
        onSelect={(id) => selectSceneObject(id, "shape")}
        onUpdate={updateShape}
        selectedId={selectedObjectId}
        shapes={activeShapes}
      />
    ) : activeTool === "layout" ? (
      layoutPanel
    ) : activeTool === "templates" ? (
      <TemplatesBrandKitPanel
        mode="templates"
        brandKit={brandKit}
        locks={templateLocks}
        onApplyBrandKit={applyBrandKitNow}
        onApplyTemplate={applyStoryTemplate}
        onBrandKitChange={updateBrandKit}
        onLocksChange={(patch) => setTemplateLocks((current) => ({ ...current, ...patch }))}
      />
    ) : activeTool === "more" ? (
      morePanel
    ) : activeTool === "draw" ? (
      <p className="ss-help">
        Draw directly on the story preview with pointer or touch. Use the Draw tool on the canvas to
        add strokes.
      </p>
    ) : null;
  const menuContent = (
    <>
      <div className="ss-menu-actions">
        <button onClick={startPreview} type="button">
          Preview story
        </button>
        <button onClick={undoSceneEdit} type="button">
          Undo edit
        </button>
        <button onClick={redoSceneEdit} type="button">
          Redo edit
        </button>
        <button onClick={() => setSafeZonesVisible((visible) => !visible)} type="button">
          Safe zones {safeZonesVisible ? "on" : "off"}
        </button>
        <button onClick={() => setTapAreasVisible((visible) => !visible)} type="button">
          Tap areas {tapAreasVisible ? "on" : "off"}
        </button>
        <button onClick={() => setInteractivePreview((visible) => !visible)} type="button">
          Test interactions {interactivePreview ? "on" : "off"}
        </button>
        <button onClick={() => setDarkMode((enabled) => !enabled)} type="button">
          {darkMode ? "Light studio" : "Dark studio"}
        </button>
        <button onClick={() => setActiveTool("shape")} type="button">
          Shapes
        </button>
        <button onClick={() => setActiveTool("layout")} type="button">
          Slides & timing
        </button>
        <button onClick={() => setActiveTool("templates")} type="button">
          Templates
        </button>
        <button
          onClick={() => {
            setMoreSection("brand");
            setActiveTool("more");
          }}
          type="button"
        >
          Brand Kit
        </button>
        <button
          onClick={() => {
            setMoreSection("collaborate");
            setActiveTool("more");
          }}
          type="button"
        >
          Collaborate
        </button>
        <button
          onClick={() => {
            setMoreSection("post");
            setActiveTool("more");
          }}
          type="button"
        >
          Share & export
        </button>
      </div>
      <StorySlideRail
        slides={slides.map((slide, index) => ({
          id: slide.id,
          thumbnailUrl: slide.mediaUrl,
          label: `Slide ${index + 1}`,
        }))}
        activeSlideId={activeSlide?.id ?? ""}
        canAdd={slides.length < MAX_STORY_SLIDES}
        onSelect={(id) => {
          const index = slides.findIndex((slide) => slide.id === id);
          if (index >= 0) selectSlide(index);
        }}
        onAdd={addSlide}
        onDuplicate={duplicateSlide}
        onDelete={removeActiveSlide}
        onMove={moveSlideById}
      />
    </>
  );

  return (
    <>
      <StoryStudio
        activeTool={studioTool}
        onToolChange={(tool) =>
          setActiveTool(
            tool === "Media"
              ? "media"
              : tool === "Text"
                ? "text"
                : tool === "Stickers"
                  ? "sticker"
                  : tool === "Draw"
                    ? "draw"
                    : tool === "Music"
                      ? "music"
                      : tool === "Background"
                        ? "background"
                        : null,
          )
        }
        preview={
          <>
            {canvasPreview}
            <SoundtrackTransport
              track={soundtrack}
              playing={playing}
              seconds={
                slides.slice(0, activeIndex).reduce((sum, slide) => sum + slide.duration, 0) +
                elapsedMs / 1000
              }
            />
          </>
        }
        panel={currentPanel}
        panelOpen={Boolean(activeTool) && !isClientPreview}
        panelTitle={toolTitle}
        menuContent={menuContent}
        status={collaborationNotice}
        error={mediaError}
        publishing={publishBusy}
        readOnly={isClientPreview}
        style={creatorTheme}
        theme={darkMode ? "dark" : "light"}
        overlay={
          <>
            <Dialog
              actions={
                <>
                  <Button onClick={() => setExitConfirmationOpen(false)} variant="secondary">
                    Keep editing
                  </Button>
                  <Button onClick={leaveStudio} variant="danger">
                    Leave Studio
                  </Button>
                </>
              }
              description="Your local draft is saved automatically. You can return to it from this device."
              onClose={() => setExitConfirmationOpen(false)}
              open={exitConfirmationOpen && !isClientPreview}
              title="Leave Story Studio?"
            />
            {!isClientPreview ? (
              <StoryStudioPublishDialog
                audience={publishAudience}
                authenticated={Boolean(user)}
                enabled={storiesEnabled}
                busy={publishBusy}
                caption={publishCaption}
                currentSlide={activeIndex + 1}
                error={publishError}
                onAudienceChange={setPublishAudience}
                onCaptionChange={setPublishCaption}
                onClose={() => setPublishOpen(false)}
                onDone={() => navigate("/home")}
                onPublish={() => void publishStorySequence()}
                onSignIn={() =>
                  navigate("/login", {
                    state: { returnTo: `${window.location.pathname}${window.location.search}` },
                  })
                }
                open={publishOpen}
                progress={publishProgress}
                slideCount={slides.length}
                status={publishStatus}
                success={publishSuccess}
                video={activeSlide?.mediaType === "video"}
              />
            ) : null}
          </>
        }
        onBack={() => (isClientPreview ? navigate("/stories") : setExitConfirmationOpen(true))}
        onReset={resetCurrentSlideEdits}
        onSaveDraft={saveDraft}
        onPublish={openPublishReview}
      />
    </>
  );
}
