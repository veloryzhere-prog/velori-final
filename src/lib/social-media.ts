import { createUuid } from "./uuid.mjs";
import { supabase } from "./supabase";

export const SOCIAL_MEDIA_BUCKETS = {
  posts: "post-media",
  stories: "story-media",
  reels: "reel-media",
} as const;

export const MAX_SOCIAL_MEDIA_BYTES = 100 * 1024 * 1024;

export type SocialMediaKind = "image" | "video";

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4"]);

export function socialMediaKind(file: File): SocialMediaKind {
  return file.type.startsWith("video/") ? "video" : "image";
}

export function socialMediaExtension(file: File) {
  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "video/mp4":
      return "mp4";
    default:
      throw new Error("Choose a JPEG, PNG, or WebP image, or an MP4 video.");
  }
}

export async function validateSocialMedia(file: File) {
  if (!acceptedTypes.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image, or an MP4 video.");
  }
  if (file.size === 0) throw new Error("This file is empty.");
  if (file.size > MAX_SOCIAL_MEDIA_BYTES) {
    throw new Error("This file is larger than the 100 MB upload limit.");
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isJpeg =
    file.type === "image/jpeg" && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng =
    file.type === "image/png" &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a;
  const isWebp =
    file.type === "image/webp" &&
    String.fromCharCode(...header.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  const isMp4 = file.type === "video/mp4" && String.fromCharCode(...header.slice(4, 8)) === "ftyp";

  if (!(isJpeg || isPng || isWebp || isMp4)) {
    throw new Error("The file contents do not match a supported image or MP4 video.");
  }
  return { kind: socialMediaKind(file), extension: socialMediaExtension(file) } as const;
}

export async function inspectReelVideo(file: File) {
  const { kind } = await validateSocialMedia(file);
  if (kind !== "video") throw new Error("A reel must be an MP4 video.");
  const source = URL.createObjectURL(file);
  try {
    return await new Promise<{
      duration: number;
      width: number;
      height: number;
      extension: string;
    }>((resolve, reject) => {
      const video = document.createElement("video");
      const cleanup = () => {
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(source);
      };
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const metadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        };
        cleanup();
        if (
          !Number.isFinite(metadata.duration) ||
          metadata.duration <= 0 ||
          metadata.duration > 600 ||
          metadata.width <= 0 ||
          metadata.height <= 0
        ) {
          reject(new Error("Choose a playable MP4 video up to 10 minutes long."));
          return;
        }
        resolve({ ...metadata, extension: socialMediaExtension(file) });
      };
      video.onerror = () => {
        cleanup();
        reject(new Error("This MP4 could not be opened by the browser. Choose another video."));
      };
      video.src = source;
    });
  } catch (error) {
    URL.revokeObjectURL(source);
    throw error;
  }
}

export function socialMediaPath(userId: string, parentId: string, extension: string) {
  return `${userId}/${parentId}/${createUuid()}.${extension}`;
}

export async function uploadSocialMedia(
  bucket: (typeof SOCIAL_MEDIA_BUCKETS)[keyof typeof SOCIAL_MEDIA_BUCKETS],
  path: string,
  file: File,
) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
}

export async function signSocialMedia(
  bucket: (typeof SOCIAL_MEDIA_BUCKETS)[keyof typeof SOCIAL_MEDIA_BUCKETS],
  paths: string[],
) {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
  if (error) throw error;
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export async function removeSocialMedia(
  bucket: (typeof SOCIAL_MEDIA_BUCKETS)[keyof typeof SOCIAL_MEDIA_BUCKETS],
  paths: string[],
) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(uniquePaths);
  if (error) throw error;
}
