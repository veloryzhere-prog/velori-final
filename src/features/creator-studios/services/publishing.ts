import { compositionMetadata } from "../../../lib/composition";
import { createUuid } from "../../../lib/uuid.mjs";
import type { User } from "@supabase/supabase-js";
import { friendlyError, supabase } from "../../../lib/supabase";
import { uploadPostMedia } from "../../../lib/post-media";
import {
  inspectReelVideo,
  removeSocialMedia,
  SOCIAL_MEDIA_BUCKETS,
  socialMediaPath,
  uploadSocialMedia,
  validateSocialMedia,
} from "../../../lib/social-media";
import { composePostMedia } from "./compose-post-media";
import { dataUrlToFile } from "./media";
import { collectUnrenderedReelEdits, UnrenderedReelEditsError } from "./reelRendering";
import type { PostDraft, ReelDraft } from "../models";

export interface PostPublishSettings {
  visibility: "public" | "followers" | "private";
  allowComments: boolean;
  allowLikes: boolean;
  hideLikeCount: boolean;
  allowSharing: boolean;
}

/** Matches the defaults of the previous post composer. */
export const defaultPostPublishSettings: PostPublishSettings = {
  visibility: "public",
  allowComments: true,
  allowLikes: true,
  hideLikeCount: false,
  allowSharing: true,
};

export interface PublishResult {
  id: string;
  url?: string;
  warning?: string;
}

type StatusReporter = (status: string) => void;

const MAX_POST_CAPTION_LENGTH = 2000;
const MAX_REEL_CAPTION_LENGTH = 2500;

function asError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  return new Error(friendlyError(cause as { code?: string; message?: string }));
}

/**
 * Publishes a Post Studio draft through the existing VELORI post pipeline:
 * composed slides -> authorized `post-media` upload -> `posts` + `post_media`
 * rows -> published flag, mirroring the previous composer's data contract.
 */
export async function publishPostDraft({
  user,
  draft,
  settings = draft.settings ?? defaultPostPublishSettings,
  linkedDraftId,
  onStatus,
}: {
  user: User;
  draft: PostDraft;
  settings?: PostPublishSettings;
  linkedDraftId?: string | null;
  onStatus?: StatusReporter;
}): Promise<PublishResult> {
  const caption = draft.caption.trim();
  if (caption.length > MAX_POST_CAPTION_LENGTH)
    throw new Error("Post captions can be up to 2,000 characters.");
  if (draft.slides.length === 0) throw new Error("Add at least one slide before publishing.");

  onStatus?.("Composing your slides…");
  const composed = await composePostMedia(draft, onStatus);

  const draftId = linkedDraftId ?? createUuid();
  const controller = new AbortController();
  const uploadedPaths: string[] = [];
  let postId = "";
  try {
    const draftRecord = {
      id: draftId,
      author_id: user.id,
      body: caption,
      visibility: settings.visibility,
      allow_comments: settings.allowComments,
      allow_likes: settings.allowLikes,
      hide_like_count: settings.hideLikeCount,
      allow_sharing: settings.allowSharing,
      updated_at: new Date().toISOString(),
    };
    // Fresh rows must use INSERT. ON CONFLICT checks collaboration SELECT
    // policies before the new draft exists and can reject a valid owner.
    const { error: draftError } = linkedDraftId
      ? await supabase
          .from("post_drafts")
          .update(draftRecord)
          .eq("id", draftId)
          .eq("author_id", user.id)
      : await supabase.from("post_drafts").insert(draftRecord);
    if (draftError) throw draftError;

    for (let index = 0; index < composed.length; index += 1) {
      const objectPath = `${user.id}/${draftId}/${createUuid()}.${composed[index].type.startsWith("video/") ? "mp4" : "webp"}`;
      const { error: attachmentError } = await supabase.from("post_draft_media").insert({
        draft_id: draftId,
        author_id: user.id,
        object_path: objectPath,
        media_type: composed[index].type.startsWith("video/") ? "video" : "image",
        position: index,
        alt_text: "",
      });
      if (attachmentError) throw attachmentError;
      onStatus?.(`Uploading slide ${index + 1} of ${composed.length}…`);
      await uploadPostMedia(objectPath, composed[index], controller.signal, () => {});
      uploadedPaths.push(objectPath);
    }

    onStatus?.("Publishing your post…");
    const { data, error: dbError } = await supabase
      .from("posts")
      .insert({
        author_id: user.id,
        body: caption,
        visibility: settings.visibility,
        allow_comments: settings.allowComments,
        allow_likes: settings.allowLikes,
        hide_like_count: settings.hideLikeCount,
        allow_sharing: settings.allowSharing,
        is_published: false,
      })
      .select("id")
      .single();
    if (dbError) throw dbError;
    postId = data.id as string;

    const mediaRows = uploadedPaths.map((objectPath, position) => ({
      post_id: postId,
      author_id: user.id,
      object_path: objectPath,
      media_type: composed[position].type.startsWith("video/")
        ? ("video" as const)
        : ("image" as const),
      position,
      alt_text: "",
      composition_metadata: compositionMetadata(draft.soundtrack),
    }));
    if (mediaRows.length) {
      const { error: mediaError } = await supabase.from("post_media").insert(mediaRows);
      if (mediaError) throw mediaError;
    }

    const { data: publishedPost, error: publishError } = await supabase
      .from("posts")
      .update({ is_published: true })
      .eq("id", postId)
      .eq("author_id", user.id)
      .select("id,is_published")
      .maybeSingle();
    if (publishError) throw publishError;
    if (!publishedPost?.is_published)
      throw new Error("Your post was not confirmed as published. Please try again.");

    const warning = linkedDraftId ? await finalizeDraftCollaboration(linkedDraftId) : undefined;
    onStatus?.("Your post is live.");
    return { id: postId, url: `/post/${postId}`, warning };
  } catch (cause) {
    if (uploadedPaths.length) {
      try {
        await supabase.storage.from("post-media").remove(uploadedPaths);
      } catch {
        // Secondary cleanup failure must not hide the original publishing error.
      }
    }
    if (postId) {
      try {
        await supabase.from("posts").delete().eq("id", postId).eq("author_id", user.id);
      } catch {
        // Secondary cleanup failure must not hide the original publishing error.
      }
    }
    throw asError(cause);
  }
}

