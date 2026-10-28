const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `tool-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const SHAPE_LIBRARY = [
  "rectangle",
  "rounded-rectangle",
  "circle",
  "ellipse",
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
  "octagon",
  "star",
  "heart",
  "talk-bubble",
  "arrow-right",
  "arrow-left",
  "arrow-up",
  "arrow-down",
  "badge",
  "sparkle",
  "ring",
  "wave",
  "crown",
  "shield",
  "cloud",
  "bolt",
  "leaf",
  "drop",
  "sun",
  "moon",
  "spark",
  "cross",
  "plus",
  "minus",
  "check",
  "x",
  "line",
  "chevron-right",
  "chevron-left",
  "chevron-up",
  "chevron-down",
  "quote",
  "tag",
  "ribbon",
  "bookmark",
  "tube",
  "capsule",
  "masthead",
  "parallelogram",
  "trapezoid",
  "cone",
  "pyramid",
  "stack",
  "cursor",
  "cursor-alt",
  "spray",
  "flare",
  "split-circle",
  "dashed-box",
  "frame",
  "glow-swatch",
  "orbit",
  "target",
  "pin",
  "map-marker",
];

export const ICON_LIBRARY = [
  "sparkles",
  "star",
  "heart",
  "camera",
  "play",
  "music",
  "brush",
  "palette",
  "bolt",
  "sun",
  "moon",
  "download",
  "upload",
  "share",
  "message",
  "calendar",
  "location",
  "tag",
  "gift",
  "rocket",
  "check",
  "thumbs-up",
  "bookmark",
  "bag",
  "search",
  "filter",
  "settings",
  "globe",
  "wifi",
  "volume",
  "shield",
  "clock",
  "starburst",
  "graph",
  "chart",
  "idea",
  "flash",
  "layers",
  "drag",
  "key",
  "link",
  "send",
];

export const FILTER_PRESETS = {
  clarity: { name: "Clarity", intensity: 0.12, type: "clarity" },
  vivid: { name: "Vivid", intensity: 0.2, type: "saturation" },
  noir: { name: "Noir", intensity: 0.8, type: "grayscale" },
  warm: { name: "Warm", intensity: 0.15, type: "temperature" },
  cool: { name: "Cool", intensity: 0.15, type: "temperature" },
  film: { name: "Film", intensity: 0.22, type: "contrast" },
  matte: { name: "Matte", intensity: 0.18, type: "soften" },
  punch: { name: "Punch", intensity: 0.25, type: "contrast" },
  grain: { name: "Grain", intensity: 0.14, type: "noise" },
  soft: { name: "Soft", intensity: 0.12, type: "blur" },
  rich: { name: "Rich", intensity: 0.2, type: "vibrance" },
  contrast: { name: "Contrast", intensity: 0.35, type: "contrast" },
  bronze: { name: "Bronze", intensity: 0.16, type: "tone" },
  sunset: { name: "Sunset", intensity: 0.18, type: "warmth" },
  neon: { name: "Neon", intensity: 0.28, type: "saturation" },
  vintage: { name: "Vintage", intensity: 0.24, type: "sepia" },
  bloom: { name: "Bloom", intensity: 0.18, type: "glow" },
  fog: { name: "Fog", intensity: 0.18, type: "soft-light" },
  crisp: { name: "Crisp", intensity: 0.1, type: "sharpness" },
  pastel: { name: "Pastel", intensity: 0.14, type: "desaturation" },
  cinematic: { name: "Cinematic", intensity: 0.22, type: "contrast" },
  monochrome: { name: "Monochrome", intensity: 0.9, type: "grayscale" },
  candy: { name: "Candy", intensity: 0.22, type: "saturation" },
  highkey: { name: "High Key", intensity: 0.16, type: "brightness" },
};

export const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "soft-light",
  "hard-light",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHexColor(input) {
  const raw = String(input ?? "#000000").trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) {
    if (raw.length === 4 || raw.length === 5) {
      return `#${raw
        .slice(1)
        .split("")
        .map((part) => part + part)
        .join("")}`;
    }
    return raw;
  }
  return "#000000";
}

export function parseColor(input) {
  const raw = normalizeHexColor(input);
  const hex = raw.replace("#", "");
  const bigint = Number.parseInt(
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex,
    16,
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2 / 255;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  return {
    hex: raw,
    rgb: { r, g, b },
    hsl: {
      h,
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    },
  };
}

export function toRgba(hex, alpha = 1) {
  const color = parseColor(hex);
  return `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${alpha})`;
}

export function createTextLayer(input = {}) {
  const layer = {
    id: input.id ?? createId(),
    slideId: input.slideId ?? null,
    type: "text",
    name: input.name ?? "Text Layer",
    order: input.order ?? 0,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? 320,
    height: input.height ?? 120,
    rotation: input.rotation ?? 0,
    opacity: clamp(input.opacity ?? 1, 0, 1),
    blendMode: input.blendMode ?? "normal",
    visible: input.visible ?? true,
    locked: input.locked ?? false,
    text: {
      id: input.text?.id ?? createId(),
      content: input.text?.content ?? "VELORI",
      fontFamily: input.text?.fontFamily ?? "Inter",
      fontSize: input.text?.fontSize ?? 48,
      fontWeight: input.text?.fontWeight ?? 700,
      color: normalizeHexColor(input.text?.color ?? "#111827"),
      align: input.text?.align ?? "center",
      letterSpacing: input.text?.letterSpacing ?? 0,
      lineHeight: input.text?.lineHeight ?? 1.2,
      stroke: input.text?.stroke ?? null,
      shadow: input.text?.shadow ?? null,
    },
  };
  return layer;
}

export function createImageLayer(input = {}) {
  return {
    id: input.id ?? createId(),
    slideId: input.slideId ?? null,
    type: "image",
    name: input.name ?? "Image Layer",
    order: input.order ?? 0,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? 320,
    height: input.height ?? 240,
    rotation: input.rotation ?? 0,
    opacity: clamp(input.opacity ?? 1, 0, 1),
    blendMode: input.blendMode ?? "normal",
    visible: input.visible ?? true,
    locked: input.locked ?? false,
    image: {
      id: input.image?.id ?? createId(),
      src: input.image?.src ?? "https://example.com/image.jpg",
      fit: input.image?.fit ?? "cover",
      crop: input.image?.crop ?? null,
      rotation: input.image?.rotation ?? 0,
      opacity: clamp(input.image?.opacity ?? 1, 0, 1),
      brightness: input.image?.brightness ?? 100,
      contrast: input.image?.contrast ?? 100,
      saturation: input.image?.saturation ?? 100,
      blur: input.image?.blur ?? 0,
    },
  };
}

export function createShapeLayer(input = {}) {
  const shape = input.shape ?? {};
  return {
    id: input.id ?? createId(),
    slideId: input.slideId ?? null,
    type: "shape",
    name: input.name ?? "Shape Layer",
    order: input.order ?? 0,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? 240,
    height: input.height ?? 160,
    rotation: input.rotation ?? 0,
    opacity: clamp(input.opacity ?? 1, 0, 1),
    blendMode: input.blendMode ?? "normal",
    visible: input.visible ?? true,
    locked: input.locked ?? false,
    shape: {
      id: shape.id ?? createId(),
      shapeType: shape.shapeType ?? "rectangle",
      fill: normalizeHexColor(shape.fill ?? "#c4b5fd"),
      stroke: shape.stroke ?? null,
      strokeWidth: shape.strokeWidth ?? 2,
      radius: shape.radius ?? 18,
    },
  };
}

export function searchIcons(query = "") {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...ICON_LIBRARY];
  return ICON_LIBRARY.filter((icon) => icon.toLowerCase().includes(needle));
}

export function createIconLayer(input = {}) {
  const iconName = input.iconName ?? "sparkles";
  return {
    ...createImageLayer({
      id: input.id,
      slideId: input.slideId,
      name: input.name ?? `${iconName} Icon`,
      order: input.order,
      x: input.x,
      y: input.y,
      width: input.width ?? 96,
      height: input.height ?? 96,
      rotation: input.rotation,
      opacity: input.opacity,
      blendMode: input.blendMode,
      visible: input.visible,
      locked: input.locked,
      image: {
        id: input.image?.id ?? createId(),
        src: input.image?.src ?? `https://cdn.velori.app/icons/${iconName}.svg`,
        fit: input.image?.fit ?? "contain",
        crop: input.image?.crop ?? null,
        rotation: input.image?.rotation ?? 0,
        opacity: clamp(input.image?.opacity ?? 1, 0, 1),
        brightness: input.image?.brightness ?? 100,
        contrast: input.image?.contrast ?? 100,
        saturation: input.image?.saturation ?? 100,
        blur: input.image?.blur ?? 0,
      },
    }),
    kind: "icon",
    iconName,
    tint: input.tint ?? "#7c3aed",
  };
}

