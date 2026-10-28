export const STORY_EXPORT_RESOLUTIONS: readonly ["720p", "1080p"];
export function getStoryExportDimensions(resolution: string): [number, number] | null;
export function parseStorySchedule(localDateTime: string, timeZone: string, now?: number): string;
export function formatStorySchedule(isoDateTime: string, timeZone: string): string;
export function getStoryExportFileName(
  title: string,
  slideNumber: number | null,
  resolution: string,
  extension: string,
): string;
export function getStoryMp4MimeType(isSupported?: (type: string) => boolean): string | null;
