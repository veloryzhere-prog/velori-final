export const REEL_EXPORT_RESOLUTIONS: readonly ["720p", "1080p", "4k"];
export const REEL_EXPORT_FRAME_RATES: readonly [24, 25, 30, 60];
export const REEL_EXPORT_ASPECT_RATIOS: readonly ["9:16", "1:1", "16:9", "4:5"];

export interface ReelExportValidationOptions {
  container: "mp4" | "mov";
  videoCodec: "h264" | "h265" | "prores";
  resolution: "720p" | "1080p" | "4k";
  frameRate: 24 | 25 | 30 | 60;
  bitrateMode: "cbr" | "vbr";
  bitrateMbps: number;
  audioCodec: "aac" | "pcm_s16le";
  audioSampleRate: 44100 | 48000;
  audioChannels: 1 | 2;
  aspectRatio: "9:16" | "1:1" | "16:9" | "4:5";
  thumbnailTime: number;
  overlayText: string;
  overlayFontSize: number;
  overlayColor: string;
  overlayPosition: "top" | "center" | "bottom";
}

export function getReelExportDimensions(
  resolution: string,
  aspectRatio: string,
): [number, number] | null;
export function validateReelExportOptions(
  options: ReelExportValidationOptions,
  duration: number,
): string | null;
export function estimateReelExportBytes(input: {
  duration: number;
  bitrateMbps: number;
  audioCodec: "aac" | "pcm_s16le";
  audioChannels?: 1 | 2;
  videoCodec?: "h264" | "h265" | "prores";
  resolution?: "720p" | "1080p" | "4k";
  aspectRatio?: "9:16" | "1:1" | "16:9" | "4:5";
  frameRate?: 24 | 25 | 30 | 60;
}): number;
export function buildReelVideoFilter(
  options: ReelExportValidationOptions,
  textPath: string,
  fontFile?: string,
): string;
export function createReelFfmpegArgs(input: {
  sourcePath: string;
  outputPath: string;
  textPath: string;
  fontFile?: string;
  duration: number;
  sourceStart?: number;
  options: ReelExportValidationOptions;
}): string[];
export function createReelThumbnailFfmpegArgs(input: {
  sourcePath: string;
  thumbnailPath: string;
  textPath: string;
  fontFile?: string;
  sourceStart?: number;
  options: ReelExportValidationOptions;
}): string[];
