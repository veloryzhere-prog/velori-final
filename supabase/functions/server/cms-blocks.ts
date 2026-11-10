import { sanitizeCustomHtml } from "./cms-html.ts";

export const PAGE_CONTENT_MODES = ["visual", "custom_html"] as const;
export const PAGE_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "quote",
  "list",
  "callout",
  "divider",
  "faq",
  "image",
  "button",
  "html",
] as const;

export type PageContentMode = (typeof PAGE_CONTENT_MODES)[number];
export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];
export type PageContentBlock = {
  id: string;
  type: PageBlockType;
  title?: string;
  text?: string;
  url?: string;
  alt?: string;
  items?: string[];
  level?: number;
  tone?: "info" | "warning";
  visible?: boolean;
  ordered?: boolean;
};

const MAX_BLOCKS = 100;
const MAX_BLOCK_TEXT = 20_000;
const safePath = /^\/(?!\/)[\w~!$&'()*+,;=:@%./?#-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safePageUrl(value: string): boolean {
  if (safePath.test(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validatePageContentBlocks(
  value: unknown,
): { blocks: PageContentBlock[] } | { error: string } {
  if (!Array.isArray(value)) return { error: "Visual page blocks must be an array." };
  if (value.length > MAX_BLOCKS) return { error: `A page can contain at most ${MAX_BLOCKS} blocks.` };

  const ids = new Set<string>();
  const blocks: PageContentBlock[] = [];
  for (const [index, candidate] of value.entries()) {
    if (!isRecord(candidate)) return { error: `Block ${index + 1} must be an object.` };
    const { id, type } = candidate;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) {
      return { error: `Block ${index + 1} needs a unique, valid ID.` };
    }
    if (typeof type !== "string" || !(PAGE_BLOCK_TYPES as readonly string[]).includes(type)) {
      return { error: `Block ${index + 1} has an unsupported type.` };
    }
    ids.add(id);

    const block: PageContentBlock = { id, type: type as PageBlockType };
    for (const key of ["title", "text", "url", "alt"] as const) {
      if (!(key in candidate)) continue;
      const field = candidate[key];
      const limit = key === "text" ? MAX_BLOCK_TEXT : 2048;
      if (typeof field !== "string" || field.length > limit) {
        return { error: `Block ${index + 1} has an invalid ${key} field.` };
      }
      if (key === "url" && field && !safePageUrl(field)) {
        return { error: `Block ${index + 1} has an unsafe link or asset URL.` };
      }
      block[key] = key === "text" && type === "html" ? sanitizeCustomHtml(field) : field;
    }

    if ("items" in candidate) {
      if (
        !Array.isArray(candidate.items) ||
        candidate.items.length > 50 ||
        candidate.items.some((item) => typeof item !== "string" || item.length > 2000)
      ) {
        return { error: `Block ${index + 1} has an invalid list of items.` };
      }
      block.items = candidate.items as string[];
    }
    if ("level" in candidate) {
      if (typeof candidate.level !== "number" || ![2, 3, 4].includes(candidate.level)) {
        return { error: `Block ${index + 1} has an invalid heading level.` };
      }
      block.level = candidate.level;
    }
    if ("tone" in candidate) {
      if (candidate.tone !== "info" && candidate.tone !== "warning") {
        return { error: `Block ${index + 1} has an invalid callout style.` };
      }
      block.tone = candidate.tone;
    }
    if ("visible" in candidate) {
      if (typeof candidate.visible !== "boolean") {
        return { error: `Block ${index + 1} has an invalid visibility setting.` };
      }
      block.visible = candidate.visible;
    }
    if ("ordered" in candidate) {
      if (typeof candidate.ordered !== "boolean") {
        return { error: `Block ${index + 1} has an invalid list style.` };
      }
      block.ordered = candidate.ordered;
    }
    if (type === "image" && (!block.url || !block.alt?.trim())) {
      return { error: `Image block ${index + 1} needs a URL and alternative text.` };
    }
    if (type === "button" && (!block.title?.trim() || !block.url)) {
      return { error: `Button block ${index + 1} needs a label and URL.` };
    }
    if (type === "faq" && (!block.title?.trim() || !block.text?.trim())) {
      return { error: `FAQ block ${index + 1} needs a question and answer.` };
    }
    blocks.push(block);
  }
  return { blocks };
}