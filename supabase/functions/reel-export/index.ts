import { createClient } from "npm:@supabase/supabase-js@2";
import { validateReelExportOptions } from "../../../src/lib/reel-editor/export-pipeline.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
function injectedKey(variable: string) {
  const raw = Deno.env.get(variable);
  if (!raw) return "";
  try {
    const keys = JSON.parse(raw) as Record<string, unknown>;
    if (typeof keys.default === "string") return keys.default;
    return Object.values(keys).find((value): value is string => typeof value === "string") ?? "";
  } catch {
    return "";
  }
}
const SERVICE_ROLE_KEY =
  Deno.env.get("VELORI_SUPABASE_SECRET_KEY") ??
  injectedKey("SUPABASE_SECRET_KEYS") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const RENDERER_URL = Deno.env.get("VELORI_FFMPEG_RENDERER_URL") ?? "";
const RENDERER_TOKEN = Deno.env.get("VELORI_FFMPEG_RENDERER_TOKEN") ?? "";
const BUCKET = "reel-media";
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:8443",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8443",
];
const ALLOWED_ORIGINS = new Set([
  ...DEV_ORIGINS,
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

let admin: ReturnType<typeof createClient> | undefined;

function getAdmin() {
  admin ??= createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

function json(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    },
  });
}

function errorResponse(message: string, status: number, origin: string) {
  return json({ error: message }, status, origin);
}

