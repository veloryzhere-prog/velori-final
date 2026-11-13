/* Copyright © 2026 VELORYZ. All rights reserved. */

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
const SPOTIFY_HOSTS = new Set(["open.spotify.com"]);
const SOUNDCLOUD_HOSTS = new Set(["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com"]);
const APPLE_MUSIC_HOSTS = new Set(["music.apple.com"]);

const cleanText = (value, max = 240) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

function safeImageUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const allowed =
      host === "i.ytimg.com" ||
      host === "img.youtube.com" ||
      host === "i.scdn.co" ||
      host.endsWith(".sndcdn.com") ||
      host === "is1-ssl.mzstatic.com" ||
      host.endsWith(".mzstatic.com");
    return allowed ? url.href : null;
  } catch {
    return null;
  }
}

export function identifyMusicLink(input) {
  if (typeof input !== "string" || input.length > 2048) {
    throw new Error("Paste a valid music link (up to 2,048 characters).");
  }
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("That link is not a valid URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Use a normal HTTPS music link without sign-in details or a custom port.");
  }
  const host = url.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) {
    const id = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
      throw new Error("Use a direct YouTube Music or YouTube video link for one track.");
    }
    const canonicalUrl = `https://www.youtube.com/watch?v=${id}`;
    return { provider: "YouTube Music / YouTube", sourceUrl: url.href, lookupUrl: `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json` };
  }
  if (SPOTIFY_HOSTS.has(host)) {
    if (!/^\/(?:intl-[a-z]{2}\/)?track\/[A-Za-z0-9]+/.test(url.pathname)) {
      throw new Error("Paste a direct Spotify track link, not an album, artist, or playlist link.");
    }
    return { provider: "Spotify", sourceUrl: url.href, lookupUrl: `https://open.spotify.com/oembed?url=${encodeURIComponent(url.href)}` };
  }
  if (SOUNDCLOUD_HOSTS.has(host)) {
    if (url.pathname.split("/").filter(Boolean).length < 2) {
      throw new Error("Paste a direct SoundCloud track link.");
    }
    return { provider: "SoundCloud", sourceUrl: url.href, lookupUrl: `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url.href)}` };
  }
  if (APPLE_MUSIC_HOSTS.has(host)) {
    const id = url.searchParams.get("i") || url.pathname.match(/\/song\/[^/]+\/(\d+)/)?.[1];
    if (!id || !/^\d{6,20}$/.test(id)) {
      throw new Error("Paste a direct Apple Music song link. Album links need a specific song ID.");
    }
    return { provider: "Apple Music", sourceUrl: url.href, lookupUrl: `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}` };
  }
  throw new Error("Supported links: YouTube Music, Spotify track, SoundCloud track, and Apple Music song.");
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`The music provider did not return metadata (HTTP ${response.status}).`);
  const type = response.headers?.get?.("content-type") || "";
  if (type && !type.toLowerCase().includes("json")) throw new Error("The music provider returned an unsupported response.");
  return await response.json();
}

export async function fetchMusicLinkMetadata(input, fetchImpl = fetch) {
  const source = identifyMusicLink(input);
  const payload = await fetchJson(source.lookupUrl, fetchImpl);
  let title = "";
  let artistName = "";
  let album = "";
  let genre = "";
  let durationSeconds = null;
  let artworkUrl = null;

  if (source.provider === "Apple Music") {
    const item = Array.isArray(payload?.results) ? payload.results[0] : null;
    if (payload?.resultCount < 1 || !item) throw new Error("Apple Music could not find that song. Check the link and try again.");
    title = cleanText(item.trackName, 120);
    artistName = cleanText(item.artistName, 120);
    album = cleanText(item.collectionName, 180);
    genre = cleanText(item.primaryGenreName, 80);
    durationSeconds = Number.isFinite(item.trackTimeMillis) ? Math.round(item.trackTimeMillis / 1000) : null;
    // Apple artwork has separate promotional-use terms; do not import it into the catalogue.
  } else {
    title = cleanText(payload?.title, 120);
    artworkUrl = safeImageUrl(payload?.thumbnail_url);
    if (source.provider === "YouTube Music / YouTube") {
      // oEmbed's author_name is the channel/uploader, not guaranteed to be the recording artist.
      artistName = cleanText(payload?.author_name, 120);
    } else if (source.provider === "SoundCloud") {
      const byMatch = title.match(/^(.*?)\s+by\s+(.+)$/i);
      if (byMatch) {
        title = cleanText(byMatch[1], 120);
        artistName = cleanText(byMatch[2], 120);
      } else {
        artistName = cleanText(payload?.author_name, 120);
      }
    }
  }

  if (!title) throw new Error("The provider did not expose a track title for this link.");
  return {
    provider: source.provider,
    sourceUrl: source.sourceUrl,
    title,
    artistName,
    album,
    genre,
    durationSeconds,
    artworkUrl,
    note: source.provider === "YouTube Music / YouTube"
      ? "YouTube exposes the video title and channel/uploader, not a guaranteed recording-artist field. Verify the artist before saving. The link supplies metadata only, not an audio file or music licence."
      : source.provider === "Spotify"
        ? "Spotify's public oEmbed provides the track title and artwork, but not the artist name or full album metadata. Enter or verify the artist manually. The link supplies metadata only, not an audio file or music licence."
        : source.provider === "Apple Music"
          ? "Apple Music metadata includes the track, artist, album, genre and duration. Its artwork is not copied into the VELORI library. The link supplies metadata only, not an audio file or music licence."
          : "Check the imported details before saving. Provider links supply metadata only, not a downloadable audio file or music licence.",
  };
}
