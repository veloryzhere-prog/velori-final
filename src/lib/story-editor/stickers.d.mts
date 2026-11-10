import type { StoryStickerConfig, StoryStickerType, Sticker } from "./types";

export interface StoryStickerCatalogItem {
  id: string;
  category: string;
  emoji: string;
  style: string;
  color: string;
  background: string;
  animation: "none" | "bounce" | "pulse" | "spin";
  animated: boolean;
  assetUrl?: string;
}

export const STORY_STICKER_CATEGORIES: readonly string[];
export const MAX_STORY_STICKERS_PER_SLIDE: number;
export const STORY_STICKER_LIBRARY: readonly StoryStickerCatalogItem[];
export const STORY_INTERACTIVE_STICKER_TYPES: readonly StoryStickerType[];
export function createStorySticker(
  type: StoryStickerType,
  slideId: string,
  content?: string,
): Sticker;
export function parseStoryStickerConfig(config: string | null): StoryStickerConfig;
export function serializeStoryStickerConfig(config: StoryStickerConfig): string;
export function getStoryCountdownParts(
  targetDate: string,
  now?: number,
): { days: number; hours: number; minutes: number; seconds: number; complete: boolean } | null;
export function validateStoryStickerPng(bytes: Uint8Array): void;
export function sanitizeStoryStickerSvg(source: string): string;
