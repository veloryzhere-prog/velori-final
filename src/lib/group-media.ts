import { createUuid } from "./uuid.mjs";
import { supabase } from "./supabase";

const BUCKET = "group-media";
const MAX_BYTES = 5 * 1024 * 1024;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function validateGroupImage(file: File) {
  if (!extensions[file.type]) {
    throw new Error("Choose a JPEG, PNG, or WebP group image.");
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    throw new Error("Group images must be between 1 byte and 5 MB.");
  }
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const magic = String.fromCharCode(...header);
  const valid =
    (file.type === "image/jpeg" &&
      header[0] === 0xff &&
      header[1] === 0xd8 &&
      header[2] === 0xff) ||
    (file.type === "image/png" && magic.startsWith("\x89PNG\r\n\x1a\n")) ||
    (file.type === "image/webp" && magic.slice(0, 4) === "RIFF" && magic.slice(8, 12) === "WEBP");
  if (!valid) throw new Error("The image contents do not match the selected image type.");
  return extensions[file.type];
}

export async function uploadGroupImage(userId: string, groupId: string, file: File) {
  const extension = await validateGroupImage(file);
  const path = `${userId}/${groupId}/${createUuid()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function signGroupImage(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeGroupImage(path: string) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
