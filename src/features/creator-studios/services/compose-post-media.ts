/* Copyright © 2026 VELORYZ. All rights reserved. */
import { composePostSlides } from "./compose-post";
import type { PostDraft } from "../models";
import { DEFAULT_STORY_MEDIA_SETTINGS } from "../../../lib/story-editor/media-tools.mjs";
import { getStoryMp4MimeType } from "../../../lib/story-editor/export.mjs";
/** Music is embedded into the uploaded visual media, so playback uses existing private post storage. */
export async function composePostMedia(
  draft: PostDraft,
  onProgress?: (message: string) => void,
): Promise<File[]> {
  const images = await composePostSlides(draft);
  const track = draft.soundtrack;
  if (!track?.audioUrl) return images;
  const end = track.excerptEndSeconds ?? track.durationSeconds;
  const duration = Math.min(20, (end ?? 0) - track.excerptStartSeconds);
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error("Select a valid music excerpt before publishing.");
  const mime =
    typeof MediaRecorder === "undefined"
      ? null
      : getStoryMp4MimeType((type) => MediaRecorder.isTypeSupported(type));
  if (!mime)
    throw new Error(
      "This browser cannot encode a post with music. Your draft is saved; use a browser with MP4 recording support or remove the soundtrack.",
    );
  const { renderStoryMp4 } = await import("../../../lib/story-editor/export-renderer");
  const urls = images.map((image) => URL.createObjectURL(image));
  try {
    const now = new Date().toISOString();
    const frames = urls.map((url, index) => ({
      slide: {
        id: `post-${index}`,
        storyId: "post",
        order: index,
        mediaType: "image" as const,
        mediaUrl: url,
        duration: duration / urls.length,
        backgroundType: "solid" as const,
        background: "#100914",
        stickers: [],
        createdAt: now,
        updatedAt: now,
      },
      textOverlays: [],
      shapes: [],
      mediaSettings: { ...DEFAULT_STORY_MEDIA_SETTINGS, mediaFit: "fill" as const },
      brand: {
        logoUrl: null,
        logoX: 0,
        logoY: 0,
        logoScale: 1,
        logoOpacity: 1,
        watermarkText: "",
        watermarkOpacity: 0,
      },
    }));
    const blob = await renderStoryMp4(
      frames,
      [1080, 1080],
      mime,
      (percent) => onProgress?.(`Rendering continuous music post · ${percent}%`),
      {
        url: track.audioUrl,
        startSeconds: track.excerptStartSeconds,
        endSeconds: track.excerptStartSeconds + duration,
        volume: track.volume ?? 0.8,
      },
    );
    return [new File([blob], "velori-music-post.mp4", { type: "video/mp4" })];
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}
