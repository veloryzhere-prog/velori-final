const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `animation-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const ANIMATION_TYPES = ["fade", "slide", "zoom", "rotate", "bounce", "elastic"];
export const EASING_TYPES = ["linear", "ease-in", "ease-out", "ease-in-out", "bezier"];
export const PAGE_TRANSITION_TYPES = ["slide", "flip", "fade", "zoom"];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function cubicBezier(t, x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleCurveX = (u) => ((ax * u + bx) * u + cx) * u;
  const sampleCurveY = (u) => ((ay * u + by) * u + cy) * u;
  const sampleCurveDerivativeX = (u) => 3 * ax * u * u + 2 * bx * u + cx;

  let time = t;
  for (let i = 0; i < 8; i += 1) {
    const x = sampleCurveX(time) - t;
    const d = sampleCurveDerivativeX(time);
    if (Math.abs(x) < 1e-5) break;
    if (Math.abs(d) < 1e-5) break;
    time -= x / d;
    time = clamp(time, 0, 1);
  }

  return sampleCurveY(time);
}

export function mapEasing(value, easing = "linear", bezierPoints = [0.25, 0.1, 0.25, 1]) {
  const t = clamp(value, 0, 1);
  switch (easing) {
    case "linear":
      return t;
    case "ease-in":
      return t * t;
    case "ease-out":
      return 1 - (1 - t) ** 2;
    case "ease-in-out":
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    case "bezier": {
      const [x1, y1, x2, y2] = bezierPoints;
      return cubicBezier(t, x1, y1, x2, y2);
    }
    default:
      return t;
  }
}

export function createAnimation(input = {}) {
  const startTime = Number.isFinite(input.startTime) ? input.startTime : 0;
  const duration = Number.isFinite(input.duration) ? input.duration : 0.6;
  const delay = Number.isFinite(input.delay) ? input.delay : 0;

  return {
    id: input.id ?? createId(),
    targetId: input.targetId ?? null,
    type: ANIMATION_TYPES.includes(input.type) ? input.type : "fade",
    startTime,
    delay,
    duration,
    easing: EASING_TYPES.includes(input.easing) ? input.easing : "ease-out",
    bezier:
      Array.isArray(input.bezier) && input.bezier.length === 4
        ? input.bezier
        : [0.25, 0.1, 0.25, 1],
    from: input.from ?? null,
    to: input.to ?? null,
    axis: input.axis ?? null,
    endTime: startTime + delay + duration,
  };
}

export function createPageTransition(input = {}) {
  const startTime = Number.isFinite(input.startTime) ? input.startTime : 0;
  const duration = Number.isFinite(input.duration) ? input.duration : 0.7;

  return {
    id: input.id ?? createId(),
    type: PAGE_TRANSITION_TYPES.includes(input.type) ? input.type : "slide",
    direction: input.direction ?? "forward",
    fromSlideId: input.fromSlideId ?? null,
    toSlideId: input.toSlideId ?? null,
    startTime,
    duration,
    easing: EASING_TYPES.includes(input.easing) ? input.easing : "ease-in-out",
    endTime: startTime + duration,
  };
}

export function getAnimationProgress(animation, time) {
  const start = Number.isFinite(animation.startTime) ? animation.startTime : 0;
  const duration = Number.isFinite(animation.duration) ? animation.duration : 0.6;
  const delay = Number.isFinite(animation.delay) ? animation.delay : 0;
  const safeTime = clamp(time, 0, start + delay + duration);
  const normalized = duration <= 0 ? 1 : (safeTime - start - delay) / duration;
  const eased = mapEasing(normalized, animation.easing, animation.bezier);
  return clamp(eased, 0, 1);
}

export function getPageTransitionProgress(transition, time) {
  const start = Number.isFinite(transition.startTime) ? transition.startTime : 0;
  const duration = Number.isFinite(transition.duration) ? transition.duration : 0.7;
  const normalized = duration <= 0 ? 1 : (time - start) / duration;
  if (normalized <= 0) return 0;
  if (normalized >= 1) return 1;
  return mapEasing(normalized, transition.easing, [0.25, 0.1, 0.25, 1]);
}

export function getTimelineRange(animations = [], transitions = []) {
  const entries = [...animations, ...transitions].filter(Boolean);
  if (!entries.length) {
    return { start: 0, end: 0, duration: 0 };
  }

  const start = Math.min(...entries.map((item) => Number(item.startTime ?? 0)));
  const end = Math.max(
    ...entries.map((item) => Number(item.endTime ?? (item.startTime ?? 0) + (item.duration ?? 0))),
  );
  return { start, end, duration: Math.max(0, end - start) };
}

export function buildTimeline(animations = [], transitions = [], currentTime = 0) {
  const items = [
    ...animations.map((animation) => ({
      id: animation.id,
      kind: "element",
      label: `${animation.type} ${animation.targetId ?? "layer"}`,
      ...animation,
      start: animation.startTime ?? 0,
      end: animation.endTime ?? (animation.startTime ?? 0) + (animation.duration ?? 0),
      progress: getAnimationProgress(animation, currentTime),
    })),
    ...transitions.map((transition) => ({
      id: transition.id,
      kind: "page",
      label: `${transition.type} transition`,
      ...transition,
      start: transition.startTime ?? 0,
      end: transition.endTime ?? (transition.startTime ?? 0) + (transition.duration ?? 0),
      progress: getPageTransitionProgress(transition, currentTime),
    })),
  ];

  return items.map((item) => ({
    ...item,
    active: currentTime >= item.start && currentTime <= item.end,
  }));
}

export function createPlaybackState(totalDuration = 0, currentTime = 0, isPlaying = false) {
  return {
    isPlaying,
    currentTime: clamp(currentTime, 0, totalDuration),
    totalDuration: Math.max(0, totalDuration),
  };
}

export function togglePlayback(state) {
  return { ...state, isPlaying: !state.isPlaying };
}

export function scrubTimeline(state, nextTime) {
  return {
    ...state,
    currentTime: clamp(nextTime, 0, state.totalDuration),
  };
}

export function advanceTimeline(state, delta = 0.25) {
  if (!state || !Number.isFinite(state.totalDuration)) return state;
  const next = clamp(state.currentTime + delta, 0, state.totalDuration);
  return {
    ...state,
    currentTime: next,
    isPlaying: next < state.totalDuration,
  };
}

export function getTimelineSelection(animations = [], transitions = [], currentTime = 0) {
  return buildTimeline(animations, transitions, currentTime).filter(
    (item) => item.active || item.progress >= 0,
  );
}

export function getAnimationEasing(type, bezierPoints = [0.25, 0.1, 0.25, 1]) {
  if (type === "bezier") return bezierPoints;
  return [0.25, 0.1, 0.25, 1];
}

export function getTimelineBar(animations = [], transitions = []) {
  const timeline = buildTimeline(animations, transitions, 0);
  return timeline.map((item) => ({
    id: item.id,
    kind: item.kind,
    label: item.label,
    start: item.start,
    end: item.end,
    duration: item.end - item.start,
  }));
}
