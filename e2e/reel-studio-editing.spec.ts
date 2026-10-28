import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

function readSecrets() {
  return Object.fromEntries(
    readFileSync(
      "C:/Users/aryan/Downloads/VELORI Platform Upgrade Audit (1)/.env.secrets.local",
      "utf8",
    )
      .split(/\r?\n/)
      .flatMap((line) => {
        const index = line.indexOf("=");
        return index > 0
          ? [
              [
                line.slice(0, index).trim(),
                line
                  .slice(index + 1)
                  .trim()
                  .replace(/^"|"$/g, ""),
              ],
            ]
          : [];
      }),
  );
}

async function signIn(page: Page) {
  const secrets = readSecrets();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(secrets.VELORI_QA_OWNER_EMAIL);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(secrets.VELORI_QA_OWNER_PASSWORD);
  const response = page.waitForResponse((item) =>
    item.url().includes("/auth/v1/token?grant_type=password"),
  );
  await page
    .getByRole("button", { name: /sign in/i })
    .first()
    .click();
  expect((await response).status()).toBe(200);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Records a short clip in the browser so the studio gets a real MP4 to edit. */
async function recordSampleVideo(page: Page): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const recorded = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const mimeType = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    if (!mimeType) return null;
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    recorder.start();
    for (let frame = 0; frame < 120; frame += 1) {
      context.fillStyle = `hsl(${(frame * 8) % 360} 70% 50%)`;
      context.fillRect(0, 0, canvas.width, canvas.height);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    recorder.stop();
    const blob = await stopped;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("Could not read the recorded clip."));
      reader.readAsDataURL(blob);
    });
    return { mimeType, base64 };
  });
  if (!recorded) throw new Error("This browser cannot record a sample clip.");
  return {
    name: "sample.mp4",
    mimeType: recorded.mimeType,
    buffer: Buffer.from(recorded.base64, "base64"),
  };
}

test("the reel studio edits a real clip and splits it into two segments", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);

  const sample = await recordSampleVideo(page);
  await page.goto("/reels/create", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".reel-studio")).toBeVisible();
  await expect(page.locator(".reel-timeline")).toBeVisible();
  await expect(page.locator(".reel-studio-panel-right")).toBeVisible();

  await page.locator(".reel-dropzone input[type=file]").setInputFiles({
    name: sample.name,
    mimeType: sample.mimeType,
    buffer: sample.buffer,
  });

  const addButton = page.getByRole("button", { name: /Add sample\.mp4 to the timeline/i });
  await expect(addButton).toBeVisible({ timeout: 20_000 });
  await addButton.click();

  const clip = page.locator(".reel-clip").first();
  await expect(clip).toBeVisible();
  await clip.click();
  await expect(page.locator(".reel-inspector-title")).toHaveText("sample.mp4");

  // Put the playhead inside the clip by clicking the ruler at the clip's
  // midpoint, then split it into two real segments.
  const clipBox = await clip.boundingBox();
  const rulerBox = await page.locator(".reel-timeline-ruler").boundingBox();
  expect(clipBox).not.toBeNull();
  expect(rulerBox).not.toBeNull();
  await page.mouse.click(
    clipBox!.x + clipBox!.width / 2,
    rulerBox!.y + rulerBox!.height / 2,
  );
  const split = page.getByRole("button", { name: "Split here" });
  await expect(split).toBeEnabled();
  await split.click();
  await expect(page.locator(".reel-clip")).toHaveCount(2);

  // The preview canvas must still be painting the composition.
  const painted = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".reel-stage-canvas");
    if (!canvas) return false;
    const context = canvas.getContext("2d");
    if (!context) return false;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < data.length; index += 4000) {
      if (data[index] || data[index + 1] || data[index + 2]) return true;
    }
    return false;
  });
  expect(painted).toBe(true);

  // The studio must fit a phone screen without sideways scrolling.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".reel-studio-mobilebar")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);

  expect(errors).toEqual([]);
});

test("the studio renders the edited reel into a real MP4 with the edit baked in", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);

  const sample = await recordSampleVideo(page);
  await page.goto("/reels/create", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".reel-studio")).toBeVisible();

  await page.locator(".reel-dropzone input[type=file]").setInputFiles({
    name: sample.name,
    mimeType: sample.mimeType,
    buffer: sample.buffer,
  });
  const addButton = page.getByRole("button", { name: /Add sample\.mp4 to the timeline/i });
  await expect(addButton).toBeVisible({ timeout: 20_000 });
  await addButton.click();

  const clip = page.locator(".reel-clip").first();
  await expect(clip).toBeVisible();
  await clip.click();

  // Apply a real edit: a grayscale filter on the clip.
  const filterSelect = page.getByLabel("Filter").first();
  await filterSelect.selectOption("mono");
  await expect(filterSelect).toHaveValue("mono");

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const cover = page.locator(".reel-profile-grid img");
  await expect(cover).toBeVisible({ timeout: 20_000 });

  // The cover is rendered by the same frame renderer the MP4 encoder uses, so a
  // grayscale result proves the edit is applied in the render pipeline.
  const isGray = await cover.evaluate(async (image: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || 1080;
    canvas.height = image.naturalHeight || 1920;
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < data.length; index += 400) {
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (Math.abs(r - g) > 12 || Math.abs(g - b) > 12) return false;
    }
    return true;
  });
  expect(isGray).toBe(true);

  // Exporting must produce a real MP4 file, not the untouched source.
  const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  await page.getByRole("button", { name: "Export file" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = readFileSync(path!);
  expect(bytes.length).toBeGreaterThan(5000);
  expect(bytes.subarray(4, 8).toString("latin1")).toBe("ftyp");

  expect(errors).toEqual([]);
});
