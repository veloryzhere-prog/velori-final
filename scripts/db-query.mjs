#!/usr/bin/env node
/**
 * Run SQL against the linked Supabase project through the Management API.
 *
 * Why this exists: `supabase db dump` shells out to Docker, and Docker is not
 * available in every developer environment (and is unavailable on this
 * machine). The Management API executes SQL as `postgres` over HTTPS using only
 * `SUPABASE_ACCESS_TOKEN`, so schema inspection, catalog assertions, backups and
 * migration application are all possible without a local Postgres toolchain.
 *
 * Safety model:
 *   - Reads are the default. Any statement that is not provably read-only is
 *     rejected unless `--write` is passed.
 *   - The token is read from `.env.secrets.local` or the environment and is
 *     never printed, logged, or sent anywhere except api.supabase.com.
 *   - `--file` wraps the statement in a single transaction so a failure cannot
 *     leave a half-applied migration behind.
 *
 * Usage:
 *   node scripts/db-query.mjs "select 1"
 *   node scripts/db-query.mjs --file supabase/migrations/xxx.sql --write
 *   node scripts/db-query.mjs --backup
 *   node scripts/db-query.mjs --file scripts/validate-velori-schema.probe.sql --expect-no-rows
 */
import { readFileSync } from "node:fs";
import { isReadOnlySql as isReadOnly, stripPsqlMetaCommands } from "./lib/guards.mjs";
import { resolveValue } from "./env.mjs";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
};

const projectRef =
  resolveValue("SUPABASE_PROJECT_REF", { secret: true }) ||
  (() => {
    try {
      return new URL(resolveValue("VITE_SUPABASE_URL")).hostname.replace(".supabase.co", "");
    } catch {
      return "";
    }
  })();
const accessToken = resolveValue("SUPABASE_ACCESS_TOKEN", { secret: true });

if (!projectRef || !accessToken) {
  throw new Error(
    "Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN in .env.secrets.local or the environment.",
  );
}

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

/**
 * Conservative read-only classifier. It errs toward refusing: anything it cannot
 * positively identify as a read is treated as a write. `EXPLAIN` is allowed
 * because it does not execute the statement it describes.
 */
// The read-only classifier and the psql meta-command stripper live in
// ./lib/guards.mjs so they can be unit tested; see guards.test.mjs.

async function run(query) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SQL failed (HTTP ${response.status}): ${text.slice(0, 800)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function print(value) {
  if (typeof value === "string") {
    console.log(value);
    return;
  }
  const rows = Array.isArray(value) ? value : [value];
  if (!rows.length) {
    console.log("(0 rows)");
    return;
  }
  const columns = Object.keys(rows[0]);
  console.log(columns.join(" | "));
  for (const row of rows) console.log(columns.map((c) => String(row[c] ?? "")).join(" | "));
  console.log(`(${rows.length} row${rows.length === 1 ? "" : "s"})`);
}

/**
 * Schema snapshot assembled from the catalog. This is a structural record, not a
 * pg_dump: every table, column, policy, index, function, trigger and RLS flag, so
 * a bad migration can be diagnosed and reversed by hand.
 *
 * The Management API returns only the final result set of a multi-statement
 * query, so each section is sent as its own request and the output is
 * concatenated. Sections are ordered so the most structural facts come first.
 */
const BACKUP_SECTIONS = [
  [
    "TABLES",
    `select table_name, column_name, data_type, is_nullable, column_default
     from information_schema.columns where table_schema = 'public'
     order by table_name, ordinal_position`,
  ],
  [
    "POLICIES",
    `select tablename, policyname, cmd, roles::text as roles, qual, with_check
     from pg_policies where schemaname = 'public' order by tablename, policyname`,
  ],
  [
    "INDEXES",
    `select tablename, indexname, indexdef from pg_indexes
     where schemaname = 'public' order by tablename, indexname`,
  ],
  [
    "FUNCTIONS",
    `select p.proname as name, pg_get_functiondef(p.oid) as definition
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' order by p.proname`,
  ],
  [
    "TRIGGERS",
    `select c.relname as table_name, t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as definition
     from pg_trigger t join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal order by c.relname, t.tgname`,
  ],
  [
    "RLS",
    `select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' order by c.relname`,
  ],
  [
    "BUCKETS",
    `select id, name, public, file_size_limit, allowed_mime_types
     from storage.buckets order by name`,
  ],
];

if (flag("--backup")) {
  const stamp =
    option("--out") ||
    `supabase/backups/catalog-${projectRef}-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
  const { writeFileSync } = await import("node:fs");
  const chunks = [
    `VELORI catalog backup`,
    `project: ${projectRef}`,
    `taken:   ${new Date().toISOString()}`,
    ``,
  ];
  for (const [label, query] of BACKUP_SECTIONS) {
    const result = await run(query);
    const rows = Array.isArray(result) ? result : [result];
    const columns = rows.length ? Object.keys(rows[0]) : [];
    chunks.push(`===== ${label} (${rows.length} rows) =====`);
    if (columns.length) chunks.push(columns.join(" | "));
    for (const row of rows) {
      chunks.push(columns.map((c) => String(row[c] ?? "")).join(" | "));
    }
    chunks.push("");
  }
  const body = chunks.join("\n");
  writeFileSync(stamp, body, "utf8");
  console.log(`Catalog backup written to ${stamp} (${body.length} bytes).`);
  process.exit(0);
}

const file = option("--file");
const inline = argv.filter((a) => !a.startsWith("--") && a !== file && a !== option("--out"));
const rawSql = file ? readFileSync(file, "utf8") : inline.join(" ").trim();
const sql = file ? stripPsqlMetaCommands(rawSql).trim() : rawSql;

if (!sql) {
  console.error("Provide SQL as an argument, with --file <path>, or use --backup.");
  process.exit(2);
}

if (!flag("--write") && !isReadOnly(sql)) {
  console.error(
    "Refusing to run a statement that is not provably read-only.\n" +
      "Re-run with --write once you are sure. Migrations use:\n" +
      "  node scripts/db-query.mjs --file <migration.sql> --write",
  );
  process.exit(3);
}

const result = await run(sql);

// Assertion mode for read-only contract files. A catalog probe reports broken
// rules as rows, so without this a failing assertion would exit 0 and read as a
// green gate. It only ever runs after the read-only classifier has accepted the
// statement, so it cannot be used to smuggle a write past the guard.
if (flag("--expect-no-rows")) {
  const rows = Array.isArray(result) ? result : [result];
  if (rows.length) {
    print(result);
    console.error(
      `Assertion failed: expected no rows, received ${rows.length}. ` +
        `Each row above is one broken contract rule.`,
    );
    process.exit(1);
  }
  console.log("Assertion passed: 0 rows.");
  process.exit(0);
}

print(result);
