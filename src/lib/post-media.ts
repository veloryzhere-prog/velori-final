import { supabase } from "./supabase";
import { supabasePublishableKey, supabaseUrl } from "../../utils/supabase/info";

export type DraftMediaRecord = {
  id: string;
  draft_id: string;
  object_path: string;
  media_type: "image" | "video";
  position: number;
  alt_text: string;
  preview_url: string;
};

export async function loadDraftMedia(draftId: string) {
  const { data, error } = await supabase
    .from("post_draft_media")
    .select("id,draft_id,object_path,media_type,position,alt_text")
    .eq("draft_id", draftId)
    .order("position");
  if (error) throw error;
  return await Promise.all(
    (data || []).map(async (item) => {
      const { data: signed, error: signError } = await supabase.storage
        .from("post-media")
        .createSignedUrl(item.object_path, 3600);
      if (signError) throw signError;
      return { ...item, preview_url: signed.signedUrl } satisfies DraftMediaRecord;
    }),
  );
}

export async function optimizePostImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Image processing is unavailable in this browser.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not optimize this image."))),
      "image/webp",
      0.84,
    );
  });
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export async function uploadPostMedia(
  path: string,
  file: File,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
) {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!data.session) throw new Error("Sign in again before uploading media.");
  if (signal.aborted) throw new DOMException("Upload cancelled.", "AbortError");

  const objectPath = path.split("/").map(encodeURIComponent).join("/");
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    let complete = false;
    const finish = (error?: Error) => {
      if (complete) return;
      complete = true;
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    };
    const abort = () => {
      request.abort();
      finish(new DOMException("Upload cancelled.", "AbortError"));
    };

    request.open("POST", `${supabaseUrl}/storage/v1/object/post-media/${objectPath}`);
    request.setRequestHeader("apikey", supabasePublishableKey);
    request.setRequestHeader("Authorization", `Bearer ${data.session.access_token}`);
    request.setRequestHeader("Content-Type", file.type);
    request.setRequestHeader("x-upsert", "false");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        finish();
        return;
      }
      let message = "Media upload failed. Please retry.";
      try {
        const result = JSON.parse(request.responseText) as { message?: string; error?: string };
        message = result.message || result.error || message;
      } catch {
        // Use the generic message for non-JSON gateway responses.
      }
      finish(new Error(message));
    });
    request.addEventListener("error", () =>
      finish(new Error("Network error while uploading media.")),
    );
    request.addEventListener("abort", () =>
      finish(new DOMException("Upload cancelled.", "AbortError")),
    );
    signal.addEventListener("abort", abort, { once: true });
    request.send(file);
  });
}
