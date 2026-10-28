import type { StoryTextOverlay } from "./types";

export type StoryCollaborationEventType = "assignment" | "comment" | "approval" | "version";
export interface StoryCollaborationEvent {
  id: string;
  type: StoryCollaborationEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}
export function getStoryCollaborationStorageKey(projectId: string): string;
export function readStoryCollaborationProject(projectId: string): object | null;
export function writeStoryCollaborationProject(project: object): void;
export function normalizeStoryCollaborationEvent(input: unknown): StoryCollaborationEvent;
export function mergeStoryCollaborationEvents(
  current?: StoryCollaborationEvent[],
  incoming?: unknown[],
): StoryCollaborationEvent[];
export function mergeStoryProjectSnapshots(
  current: object | null,
  incoming: object | null,
): object | null;
export function checkStoryBrandConsistency(
  overlays: StoryTextOverlay[],
  allowedColors: string[],
  allowedFonts: string[],
): Array<{ id: string; message: string }>;
