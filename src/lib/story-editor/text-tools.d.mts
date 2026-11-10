import type { StoryTextAnimation, StoryTextPosition, StoryTextOverlay } from "./types";

export interface StoryTextPreset {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  italic: boolean;
  uppercase: boolean;
  background: string | null;
  stroke: string | null;
  shadow: string | null;
}

export const STORY_TEXT_STYLES: readonly StoryTextPreset[];
export const STORY_TEXT_POSITION_PRESETS: readonly {
  id: StoryTextPosition;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  align: "left" | "center" | "right";
}[];
export function getStoryTextStyle(styleId: string): StoryTextPreset;
export function getStoryTextPosition(
  positionId: string,
): (typeof STORY_TEXT_POSITION_PRESETS)[number];
export function getStoryAutoFontSize(
  text: string,
  baseSize: number,
  widthPercent: number,
  heightPercent: number,
): number;
export function getStoryTextAnimationState(
  animation: StoryTextAnimation | "spin",
  elapsedSeconds: number,
  startAt: number,
  duration: number,
  delay?: number,
  loop?: boolean,
): { visible: boolean; progress: number };
export function getStoryTextAnimationFrame(
  animation: StoryTextAnimation | "spin",
  progress: number,
  baseRotation?: number,
): { opacity: number; x: number; y: number; scale: number; rotation: number };
export function getStoryTypewriterText(text: string, progress: number): string;
