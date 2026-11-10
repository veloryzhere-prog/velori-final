export function cmsDisplaySettings(page: {
  footer_enabled?: unknown;
  animation_enabled?: unknown;
  content_blocks?: unknown[] | null;
}): { footer_enabled: boolean; animation_enabled: boolean };
export function withCmsDisplaySettings<T extends { content_blocks?: unknown[] | null }>(
  page: T,
): T & { content_blocks: unknown[] };
export function editableCmsBlocks<T>(blocks: T[] | null | undefined): T[];
