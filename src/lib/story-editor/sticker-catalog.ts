import { createStorySticker } from "./stickers.mjs";
import type { Sticker, StoryStickerType } from "./types";

export type StoryStickerCategory = "all" | "interactive" | "social" | "emoji" | "decorative";

export type StoryStickerKind =
  | "emoji"
  | "text"
  | "poll"
  | "question"
  | "mention"
  | "hashtag"
  | "location"
  | "link"
  | "countdown"
  | "music"
  | "gif"
  | "slider"
  | "time"
  | "date"
  | "temperature";

export interface StoryStickerDefinition {
  id: string;
  type: StoryStickerKind;
  label: string;
  description: string;
  category: Exclude<StoryStickerCategory, "all">;
  glyph: string;
  defaultContent: string;
  defaultConfig?: Record<string, string | number | boolean>;
}

export const STORY_STICKERS: StoryStickerDefinition[] = [
  {
    id: "emoji-heart",
    type: "emoji",
    label: "Heart",
    description: "Add a heart",
    category: "emoji",
    glyph: "❤️",
    defaultContent: "❤️",
  },
  {
    id: "emoji-fire",
    type: "emoji",
    label: "Fire",
    description: "Add a fire emoji",
    category: "emoji",
    glyph: "🔥",
    defaultContent: "🔥",
  },
  {
    id: "emoji-laugh",
    type: "emoji",
    label: "Laugh",
    description: "Add a laughing emoji",
    category: "emoji",
    glyph: "😂",
    defaultContent: "😂",
  },
  {
    id: "emoji-star",
    type: "emoji",
    label: "Star",
    description: "Add a star",
    category: "emoji",
    glyph: "⭐",
    defaultContent: "⭐",
  },
  {
    id: "emoji-sparkles",
    type: "emoji",
    label: "Sparkles",
    description: "Add sparkles",
    category: "emoji",
    glyph: "✨",
    defaultContent: "✨",
  },
  {
    id: "emoji-clap",
    type: "emoji",
    label: "Clapping",
    description: "Celebrate something",
    category: "emoji",
    glyph: "👏",
    defaultContent: "👏",
  },
  {
    id: "emoji-party",
    type: "emoji",
    label: "Party",
    description: "Celebrate",
    category: "emoji",
    glyph: "🎉",
    defaultContent: "🎉",
  },
  {
    id: "emoji-sunglasses",
    type: "emoji",
    label: "Cool",
    description: "Add a cool emoji",
    category: "emoji",
    glyph: "😎",
    defaultContent: "😎",
  },
  {
    id: "emoji-heart-eyes",
    type: "emoji",
    label: "Heart eyes",
    description: "Add heart eyes",
    category: "emoji",
    glyph: "😍",
    defaultContent: "😍",
  },
  {
    id: "emoji-rocket",
    type: "emoji",
    label: "Rocket",
    description: "Add a rocket",
    category: "emoji",
    glyph: "🚀",
    defaultContent: "🚀",
  },
  {
    id: "emoji-crown",
    type: "emoji",
    label: "Crown",
    description: "Add a crown",
    category: "emoji",
    glyph: "👑",
    defaultContent: "👑",
  },
  {
    id: "emoji-flower",
    type: "emoji",
    label: "Flower",
    description: "Add a flower",
    category: "emoji",
    glyph: "🌸",
    defaultContent: "🌸",
  },
  {
    id: "emoji-butterfly",
    type: "emoji",
    label: "Butterfly",
    description: "Add a butterfly",
    category: "emoji",
    glyph: "🦋",
    defaultContent: "🦋",
  },
  {
    id: "poll",
    type: "poll",
    label: "Poll",
    description: "Let viewers vote",
    category: "interactive",
    glyph: "📊",
    defaultContent: "Your question?",
    defaultConfig: {
      optionA: "Yes",
      optionB: "No",
    },
  },
  {
    id: "question",
    type: "question",
    label: "Questions",
    description: "Collect audience responses",
    category: "interactive",
    glyph: "❓",
    defaultContent: "Ask me anything!",
  },
  {
    id: "slider",
    type: "slider",
    label: "Emoji slider",
    description: "Collect slider reactions",
    category: "interactive",
    glyph: "😍",
    defaultContent: "How much do you love this?",
    defaultConfig: {
      emoji: "😍",
    },
  },
  {
    id: "mention",
    type: "mention",
    label: "Mention",
    description: "Mention an account",
    category: "social",
    glyph: "@",
    defaultContent: "@username",
  },
  {
    id: "hashtag",
    type: "hashtag",
    label: "Hashtag",
    description: "Add a hashtag",
    category: "social",
    glyph: "#",
    defaultContent: "#yourhashtag",
  },
  {
    id: "location",
    type: "location",
    label: "Location",
    description: "Add a location label",
    category: "social",
    glyph: "📍",
    defaultContent: "Add a location",
  },
  {
    id: "link",
    type: "link",
    label: "Link",
    description: "Add a link sticker",
    category: "interactive",
    glyph: "🔗",
    defaultContent: "Add link",
  },
  {
    id: "countdown",
    type: "countdown",
    label: "Countdown",
    description: "Create a countdown",
    category: "interactive",
    glyph: "⏳",
    defaultContent: "Coming soon",
  },
  {
    id: "music",
    type: "music",
    label: "Music",
    description: "Choose a soundtrack",
    category: "decorative",
    glyph: "♫",
    defaultContent: "Choose music",
  },
  {
    id: "gif",
    type: "gif",
    label: "GIF",
    description: "Add an animated sticker",
    category: "decorative",
    glyph: "GIF",
    defaultContent: "GIF",
  },
  {
    id: "time",
    type: "time",
    label: "Time",
    description: "Display the current time",
    category: "decorative",
    glyph: "🕒",
    defaultContent: "12:00",
  },
  {
    id: "date",
    type: "date",
    label: "Date",
    description: "Display the date",
    category: "decorative",
    glyph: "📅",
    defaultContent: "Today",
  },
  {
    id: "temperature",
    type: "temperature",
    label: "Weather",
    description: "Display a temperature label",
    category: "decorative",
    glyph: "☀️",
    defaultContent: "Weather",
  },
  {
    id: "decorative-love",
    type: "text",
    label: "Love label",
    description: "Add a decorative love label",
    category: "decorative",
    glyph: "LOVE",
    defaultContent: "LOVE",
  },
  {
    id: "decorative-vibes",
    type: "text",
    label: "Good vibes",
    description: "Add a positive label",
    category: "decorative",
    glyph: "VIBES",
    defaultContent: "GOOD VIBES",
  },
  {
    id: "decorative-new",
    type: "text",
    label: "New",
    description: "Highlight something new",
    category: "decorative",
    glyph: "NEW",
    defaultContent: "NEW",
  },
];

