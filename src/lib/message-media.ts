import { createUuid } from "./uuid.mjs";
import { supabase } from "./supabase";

const BUCKET = "message-media";

export type MessageAttachmentKind = "image" | "video" | "file" | "audio";

export {
  validateMessageAttachment,
  MAX_MESSAGE_ATTACHMENT_BYTES,
} from "./message-attachment-validation.mjs";

export function messageAttachmentPath(userId: string, extension: string) {
  return `${userId}/${createUuid()}.${extension}`;
}

export async function uploadMessageAttachment(path: string, file: File) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type.split(";")[0].trim().toLowerCase(),
    upsert: false,
  });
  if (error) throw error;
}

export async function signMessageAttachments(paths: string[]) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const urls = new Map<string, string>();
  if (uniquePaths.length === 0) return urls;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(uniquePaths, 3600);
  if (error) throw error;
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export async function removeMessageAttachments(paths: string[]) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(uniquePaths);
  if (error) throw error;
}
