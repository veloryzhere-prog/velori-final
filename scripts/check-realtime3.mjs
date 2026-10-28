import { resolveValue } from "./env.mjs";

const url = resolveValue("VITE_SUPABASE_URL") || resolveValue("SUPABASE_URL", { secret: true });
const key =
  resolveValue("SUPABASE_SERVICE_ROLE_KEY", { secret: true }) ||
  resolveValue("VELORI_SUPABASE_SECRET_KEY", { secret: true });

const baseUrl = new URL(url).origin;

// Try querying pg_publication_tables directly via REST API
const response = await fetch(
  baseUrl +
    "/rest/v1/pg_publication_tables?pubname=eq.supabase_realtime&schemaname=eq.public&tablename=eq.site_settings&select=tablename",
  {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
    },
  },
);

const data = await response.json();
console.log("site_settings in publication:", data, "status:", response.status);

// Also check all tables in publication
const response2 = await fetch(
  baseUrl +
    "/rest/v1/pg_publication_tables?pubname=eq.supabase_realtime&schemaname=eq.public&select=tablename&order=tablename",
  {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
    },
  },
);

const data2 = await response2.json();
console.log("All tables in supabase_realtime:", data2, "status:", response2.status);
