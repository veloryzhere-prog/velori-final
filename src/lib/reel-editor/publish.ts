import { createUuid } from "../uuid.mjs";
import {
  SOCIAL_MEDIA_BUCKETS,
  removeSocialMedia,
  socialMediaPath,
  uploadSocialMedia,
  validateSocialMedia,
} from "../../lib/social-media.ts";
import { supabase } from "../../lib/supabase.ts";
import { prepareReelAssets, renderReelCover } from "./frame-renderer.ts";
import { getReelMp4MimeType, renderReelMp4 } from "./render-reel.ts";
import type { ReelProject } from "./types.ts";

export type ReelVisibility = "public" | "followers" | "private";

export interface PublishReelInput {
  userId: string;
  project: ReelProject;
  title: string;
  caption: string;
  visibility: ReelVisibility;
  allowComments: boolean;
  allowLikes: boolean;
  allowSharing: boolean;
  onStatus?: (status: string) => void;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface PublishReelResult {
  reelId: string;
  videoPath: string;
  coverPath: string | null;
  durationSeconds: number;
  includedAudio: boolean;
}

const messageFor = (cause: unknown) => {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "object" && cause && "message" in cause) {
    return String((cause as { message: unknown }).message);
  }
  return "Something went wrong while publishing your reel.";
};

/** The mime type this browser can record, or null when MP4 recording is unavailable. */
export function supportedReelMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return getReelMp4MimeType((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Renders the edited reel and publishes the rendered file.
 *
 * The published video is the composition the creator previewed, never the
 * untouched source file.
 */
export async function publishReel(input: PublishReelInput): Promise<PublishReelResult> {
  const { userId, project } = input;
  const status = input.onStatus ?? (() => {});
  const title = input.title.trim();
  const caption = input.caption.trim();
  if (title.length > 140) throw new Error("Reel titles can be up to 140 characters.");
  if (caption.length > 2500) throw new Error("Reel captions can be up to 2,500 characters.");
  if (!project.clips.length) throw new Error("Add a clip to the timeline before publishing.");

  const mimeType = supportedReelMimeType();
  if (!mimeType) {
    throw new Error(
      "This browser cannot record an MP4, so your edited reel cannot be published. Use a browser with MP4 recording support such as Chrome, Edge, or Safari.",
    );
  }

  status("Rendering your reel…");
  const rendered = await renderReelMp4(project, {
    mimeType,
    frameRate: 30,
    onProgress: input.onProgress,
    signal: input.signal,
  });

  status("Preparing your video…");
  const reelId = createUuid();
  const videoFile = new File([rendered.blob], `velori-reel-${reelId}.mp4`, { type: "video/mp4" });
  const checked = await validateSocialMedia(videoFile);
  if (checked.kind !== "video") throw new Error("The rendered reel is not a valid MP4 video.");

  const videoPath = socialMediaPath(userId, reelId, "mp4");
  const uploadedPaths: string[] = [];
  let reelCreated = false;
  let mediaCreated = false;
  let coverPath: string | null = null;

  try {
    const { error: reelError } = await supabase.from("reels").insert({
      id: reelId,
      author_id: userId,
      title,
      caption,
      video_url: "",
      thumbnail_url: "",
      status: "draft",
      visibility: input.visibility,
      allow_comments: input.allowComments,
      allow_likes: input.allowLikes,
      allow_sharing: input.allowSharing,
    });
    if (reelError) throw reelError;
    reelCreated = true;

    const { error: mediaError } = await supabase.from("reel_media").insert({
      reel_id: reelId,
      media_type: "video",
      object_path: videoPath,
      original_name: videoFile.name.slice(0, 255),
      mime_type: videoFile.type,
      byte_size: videoFile.size,
      width: project.width,
      height: project.height,
      duration_seconds: rendered.durationSeconds,
      processing_state: "uploading",
      composition_metadata: {
        schemaVersion: 1,
        audioBakedIn: rendered.includedAudio,
        projectId: project.id,
        canvas: { width: project.width, height: project.height },
        audioTracks: project.audio.map((clip) => ({
          trackId: project.assets[clip.assetId]?.catalogTrackId ?? null,
          startSeconds: clip.startSeconds,
          sourceIn: clip.sourceIn,
          sourceOut: clip.sourceOut,
          volume: clip.volume,
          fadeInSeconds: clip.fadeInSeconds,
          fadeOutSeconds: clip.fadeOutSeconds,
        })),
      },
    });
    if (mediaError) throw mediaError;
    mediaCreated = true;

    status("Uploading your reel…");
    await uploadSocialMedia(SOCIAL_MEDIA_BUCKETS.reels, videoPath, videoFile);
    uploadedPaths.push(videoPath);

    const { error: readyError } = await supabase
      .from("reel_media")
      .update({ processing_state: "uploaded" })
      .eq("reel_id", reelId)
      .eq("object_path", videoPath);
    if (readyError) throw readyError;

    status("Saving your cover…");
    try {
      const assets = await prepareReelAssets(project);
      const coverBlob = await renderReelCover(project, assets, project.coverFrameSeconds);
      const coverFile = new File([coverBlob], `velori-reel-${reelId}-cover.jpg`, {
        type: "image/jpeg",
      });
      const candidatePath = socialMediaPath(userId, reelId, "jpg");
      const { error: coverMediaError } = await supabase.from("reel_media").insert({
        reel_id: reelId,
        media_type: "image",
        object_path: candidatePath,
        original_name: coverFile.name.slice(0, 255),
        mime_type: coverFile.type,
        byte_size: coverFile.size,
        width: project.width,
        height: project.height,
        processing_state: "uploading",
      });
      if (coverMediaError) throw coverMediaError;
      await uploadSocialMedia(SOCIAL_MEDIA_BUCKETS.reels, candidatePath, coverFile);
      uploadedPaths.push(candidatePath);
      await supabase
        .from("reel_media")
        .update({ processing_state: "uploaded" })
        .eq("reel_id", reelId)
        .eq("object_path", candidatePath);
      coverPath = candidatePath;
    } catch (cause) {
      await supabase.from("reel_media").delete().eq("reel_id", reelId).eq("media_type", "image");
      coverPath = null;
      status(`Your reel is ready, but the cover image could not be saved: ${messageFor(cause)}`);
    }

    status("Publishing your reel…");
    const { data: published, error: publishError } = await supabase
      .from("reels")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", reelId)
      .eq("author_id", userId)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (publishError) throw publishError;
    if (!published) throw new Error("The reel could not be published. No draft was updated.");

    status("Your reel is live.");
    return {
      reelId,
      videoPath,
      coverPath,
      durationSeconds: rendered.durationSeconds,
      includedAudio: rendered.includedAudio,
    };
  } catch (cause) {
    if (uploadedPaths.length) {
      try {
        await removeSocialMedia(SOCIAL_MEDIA_BUCKETS.reels, uploadedPaths);
      } catch {
        // The rows below still need removing.
      }
    }
    if (mediaCreated) {
      await supabase.from("reel_media").delete().eq("reel_id", reelId);
    }
    if (reelCreated) {
      await supabase.from("reels").delete().eq("id", reelId).eq("author_id", userId);
    }
    throw new Error(messageFor(cause));
  }
}
