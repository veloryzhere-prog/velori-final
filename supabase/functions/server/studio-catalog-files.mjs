/** Detect supported studio catalog media using file signatures, not browser MIME claims. */
export function detectStudioAssetMime(bytes, kind) {
  const ascii = (start, value) =>
    value.split("").every((char, index) => bytes[start + index] === char.charCodeAt(0));
  if (!(bytes instanceof Uint8Array) || (kind !== "audio" && kind !== "image")) return null;
  if (kind === "audio") {
    if (ascii(0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return "audio/mpeg";
    if (ascii(0, "RIFF") && ascii(8, "WAVE")) return "audio/wav";
    if (ascii(0, "OggS")) return "audio/ogg";
    if (ascii(0, "\u001aE\u00df\u00a3")) return "audio/webm";
    if (ascii(4, "ftyp")) return "audio/mp4";
    return null;
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, "PNG\r\n\u001a\n")) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}
