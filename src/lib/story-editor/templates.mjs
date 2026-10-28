import { getStoryTextStyle } from "./text-tools.mjs";
import { createStoryEditorId } from "./id.mjs";

export const DEFAULT_STORY_BRAND_KIT = Object.freeze({
  name: "My brand",
  primaryColor: "#ffffff",
  secondaryColor: "#262336",
  accentColor: "#e8b34d",
  fontFamily: "DM Sans",
  autoApply: false,
});

export const DEFAULT_STORY_TEMPLATE_LOCKS = Object.freeze({
  logoPosition: false,
  colors: false,
});

export const STORY_TEMPLATES = Object.freeze([
  {
    id: "promo",
    name: "Promo",
    description: "A clear offer, supporting line, and call to action.",
    backgroundRole: "secondaryColor",
    text: [
      {
        content: "A little something for you",
        style: "bold-title",
        color: "primaryColor",
        y: 43,
        size: 82,
      },
      { content: "DISCOVER THE OFFER", style: "label", color: "accentColor", y: 62, size: 38 },
      { content: "Tap to learn more", style: "clean", color: "primaryColor", y: 72, size: 48 },
    ],
  },
  {
    id: "behind-the-scenes",
    name: "Behind the scenes",
    description: "Introduce the process, people, or making-of moment.",
    backgroundRole: "secondaryColor",
    text: [
      { content: "Behind the scenes", style: "editorial", color: "primaryColor", y: 36, size: 76 },
      {
        content: "A closer look at what makes it special.",
        style: "clean",
        color: "accentColor",
        y: 65,
        size: 48,
      },
    ],
  },
  {
    id: "announcement",
    name: "Announcement",
    description: "A bold headline for a launch, update, or important date.",
    backgroundRole: "secondaryColor",
    text: [
      { content: "BIG NEWS", style: "label", color: "accentColor", y: 38, size: 42 },
      {
        content: "Something new is here",
        style: "bold-title",
        color: "primaryColor",
        y: 53,
        size: 82,
      },
      {
        content: "More details coming soon",
        style: "clean",
        color: "primaryColor",
        y: 70,
        size: 48,
      },
    ],
  },
  {
    id: "poll-campaign",
    name: "Poll campaign",
    description: "Ask your audience to choose between two options.",
    backgroundRole: "secondaryColor",
    poll: true,
    text: [
      { content: "Help us choose", style: "bold-title", color: "primaryColor", y: 38, size: 82 },
      {
        content: "Vote below — we want to hear from you.",
        style: "clean",
        color: "accentColor",
        y: 57,
        size: 48,
      },
    ],
  },
]);

export function getStoryTemplate(templateId) {
  return STORY_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function createStoryTemplateOverlays(templateId, brandKit, idFactory = createStoryEditorId) {
  const template = getStoryTemplate(templateId);
  if (!template) throw new RangeError("Choose a supported story template.");
  return template.text.map((item) => {
    const style = getStoryTextStyle(item.style);
    return {
      id: idFactory(),
      content: item.content,
      styleId: item.style,
      fontFamily: brandKit.fontFamily,
      fontSize: item.size ?? style.fontSize,
      fontWeight: style.fontWeight,
      color: brandKit[item.color],
      align: "center",
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      italic: style.italic,
      uppercase: style.uppercase,
      background: style.background,
      stroke: style.stroke,
      shadow: style.shadow,
      animation: "fade",
      animationDuration: 0.7,
      startAt: 0,
      position: "center",
      x: 50,
      y: item.y,
      width: 86,
      height: 24,
      autoSize: true,
    };
  });
}

export function applyStoryBrandKitToOverlays(overlays, brandKit, lockColors = false) {
  return overlays.map((overlay) => ({
    ...overlay,
    fontFamily: brandKit.fontFamily,
    color: lockColors ? overlay.color : brandKit.primaryColor,
  }));
}