export function applyColorPreset(layer, color, alpha = 1) {
  const next = structuredClone(layer);
  if (next.text) {
    next.text.color = normalizeHexColor(color);
  }
  if (next.shape) {
    next.shape.fill = normalizeHexColor(color);
  }
  if (next.image) {
    next.image.opacity = clamp(alpha, 0, 1);
  }
  return next;
}

export function createBackground(input = {}) {
  const backgroundType = input.type ?? "solid";
  const base = {
    id: input.id ?? createId(),
    type: backgroundType,
    color: normalizeHexColor(input.color ?? "#ffffff"),
    repeat: input.repeat ?? "repeat",
    opacity: clamp(input.opacity ?? 1, 0, 1),
  };

  if (backgroundType === "gradient") {
    return {
      ...base,
      mode: input.mode ?? "linear",
      angle: input.angle ?? 90,
      stops:
        Array.isArray(input.stops) && input.stops.length
          ? input.stops
          : [
              { offset: 0, color: "#ffffff" },
              { offset: 1, color: "#e0e7ff" },
            ],
    };
  }

  if (backgroundType === "pattern") {
    return {
      ...base,
      pattern: input.pattern ?? "dots",
      size: input.size ?? 18,
      stroke: input.stroke ?? "#e2e8f0",
    };
  }

  if (backgroundType === "image") {
    return {
      ...base,
      src: input.src ?? "https://example.com/background.jpg",
      fit: input.fit ?? "cover",
    };
  }

  return base;
}

