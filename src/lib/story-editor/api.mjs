const STORY_STATUSES = new Set(["draft", "published", "archived"]);
const MEDIA_TYPES = new Set(["image", "video", "gif", "camera"]);
const BACKGROUND_TYPES = new Set(["solid", "gradient", "image", "video", "pattern"]);
const STICKER_TYPES = new Set([
  "poll",
  "question",
  "quiz",
  "slider",
  "link",
  "countdown",
  "music",
  "mention",
  "location",
  "hashtag",
  "emoji",
  "custom",
]);
const TRANSITION_TYPES = new Set(["fade", "slide", "zoom", "spin", "wipe", "glitch"]);
const MAX_STORY_SLIDES = 10;
const MAX_STICKERS_PER_SLIDE = 100;
const MAX_AUDIO_TRACKS_PER_STORY = 100;
const MAX_CONFIG_LENGTH = 64 * 1024;
const clone = (value) => structuredClone(value);
const now = () => new Date().toISOString();
const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `story-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function requireText(value, name, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new TypeError(`${name} must contain 1–${maxLength} characters.`);
  }
  return value.trim();
}

function optionalText(value, name, maxLength = 4096) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new TypeError(`${name} must be a string of at most ${maxLength} characters.`);
  }
  return value;
}

function finite(value, name, min, max, fallback) {
  const normalized = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(normalized) || normalized < min || normalized > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
  return normalized;
}

function integer(value, name, min, max, fallback) {
  const normalized = finite(value, name, min, max, fallback);
  if (!Number.isInteger(normalized)) throw new TypeError(`${name} must be an integer.`);
  return normalized;
}

function boolean(value, name, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean.`);
  return value;
}

function normalizedJson(value, name) {
  if (value === undefined || value === null || value === "") return null;
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new TypeError(`${name} must be valid JSON.`);
    }
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new TypeError(`${name} must be a JSON object or array.`);
  }
  const serialized = JSON.stringify(parsed);
  if (serialized.length > MAX_CONFIG_LENGTH) {
    throw new RangeError(`${name} must be ${MAX_CONFIG_LENGTH} characters or smaller.`);
  }
  return serialized;
}

function normalizeStory(input = {}, existing) {
  const title = requireText(input.title ?? existing?.title ?? "Untitled Story", "Story title", 120);
  const ownerId = input.ownerId === undefined ? (existing?.ownerId ?? null) : input.ownerId;
  if (
    ownerId !== null &&
    (typeof ownerId !== "string" || !ownerId.trim() || ownerId.length > 255)
  ) {
    throw new TypeError("Story owner id must be a non-empty string or null.");
  }
  const status = input.status ?? existing?.status ?? "draft";
  if (!STORY_STATUSES.has(status)) throw new TypeError("Unsupported story status.");
  const width = integer(input.width ?? existing?.width, "Story width", 1, 4320, 1080);
  const height = integer(input.height ?? existing?.height, "Story height", 1, 7680, 1920);
  if (Math.abs(width / height - 9 / 16) > 0.002) {
    throw new RangeError("Story canvas dimensions must use a 9:16 aspect ratio.");
  }
  return {
    id: existing?.id ?? input.id ?? createId(),
    ownerId: ownerId?.trim() ?? null,
    title,
    status,
    aspectRatio: "9:16",
    width,
    height,
    loop: boolean(input.loop, "Story loop", existing?.loop ?? false),
    createdAt: existing?.createdAt ?? input.createdAt ?? now(),
    updatedAt: now(),
  };
}

function normalizeSlide(input, storyId, existing, order) {
  const mediaType = input.mediaType ?? existing?.mediaType ?? "image";
  const backgroundType = input.backgroundType ?? existing?.backgroundType ?? "solid";
  if (!MEDIA_TYPES.has(mediaType)) throw new TypeError("Unsupported story slide media type.");
  if (!BACKGROUND_TYPES.has(backgroundType))
    throw new TypeError("Unsupported slide background type.");
  return {
    id: existing?.id ?? input.id ?? createId(),
    storyId,
    order: integer(input.order ?? existing?.order, "Slide order", 0, 9, order),
    mediaType,
    mediaUrl:
      input.mediaUrl === undefined
        ? (existing?.mediaUrl ?? null)
        : optionalText(input.mediaUrl, "Slide media URL"),
    duration: finite(input.duration ?? existing?.duration, "Slide duration", 0.1, 15, 5),
    backgroundType,
    background:
      input.background === undefined
        ? (existing?.background ?? null)
        : optionalText(input.background, "Slide background", MAX_CONFIG_LENGTH),
    stickers: existing?.stickers ?? [],
    createdAt: existing?.createdAt ?? input.createdAt ?? now(),
    updatedAt: now(),
  };
}

