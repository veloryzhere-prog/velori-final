import { resolveValue } from "./env.mjs";

const url = resolveValue("VITE_SUPABASE_URL") || resolveValue("SUPABASE_URL", { secret: true });
const key =
  resolveValue("SUPABASE_SERVICE_ROLE_KEY", { secret: true }) ||
  resolveValue("VELORI_SUPABASE_SECRET_KEY", { secret: true });

const baseUrl = new URL(url).origin;

const sql =
  "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'site_settings'";

const response = await fetch(baseUrl + "/rest/v1/rpc/exec_sql", {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ sql }),
});

const data = await response.json();
console.log("site_settings in publication:", data);

// Also check all tables in publication
const response2 = await fetch(baseUrl + "/rest/v1/rpc/exec_sql", {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    sql: "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' ORDER BY tablename",
  }),
});

const data2 = await response2.json();
console.log("All tables in supabase_realtime:", data2);
