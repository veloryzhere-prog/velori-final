import { drawReelFrame, prepareReelAssets, type ReelRenderAsset } from "./frame-renderer.ts";
import { activeClipAt, clipDuration, clipEnd, projectDuration } from "./timeline.ts";
import type { ReelProject } from "./types.ts";

// Prefer an explicit, broadly playable video/audio pair. A generic MP4 request
// can otherwise choose VP9/Opus even when this browser can encode H.264/AAC.
export const REEL_MP4_MIME_TYPES = [
  "video/mp4;codecs=avc1.42E028,mp4a.40.2",
  "video/mp4;codecs=avc1.42E028",
  "video/mp4",
];
export const REEL_WEBM_MIME_TYPES = ["video/webm;codecs=vp9", "video/webm"];

/** Picks the first MP4 mime type the browser can actually record. */
export function getReelMp4MimeType(isSupported: (type: string) => boolean = () => false) {
  return REEL_MP4_MIME_TYPES.find((type) => isSupported(type)) ?? null;
}

/** Picks a WebM mime type so an unsupported browser can still export a file. */
export function getReelWebmMimeType(isSupported: (type: string) => boolean = () => false) {
  return REEL_WEBM_MIME_TYPES.find((type) => isSupported(type)) ?? null;
}

export interface ReelRenderOptions {
  mimeType: string;
  frameRate?: number;
  onProgress?: (percent: number) => void;
  onStage?: (stage: string) => void;
  signal?: AbortSignal;
}

export interface ReelRenderResult {
  blob: Blob;
  durationSeconds: number;
  includedAudio: boolean;
}

const recordedDuration = (blob: Blob, signal?: AbortSignal) =>
  new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(blob);
    const cleanup = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      video.onloadedmetadata = null;
      video.ondurationchange = null;
      video.ontimeupdate = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const fail = () => {
      cleanup();
      reject(new Error("The rendered video has no readable duration. Please retry the export."));
    };
    const onAbort = () => {
      cleanup();
      reject(new Error("The export was cancelled."));
    };
    const timer = window.setTimeout(fail, 15000);
    video.preload = "metadata";
    const finish = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      cleanup();
      resolve(duration);
    };
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) return finish();
      // MediaRecorder WebM may omit its duration header. Seeking to the end
      // asks the decoder to discover the real endpoint rather than inventing it.
      video.currentTime = Number.MAX_SAFE_INTEGER;
    };
    video.ondurationchange = finish;
    video.ontimeupdate = finish;
    video.onerror = fail;
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
    video.src = url;
  });

const waitForMedia = (element: HTMLMediaElement, readyState = 2, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("The export was cancelled."));
      return;
    }
    if (element.readyState >= readyState) {
      resolve();
      return;
    }
    const onReady = () => {
      if (element.readyState < readyState) return;
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("A media file in this reel could not be prepared for rendering."));
    };
    const onAbort = () => {
      cleanup();
      reject(new Error("The export was cancelled."));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("A media file took too long to load. Check your connection and retry."));
    }, 15000);
    const cleanup = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      element.removeEventListener("loadeddata", onReady);
      element.removeEventListener("canplay", onReady);
      element.removeEventListener("error", onError);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    element.addEventListener("loadeddata", onReady);
    element.addEventListener("canplay", onReady);
    element.addEventListener("error", onError);
  });

/**
 * Renders the edited reel to a real video file in the browser.
 *
 * The same frame renderer drives the editor preview and this encoder, so the
 * published file matches the preview instead of the untouched source.
 */
