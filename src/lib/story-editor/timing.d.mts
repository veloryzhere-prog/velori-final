export const MAX_STORY_SLIDE_SECONDS: number;
export function normalizeStorySlideSeconds(value: number, fallback?: number): number;
export function storyMusicSlideSeconds(track: { excerptStartSeconds: number; excerptEndSeconds: number | null; durationSeconds: number | null } | null): number | null;
