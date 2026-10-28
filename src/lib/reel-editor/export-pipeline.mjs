export const REEL_EXPORT_RESOLUTIONS = ["720p", "1080p", "4k"];
export const REEL_EXPORT_FRAME_RATES = [24, 25, 30, 60];
export const REEL_EXPORT_ASPECT_RATIOS = ["9:16", "1:1", "16:9", "4:5"];

const dimensions = {
  "9:16": { "720p": [720, 1280], "1080p": [1080, 1920], "4k": [2160, 3840] },
  "1:1": { "720p": [720, 720], "1080p": [1080, 1080], "4k": [2160, 2160] },
  "16:9": { "720p": [1280, 720], "1080p": [1920, 1080], "4k": [3840, 2160] },
  "4:5": { "720p": [720, 900], "1080p": [1080, 1350], "4k": [2160, 2700] },
};

export function getReelExportDimensions(resolution, aspectRatio) {
  return dimensions[aspectRatio]?.[resolution] ?? null;
}

export function validateReelExportOptions(options, duration) {
  if (!options || typeof options !== "object") return "Export settings are required.";
  if (!getReelExportDimensions(options.resolution, options.aspectRatio)) {
    return "Choose a supported resolution and aspect ratio.";
  }
  if (!REEL_EXPORT_FRAME_RATES.includes(options.frameRate)) {
    return "Choose a supported frame rate.";
  }
  if (!["mp4", "mov"].includes(options.container)) {
    return "Choose MP4 or MOV.";
  }
  if (
    (options.container === "mp4" && !["h264", "h265"].includes(options.videoCodec)) ||
    (options.container === "mov" && options.videoCodec !== "prores")
  ) {
    return "Choose a video codec supported by the selected container.";
  }
  if (
    (options.container === "mp4" && options.audioCodec !== "aac") ||
    (options.container === "mov" && options.audioCodec !== "pcm_s16le")
  ) {
    return "Choose AAC audio for MP4 or PCM audio for MOV.";
  }
  if (!["cbr", "vbr"].includes(options.bitrateMode)) return "Choose CBR or VBR bitrate mode.";
  if (
    !Number.isFinite(options.bitrateMbps) ||
    options.bitrateMbps < 1 ||
    options.bitrateMbps > 100
  ) {
    return "Bitrate must be between 1 and 100 Mbps.";
  }
  if (![44100, 48000].includes(options.audioSampleRate)) {
    return "Choose a supported audio sample rate.";
  }
  if (![1, 2].includes(options.audioChannels)) return "Choose mono or stereo audio.";
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600) {
    return "The source video must be between 0 and 600 seconds.";
  }
  if (
    !Number.isFinite(options.thumbnailTime) ||
    options.thumbnailTime < 0 ||
    options.thumbnailTime > duration
  ) {
    return "Choose a thumbnail time within the source video.";
  }
  if (typeof options.overlayText !== "string" || options.overlayText.length > 200) {
    return "Overlay text must be 200 characters or fewer.";
  }
  if (
    !Number.isInteger(options.overlayFontSize) ||
    options.overlayFontSize < 12 ||
    options.overlayFontSize > 180 ||
    !/^#[0-9a-f]{6}$/i.test(options.overlayColor) ||
    !["top", "center", "bottom"].includes(options.overlayPosition)
  ) {
    return "Choose a valid text overlay size, color, and position.";
  }
  return null;
}

export function estimateReelExportBytes({
  duration,
  bitrateMbps,
  audioCodec,
  audioChannels = 2,
  videoCodec = "h264",
  resolution = "1080p",
  aspectRatio = "9:16",
  frameRate = 30,
}) {
  const audioMbps = audioCodec === "pcm_s16le" ? 0.768 * audioChannels : 0.192;
  const videoMbps =
    videoCodec === "prores"
      ? 220 *
        (getReelExportDimensions(resolution, aspectRatio).reduce(
          (total, value) => total * value,
          1,
        ) /
          (1080 * 1920)) *
        (frameRate / 30)
      : bitrateMbps;
  return Math.ceil(duration * ((videoMbps + audioMbps) * 125000) + 65536);
}

export function buildReelVideoFilter(options, textPath, fontFile = "") {
  const [width, height] = getReelExportDimensions(options.resolution, options.aspectRatio);
  const filters = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    `fps=${options.frameRate}`,
    "setsar=1",
  ];
  if (options.overlayText) {
    const escapedTextPath = textPath.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
    const fontFilter = fontFile
      ? `fontfile='${fontFile.replaceAll("\\", "\\\\").replaceAll(":", "\\:")}':`
      : "";
    const y = {
      top: "h*0.08",
      center: "(h-text_h)/2",
      bottom: "h-text_h-h*0.08",
    }[options.overlayPosition];
    filters.push(
      `drawtext=${fontFilter}textfile='${escapedTextPath}':expansion=none` +
        `:fontsize=${options.overlayFontSize}:fontcolor=0x${options.overlayColor.slice(1)}` +
        `:x=(w-text_w)/2:y=${y}`,
    );
  }
  return filters.join(",");
}

export function createReelFfmpegArgs({
  sourcePath,
  outputPath,
  textPath,
  fontFile,
  duration,
  sourceStart = 0,
  options,
}) {
  const videoCodec = {
    h264: ["-c:v", "libx264", "-preset", "medium"],
    h265: ["-c:v", "libx265", "-preset", "medium"],
    prores: ["-c:v", "prores_ks", "-profile:v", "3"],
  }[options.videoCodec];
  const audioCodec =
    options.audioCodec === "aac" ? ["-c:a", "aac", "-b:a", "192k"] : ["-c:a", "pcm_s16le"];
  const bitrateArgs =
    options.videoCodec === "prores"
      ? []
      : options.bitrateMode === "cbr"
        ? [
            "-b:v",
            `${options.bitrateMbps}M`,
            "-minrate",
            `${options.bitrateMbps}M`,
            "-maxrate",
            `${options.bitrateMbps}M`,
            "-bufsize",
            `${options.bitrateMbps * 2}M`,
          ]
        : [
            "-b:v",
            `${options.bitrateMbps}M`,
            "-maxrate",
            `${options.bitrateMbps * 1.5}M`,
            "-bufsize",
            `${options.bitrateMbps * 2}M`,
          ];
  return [
    "-hide_banner",
    "-y",
    "-ss",
    String(sourceStart),
    "-i",
    sourcePath,
    "-t",
    String(duration),
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-vf",
    buildReelVideoFilter(options, textPath, fontFile),
    ...videoCodec,
    ...bitrateArgs,
    "-pix_fmt",
    options.videoCodec === "prores" ? "yuv422p10le" : "yuv420p",
    "-r",
    String(options.frameRate),
    ...audioCodec,
    "-ar",
    String(options.audioSampleRate),
    "-ac",
    String(options.audioChannels),
    "-progress",
    "pipe:1",
    "-nostats",
    outputPath,
  ];
}

export function createReelThumbnailFfmpegArgs({
  sourcePath,
  thumbnailPath,
  textPath,
  fontFile,
  sourceStart = 0,
  options,
}) {
  const [width, height] = getReelExportDimensions(options.resolution, options.aspectRatio);
  return [
    "-hide_banner",
    "-y",
    "-ss",
    String(sourceStart + options.thumbnailTime),
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    "-vf",
    buildReelVideoFilter(options, textPath, fontFile),
    "-s",
    `${width}x${height}`,
    "-q:v",
    "2",
    thumbnailPath,
  ];
}
