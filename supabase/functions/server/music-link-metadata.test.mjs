import assert from "node:assert/strict";
import test from "node:test";
import { fetchMusicLinkMetadata, identifyMusicLink } from "./music-link-metadata.mjs";

const jsonResponse = (value) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { "content-type": "application/json" },
});

test("recognizes YouTube Music links and queries the official YouTube oEmbed endpoint", () => {
  const result = identifyMusicLink("https://music.youtube.com/watch?v=abcdefghijk&list=RDabcdefghijk");
  assert.equal(result.provider, "YouTube Music / YouTube");
  assert.match(result.lookupUrl, /youtube\.com\/oembed/);
  assert.match(decodeURIComponent(result.lookupUrl), /youtube\.com\/watch\?v=abcdefghijk/);
});

test("recognizes Spotify track links and rejects unsupported Spotify entity links", () => {
  assert.equal(identifyMusicLink("https://open.spotify.com/track/12345678901234567890").provider, "Spotify");
  assert.throws(() => identifyMusicLink("https://open.spotify.com/playlist/123456"), /direct Spotify track link/);
});

test("recognizes SoundCloud and Apple Music song links", () => {
  assert.equal(identifyMusicLink("https://soundcloud.com/artist/song-name").provider, "SoundCloud");
  assert.equal(identifyMusicLink("https://music.apple.com/in/song/song-name/123456789?i=987654321" ).provider, "Apple Music");
});

test("rejects non-HTTPS, non-allowlisted, credentialed and custom-port URLs", () => {
  assert.throws(() => identifyMusicLink("http://music.youtube.com/watch?v=abcdefghijk"), /HTTPS/);
  assert.throws(() => identifyMusicLink("https://example.com/watch?v=abcdefghijk"), /Supported links/);
  assert.throws(() => identifyMusicLink("https://user:pass@music.youtube.com/watch?v=abcdefghijk"), /HTTPS/);
  assert.throws(() => identifyMusicLink("https://music.youtube.com:8443/watch?v=abcdefghijk"), /HTTPS/);
});

test("imports YouTube metadata but flags channel name as needing verification", async () => {
  const result = await fetchMusicLinkMetadata("https://music.youtube.com/watch?v=abcdefghijk", async (url) => {
    assert.match(url, /youtube\.com\/oembed/);
    return jsonResponse({
      title: "A Sample Song - Official Video",
      author_name: "Example Music Channel",
      thumbnail_url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
    });
  });
  assert.equal(result.title, "A Sample Song - Official Video");
  assert.equal(result.artistName, "Example Music Channel");
  assert.equal(result.provider, "YouTube Music / YouTube");
  assert.match(result.note, /verify/i);
  assert.equal(result.artworkUrl, "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
});


test("extracts artist name from SoundCloud's public track title when it uses the by format", async () => {
  const result = await fetchMusicLinkMetadata("https://soundcloud.com/artist/example-track", async () => jsonResponse({
    title: "Example Track by Example Artist",
    author_name: "Example Artist",
    thumbnail_url: "https://i1.sndcdn.com/artworks-example.jpg",
  }));
  assert.equal(result.title, "Example Track");
  assert.equal(result.artistName, "Example Artist");
  assert.equal(result.provider, "SoundCloud");
});

test("imports Apple Music song metadata without copying promotional artwork", async () => {
  const result = await fetchMusicLinkMetadata("https://music.apple.com/in/song/example-song/123456789", async (url) => {
    assert.match(url, /itunes\.apple\.com\/lookup\?id=123456789/);
    return jsonResponse({ resultCount: 1, results: [{ trackName: "Example Song", artistName: "Example Artist", collectionName: "Example Album", primaryGenreName: "Pop", trackTimeMillis: 183000, artworkUrl100: "https://is1-ssl.mzstatic.com/image.jpg" }] });
  });
  assert.equal(result.title, "Example Song");
  assert.equal(result.artistName, "Example Artist");
  assert.equal(result.album, "Example Album");
  assert.equal(result.genre, "Pop");
  assert.equal(result.durationSeconds, 183);
  assert.equal(result.artworkUrl, null);
});

test("never returns provider iframe HTML or audio/download URLs", async () => {
  const result = await fetchMusicLinkMetadata("https://open.spotify.com/track/12345678901234567890", async () => jsonResponse({
    title: "Spotify sample track",
    thumbnail_url: "https://i.scdn.co/image/sample",
    html: "<iframe src='https://open.spotify.com/embed/track/secret'></iframe>",
  }));
  assert.equal(result.title, "Spotify sample track");
  assert.equal(result.artistName, "");
  assert.match(result.note, /artist name.*manually/i);
  assert.equal("html" in result, false);
  assert.equal("audioUrl" in result, false);
});
