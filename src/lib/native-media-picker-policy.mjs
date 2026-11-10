const IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4"]);

export function nativeMediaAccept(accept) {
  const tokens = accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) return null;

  const photos = tokens.some((token) => token === "image/*" || IMAGE_TYPES.has(token));
  const videos = tokens.some((token) => token === "video/*" || VIDEO_TYPES.has(token));
  const otherFiles = tokens.some((token) => !photosToken(token) && !videosToken(token));

  if (!photos && !videos) return null;
  return { photos, videos, otherFiles };
}

function photosToken(token) {
  return token === "image/*" || IMAGE_TYPES.has(token);
}

function videosToken(token) {
  return token === "video/*" || VIDEO_TYPES.has(token);
}
