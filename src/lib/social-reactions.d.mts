import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
export function setSocialReaction(
  client: SupabaseClient,
  table: "likes" | "saves" | "reel_likes" | "reel_saves",
  identity: { user_id: string; post_id?: string; reel_id?: string },
  active: boolean,
): PromiseLike<{ error: PostgrestError | null }>;