function normalizeSticker(input, slideId, existing) {
  const type = input.type ?? existing?.type;
  if (!STICKER_TYPES.has(type)) throw new TypeError("Unsupported story sticker type.");
  return {
    id: existing?.id ?? input.id ?? createId(),
    slideId,
    type,
    content:
      input.content === undefined
        ? (existing?.content ?? "")
        : typeof input.content === "string" && input.content.length <= 5000
          ? input.content
          : (() => {
              throw new TypeError("Sticker content must be a string of at most 5000 characters.");
            })(),
    x: finite(input.x ?? existing?.x, "Sticker x", 0, 1, 0.5),
    y: finite(input.y ?? existing?.y, "Sticker y", 0, 1, 0.5),
    scale: finite(input.scale ?? existing?.scale, "Sticker scale", 0.05, 10, 1),
    rotation: finite(input.rotation ?? existing?.rotation, "Sticker rotation", -360, 360, 0),
    zIndex: integer(input.zIndex ?? existing?.zIndex, "Sticker z-index", 0, 10000, 0),
    visible: boolean(input.visible, "Sticker visibility", existing?.visible ?? true),
    config:
      input.config === undefined
        ? (existing?.config ?? null)
        : normalizedJson(input.config, "Sticker configuration"),
    createdAt: existing?.createdAt ?? input.createdAt ?? now(),
    updatedAt: now(),
  };
}

function normalizeAudioTrack(input, storyId, existing, slideIds) {
  const name = requireText(input.name ?? existing?.name, "Audio track name", 255);
  const sourceUrl = requireText(input.sourceUrl ?? existing?.sourceUrl, "Audio source URL", 4096);
  const slideId = input.slideId === undefined ? (existing?.slideId ?? null) : input.slideId;
  if (slideId !== null && !slideIds.has(slideId)) {
    throw new TypeError("Audio track slide id must refer to a slide in this story.");
  }
  const startTime = finite(input.startTime ?? existing?.startTime, "Audio start time", 0, 3600, 0);
  const endTime =
    input.endTime === undefined
      ? (existing?.endTime ?? null)
      : input.endTime === null
        ? null
        : finite(input.endTime, "Audio end time", startTime + 0.001, 3600, startTime + 1);
  return {
    id: existing?.id ?? input.id ?? createId(),
    storyId,
    slideId,
    name,
    sourceUrl,
    startTime,
    endTime,
    volume: finite(input.volume ?? existing?.volume, "Audio volume", 0, 2, 1),
    fadeIn: finite(input.fadeIn ?? existing?.fadeIn, "Audio fade-in", 0, 60, 0),
    fadeOut: finite(input.fadeOut ?? existing?.fadeOut, "Audio fade-out", 0, 60, 0),
    crossfadeIn: finite(input.crossfadeIn ?? existing?.crossfadeIn, "Audio crossfade-in", 0, 60, 0),
    crossfadeOut: finite(
      input.crossfadeOut ?? existing?.crossfadeOut,
      "Audio crossfade-out",
      0,
      60,
      0,
    ),
    muted: boolean(input.muted, "Audio mute", existing?.muted ?? false),
    createdAt: existing?.createdAt ?? input.createdAt ?? now(),
    updatedAt: now(),
  };
}

function normalizeTransition(input, storyId, slides, existing) {
  const fromSlideId = input.fromSlideId ?? existing?.fromSlideId;
  const toSlideId = input.toSlideId ?? existing?.toSlideId;
  if (!fromSlideId || !toSlideId || fromSlideId === toSlideId) {
    throw new TypeError("A transition requires two different slide ids.");
  }
  if (
    !slides.some((slide) => slide.id === fromSlideId) ||
    !slides.some((slide) => slide.id === toSlideId)
  ) {
    throw new TypeError("Transition slide ids must belong to this story.");
  }
  const type = input.type ?? existing?.type ?? "fade";
  if (!TRANSITION_TYPES.has(type)) throw new TypeError("Unsupported story transition type.");
  return {
    id: existing?.id ?? input.id ?? createId(),
    storyId,
    fromSlideId,
    toSlideId,
    type,
    duration: finite(input.duration ?? existing?.duration, "Transition duration", 0.3, 1.5, 0.3),
    parameters:
      input.parameters === undefined
        ? (existing?.parameters ?? null)
        : normalizedJson(input.parameters, "Transition parameters"),
    createdAt: existing?.createdAt ?? input.createdAt ?? now(),
    updatedAt: now(),
  };
}