/** Advances a linked draft's collaboration workflow, like the old composer. */
async function finalizeDraftCollaboration(draftId: string): Promise<string | undefined> {
  const { data: currentDraft, error: stateError } = await supabase
    .from("post_drafts")
    .select("collaboration_status")
    .eq("id", draftId)
    .maybeSingle();
  if (stateError)
    return `Your post is live, but its collaboration state could not be updated: ${friendlyError(stateError)}`;
  const route =
    currentDraft?.collaboration_status === "draft"
      ? ["in_review", "approved", "published"]
      : currentDraft?.collaboration_status === "in_review"
        ? ["approved", "published"]
        : currentDraft?.collaboration_status === "approved" ||
            currentDraft?.collaboration_status === "scheduled"
          ? ["published"]
          : [];
  for (const nextStatus of route) {
    const { error: statusError } = await supabase.rpc("set_post_draft_collaboration_status", {
      target_draft: draftId,
      next_status: nextStatus,
      schedule_for: null,
    });
    if (statusError)
      return `Your post is live, but its collaboration history could not be finalized: ${friendlyError(statusError)}`;
  }
  return undefined;
}

/**
 * Publishes a Reel Studio draft through the existing reels pipeline
 * (`reels` + `reel_media` + `reel-media` storage), including the captured
 * cover frame as the viewer's poster image.
 *
 * Edits the pipeline cannot render into the video file raise
 * `UnrenderedReelEditsError` unless the user explicitly acknowledged them.
 */
