import { createClient } from "@supabase/supabase-js";
import { resolveValue } from "./env.mjs";

const url = resolveValue("VITE_SUPABASE_URL") || resolveValue("SUPABASE_URL", { secret: true });
const key =
  resolveValue("SUPABASE_SERVICE_ROLE_KEY", { secret: true }) ||
  resolveValue("VELORI_SUPABASE_SECRET_KEY", { secret: true });

const supabase = createClient(url, key);

const sql =
  "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'site_settings'";
const { data, error } = await supabase.rpc("exec_sql", { sql });
console.log("site_settings in publication:", data, error);

// Also check all tables in publication
const { data: allTables, error: allError } = await supabase.rpc("exec_sql", {
  sql: "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' ORDER BY tablename",
});
console.log("All tables in supabase_realtime:", allTables, allError);