function normalizeBrandOverride(input, storyId, existing) {
  const opacity = (key, fallback) =>
    finite(input[key] ?? existing?.[key], `Brand ${key}`, 0, 1, fallback);
  const scale = finite(input.logoScale ?? existing?.logoScale, "Brand logo scale", 0.05, 10, 1);
  const brandKitId =
    input.brandKitId === undefined ? (existing?.brandKitId ?? null) : input.brandKitId;
  if (brandKitId !== null && (typeof brandKitId !== "string" || !brandKitId.trim())) {
    throw new TypeError("Brand kit id must be a non-empty string or null.");
  }
  return {
    id: existing?.id ?? input.id ?? createId(),
    storyId,
    brandKitId: brandKitId?.trim() ?? null,
    colors:
      input.colors === undefined
        ? (existing?.colors ?? null)
        : normalizedJson(input.colors, "Brand colors"),
    fonts:
      input.fonts === undefined
        ? (existing?.fonts ?? null)
        : normalizedJson(input.fonts, "Brand fonts"),
    logoUrl:
      input.logoUrl === undefined
        ? (existing?.logoUrl ?? null)
        : optionalText(input.logoUrl, "Brand logo URL"),
    logoX: finite(input.logoX ?? existing?.logoX, "Brand logo x", 0, 1, 0.9),
    logoY: finite(input.logoY ?? existing?.logoY, "Brand logo y", 0, 1, 0.1),
    logoScale: scale,
    logoOpacity: opacity("logoOpacity", 1),
    watermarkText:
      input.watermarkText === undefined
        ? (existing?.watermarkText ?? null)
        : optionalText(input.watermarkText, "Watermark text", 255),
    watermarkOpacity: opacity("watermarkOpacity", 0.5),
    createdAt: existing?.createdAt ?? input.createdAt ?? now(),
    updatedAt: now(),
  };
}

function notFound(message) {
  return { status: 404, body: { error: message } };
}

function validationResponse(error) {
  if (error instanceof TypeError || error instanceof RangeError) {
    return { status: 400, body: { error: error.message } };
  }
  throw error;
}

