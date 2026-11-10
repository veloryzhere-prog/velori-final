export const STORY_EXPORT_RESOLUTIONS = ["720p", "1080p"];

const dimensions = {
  "720p": [720, 1280],
  "1080p": [1080, 1920],
};

export function getStoryExportDimensions(resolution) {
  return dimensions[resolution] ? [...dimensions[resolution]] : null;
}

function partsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map(({ type, value }) => [type, Number(value)]),
  );
}

export function parseStorySchedule(localDateTime, timeZone, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime)) {
    throw new TypeError("Choose a valid local date and time.");
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(new Date(now));
  } catch {
    throw new RangeError("Enter a valid IANA timezone, such as Asia/Kolkata.");
  }

  const [date, time] = localDateTime.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  const normalized = new Date(wallTime);
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() + 1 !== month ||
    normalized.getUTCDate() !== day ||
    normalized.getUTCHours() !== hour ||
    normalized.getUTCMinutes() !== minute
  ) {
    throw new TypeError("Choose a valid local date and time.");
  }
  const requested = { year, month, day, hour, minute };
  const offsets = new Set();
  for (let delta = -36; delta <= 36; delta += 6) {
    const sample = new Date(wallTime + delta * 60 * 60 * 1000);
    const formatted = partsInTimeZone(sample, timeZone);
    const localAsUtc = Date.UTC(
      formatted.year,
      formatted.month - 1,
      formatted.day,
      formatted.hour,
      formatted.minute,
      formatted.second,
    );
    offsets.add(localAsUtc - Math.floor(sample.getTime() / 1000) * 1000);
  }
  const candidates = [...offsets]
    .map((offset) => wallTime - offset)
    .filter((candidate) => {
      const actual = partsInTimeZone(new Date(candidate), timeZone);
      return Object.entries(requested).every(([key, value]) => actual[key] === value);
    })
    .sort((a, b) => a - b);
  if (!candidates.length) {
    throw new RangeError(
      "This local time does not exist in the selected timezone due to a clock change.",
    );
  }
  if (candidates[0] <= now) throw new RangeError("Choose a schedule time in the future.");
  return new Date(candidates[0]).toISOString();
}

export function formatStorySchedule(isoDateTime, timeZone) {
  const date = new Date(isoDateTime);
  if (!Number.isFinite(date.getTime())) throw new TypeError("Schedule time must be a valid date.");
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function getStoryExportFileName(title, slideNumber, resolution, extension) {
  const safeTitle =
    String(title)
      .normalize("NFKD")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "story";
  const slideSuffix = Number.isInteger(slideNumber) ? `-slide-${slideNumber}` : "";
  return `${safeTitle}${slideSuffix}-${resolution}.${extension}`;
}

export function getStoryMp4MimeType(isSupported = () => false) {
  return (
    ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/mp4;codecs=avc1.42E01E"].find(
      (type) => isSupported(type),
    ) ?? null
  );
}
