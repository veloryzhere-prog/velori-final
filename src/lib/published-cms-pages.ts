import { cmsDisplaySettings } from "./cms-display-settings.mjs";
import { friendlyError, supabase } from "./supabase";

export type PublishedCmsPageRecord = {
  title: string;
  slug: string;
  route: string;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  og_title?: string | null;
  og_description?: string | null;
  hero_image: string | null;
  footer_enabled?: boolean;
  animation_enabled?: boolean;
  custom_html?: string | null;
  custom_css?: string | null;
  custom_js?: string | null;
  content_mode?: "visual" | "custom_html" | null;
  content_blocks?: unknown[] | null;
};

export type PublishedCmsPageResult =
  | { status: "ready"; page: PublishedCmsPageRecord }
  | { status: "missing" }
  | { status: "error"; message: string };

const CACHE_TTL_MS = 120_000;
const QUERY_TIMEOUT_MS = 8_000;
const cache = new Map<string, { result: PublishedCmsPageResult; checkedAt: number }>();
const inflight = new Map<string, Promise<PublishedCmsPageResult>>();

export function normalizeCmsRoute(route: string) {
  const normalized = `/${route.trim().replace(/^\/+|\/+$/g, "")}`.toLowerCase();
  return normalized === "/" ? "/" : normalized;
}

export function cachedPublishedCmsPage(route: string): PublishedCmsPageResult | null {
  const cached = cache.get(normalizeCmsRoute(route));
  if (!cached) return null;
  if (cached.result.status === "missing" && Date.now() - cached.checkedAt >= CACHE_TTL_MS) {
    cache.delete(normalizeCmsRoute(route));
    return null;
  }
  return cached.result;
}

function validPublishedPage(value: unknown, route: string): value is PublishedCmsPageRecord {
  if (!value || typeof value !== "object") return false;
  const page = value as Record<string, unknown>;
  return (
    typeof page.title === "string" &&
    typeof page.slug === "string" &&
    typeof page.route === "string" &&
    normalizeCmsRoute(page.route) === route &&
    typeof page.content === "string" &&
    (page.seo_title == null || typeof page.seo_title === "string") &&
    (page.seo_description == null || typeof page.seo_description === "string") &&
    (page.hero_image == null || typeof page.hero_image === "string") &&
    (page.custom_html == null || typeof page.custom_html === "string") &&
    (page.custom_css == null || typeof page.custom_css === "string") &&
    (page.custom_js == null || typeof page.custom_js === "string") &&
    (page.content_blocks == null || Array.isArray(page.content_blocks)) &&
    (page.content_mode == null ||
      page.content_mode === "visual" ||
      page.content_mode === "custom_html")
  );
}

type PublishedPageQueryError = { code?: string; message?: string };
type PublishedPageQueryResult = { data: unknown; error: PublishedPageQueryError | null };

const PUBLISHED_PAGE_COLUMNS =
  "title,slug,route,content,seo_title,seo_description,og_title,og_description,hero_image,custom_html,custom_css,custom_js,content_mode,content_blocks";
// Databases that predate the custom JavaScript migration lack the custom_js
// column or its public grant; the page still renders HTML and CSS without it.
const LEGACY_PUBLISHED_PAGE_COLUMNS =
  "title,slug,route,content,seo_title,seo_description,og_title,og_description,hero_image,custom_html,custom_css,content_mode,content_blocks";

function missingCustomJsSchema(error: PublishedPageQueryError) {
  const message = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("custom_js")
  );
}

async function fetchPublishedPage(
  route: string,
  columns: string,
): Promise<PublishedPageQueryResult> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const query = supabase
      .from("cms_pages")
      .select(columns)
      .eq("status", "published")
      .eq("route", route)
      .abortSignal(controller.signal)
      .maybeSingle();
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error("The published page request timed out. Please try again."));
      }, QUERY_TIMEOUT_MS);
    });
    return await Promise.race([query, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/** Drop the cached public snapshot so a fresh publish shows immediately. */
export function invalidatePublishedCmsPage(route: string) {
  const normalized = normalizeCmsRoute(route);
  cache.delete(normalized);
  inflight.delete(normalized);
}

export function loadPublishedCmsPage(
  route: string,
  options: { force?: boolean } = {},
): Promise<PublishedCmsPageResult> {
  const normalizedRoute = normalizeCmsRoute(route);
  const cached = cache.get(normalizedRoute);
  const cacheAge = cached ? Date.now() - cached.checkedAt : Infinity;

  if (!options.force && cached && cacheAge < CACHE_TTL_MS && cached.result.status !== "error") {
    return Promise.resolve(cached.result);
  }
  const currentRequest = inflight.get(normalizedRoute);
  if (currentRequest) return currentRequest;

  const request = (async (): Promise<PublishedCmsPageResult> => {
    let response: PublishedPageQueryResult;
    try {
      response = await fetchPublishedPage(normalizedRoute, PUBLISHED_PAGE_COLUMNS);
      // A database that predates the custom JavaScript migration still renders
      // the page; only the optional script column is skipped.
      if (response.error && missingCustomJsSchema(response.error)) {
        response = await fetchPublishedPage(normalizedRoute, LEGACY_PUBLISHED_PAGE_COLUMNS);
      }
    } catch (cause) {
      if (cached?.result.status === "ready") return cached.result;
      return {
        status: "error",
        message:
          cause instanceof Error
            ? cause.message.includes("timed out")
              ? cause.message
              : friendlyError({ message: cause.message })
            : "The published page could not be loaded. Please try again.",
      };
    }
    const { data, error } = response;
    if (error) {
      if (cached?.result.status === "ready") return cached.result;
      return {
        status: "error",
        message: friendlyError(error),
      };
    }
    if (data == null) {
      const result: PublishedCmsPageResult = { status: "missing" };
      cache.set(normalizedRoute, { result, checkedAt: Date.now() });
      return result;
    }
    if (!validPublishedPage(data, normalizedRoute)) {
      if (cached?.result.status === "ready") return cached.result;
      return {
        status: "error",
        message: "The published page response was invalid. Please try again.",
      };
    }

    const result: PublishedCmsPageResult = {
      status: "ready",
      page: { ...data, ...cmsDisplaySettings(data) },
    };
    cache.set(normalizedRoute, { result, checkedAt: Date.now() });
    return result;
  })();
  inflight.set(normalizedRoute, request);
  void request.finally(() => {
    if (inflight.get(normalizedRoute) === request) inflight.delete(normalizedRoute);
  });
  return request;
}
