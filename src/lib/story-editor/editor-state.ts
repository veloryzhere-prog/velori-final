import { createUuid } from "../uuid.mjs";
export interface StoryEditorTextObject {
  id: string;
  type: "text";
  content: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string | null;
  bold: boolean;
  italic: boolean;
  alignment: "left" | "center" | "right";
  rotation: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

export interface StoryEditorMediaObject {
  id: string;
  type: "image" | "video";
  src: string;
  alt: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  opacity: number;
  fit: "cover" | "contain" | "fill";
  zIndex: number;
}

export interface StoryEditorSlideState {
  id: string;
  backgroundColor: string;
  texts: StoryEditorTextObject[];
  media: StoryEditorMediaObject[];
  stickers: Array<{
    id: string;
    type: string;
    content: string;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    zIndex: number;
    config?: Record<string, unknown>;
  }>;
  drawing: unknown;
  durationMs: number;
}

export interface StoryEditorState {
  version: 1;
  activeSlideId: string;
  slides: StoryEditorSlideState[];
  selectedObjectId: string | null;
  dirty: boolean;
  updatedAt: string;
}

export function createStoryEditorSlide(id: string): StoryEditorSlideState {
  return {
    id,
    backgroundColor: "#111111",
    texts: [],
    media: [],
    stickers: [],
    drawing: {
      version: 1,
      strokes: [],
    },
    durationMs: 7000,
  };
}

export function createStoryEditorState(slideId: string): StoryEditorState {
  return {
    version: 1,
    activeSlideId: slideId,
    slides: [createStoryEditorSlide(slideId)],
    selectedObjectId: null,
    dirty: false,
    updatedAt: new Date().toISOString(),
  };
}

export function getActiveEditorSlide(state: StoryEditorState): StoryEditorSlideState | undefined {
  return state.slides.find((slide) => slide.id === state.activeSlideId);
}

export function updateEditorSlide(
  state: StoryEditorState,
  slideId: string,
  update: (slide: StoryEditorSlideState) => StoryEditorSlideState,
): StoryEditorState {
  const exists = state.slides.some((slide) => slide.id === slideId);

  if (!exists) {
    return state;
  }

  return {
    ...state,
    slides: state.slides.map((slide) => (slide.id === slideId ? update(slide) : slide)),
    dirty: true,
    updatedAt: new Date().toISOString(),
  };
}

export function addEditorSlide(
  state: StoryEditorState,
  slide: StoryEditorSlideState,
): StoryEditorState {
  if (state.slides.some((item) => item.id === slide.id)) {
    throw new Error(`Slide "${slide.id}" already exists.`);
  }

  return {
    ...state,
    slides: [...state.slides, slide],
    activeSlideId: slide.id,
    selectedObjectId: null,
    dirty: true,
    updatedAt: new Date().toISOString(),
  };
}

export function duplicateEditorSlide(state: StoryEditorState, newId: string): StoryEditorState {
  const source = getActiveEditorSlide(state);

  if (!source) {
    return state;
  }

  if (state.slides.some((slide) => slide.id === newId)) {
    throw new Error(`Slide "${newId}" already exists.`);
  }

  const clone: StoryEditorSlideState = {
    ...source,
    id: newId,
    texts: source.texts.map((item) => ({
      ...item,
      id: createUuid(),
    })),
    media: source.media.map((item) => ({
      ...item,
      id: createUuid(),
    })),
    stickers: source.stickers.map((item) => ({
      ...item,
      id: createUuid(),
      config: item.config ? { ...item.config } : undefined,
    })),
    drawing:
      typeof structuredClone === "function"
        ? structuredClone(source.drawing)
        : JSON.parse(JSON.stringify(source.drawing)),
  };

  return addEditorSlide(state, clone);
}

export function deleteEditorSlide(
  state: StoryEditorState,
  slideId: string,
  replacementId?: string,
): StoryEditorState {
  if (state.slides.length <= 1) {
    throw new Error("A story must contain at least one slide.");
  }

  const slides = state.slides.filter((slide) => slide.id !== slideId);

  if (slides.length === state.slides.length) {
    return state;
  }

  const nextActiveId =
    state.activeSlideId === slideId
      ? replacementId && slides.some((slide) => slide.id === replacementId)
        ? replacementId
        : slides[0].id
      : state.activeSlideId;

  return {
    ...state,
    slides,
    activeSlideId: nextActiveId,
    selectedObjectId: null,
    dirty: true,
    updatedAt: new Date().toISOString(),
  };
}

export function reorderEditorSlide(
  state: StoryEditorState,
  sourceId: string,
  targetId: string,
): StoryEditorState {
  if (sourceId === targetId) {
    return state;
  }

  const sourceIndex = state.slides.findIndex((slide) => slide.id === sourceId);

  const targetIndex = state.slides.findIndex((slide) => slide.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0) {
    return state;
  }

  const slides = [...state.slides];
  const [moved] = slides.splice(sourceIndex, 1);
  slides.splice(targetIndex, 0, moved);

  return {
    ...state,
    slides,
    dirty: true,
    updatedAt: new Date().toISOString(),
  };
}

export function selectEditorSlide(state: StoryEditorState, slideId: string): StoryEditorState {
  if (!state.slides.some((slide) => slide.id === slideId)) {
    return state;
  }

  return {
    ...state,
    activeSlideId: slideId,
    selectedObjectId: null,
  };
}

export function selectEditorObject(
  state: StoryEditorState,
  objectId: string | null,
): StoryEditorState {
  return {
    ...state,
    selectedObjectId: objectId,
  };
}