export function applyFilterPreset(layer, presetName) {
  const preset = FILTER_PRESETS[presetName] ?? FILTER_PRESETS.clarity;
  const next = structuredClone(layer);
  next.filter = {
    ...preset,
    id: presetName,
    enabled: true,
  };
  return next;
}

export function applyBlendMode(layer, mode) {
  const allowed = new Set(BLEND_MODES);
  const normalized = allowed.has(mode) ? mode : "normal";
  const next = structuredClone(layer);
  next.blendMode = normalized;
  return next;
}

export function groupLayers(layers) {
  return {
    id: createId(),
    type: "group",
    name: "Group",
    members: layers.map((layer) => layer.id),
    x: Math.min(...layers.map((layer) => layer.x)),
    y: Math.min(...layers.map((layer) => layer.y)),
    width:
      Math.max(...layers.map((layer) => layer.x + layer.width)) -
      Math.min(...layers.map((layer) => layer.x)),
    height:
      Math.max(...layers.map((layer) => layer.y + layer.height)) -
      Math.min(...layers.map((layer) => layer.y)),
  };
}

export function ungroupLayers(group) {
  return Array.isArray(group.members) ? group.members : [];
}

export function getBlendModes() {
  return [...BLEND_MODES];
}

export function getFilterPresetNames() {
  return Object.keys(FILTER_PRESETS);
}

export function getShapeLibrary() {
  return [...SHAPE_LIBRARY];
}

export function getEyedropperColor(sourceColor) {
  return parseColor(sourceColor).hex;
}
