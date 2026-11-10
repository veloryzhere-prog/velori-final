import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReelVideoFilter,
  createReelFfmpegArgs,
  createReelThumbnailFfmpegArgs,
  estimateReelExportBytes,
  getReelExportDimensions,
  validateReelExportOptions,
} from "./export-pipeline.mjs";

const defaults = {
  container: "mp4",
  videoCodec: "h264",
  resolution: "1080p",
  frameRate: 30,
  bitrateMode: "vbr",
  bitrateMbps: 12,
  audioCodec: "aac",
  audioSampleRate: 48000,
  audioChannels: 2,
  aspectRatio: "9:16",
  thumbnailTime: 2,
  overlayText: "",
  overlayFontSize: 48,
  overlayColor: "#ffffff",
  overlayPosition: "bottom",
};

test("export dimensions cover all requested aspect ratios and resolutions", () => {
  assert.deepEqual(getReelExportDimensions("1080p", "9:16"), [1080, 1920]);
  assert.deepEqual(getReelExportDimensions("720p", "4:5"), [720, 900]);
  assert.deepEqual(getReelExportDimensions("4k", "16:9"), [3840, 2160]);
  assert.equal(getReelExportDimensions("8k", "1:1"), null);
});

test("validates supported MP4 and MOV video/audio combinations", () => {
  assert.equal(validateReelExportOptions(defaults, 30), null);
  assert.equal(
    validateReelExportOptions(
      { ...defaults, container: "mov", videoCodec: "prores", audioCodec: "pcm_s16le" },
      30,
    ),
    null,
  );
  assert.match(
    validateReelExportOptions({ ...defaults, container: "mp4", videoCodec: "prores" }, 30),
    /video codec/,
  );
});

test("rejects invalid values and out-of-range overlay and thumbnail inputs", () => {
  assert.match(validateReelExportOptions({ ...defaults, frameRate: 48 }, 30), /frame rate/);
  assert.match(validateReelExportOptions({ ...defaults, bitrateMbps: 0 }, 30), /Bitrate/);
  assert.match(validateReelExportOptions({ ...defaults, audioChannels: 6 }, 30), /mono or stereo/);
  assert.match(validateReelExportOptions({ ...defaults, thumbnailTime: 31 }, 30), /thumbnail time/);
  assert.match(validateReelExportOptions({ ...defaults, overlayText: "x".repeat(201) }, 30), /200/);
  assert.match(validateReelExportOptions(defaults, 601), /0 and 600/);
});

test("size estimate reflects target bitrate and PCM audio cost", () => {
  const aac = estimateReelExportBytes({ duration: 30, bitrateMbps: 12, audioCodec: "aac" });
  const pcm = estimateReelExportBytes({ duration: 30, bitrateMbps: 12, audioCodec: "pcm_s16le" });
  const prores = estimateReelExportBytes({
    duration: 30,
    bitrateMbps: 12,
    audioCodec: "pcm_s16le",
    videoCodec: "prores",
  });
  assert.ok(pcm > aac);
  assert.ok(prores > pcm * 10);
  assert.ok(estimateReelExportBytes({ duration: 60, bitrateMbps: 12, audioCodec: "aac" }) > aac);
});

test("FFmpeg arguments encode the selected codec, frame size, fps, audio, and bitrate mode", () => {
  const args = createReelFfmpegArgs({
    sourcePath: "/tmp/source.mp4",
    outputPath: "/tmp/result.mp4",
    textPath: "/tmp/overlay.txt",
    duration: 30,
    sourceStart: 5,
    options: {
      ...defaults,
      videoCodec: "h265",
      frameRate: 60,
      resolution: "4k",
      bitrateMode: "cbr",
    },
  });
  assert.ok(args.includes("libx265"));
  assert.equal(args[args.indexOf("-ss") + 1], "5");
  assert.ok(
    args.includes(
      "scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,fps=60,setsar=1",
    ),
  );
  assert.ok(args.includes("60"));
  assert.ok(args.includes("12M"));
  assert.ok(args.includes("48000"));
  assert.ok(args.includes("2"));
});

test("text overlay uses a text file, disables expansions, and carries into thumbnail args", () => {
  const options = { ...defaults, overlayText: "%{dangerous}: caption" };
  const filter = buildReelVideoFilter(options, "/tmp/overlay.txt");
  assert.match(filter, /textfile='\/tmp\/overlay\.txt':expansion=none/);
  assert.equal(filter.includes(options.overlayText), false);

  const args = createReelThumbnailFfmpegArgs({
    sourcePath: "/tmp/source.mp4",
    thumbnailPath: "/tmp/cover.jpg",
    textPath: "/tmp/overlay.txt",
    sourceStart: 5,
    options,
  });
  assert.equal(args[args.indexOf("-ss") + 1], "7");
  assert.ok(args.includes("1080x1920"));
  assert.equal(args.at(-1), "/tmp/cover.jpg");
});

test("ProRes emits MOV codec and PCM audio without a misleading video bitrate cap", () => {
  const args = createReelFfmpegArgs({
    sourcePath: "/tmp/source.mp4",
    outputPath: "/tmp/result.mov",
    textPath: "/tmp/overlay.txt",
    duration: 30,
    options: {
      ...defaults,
      container: "mov",
      videoCodec: "prores",
      audioCodec: "pcm_s16le",
      bitrateMode: "vbr",
    },
  });
  assert.ok(args.includes("prores_ks"));
  assert.ok(args.includes("pcm_s16le"));
  assert.equal(args.includes("12M"), false);
  assert.equal(args.at(-1), "/tmp/result.mov");
});
