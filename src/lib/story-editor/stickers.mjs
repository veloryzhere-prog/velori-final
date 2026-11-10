import { createStoryEditorId } from "./id.mjs";

const motifs = [
  [
    "reaction",
    [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "🥹",
      "😂",
      "🤣",
      "😊",
      "😍",
      "🥰",
      "😘",
      "😎",
      "🤩",
      "🥳",
      "😏",
    ],
  ],
  [
    "reaction",
    [
      "🙌",
      "👏",
      "👍",
      "👎",
      "🤝",
      "🙏",
      "💪",
      "🤟",
      "🫶",
      "👀",
      "💯",
      "✨",
      "💖",
      "🔥",
      "💥",
      "✅",
    ],
  ],
  [
    "food",
    [
      "🍓",
      "🍒",
      "🍑",
      "🍍",
      "🥑",
      "🍋",
      "🍉",
      "🍇",
      "🍊",
      "🥥",
      "🍕",
      "🍟",
      "🍔",
      "🍩",
      "🧁",
      "🍪",
    ],
  ],
  [
    "travel",
    [
      "✈️",
      "🚀",
      "🚗",
      "🚲",
      "🚆",
      "🛳️",
      "🗺️",
      "🧳",
      "🏖️",
      "🏝️",
      "🌆",
      "🗽",
      "🏔️",
      "⛺",
      "🌋",
      "🧭",
    ],
  ],
  [
    "nature",
    [
      "🌸",
      "🌻",
      "🌼",
      "🌷",
      "🌹",
      "🌿",
      "🍀",
      "🌵",
      "🌴",
      "🌈",
      "☀️",
      "🌙",
      "⭐",
      "☁️",
      "❄️",
      "🌊",
    ],
  ],
  [
    "celebration",
    [
      "🎉",
      "🎊",
      "🎂",
      "🎁",
      "🎈",
      "🥂",
      "🍾",
      "🎆",
      "🎇",
      "🎄",
      "🪩",
      "🎃",
      "💐",
      "🏆",
      "🎓",
      "💍",
    ],
  ],
  [
    "music",
    [
      "🎵",
      "🎶",
      "🎤",
      "🎧",
      "🎸",
      "🥁",
      "🎹",
      "🎺",
      "🎻",
      "🪇",
      "🎼",
      "📻",
      "💿",
      "🎙️",
      "🕺",
      "💃",
    ],
  ],
  [
    "objects",
    [
      "📸",
      "📱",
      "💻",
      "📚",
      "🕶️",
      "🧸",
      "🪴",
      "🕯️",
      "💌",
      "🔮",
      "🧿",
      "🪄",
      "🧡",
      "💜",
      "🩷",
      "🤍",
    ],
  ],
];

const styles = [
  { name: "Lilac", color: "#49388f", background: "#e7ddff" },
  { name: "Coral", color: "#8b2635", background: "#ffe0d9" },
  { name: "Mint", color: "#175c4e", background: "#d5f7e9" },
  { name: "Sunshine", color: "#68440c", background: "#fff0bd" },
  { name: "Sky", color: "#185486", background: "#d9efff" },
  { name: "Berry", color: "#7a245d", background: "#f8d8ec" },
  { name: "Citrus", color: "#53620c", background: "#f0f5c9" },
  { name: "Ocean", color: "#164d5b", background: "#d1f1f3" },
  { name: "Rose", color: "#8d3654", background: "#ffe0e9" },
  { name: "Lavender", color: "#594289", background: "#eae2ff" },
  { name: "Peach", color: "#85411e", background: "#ffe5d0" },
  { name: "Aqua", color: "#12605f", background: "#d3f6ee" },
  { name: "Grape", color: "#60316d", background: "#f0ddf5" },
  { name: "Lemon", color: "#685914", background: "#fff6c9" },
  { name: "Cloud", color: "#3e4b64", background: "#e8edf7" },
  { name: "Flame", color: "#8b321c", background: "#ffe0cb" },
];

export const STORY_STICKER_CATEGORIES = Object.freeze([
  "all",
  "reaction",
  "food",
  "travel",
  "nature",
  "celebration",
  "music",
  "objects",
]);