export async function publishReelDraft({
  user,
  draft,
  acknowledgeUnrendered,
  onStatus,
}: {
  user: User;
  draft: ReelDraft;
  acknowledgeUnrendered?: boolean;
  onStatus?: StatusReporter;
}): Promise<PublishResult> {
  if (!draft.source) throw new Error("Upload a video before publishing.");
  const unrendered = collectUnrenderedReelEdits(draft);
  if (unrendered.length && !acknowledgeUnrendered) throw new UnrenderedReelEditsError(unrendered);

  const caption = draft.caption.trim();
  if (caption.length > MAX_REEL_CAPTION_LENGTH)
    throw new Error("Reel captions can be up to 2,500 characters.");

  onStatus?.("Preparing your reel…");
  const videoFile = dataUrlToFile(draft.source, draft.fileName ?? "clip.mp4", "video/mp4");
  const checked = await inspectReelVideo(videoFile);

  const id = createUuid();
  const path = socialMediaPath(user.id, id, checked.extension);
  let reelCreated = false;
  let mediaCreated = false;
  let uploadStarted = false;
  let coverPath = "";
  let coverCreated = false;
  let coverUploaded = false;
  try {
    const { error: reelError } = await supabase.from("reels").insert({
      id,
      author_id: user.id,
      title: "",
      caption,
      video_url: "",
      thumbnail_url: "",
      status: "draft",
      visibility: "public",
      allow_comments: true,
      allow_likes: true,
      allow_sharing: true,
    });
    if (reelError) throw reelError;
    reelCreated = true;

    const { error: mediaError } = await supabase.from("reel_media").insert({
      reel_id: id,
      media_type: "video",
      object_path: path,
      original_name: videoFile.name.slice(0, 255),
      mime_type: videoFile.type,
      byte_size: videoFile.size,
      width: checked.width,
      height: checked.height,
      duration_seconds: checked.duration,
      processing_state: "uploading",
    });
    if (mediaError) throw mediaError;
    mediaCreated = true;

    onStatus?.("Uploading your video…");
    uploadStarted = true;
    await uploadSocialMedia(SOCIAL_MEDIA_BUCKETS.reels, path, videoFile);

    if (draft.cover) {
      // The cover is a best-effort poster; the viewer falls back gracefully,
      // so a cover failure never discards the reel.
      try {
        const coverFile = dataUrlToFile(draft.cover, "cover.jpg", "image/jpeg");
        const coverChecked = await validateSocialMedia(coverFile);
        if (coverChecked.kind === "image") {
          coverPath = socialMediaPath(user.id, id, coverChecked.extension);
          const { error: coverRowError } = await supabase.from("reel_media").insert({
            reel_id: id,
            media_type: "image",
            object_path: coverPath,
            original_name: coverFile.name.slice(0, 255),
            mime_type: coverFile.type,
            byte_size: coverFile.size,
          });
          if (!coverRowError) {
            coverCreated = true;
            await uploadSocialMedia(SOCIAL_MEDIA_BUCKETS.reels, coverPath, coverFile);
            coverUploaded = true;
          }
        }
      } catch {
        // Optional cover processing failed; continue publishing the video.
      }
    }

    onStatus?.("Checking the uploaded video…");
    const { error: readyError } = await supabase
      .from("reel_media")
      .update({ processing_state: "uploaded" })
      .eq("reel_id", id)
      .eq("object_path", path);
    if (readyError) throw readyError;

    onStatus?.("Publishing your reel…");
    const { data: published, error: publishError } = await supabase
      .from("reels")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("author_id", user.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (publishError) throw publishError;
    if (!published) throw new Error("The reel could not be published. No draft was updated.");

    onStatus?.("Your reel is live.");
    return { id, url: `/reels?reel=${encodeURIComponent(id)}` };
  } catch (cause) {
    const cleanupErrors: string[] = [];
    if (coverUploaded) {
      try {
        await removeSocialMedia(SOCIAL_MEDIA_BUCKETS.reels, [coverPath]);
      } catch (cleanupFailure) {
        cleanupErrors.push(asError(cleanupFailure).message);
      }
    }
    if (coverCreated) {
      const { error: cleanupFailure } = await supabase
        .from("reel_media")
        .delete()
        .eq("reel_id", id)
        .eq("object_path", coverPath);
      if (cleanupFailure) cleanupErrors.push(friendlyError(cleanupFailure));
    }
    if (uploadStarted) {
      try {
        await removeSocialMedia(SOCIAL_MEDIA_BUCKETS.reels, [path]);
      } catch (cleanupFailure) {
        cleanupErrors.push(asError(cleanupFailure).message);
      }
    }
    if (mediaCreated) {
      const { error: cleanupFailure } = await supabase
        .from("reel_media")
        .delete()
        .eq("reel_id", id);
      if (cleanupFailure) cleanupErrors.push(friendlyError(cleanupFailure));
    }
    if (reelCreated) {
      const { error: cleanupFailure } = await supabase
        .from("reels")
        .delete()
        .eq("id", id)
        .eq("author_id", user.id);
      if (cleanupFailure) cleanupErrors.push(friendlyError(cleanupFailure));
    }
    const message = asError(cause).message;
    throw new Error(
      cleanupErrors.length
        ? `${message} Cleanup also failed: ${cleanupErrors.join("; ")}`
        : message,
    );
  }
}
