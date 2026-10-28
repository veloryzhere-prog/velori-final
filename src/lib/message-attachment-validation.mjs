export const MAX_MESSAGE_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const mimeKinds = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "application/pdf": "file",
  "audio/mp4": "audio",
  "audio/webm": "audio",
  "audio/ogg": "audio",
};

const extensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
};

export async function validateMessageAttachment(file) {
  const mimeType = file.type.split(";")[0].trim().toLowerCase();
  const kind = mimeKinds[mimeType];
  if (!kind)
    throw new Error(
      "Choose a JPEG, PNG, WebP or GIF image, MP4 video, PDF, or supported audio recording.",
    );
  if (file.size === 0) throw new Error("This file is empty.");
  if (file.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
    throw new Error("Attachments must be 25 MB or smaller.");
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const magic = String.fromCharCode(...header);
  const valid =
    (mimeType === "image/gif" &&
      /^(GIF87a|GIF89a)/.test(magic) &&
      header.length >= 10 &&
      header[6] + header[7] * 256 > 0 &&
      header[8] + header[9] * 256 > 0) ||
    (file.type === "image/jpeg" &&
      header[0] === 0xff &&
      header[1] === 0xd8 &&
      header[2] === 0xff) ||
    (file.type === "image/png" && magic.startsWith("\x89PNG\r\n\x1a\n")) ||
    (file.type === "image/webp" && magic.slice(0, 4) === "RIFF" && magic.slice(8, 12) === "WEBP") ||
    (file.type === "video/mp4" && magic.slice(4, 8) === "ftyp") ||
    (mimeType === "application/pdf" && magic.startsWith("%PDF-")) ||
    (mimeType === "audio/mp4" && magic.slice(4, 8) === "ftyp") ||
    (mimeType === "audio/webm" &&
      header[0] === 0x1a &&
      header[1] === 0x45 &&
      header[2] === 0xdf &&
      header[3] === 0xa3) ||
    (mimeType === "audio/ogg" && magic.startsWith("OggS"));
  if (!valid) throw new Error("The file contents do not match the selected file type.");

  return { kind, extension: extensions[mimeType] };
}
