import { supabasePublishableKey, supabaseUrl } from "../../utils/supabase/info";
import type { StudioTarget } from "./admin-api";

export type StudioMusicTrack = {
  id: string;
  volume?: number;
  title: string;
  artistName: string;
  searchAliases: string[];
  audioUrl: string | null;
  coverUrl: string | null;
  durationSeconds: number | null;
  genre: string;
  tags: string[];
  availableIn: StudioTarget[];
  licenseReference: string;
  excerptStartSeconds: number;
  excerptEndSeconds: number | null;
};

export type StudioStickerAsset = {
  id: string;
  name: string;
  searchAliases: string[];
  category: string;
  assetUrl: string | null;
  thumbnailUrl: string | null;
  altText: string;
  tags: string[];
  attribution: string;
  animated: boolean;
  availableIn: StudioTarget[];
};

export type StudioCatalog = {
  music: StudioMusicTrack[];
  stickers: StudioStickerAsset[];
  categories: Array<{ id: string; name: string }>;
  nextOffset: number | null;
};

export async function fetchStudioCatalog(input: {
  studio: StudioTarget;
  signal?: AbortSignal;
  search?: string;
  category?: string;
  trackId?: string;
  offset?: number;
  limit?: number;
}): Promise<StudioCatalog> {
  const params = new URLSearchParams({ studio: input.studio });
  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.category) params.set("category", input.category);
  if (input.trackId) params.set("trackId", input.trackId);
  if (input.offset) params.set("offset", String(input.offset));
  if (input.limit) params.set("limit", String(input.limit));
  const response = await fetch(`${supabaseUrl}/functions/v1/server/studio-catalog?${params}`, {
    headers: { apikey: supabasePublishableKey },
    signal: input.signal,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "The studio catalog could not be loaded.");
  }
  return (await response.json()) as StudioCatalog;
}