function rendererConfigured() {
  if (!RENDERER_URL || !RENDERER_TOKEN) return false;
  try {
    const url = new URL(RENDERER_URL);
    return url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function rendererRequest(path: string, method: "GET" | "POST", payload?: unknown) {
  if (!rendererConfigured()) throw new Error("The FFmpeg renderer is not configured.");
  const isDownload = path.endsWith("/output") || path.endsWith("/thumbnail");
  return await fetch(`${RENDERER_URL.replace(/\/+$/, "")}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-velori-renderer-token": RENDERER_TOKEN,
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: AbortSignal.timeout(method === "POST" ? 20_000 : isDownload ? 120_000 : 10_000),
  });
}

async function authenticate(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match || !SERVICE_ROLE_KEY) return null;
  const { data, error } = await getAdmin().auth.getUser(match[1]);
  return error ? null : data.user;
}

async function parseJson(request: Request) {
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) return null;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 64 * 1024) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function jobIdFromPath(path: string) {
  const match = /^\/jobs\/([^/]+)(?:\/(output|thumbnail))?$/.exec(path);
  if (!match || !UUID_PATTERN.test(match[1])) return null;
  return { id: match[1], kind: match[2] };
}

async function handleRequest(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  if (origin && !ALLOWED_ORIGINS.has(origin))
    return errorResponse("Origin is not allowed.", 403, "");
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
        "Access-Control-Allow-Headers": "authorization, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Max-Age": "600",
      },
    });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return errorResponse("The reel export service is not configured.", 503, origin);
  }
  const user = await authenticate(request);
  if (!user) return errorResponse("Sign in to use the reel export service.", 401, origin);
  const pathname = new URL(request.url).pathname;
  const path = pathname.replace(/^\/functions\/v1\/reel-export/, "").replace(/\/+$/, "") || "/";

  if (path === "/uploads" && request.method === "POST") {
    if (!rendererConfigured()) {
      return errorResponse(
        "FFmpeg export is unavailable: the renderer service is not configured.",
        503,
        origin,
      );
    }
    const body = await parseJson(request);
    if (
      !body ||
      body.contentType !== "video/mp4" ||
      !Number.isInteger(body.size) ||
      body.size < 1 ||
      body.size > MAX_SOURCE_BYTES
    ) {
      return errorResponse("Upload a valid MP4 video smaller than 100 MB.", 400, origin);
    }
    const id = crypto.randomUUID();
    const objectPath = `${user.id}/${id}/source.mp4`;
    const { data, error } = await getAdmin().storage.from(BUCKET).createSignedUploadUrl(objectPath);
    if (error || !data?.token) {
      console.error(JSON.stringify({ event: "reel_export.source_upload_url_failed" }));
      return errorResponse("Could not prepare a private upload for the source video.", 502, origin);
    }
    return json({ jobId: id, path: objectPath, token: data.token }, 201, origin);
  }

  if (path === "/uploads" && request.method === "DELETE") {
    const body = await parseJson(request);
    if (!body || typeof body.jobId !== "string" || !UUID_PATTERN.test(body.jobId)) {
      return errorResponse("The temporary upload identifier is invalid.", 400, origin);
    }
    const { error } = await getAdmin()
      .storage.from(BUCKET)
      .remove([`${user.id}/${body.jobId}/source.mp4`]);
    if (error) {
      console.error(JSON.stringify({ event: "reel_export.source_cleanup_failed" }));
      return errorResponse("The temporary source upload could not be removed.", 502, origin);
    }
    return json({ removed: true }, 200, origin);
  }

  if (path === "/jobs" && request.method === "POST") {
    if (!rendererConfigured()) {
      return errorResponse(
        "FFmpeg export is unavailable: the renderer service is not configured.",
        503,
        origin,
      );
    }
    const body = await parseJson(request);
    if (
      !body ||
      typeof body.id !== "string" ||
      !UUID_PATTERN.test(body.id) ||
      body.sourcePath !== `${user.id}/${body.id}/source.mp4` ||
      typeof body.duration !== "number" ||
      typeof body.sourceStart !== "number" ||
      typeof body.options !== "object" ||
      body.options === null
    ) {
      return errorResponse("The source video or export settings are invalid.", 400, origin);
    }
    if (
      !Number.isFinite(body.sourceStart) ||
      body.sourceStart < 0 ||
      body.sourceStart + body.duration > 600
    ) {
      return errorResponse("The source trim start is invalid.", 400, origin);
    }
    const settingsError = validateReelExportOptions(body.options, body.duration);
    if (settingsError) return errorResponse(settingsError, 400, origin);

    const { data: signedSource, error: signedSourceError } = await getAdmin()
      .storage.from(BUCKET)
      .createSignedUrl(body.sourcePath, 30 * 60);
    if (signedSourceError || !signedSource?.signedUrl) {
      return errorResponse("The uploaded source video could not be opened.", 400, origin);
    }

    let response: Response;
    try {
      response = await rendererRequest("/jobs", "POST", {
        id: body.id,
        ownerId: user.id,
        sourceUrl: signedSource.signedUrl,
        duration: body.duration,
        sourceStart: body.sourceStart,
        options: body.options,
      });
    } catch {
      console.error(JSON.stringify({ event: "reel_export.renderer_unavailable" }));
      return errorResponse(
        "FFmpeg renderer is unavailable. Try again after it is online.",
        503,
        origin,
      );
    }
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return errorResponse(
        typeof result.error === "string" ? result.error : "The render job could not be started.",
        response.status,
        origin,
      );
    }
    return json(await response.json(), 202, origin);
  }

  const job = jobIdFromPath(path);
  if (!job) return errorResponse("Export route not found.", 404, origin);
  if (request.method !== "GET") {
    return errorResponse("Method not allowed.", 405, origin);
  }

  let response: Response;
  try {
    response = await rendererRequest(
      `/jobs/${encodeURIComponent(user.id)}/${encodeURIComponent(job.id)}${job.kind ? `/${job.kind}` : ""}`,
      "GET",
    );
  } catch {
    console.error(JSON.stringify({ event: "reel_export.renderer_unavailable" }));
    return errorResponse("FFmpeg renderer is unavailable.", 503, origin);
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    return errorResponse(
      typeof result.error === "string" ? result.error : "The export job could not be found.",
      response.status,
      origin,
    );
  }
  if (job.kind) {
    const headers = new Headers(response.headers);
    if (origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    }
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: 200, headers });
  }

  const result = await response.json();
  if (result.status === "completed" || result.status === "failed") {
    const { error } = await getAdmin()
      .storage.from(BUCKET)
      .remove([`${user.id}/${job.id}/source.mp4`]);
    if (error) {
      console.error(JSON.stringify({ event: "reel_export.source_cleanup_failed" }));
      result.cleanupWarning = "The temporary source upload could not be removed automatically.";
    }
  }
  return json(result, 200, origin);
}

Deno.serve(async (request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "reel_export.unhandled_error",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    return json({ error: "The export request could not be completed." }, 500);
  }
});

export { handleRequest };
