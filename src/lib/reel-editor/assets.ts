import type { ReelAsset, ReelAssetKind } from "./types.ts";

const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".webm"];

const kindForFile = (file: File): ReelAssetKind => {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  const lower = file.name.toLowerCase();
  if (AUDIO_EXTENSIONS.some((extension) => lower.endsWith(extension))) return "audio";
  return "image";
};

interface ProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
}

const probeVideo = (url: string): Promise<ProbeResult> =>
  new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const result = {
        durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };
    video.onerror = () => reject(new Error("This video could not be opened by the browser."));
    video.src = url;
  });

const probeImage = (url: string): Promise<ProbeResult> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({ durationSeconds: 0, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => reject(new Error("This image could not be opened by the browser."));
    image.src = url;
  });

const probeAudio = (url: string): Promise<ProbeResult> =>
  new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const result = {
        durationSeconds: Number.isFinite(audio.duration) ? audio.duration : 0,
        width: 0,
        height: 0,
      };
      audio.removeAttribute("src");
      audio.load();
      resolve(result);
    };
    audio.onerror = () => reject(new Error("This track could not be opened by the browser."));
    audio.src = url;
  });

/** Turns a picked file into an asset the studio can place on the timeline. */
export async function createReelAssetFromFile(file: File): Promise<ReelAsset> {
  const kind = kindForFile(file);
  const url = URL.createObjectURL(file);
  try {
    let probe: ProbeResult = { durationSeconds: 0, width: 0, height: 0 };
    if (kind === "video") probe = await probeVideo(url);
    else if (kind === "image") probe = await probeImage(url);
    else probe = await probeAudio(url);

    if (kind === "video" && (!probe.durationSeconds || probe.durationSeconds <= 0)) {
      throw new Error("This video has no readable duration. Choose another file.");
    }
    if (kind === "video" && probe.durationSeconds > 600) {
      throw new Error("Reels can be up to 10 minutes long. Choose a shorter video.");
    }
    return {
      id: globalThis.crypto?.randomUUID?.() ?? `asset-${Date.now()}`,
      kind,
      name: file.name,
      mimeType: file.type || (kind === "video" ? "video/mp4" : "application/octet-stream"),
      sizeBytes: file.size,
      durationSeconds: probe.durationSeconds,
      width: probe.width,
      height: probe.height,
      url,
      file,
    };
  } catch (cause) {
    URL.revokeObjectURL(url);
    throw cause;
  }
}

/** Releases the object URL of an asset that left the project. */
export function releaseReelAsset(asset: ReelAsset | undefined): void {
  if (!asset) return;
  if (asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
}

/**
 * Grabs a poster frame from a video so the media library can show a thumbnail.
 * Returns null when the browser cannot decode a frame.
 */
export function createVideoPoster(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const finish = (value: string | null) => {
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 6000);
    video.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    video.onloadeddata = () => {
      window.clearTimeout(timer);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 568;
      const context = canvas.getContext("2d");
      if (!context || !video.videoWidth) {
        finish(null);
        return;
      }
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        finish(null);
      }
    };
    video.src = url;
  });
}
