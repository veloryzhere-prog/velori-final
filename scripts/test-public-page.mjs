import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gmgobchwnfkwfuekhpkr.supabase.co";
const ANON_KEY = "sb_publishable_aF96U1ltASsspmvrAGV16g_ugvpCEye";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testPublicPage() {
  // Check the published /about page
  const { data: page, error: pageError } = await supabase
    .from("cms_pages")
    .select(
      "title,slug,route,content,seo_title,seo_description,hero_image,custom_html,custom_css,content_mode,content_blocks",
    )
    .eq("status", "published")
    .eq("route", "/about")
    .maybeSingle();

  if (pageError) {
    console.error("Error fetching page:", pageError);
    return;
  }

  console.log("Published /about page:", {
    title: page?.title,
    slug: page?.slug,
    route: page?.route,
    status: page?.status,
    content_mode: page?.content_mode,
    has_content_blocks: !!page?.content_blocks,
    content_blocks_count: page?.content_blocks?.length,
    has_custom_html: !!page?.custom_html,
    custom_html_length: page?.custom_html?.length,
    has_custom_css: !!page?.custom_css,
  });

  if (page?.content_blocks) {
    console.log(
      "\nContent blocks:",
      page.content_blocks.map((b) => ({
        type: b.type,
        title: b.title,
        text: b.text?.substring(0, 50),
      })),
    );
  }
}

testPublicPage();
