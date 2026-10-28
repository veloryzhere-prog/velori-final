import type { StoryTextOverlay } from "./types";

export interface StoryBrandKit {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  autoApply: boolean;
}

export interface StoryTemplateLocks {
  logoPosition: boolean;
  colors: boolean;
}

export interface StoryTemplatePreset {
  id: string;
  name: string;
  description: string;
  backgroundRole: "secondaryColor";
  poll?: boolean;
  text: Array<{
    content: string;
    style: string;
    color: "primaryColor" | "accentColor";
    y: number;
    size: number;
  }>;
}

export const DEFAULT_STORY_BRAND_KIT: Readonly<StoryBrandKit>;
export const DEFAULT_STORY_TEMPLATE_LOCKS: Readonly<StoryTemplateLocks>;
export const STORY_TEMPLATES: readonly StoryTemplatePreset[];
export function getStoryTemplate(templateId: string): StoryTemplatePreset | null;
export function createStoryTemplateOverlays(
  templateId: string,
  brandKit: StoryBrandKit,
  idFactory?: () => string,
): StoryTextOverlay[];
export function applyStoryBrandKitToOverlays(
  overlays: StoryTextOverlay[],
  brandKit: StoryBrandKit,
  lockColors?: boolean,
): StoryTextOverlay[];