export function createStoryEditorStore(initialStories = []) {
  const stories = new Map();
  for (const input of initialStories) {
    const story = normalizeStory(input);
    const slides = (input.slides ?? []).map((slide, index) => {
      const normalized = normalizeSlide(slide, story.id, undefined, index);
      normalized.stickers = (slide.stickers ?? []).map((sticker) =>
        normalizeSticker(sticker, normalized.id),
      );
      return normalized;
    });
    if (slides.length > MAX_STORY_SLIDES)
      throw new RangeError("A story can contain at most 10 slides.");
    const slideIds = new Set(slides.map((slide) => slide.id));
    const audioTracks = (input.audioTracks ?? []).map((track) =>
      normalizeAudioTrack(track, story.id, undefined, slideIds),
    );
    const transitions = (input.transitions ?? []).map((transition) =>
      normalizeTransition(transition, story.id, slides),
    );
    const brandOverride = input.brandOverride
      ? normalizeBrandOverride(input.brandOverride, story.id)
      : null;
    stories.set(story.id, {
      ...story,
      slides,
      audioTracks,
      transitions,
      brandOverride,
    });
  }

  const getStory = (storyId) => stories.get(storyId);
  const getSlide = (storyId, slideId) =>
    getStory(storyId)?.slides.find((slide) => slide.id === slideId);

  return {
    getStories() {
      return [...stories.values()].map(clone);
    },
    getStory(storyId) {
      const story = getStory(storyId);
      return story ? clone(story) : undefined;
    },
    createStory(input = {}) {
      const story = normalizeStory(input);
      stories.set(story.id, {
        ...story,
        slides: [],
        audioTracks: [],
        transitions: [],
        brandOverride: null,
      });
      return clone(stories.get(story.id));
    },
    updateStory(storyId, input = {}) {
      const current = getStory(storyId);
      if (!current) return undefined;
      const updates = normalizeStory(input, current);
      const updated = {
        ...current,
        ...updates,
        slides: current.slides,
        audioTracks: current.audioTracks,
        transitions: current.transitions,
        brandOverride: current.brandOverride,
      };
      stories.set(storyId, updated);
      return clone(updated);
    },
    deleteStory(storyId) {
      const story = getStory(storyId);
      if (!story) return undefined;
      stories.delete(storyId);
      return clone(story);
    },
    getSlides(storyId) {
      return getStory(storyId)
        ?.slides.slice()
        .sort((left, right) => left.order - right.order);
    },
    createSlide(storyId, input = {}) {
      const story = getStory(storyId);
      if (!story) return undefined;
      if (story.slides.length >= MAX_STORY_SLIDES)
        throw new RangeError("A story can contain at most 10 slides.");
      const order = input.order ?? story.slides.length;
      if (story.slides.some((slide) => slide.order === order))
        throw new RangeError("A slide already uses this order.");
      const slide = normalizeSlide(input, storyId, undefined, order);
      story.slides.push(slide);
      story.updatedAt = now();
      return clone(slide);
    },
    updateSlide(storyId, slideId, input = {}) {
      const story = getStory(storyId);
      const index = story?.slides.findIndex((slide) => slide.id === slideId) ?? -1;
      if (!story || index < 0) return undefined;
      const slide = normalizeSlide(input, storyId, story.slides[index], story.slides[index].order);
      if (
        story.slides.some((item, itemIndex) => itemIndex !== index && item.order === slide.order)
      ) {
        throw new RangeError("A slide already uses this order.");
      }
      story.slides[index] = slide;
      story.updatedAt = now();
      return clone(slide);
    },
    deleteSlide(storyId, slideId) {
      const story = getStory(storyId);
      const index = story?.slides.findIndex((slide) => slide.id === slideId) ?? -1;
      if (!story || index < 0) return undefined;
      const [deleted] = story.slides.splice(index, 1);
      story.slides.forEach((slide, slideIndex) => {
        slide.order = slideIndex;
      });
      story.audioTracks = story.audioTracks.filter((track) => track.slideId !== slideId);
      story.transitions = story.transitions.filter(
        (transition) => transition.fromSlideId !== slideId && transition.toSlideId !== slideId,
      );
      story.updatedAt = now();
      return clone(deleted);
    },
    getStickers(storyId, slideId) {
      return getSlide(storyId, slideId)?.stickers.map(clone);
    },
    createSticker(storyId, slideId, input = {}) {
      const slide = getSlide(storyId, slideId);
      if (!slide) return undefined;
      if (slide.stickers.length >= MAX_STICKERS_PER_SLIDE) {
        throw new RangeError("A slide can contain at most 100 stickers.");
      }
      const sticker = normalizeSticker(input, slideId);
      slide.stickers.push(sticker);
      return clone(sticker);
    },
    updateSticker(storyId, slideId, stickerId, input = {}) {
      const slide = getSlide(storyId, slideId);
      const index = slide?.stickers.findIndex((sticker) => sticker.id === stickerId) ?? -1;
      if (!slide || index < 0) return undefined;
      slide.stickers[index] = normalizeSticker(input, slideId, slide.stickers[index]);
      return clone(slide.stickers[index]);
    },
    deleteSticker(storyId, slideId, stickerId) {
      const slide = getSlide(storyId, slideId);
      const index = slide?.stickers.findIndex((sticker) => sticker.id === stickerId) ?? -1;
      if (!slide || index < 0) return undefined;
      return clone(slide.stickers.splice(index, 1)[0]);
    },
    getAudioTracks(storyId) {
      return getStory(storyId)?.audioTracks.map(clone);
    },
    createAudioTrack(storyId, input = {}) {
      const story = getStory(storyId);
      if (!story) return undefined;
      if (story.audioTracks.length >= MAX_AUDIO_TRACKS_PER_STORY) {
        throw new RangeError("A story can contain at most 100 audio tracks.");
      }
      const track = normalizeAudioTrack(
        input,
        storyId,
        undefined,
        new Set(story.slides.map((slide) => slide.id)),
      );
      story.audioTracks.push(track);
      story.updatedAt = now();
      return clone(track);
    },
    updateAudioTrack(storyId, trackId, input = {}) {
      const story = getStory(storyId);
      const index = story?.audioTracks.findIndex((track) => track.id === trackId) ?? -1;
      if (!story || index < 0) return undefined;
      story.audioTracks[index] = normalizeAudioTrack(
        input,
        storyId,
        story.audioTracks[index],
        new Set(story.slides.map((slide) => slide.id)),
      );
      return clone(story.audioTracks[index]);
    },
    deleteAudioTrack(storyId, trackId) {
      const story = getStory(storyId);
      const index = story?.audioTracks.findIndex((track) => track.id === trackId) ?? -1;
      if (!story || index < 0) return undefined;
      return clone(story.audioTracks.splice(index, 1)[0]);
    },
    getTransitions(storyId) {
      return getStory(storyId)?.transitions.map(clone);
    },
    createTransition(storyId, input = {}) {
      const story = getStory(storyId);
      if (!story) return undefined;
      const transition = normalizeTransition(input, storyId, story.slides);
      if (
        story.transitions.some(
          (item) =>
            item.fromSlideId === transition.fromSlideId && item.toSlideId === transition.toSlideId,
        )
      ) {
        throw new RangeError("A transition already exists between these slides.");
      }
      story.transitions.push(transition);
      story.updatedAt = now();
      return clone(transition);
    },
    updateTransition(storyId, transitionId, input = {}) {
      const story = getStory(storyId);
      const index =
        story?.transitions.findIndex((transition) => transition.id === transitionId) ?? -1;
      if (!story || index < 0) return undefined;
      const transition = normalizeTransition(
        input,
        storyId,
        story.slides,
        story.transitions[index],
      );
      if (
        story.transitions.some(
          (item, itemIndex) =>
            itemIndex !== index &&
            item.fromSlideId === transition.fromSlideId &&
            item.toSlideId === transition.toSlideId,
        )
      ) {
        throw new RangeError("A transition already exists between these slides.");
      }
      story.transitions[index] = transition;
      return clone(transition);
    },
    deleteTransition(storyId, transitionId) {
      const story = getStory(storyId);
      const index =
        story?.transitions.findIndex((transition) => transition.id === transitionId) ?? -1;
      if (!story || index < 0) return undefined;
      return clone(story.transitions.splice(index, 1)[0]);
    },
    getBrandOverride(storyId) {
      return getStory(storyId)?.brandOverride ? clone(getStory(storyId).brandOverride) : null;
    },
    setBrandOverride(storyId, input = {}) {
      const story = getStory(storyId);
      if (!story) return undefined;
      story.brandOverride = normalizeBrandOverride(input, storyId, story.brandOverride);
      story.updatedAt = now();
      return clone(story.brandOverride);
    },
    deleteBrandOverride(storyId) {
      const story = getStory(storyId);
      if (!story || !story.brandOverride) return undefined;
      const deleted = story.brandOverride;
      story.brandOverride = null;
      story.updatedAt = now();
      return clone(deleted);
    },
  };
}

