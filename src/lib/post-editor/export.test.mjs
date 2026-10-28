import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPORT_FORMATS,
  RESOLUTIONS,
  buildBulkZip,
  buildMp4Export,
  buildPdfExport,
  buildPngExport,
  createExportDialog,
  createExportJob,
  estimateFileSize,
  exportSlides,
} from "./export.mjs";

test("export utilities expose the supported formats and resolutions", () => {
  assert.ok(EXPORT_FORMATS.includes("png"));
  assert.ok(EXPORT_FORMATS.includes("pdf"));
  assert.ok(EXPORT_FORMATS.includes("mp4"));
  assert.ok(EXPORT_FORMATS.includes("zip"));
  assert.deepEqual(RESOLUTIONS, [1, 2, 3]);
});

test("export job builder calculates file size and metadata", () => {
  const job = createExportJob({
    name: "launch-carousel",
    format: "png",
    resolution: 2,
    quality: 0.82,
    slideCount: 5,
  });

  assert.equal(job.format, "png");
  assert.equal(job.resolution, 2);
  assert.equal(job.quality, 0.82);
  assert.ok(job.fileSize.bytes > 0);
  assert.ok(job.fileSize.mb >= 0);
});

test("PNG, PDF, MP4, and ZIP exports build valid payloads", () => {
  const slides = [
    { id: "slide-1", title: "Slide 1" },
    { id: "slide-2", title: "Slide 2" },
    { id: "slide-3", title: "Slide 3" },
  ];

  const png = buildPngExport({ width: 1080, height: 1920, resolution: 3, quality: 0.9, slides });
  const pdf = buildPdfExport({ slides, title: "Launch" });
  const mp4 = buildMp4Export({ slides, width: 1080, height: 1920, fps: 30, duration: 9 });
  const zip = buildBulkZip({ slides });

  assert.equal(png.kind, "png");
  assert.equal(png.width, 3240);
  assert.equal(png.frames.length, 3);
  assert.equal(pdf.kind, "pdf");
  assert.equal(pdf.pages.length, 3);
  assert.equal(mp4.kind, "mp4");
  assert.equal(mp4.totalFrames, 270);
  assert.equal(zip.kind, "zip");
  assert.equal(zip.files.length, 3);
});

test("dialog and post export utilities estimate export size and set defaults", () => {
  const dialog = createExportDialog({
    name: "story-board",
    format: "pdf",
    quality: 0.75,
    resolution: 1,
  });

  const result = exportSlides(
    { title: "Campaign", slides: [{ id: "one" }, { id: "two" }] },
    { format: "zip", quality: 0.65, resolution: 2 },
  );

  const estimate = estimateFileSize({
    width: 1080,
    height: 1920,
    scale: 2,
    quality: 0.75,
    slideCount: 2,
    format: "png",
  });

  assert.equal(dialog.format, "pdf");
  assert.equal(dialog.quality, 0.75);
  assert.ok(dialog.estimate.bytes > 0);
  assert.equal(result.kind, "zip");
  assert.ok(estimate.bytes > 0);
});