export const MAX_STORY_STICKERS_PER_SLIDE = 100;

export const STORY_STICKER_LIBRARY = Object.freeze(
  motifs.flatMap(([category, emojis], groupIndex) =>
    emojis.flatMap((emoji, motifIndex) =>
      styles.map((style, styleIndex) => ({
        id: `${category}-${groupIndex}-${motifIndex}-${styleIndex}`,
        category,
        emoji,
        style: style.name,
        color: style.color,
        background: style.background,
        animation:
          styleIndex % 4 === 1
            ? "bounce"
            : styleIndex % 4 === 2
              ? "pulse"
              : styleIndex % 4 === 3
                ? "spin"
                : "none",
        animated: styleIndex % 4 !== 0,
      })),
    ),
  ),
);

export const STORY_INTERACTIVE_STICKER_TYPES = Object.freeze([
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
]);

const defaultConfig = {
  poll: { options: ["Yes", "No"], votes: [0, 0], showResults: true, selectedOption: null },
  question: {},
  quiz: {
    options: ["Option A", "Option B", "Option C"],
    votes: [0, 0, 0],
    correctAnswer: 0,
    selectedOption: null,
  },
  slider: { reaction: "😍", emoji: "😍" },
  link: { url: "https://example.com", displayText: "Learn more" },
  countdown: { targetDate: "" },
  music: { title: "Song title", artist: "Artist", volume: 80 },
  mention: { account: "@account", displayText: "Follow along" },
  location: { locationName: "Add a place", latitude: 37.7749, longitude: -122.4194 },
  hashtag: {},
  emoji: { emoji: "✨", animation: "none" },
  custom: { customType: "image" },
};

export function createStorySticker(type, slideId, content = "") {
  if (!Object.hasOwn(defaultConfig, type)) throw new TypeError("Unsupported story sticker type.");
  const now = new Date().toISOString();
  return {
    id: createStoryEditorId(),
    slideId,
    type,
    content: content || defaultContent(type),
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    zIndex: 10,
    visible: true,
    config: JSON.stringify(defaultConfig[type]),
    createdAt: now,
    updatedAt: now,
  };
}

function defaultContent(type) {
  const content = {
    poll: "What do you think?",
    question: "Ask me anything",
    quiz: "Choose the right answer",
    slider: "How much do you love this?",
    link: "Visit this link",
    countdown: "Coming soon",
    music: "Music",
    mention: "@account",
    location: "Add a place",
    hashtag: "#yourtag",
    emoji: "✨",
    custom: "Custom sticker",
  };
  return content[type];
}

export function parseStoryStickerConfig(config) {
  if (!config) return {};
  try {
    const parsed = JSON.parse(config);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeStoryStickerConfig(config) {
  return JSON.stringify(config);
}

export function getStoryCountdownParts(targetDate, now = Date.now()) {
  const target = Date.parse(targetDate);
  if (!Number.isFinite(target)) return null;
  const remaining = Math.max(0, target - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return { days, hours, minutes, seconds, complete: remaining === 0 };
}

export function validateStoryStickerPng(bytes) {
  const valid =
    bytes instanceof Uint8Array &&
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    String.fromCharCode(...bytes.slice(1, 4)) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (!valid) throw new Error("Custom stickers must be a valid PNG or SVG file.");
}

export function sanitizeStoryStickerSvg(source) {
  if (typeof source !== "string" || source.length > 5_000_000) {
    throw new Error("SVG stickers must be smaller than 5 MB.");
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error("This SVG contains unsupported declarations.");
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = document.documentElement;
  if (root.localName !== "svg" || document.querySelector("parsererror")) {
    throw new Error("Choose a valid SVG sticker.");
  }
  for (const element of document.querySelectorAll(
    "script,style,foreignObject,iframe,object,embed,animate,animateMotion,animateTransform,set",
  )) {
    element.remove();
  }
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        name.startsWith("on") ||
        name === "xml:base" ||
        (name === "style" && /url\s*\(|@import/i.test(value)) ||
        ((name === "href" || name === "xlink:href" || name === "src") &&
          value !== "" &&
          !value.startsWith("#"))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return new XMLSerializer().serializeToString(root);
}