export function searchStoryStickers(
  query: string,
  category: StoryStickerCategory = "all",
): StoryStickerDefinition[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return STORY_STICKERS.filter((sticker) => {
    const matchesCategory = category === "all" || sticker.category === category;

    const searchableText = [
      sticker.label,
      sticker.description,
      sticker.type,
      sticker.defaultContent,
    ]
      .join(" ")
      .toLocaleLowerCase();

    const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

    return matchesCategory && matchesQuery;
  });
}

export function getStoryStickerById(id: string): StoryStickerDefinition | undefined {
  return STORY_STICKERS.find((sticker) => sticker.id === id);
}

export function createStoryStickerFromDefinition(
  definition: StoryStickerDefinition,
  slideId: string,
): Sticker {
  const staticInteractive = ["poll", "question", "slider"].includes(definition.type);
  const supportedTypes = new Set<StoryStickerType>([
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
  const type: StoryStickerType =
    staticInteractive || !supportedTypes.has(definition.type as StoryStickerType)
      ? "custom"
      : (definition.type as StoryStickerType);
  const sticker = createStorySticker(type, slideId, definition.defaultContent);
  sticker.config = JSON.stringify({
    ...(definition.defaultConfig ?? {}),
    catalogId: definition.id,
    catalogGlyph: definition.glyph,
    catalogType: definition.type,
    staticText: staticInteractive || type === "custom",
  });
  return sticker;
}