export function handleStoryEditorRequest(request, store = createStoryEditorStore()) {
  const { method = "GET", resource, id, storyId, slideId, payload = {} } = request ?? {};
  const run = (callback) => {
    try {
      return callback();
    } catch (error) {
      return validationResponse(error);
    }
  };

  if (resource === "stories") {
    if (method === "GET" && !id) return { status: 200, body: store.getStories() };
    if (method === "GET" && id) {
      const story = store.getStory(id);
      return story ? { status: 200, body: story } : notFound("Story not found.");
    }
    if (method === "POST") return run(() => ({ status: 201, body: store.createStory(payload) }));
    if ((method === "PUT" || method === "PATCH") && id) {
      return run(() => {
        const story = store.updateStory(id, payload);
        return story ? { status: 200, body: story } : notFound("Story not found.");
      });
    }
    if (method === "DELETE" && id) {
      const story = store.deleteStory(id);
      return story ? { status: 200, body: story } : notFound("Story not found.");
    }
  }

  if (
    !["slides", "stickers", "audio-tracks", "transitions", "brand-overrides"].includes(resource)
  ) {
    return notFound("Story editor resource not found.");
  }
  if (!storyId) return { status: 400, body: { error: "A story id is required." } };
  if (resource === "slides") {
    if (method === "GET") {
      const slides = id
        ? store.getSlides(storyId)?.find((slide) => slide.id === id)
        : store.getSlides(storyId);
      return slides !== undefined
        ? { status: 200, body: slides }
        : notFound(id ? "Slide not found." : "Story not found.");
    }
    if (method === "POST")
      return run(() => {
        const slide = store.createSlide(storyId, payload);
        return slide ? { status: 201, body: slide } : notFound("Story not found.");
      });
    if ((method === "PUT" || method === "PATCH") && id)
      return run(() => {
        const slide = store.updateSlide(storyId, id, payload);
        return slide ? { status: 200, body: slide } : notFound("Slide not found.");
      });
    if (method === "DELETE" && id) {
      const slide = store.deleteSlide(storyId, id);
      return slide ? { status: 200, body: slide } : notFound("Slide not found.");
    }
  }

  if (resource === "stickers") {
    if (!slideId) return { status: 400, body: { error: "A slide id is required." } };
    if (method === "GET") {
      const stickers = store.getStickers(storyId, slideId);
      const item = id ? stickers?.find((sticker) => sticker.id === id) : stickers;
      return item !== undefined
        ? { status: 200, body: item }
        : notFound("Slide or sticker not found.");
    }
    if (method === "POST")
      return run(() => {
        const sticker = store.createSticker(storyId, slideId, payload);
        return sticker ? { status: 201, body: sticker } : notFound("Slide not found.");
      });
    if ((method === "PUT" || method === "PATCH") && id)
      return run(() => {
        const sticker = store.updateSticker(storyId, slideId, id, payload);
        return sticker ? { status: 200, body: sticker } : notFound("Sticker not found.");
      });
    if (method === "DELETE" && id) {
      const sticker = store.deleteSticker(storyId, slideId, id);
      return sticker ? { status: 200, body: sticker } : notFound("Sticker not found.");
    }
  }

  if (resource === "audio-tracks") {
    if (method === "GET") {
      const tracks = store.getAudioTracks(storyId);
      const item = id ? tracks?.find((track) => track.id === id) : tracks;
      return item !== undefined
        ? { status: 200, body: item }
        : notFound("Story or audio track not found.");
    }
    if (method === "POST")
      return run(() => {
        const track = store.createAudioTrack(storyId, payload);
        return track ? { status: 201, body: track } : notFound("Story not found.");
      });
    if ((method === "PUT" || method === "PATCH") && id)
      return run(() => {
        const track = store.updateAudioTrack(storyId, id, payload);
        return track ? { status: 200, body: track } : notFound("Audio track not found.");
      });
    if (method === "DELETE" && id) {
      const track = store.deleteAudioTrack(storyId, id);
      return track ? { status: 200, body: track } : notFound("Audio track not found.");
    }
  }

  if (resource === "transitions") {
    if (method === "GET") {
      const transitions = store.getTransitions(storyId);
      const item = id ? transitions?.find((transition) => transition.id === id) : transitions;
      return item !== undefined
        ? { status: 200, body: item }
        : notFound("Story or transition not found.");
    }
    if (method === "POST")
      return run(() => {
        const transition = store.createTransition(storyId, payload);
        return transition ? { status: 201, body: transition } : notFound("Story not found.");
      });
    if ((method === "PUT" || method === "PATCH") && id)
      return run(() => {
        const transition = store.updateTransition(storyId, id, payload);
        return transition ? { status: 200, body: transition } : notFound("Transition not found.");
      });
    if (method === "DELETE" && id) {
      const transition = store.deleteTransition(storyId, id);
      return transition ? { status: 200, body: transition } : notFound("Transition not found.");
    }
  }

  if (resource === "brand-overrides") {
    if (method === "GET") {
      const story = store.getStory(storyId);
      if (!story) return notFound("Story not found.");
      return { status: 200, body: store.getBrandOverride(storyId) };
    }
    if (method === "PUT" || method === "POST")
      return run(() => {
        const override = store.setBrandOverride(storyId, payload);
        return override ? { status: 200, body: override } : notFound("Story not found.");
      });
    if (method === "DELETE") {
      const override = store.deleteBrandOverride(storyId);
      return override ? { status: 200, body: override } : notFound("Brand override not found.");
    }
  }

  return { status: 405, body: { error: "Method not allowed for this story editor resource." } };
}
