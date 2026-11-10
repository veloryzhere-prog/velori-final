import { createUuid } from "./uuid.mjs";
import { storyDisplaySeconds, type CompositionMetadata } from "./composition";
import {
  removeSocialMedia,
  SOCIAL_MEDIA_BUCKETS,
  socialMediaPath,
  signSocialMedia,
  uploadSocialMedia,
  validateSocialMedia,
} from "./social-media";
import { supabase } from "./supabase";

export type StoryAudience = "public" | "followers" | "close_friends" | "private";

interface PublishStoryInput {
  userId: string;
  file: File | null;
  audience: StoryAudience;
  caption?: string;
  visualDurationSeconds?: number;
  composition?: CompositionMetadata;
  onStatus?: (status: string) => void;
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === "object" && "message" in cause) {
    const message = Reflect.get(cause, "message");
    if (typeof message === "string" && message.trim()) return message;
  }
  return "The story could not be published.";
}

export async function deleteStoryAndMedia(
  storyId: string,
  userId: string,
  objectPaths: string[],
): Promise<void> {
  const { data: queuedDelete, error: queueError } = await supabase.rpc("delete_own_story", {
    p_story_id: storyId,
  });
  if (!queueError) {
    if (!queuedDelete) throw new Error("This story could not be found or deleted.");
    return;
  }
  const code = Reflect.get(queueError, "code");
  const message = String(Reflect.get(queueError, "message") ?? "");
  if (code !== "PGRST202" && !/delete_own_story.*(schema cache|function)/i.test(message))
    throw queueError;

  await removeSocialMedia(SOCIAL_MEDIA_BUCKETS.stories, objectPaths);
  const { error: deleteError } = await supabase
    .from("stories")
    .delete()
    .eq("id", storyId)
    .eq("author_id", userId);
  if (deleteError) throw deleteError;
}

export async function publishStory({
  userId,
  file,
  audience,
  caption = "",
  visualDurationSeconds = 7,
  composition,
  onStatus,
}: PublishStoryInput): Promise<string> {
  if (!userId) throw new Error("Sign in before publishing a story.");
  if (
    !Number.isFinite(visualDurationSeconds) ||
    visualDurationSeconds < 0.2 ||
    visualDurationSeconds > 600
  )
    throw new Error("Choose a Story duration between 0.2 and 600 seconds.");
  onStatus?.("Preparing your story…");

  const checked = file ? await validateSocialMedia(file) : null;
  const { data: storySettings, error: settingsError } = await supabase
    .from("story_settings")
    .select("auto_expire_minutes,hide_from_self,allow_replies,allow_reactions")
    .eq("author_id", userId)
    .maybeSingle();
  if (settingsError) throw settingsError;

  const storyId = createUuid();
  const path = checked ? socialMediaPath(userId, storyId, checked.extension) : "";
  let storyCreated = false;
  try {
    const { error: storyError } = await supabase.from("stories").insert({
      id: storyId,
      author_id: userId,
      caption: caption.trim(),
      media_url: "",
      media_type: checked?.kind ?? "text",
      audience,
      visual_duration_seconds: storyDisplaySeconds(visualDurationSeconds),
      status: checked ? "archived" : "active",
      hide_from_self: storySettings?.hide_from_self ?? false,
      allow_replies: storySettings?.allow_replies ?? true,
      allow_reactions: storySettings?.allow_reactions ?? true,
      expires_at: new Date(
        Date.now() + (storySettings?.auto_expire_minutes ?? 24 * 60) * 60 * 1000,
      ).toISOString(),
    });
    if (storyError) throw storyError;
    storyCreated = true;

    if (file && checked) {
      const { error: assetError } = await supabase.from("story_media").insert({
        story_id: storyId,
        media_url: "",
        media_type: checked.kind,
        object_path: path,
        mime_type: file.type,
        byte_size: file.size,
        composition_metadata: composition ?? {},
      });
      if (assetError) throw assetError;
      onStatus?.("Uploading your story…");
      await uploadSocialMedia(SOCIAL_MEDIA_BUCKETS.stories, path, file);

      onStatus?.("Checking uploaded story media…");
      const signed = await signSocialMedia(SOCIAL_MEDIA_BUCKETS.stories, [path]);
      const mediaUrl = signed.get(path);
      if (!mediaUrl)
        throw new Error(
          "Your uploaded story could not be resolved securely. It has not been published.",
        );
      const verification = await fetch(mediaUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(20000),
      });
      if (!verification.ok)
        throw new Error("The uploaded story could not be read back. It has not been published.");
      const storedSize = Number(verification.headers.get("content-length"));
      if (storedSize > 0 && storedSize !== file.size)
        throw new Error("The story upload is incomplete. Please retry.");
      onStatus?.("Publishing your story…");
      const { data: publishedStory, error: publishError } = await supabase
        .from("stories")
        .update({ status: "active", published_at: new Date().toISOString() })
        .eq("id", storyId)
        .eq("author_id", userId)
        .eq("status", "archived")
        .select("id")
        .maybeSingle();
      if (publishError) throw publishError;
      if (!publishedStory) throw new Error("Your story could not be published. Please try again.");
    }
    return storyId;
  } catch (cause) {
    if (storyCreated) {
      try {
        await deleteStoryAndMedia(storyId, userId, path ? [path] : []);
      } catch (cleanupFailure) {
        throw new Error(
          `${errorMessage(cause)} Cleanup also failed: ${errorMessage(cleanupFailure)}`,
        );
      }
    }
    throw cause;
  }
}