export async function renderReelMp4(
  project: ReelProject,
  options: ReelRenderOptions,
): Promise<ReelRenderResult> {
  if (!project.clips.length) throw new Error("Add a clip to the timeline before exporting.");
  const frameRate = options.frameRate ?? 30;
  const duration = projectDuration(project);
  if (duration <= 0) throw new Error("This reel has no playable content yet.");

  const canvas = document.createElement("canvas");
  canvas.width = project.width;
  canvas.height = project.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not create an export canvas.");
  if (typeof canvas.captureStream !== "function") {
    throw new Error("This browser cannot record a canvas to a video file.");
  }

  options.onStage?.("Preparing your media…");
  const assets: Map<string, ReelRenderAsset> = await prepareReelAssets(project);
  // Still-image compositions also need explicit frames; a compositor may omit
  // unchanged/offscreen canvas paints from automatic capture.
  drawReelFrame(context, project, assets, 0);
  const manualCapture =
    typeof CanvasCaptureMediaStreamTrack !== "undefined" &&
    typeof CanvasCaptureMediaStreamTrack.prototype.requestFrame === "function";
  const stream = canvas.captureStream(manualCapture ? 0 : frameRate);
  const captureTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  const captureFrame = () => {
    if (manualCapture) captureTrack?.requestFrame();
  };
  let audioContext: AudioContext | null = null;
  let includedAudio = false;
  let animationFrame = 0;
  const mediaElements = new Map<string, HTMLVideoElement>();
  for (const [assetId, asset] of assets.entries()) {
    if (asset instanceof HTMLVideoElement) mediaElements.set(assetId, asset);
  }
  const gainNodes = new Map<string, GainNode>();
  const cleanupElements: HTMLMediaElement[] = [];
  const audioElements = new Map<string, HTMLAudioElement>();
  let recorder: MediaRecorder | null = null;
  let playbackFailure: Error | null = null;

  try {
    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    for (const [assetId, asset] of Object.entries(project.assets)) {
      if (asset.kind === "audio") continue;
      const element = assets.get(assetId);
      if (!element) continue;
      const media = element instanceof HTMLVideoElement ? element : null;
      if (!media) continue;
      media.muted = false;
      media.volume = 1;
      try {
        const source = audioContext.createMediaElementSource(media);
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(destination);
        gainNodes.set(assetId, gain);
        includedAudio = true;
      } catch {
        throw new Error("A video soundtrack could not be connected. Your reel was not exported.");
      }
    }

    for (const audioClip of project.audio) {
      const asset = project.assets[audioClip.assetId];
      if (!asset) continue;
      const element = document.createElement("audio");
      element.crossOrigin = "anonymous";
      element.preload = "auto";
      element.src = asset.url;
      cleanupElements.push(element);
      audioElements.set(audioClip.id, element);
      try {
        const source = audioContext.createMediaElementSource(element);
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(destination);
        gainNodes.set(audioClip.id, gain);
        includedAudio = true;
      } catch {
        throw new Error("An audio track could not be connected. Your reel was not exported.");
      }
    }

    if (includedAudio) {
      for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
    }

    options.onStage?.("Rendering your reel…");
    recorder = new MediaRecorder(stream, { mimeType: options.mimeType });
    const recording = recorder;
    const chunks: BlobPart[] = [];
    const completed = new Promise<Blob>((resolve, reject) => {
      recording.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recording.onerror = () =>
        reject(new Error("The browser encountered an error while encoding your reel."));
      recording.onstop = () => resolve(new Blob(chunks, { type: options.mimeType }));
    });

    // Attach a rejection handler immediately; encoder errors can arrive before
    // the drawing loop finishes. The original promise is still awaited below.
    void completed.catch(() => undefined);
    for (const element of mediaElements.values()) {
      await waitForMedia(element, 2, options.signal);
    }
    for (const element of audioElements.values()) await waitForMedia(element, 2, options.signal);

    if (audioContext) await audioContext.resume();
    const started = new Promise<void>((resolve) => {
      recording.addEventListener("start", () => resolve(), { once: true });
    });
    recorder.start(500);
    await Promise.race([
      started,
      completed.then(() => {
        throw new Error("The encoder stopped before rendering began.");
      }),
    ]);
    drawReelFrame(context, project, assets, 0);
    captureFrame();

    const startedAt = performance.now();
    let activeClipId: string | null = null;
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        try {
          if (options.signal?.aborted) {
            reject(new Error("The export was cancelled."));
            return;
          }
          if (playbackFailure) throw playbackFailure;
          const elapsed = (performance.now() - startedAt) / 1000;
          // The endpoint is exclusive for clip lookup. Capture the final valid
          // frame instead of encoding a black frame at exactly `duration`.
          const time = Math.min(elapsed, Math.max(0, duration - 1 / frameRate));
          const clip = activeClipAt(project, time);

          if (clip && clip.id !== activeClipId) {
            activeClipId = clip.id;
            const media = mediaElements.get(clip.assetId);
            if (media) {
              media.playbackRate = clip.playbackRate;
              try {
                media.currentTime = clip.sourceIn;
              } catch {
                /* the element will settle on its next frame */
              }
              void media.play().catch(() => {
                playbackFailure = new Error(
                  "A video clip could not play during rendering. Your reel was not exported.",
                );
              });
            }
          }
          if (!clip) activeClipId = null;

          for (const [assetId, gain] of gainNodes) {
            if (project.audio.some((item) => item.id === assetId)) {
              const audioClip = project.audio.find((item) => item.id === assetId);
              if (!audioClip) {
                gain.gain.value = 0;
                continue;
              }
              const local = time - audioClip.startSeconds;
              const inside = local >= 0 && local <= audioClip.sourceOut - audioClip.sourceIn;
              const fade = Math.min(
                1,
                Math.max(
                  0,
                  Math.min(
                    local > 0 ? local / Math.max(0.01, audioClip.fadeInSeconds) : 1,
                    (audioClip.sourceOut - audioClip.sourceIn - local) /
                      Math.max(0.01, audioClip.fadeOutSeconds),
                  ),
                ),
              );
              gain.gain.value = inside ? audioClip.volume * fade : 0;
              const audio = audioElements.get(audioClip.id);
              if (audio) {
                if (inside && audio.paused) {
                  audio.currentTime = audioClip.sourceIn + local;
                  void audio.play().catch(() => {
                    playbackFailure = new Error(
                      "An audio track could not play during rendering. Your reel was not exported.",
                    );
                  });
                } else if (!inside && !audio.paused) audio.pause();
              }
              continue;
            }
            const videoClip = project.clips.find((item) => item.assetId === assetId);
            if (!videoClip || !clip || clip.assetId !== assetId) {
              gain.gain.value = 0;
              continue;
            }
            const sinceStart = time - clip.startSeconds;
            const untilEnd = clipEnd(clip) - time;
            const fadeIn =
              clip.fadeInSeconds > 0 ? Math.min(1, sinceStart / clip.fadeInSeconds) : 1;
            const fadeOut =
              clip.fadeOutSeconds > 0 ? Math.min(1, untilEnd / clip.fadeOutSeconds) : 1;
            const fade = Math.max(0, Math.min(fadeIn, fadeOut));
            gain.gain.value = clip.muted ? 0 : videoClip.volume * fade;
          }

          for (const media of mediaElements.values()) {
            if (!activeClipId) {
              media.pause();
              continue;
            }
            const clip = project.clips.find((item) => item.id === activeClipId);
            if (!clip || mediaElements.get(clip.assetId) !== media) media.pause();
          }

          drawReelFrame(context, project, assets, time);
          captureFrame();
          options.onProgress?.(Math.min(99, Math.round((time / duration) * 100)));

          if (elapsed >= duration) {
            resolve();
            return;
          }
          animationFrame = window.requestAnimationFrame(tick);
        } catch (cause) {
          reject(cause);
        }
      };
      animationFrame = window.requestAnimationFrame(tick);
    });

    // requestFrame is captured asynchronously. Let the final painted frame
    // reach the stream before stopping; stopping in the same task drops it.
    for (const element of [...mediaElements.values(), ...audioElements.values()]) element.pause();
    for (const gain of gainNodes.values()) gain.gain.value = 0;
    await new Promise<void>((resolve) => {
      animationFrame = window.requestAnimationFrame(() => resolve());
    });
    if (options.signal?.aborted) throw new Error("The export was cancelled.");
    if (typeof recorder.requestData === "function") recorder.requestData();
    recorder.stop();
    const blob = await completed;
    if (!blob.size) throw new Error("The browser finished rendering without any video data.");
    const durationSeconds = await recordedDuration(blob, options.signal);
    options.onProgress?.(100);
    return { blob, durationSeconds, includedAudio };
  } catch (cause) {
    throw cause;
  } finally {
    window.cancelAnimationFrame(animationFrame);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    for (const element of mediaElements.values()) {
      try {
        element.pause();
        element.removeAttribute("src");
        element.load();
      } catch {
        /* the element may already be detached */
      }
    }
    for (const element of cleanupElements) {
      try {
        element.pause();
        element.removeAttribute("src");
        element.load();
      } catch {
        /* the element may already be detached */
      }
    }
    stream.getTracks().forEach((track) => track.stop());
    if (audioContext && audioContext.state !== "closed") await audioContext.close();
  }
}

/** Total length of the reel, exposed for UI labels. */
export function reelDuration(project: ReelProject): number {
  return projectDuration(project);
}

/** Length of the clip that is playing at a timeline position. */
export function activeClipLength(project: ReelProject, timeSeconds: number): number {
  const clip = activeClipAt(project, timeSeconds);
  return clip ? clipDuration(clip) : 0;
}
