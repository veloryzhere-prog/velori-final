export const STORY_PREVIEW_RENDER_INTERVAL_MS = 1000 / 30;

export function shouldRenderStoryPreviewFrame(now: number, lastRenderedAt: number): boolean {
  return now - lastRenderedAt >= STORY_PREVIEW_RENDER_INTERVAL_MS;
}
