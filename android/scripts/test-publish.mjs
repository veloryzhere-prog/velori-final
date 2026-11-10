import { createClient } from "@supabase/supabase-js";
import { resolveValue } from "./env.mjs";

const SUPABASE_URL = resolveValue("VITE_SUPABASE_URL");
const ANON_KEY =
  resolveValue("VITE_SUPABASE_PUBLISHABLE_KEY") || resolveValue("VITE_SUPABASE_ANON_KEY");
if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error(
    "Set the active VITE_SUPABASE_URL and publishable key before running this check.",
  );
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testPublish() {
  // First, check the current state of the privacy page
  const { data: page, error: pageError } = await supabase
    .from("cms_pages")
    .select("*")
    .eq("slug", "privacy")
    .single();

  if (pageError) {
    console.error("Error fetching page:", pageError);
    return;
  }

  console.log("Current page:", {
    id: page.id,
    title: page.title,
    slug: page.slug,
    route: page.route,
    status: page.status,
    draft_updated_at: page.draft_updated_at,
    published_version: page.published_version,
    published_at: page.published_at,
    has_draft: !!page.draft_content,
  });

  // Try to call the publish endpoint
  // We need an admin session for this, so we can't test directly with anon key
  console.log("\nTo test publish, you need an admin session.");
  console.log("The page has draft_content:", !!page.draft_content);
  console.log("Draft updated at:", page.draft_updated_at);
}

testPublish();
