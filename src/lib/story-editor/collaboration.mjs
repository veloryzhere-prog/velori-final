export const STORY_COLLABORATION_EVENT_TYPES = ["assignment", "comment", "approval", "version"];
const MAX_STORED_EVENTS = 500;

export function getStoryCollaborationStorageKey(projectId) {
  return `velori:story-collaboration:${projectId}`;
}

export function readStoryCollaborationProject(projectId) {
  const raw = window.localStorage.getItem(getStoryCollaborationStorageKey(projectId));
  if (!raw) return null;
  const project = JSON.parse(raw);
  if (!project || project.projectId !== projectId || !Array.isArray(project.slides)) {
    throw new Error("The shared story draft is invalid or unavailable.");
  }
  return project;
}

export function writeStoryCollaborationProject(project) {
  if (!project || typeof project.projectId !== "string" || !Array.isArray(project.slides)) {
    throw new TypeError("A project ID and slide list are required to save the shared story.");
  }
  try {
    window.localStorage.setItem(
      getStoryCollaborationStorageKey(project.projectId),
      JSON.stringify(project),
    );
  } catch (cause) {
    throw new Error(
      cause instanceof Error
        ? `Could not save this shared story in browser storage: ${cause.message}`
        : "Could not save this shared story in browser storage.",
    );
  }
}

export function normalizeStoryCollaborationEvent(input) {
  if (
    !input ||
    typeof input !== "object" ||
    typeof input.id !== "string" ||
    !input.id.trim() ||
    !STORY_COLLABORATION_EVENT_TYPES.includes(input.type) ||
    !input.payload ||
    typeof input.payload !== "object" ||
    Array.isArray(input.payload) ||
    !Number.isFinite(Date.parse(input.createdAt))
  ) {
    throw new TypeError(
      "Story collaboration updates must have a supported type and valid timestamp.",
    );
  }
  return {
    id: input.id.slice(0, 120),
    type: input.type,
    payload: input.payload,
    createdAt: input.createdAt,
  };
}

export function mergeStoryCollaborationEvents(current = [], incoming = []) {
  const merged = new Map();
  for (const candidate of [...current, ...incoming]) {
    try {
      const event = normalizeStoryCollaborationEvent(candidate);
      if (!merged.has(event.id)) merged.set(event.id, event);
    } catch {
      continue;
    }
  }
  return [...merged.values()]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-MAX_STORED_EVENTS);
}

function revision(snapshot, slideId) {
  return snapshot.slideRevisions?.[slideId] ?? "";
}

export function mergeStoryProjectSnapshots(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  const slides = new Map();
  const removals = { ...(current.removedSlides ?? {}) };
  for (const [id, timestamp] of Object.entries(incoming.removedSlides ?? {})) {
    removals[id] = Math.max(Date.parse(removals[id] ?? "") || 0, Date.parse(timestamp) || 0)
      ? new Date(
          Math.max(Date.parse(removals[id] ?? "") || 0, Date.parse(timestamp) || 0),
        ).toISOString()
      : timestamp;
  }
  for (const snapshot of [current, incoming]) {
    for (const slide of snapshot.slides) {
      const removedAt = Date.parse(removals[slide.id] ?? "") || 0;
      if (
        removedAt >= (Date.parse(revision(snapshot, slide.id)) || Date.parse(slide.updatedAt) || 0)
      ) {
        slides.delete(slide.id);
        continue;
      }
      const existing = slides.get(slide.id);
      const currentRevision = Date.parse(existing?.revision ?? "") || 0;
      const incomingRevision = Date.parse(revision(snapshot, slide.id) || slide.updatedAt) || 0;
      if (
        !existing ||
        incomingRevision > currentRevision ||
        (incomingRevision === currentRevision &&
          String(snapshot.actorId ?? "").localeCompare(String(existing.actorId ?? "")) > 0)
      ) {
        slides.set(slide.id, {
          slide,
          revision: revision(snapshot, slide.id) || slide.updatedAt,
          actorId: snapshot.actorId,
          snapshot,
        });
      }
    }
  }
  const selected = [...slides.values()];
  const maps = [
    "textOverlaysBySlide",
    "mediaSettingsBySlide",
    "transitionsBySlide",
    "slideLoops",
    "drawingsBySlide",
  ];
  const result = {
    ...current,
    ...(Date.parse(incoming.updatedAt ?? "") > Date.parse(current.updatedAt ?? "") ? incoming : {}),
    slides: selected.map(({ slide }) => slide).sort((a, b) => a.order - b.order),
    removedSlides: removals,
    slideRevisions: Object.fromEntries(
      selected.map(({ slide, revision: value }) => [slide.id, value]),
    ),
    updatedAt:
      Date.parse(incoming.updatedAt ?? "") > Date.parse(current.updatedAt ?? "")
        ? incoming.updatedAt
        : current.updatedAt,
  };
  for (const mapName of maps) {
    const map = { ...(current[mapName] ?? {}) };
    for (const { slide, snapshot } of selected) {
      if (Object.hasOwn(snapshot[mapName] ?? {}, slide.id)) {
        map[slide.id] = snapshot[mapName][slide.id];
      } else {
        delete map[slide.id];
      }
    }
    for (const id of Object.keys(removals)) delete map[id];
    result[mapName] = map;
  }
  result.draftMediaBySlide = Object.fromEntries(
    selected.flatMap(({ slide, snapshot }) => {
      const key = snapshot.draftMediaBySlide?.[slide.id];
      return key ? [[slide.id, key]] : [];
    }),
  );
  return result;
}

export function checkStoryBrandConsistency(overlays, allowedColors, allowedFonts) {
  const colors = new Set(allowedColors.map((value) => value.trim().toLowerCase()).filter(Boolean));
  const fonts = new Set(allowedFonts.map((value) => value.trim().toLowerCase()).filter(Boolean));
  const issues = [];
  for (const overlay of overlays) {
    if (colors.size && !colors.has(overlay.color.trim().toLowerCase())) {
      issues.push({
        id: `${overlay.id}:color`,
        message: `“${overlay.content}” uses off-brand color ${overlay.color}.`,
      });
    }
    if (fonts.size && !fonts.has(overlay.fontFamily.trim().toLowerCase())) {
      issues.push({
        id: `${overlay.id}:font`,
        message: `“${overlay.content}” uses off-brand font ${overlay.fontFamily}.`,
      });
    }
  }
  return issues;
}
