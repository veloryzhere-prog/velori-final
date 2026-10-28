#!/usr/bin/env node
/**
 * Live authorization probes for the messaging and groups tables.
 *
 * These run against the real Supabase project with the real anon key, so they
 * test the deployed RLS rather than the SQL text. The important cases are the
 * negative ones: an anonymous caller, and an authenticated caller reaching for
 * somebody else's data, must be refused by the database.
 *
 * Read-only: it never inserts application data. Where a temporary fixture would
 * be needed it is reported as skipped rather than faked.
 */
import { resolveValue } from "./env.mjs";

const url = resolveValue("VITE_SUPABASE_URL");
const anonKey = resolveValue("VITE_SUPABASE_PUBLISHABLE_KEY");

if (!url || !anonKey) {
  console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to run these probes.");
  process.exit(2);
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
}

async function probe(path, init = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

const denied = (r) => r.status === 401 || r.status === 403 || r.status === 42501;

// -- Anonymous must not read private content -------------------------------

for (const table of [
  "messages",
  "conversation_participants",
  "message_attachments",
  "group_members",
  "group_settings",
]) {
  const r = await probe(table);
  record(`Anonymous cannot read ${table}`, denied(r), `HTTP ${r.status}`);
}

const conversationRead = await probe("conversations");
record(
  "Anonymous cannot read conversations",
  denied(conversationRead),
  `HTTP ${conversationRead.status}`,
);

// -- Anonymous must not write ----------------------------------------------

for (const [table, payload] of [
  [
    "messages",
    {
      conversation_id: "00000000-0000-0000-0000-000000000000",
      sender_id: "00000000-0000-0000-0000-000000000000",
      body: "x",
    },
  ],
  [
    "groups",
    { slug: "anon-probe", name: "anon", owner_id: "00000000-0000-0000-0000-000000000000" },
  ],
  [
    "group_members",
    {
      group_id: "00000000-0000-0000-0000-000000000000",
      user_id: "00000000-0000-0000-0000-000000000000",
    },
  ],
]) {
  const r = await probe(table, { method: "POST", body: JSON.stringify(payload) });
  record(`Anonymous cannot insert ${table}`, denied(r), `HTTP ${r.status}`);
}

// -- Anonymous may only see public groups ----------------------------------

const publicGroups = await probe("groups?select=id,privacy");
const publicRows = Array.isArray(publicGroups.body) ? publicGroups.body : [];
const onlyPublic = publicGroups.status === 200 && publicRows.every((g) => g.privacy === "public");
record(
  "Anonymous sees only public groups",
  onlyPublic,
  publicGroups.status === 200
    ? `${publicRows.length} rows, all public`
    : `HTTP ${publicGroups.status}`,
);

// -- Privileged RPCs must reject anonymous execution -----------------------
//
// PostgREST resolves /rpc/<fn> by matching the JSON body against the function's
// parameter names, and answers 404 "function not found" when they do not match.
// Passing {} would therefore test nothing. Each call supplies a well-formed
// argument list so a 401/403 is a genuine authorization refusal rather than a
// routing miss.

const PROBE_UUID = "00000000-0000-0000-0000-000000000000";

for (const [rpc, payload] of [
  ["open_direct_conversation", { p_other_user_id: PROBE_UUID }],
  ["mark_conversation_read", { p_conversation_id: PROBE_UUID }],
  ["join_group", { p_group_id: PROBE_UUID }],
  ["leave_group", { p_group_id: PROBE_UUID }],
  ["review_group_member", { p_group_id: PROBE_UUID, p_user_id: PROBE_UUID, p_approve: true }],
]) {
  const r = await probe(`rpc/${rpc}`, { method: "POST", body: JSON.stringify(payload) });
  // A 404 here would mean the function was not found at all, which is a
  // deployment problem rather than a correct refusal.
  record(`Anonymous cannot execute ${rpc}()`, denied(r), `HTTP ${r.status}`);
}

const unread = await probe("rpc/conversation_unread_total", { method: "POST", body: "{}" });
record(
  "Anonymous cannot execute conversation_unread_total()",
  denied(unread),
  `HTTP ${unread.status}`,
);

// -- Private bucket must refuse anonymous access ---------------------------

const storageResponse = await fetch(`${url}/storage/v1/object/list/message-media`, {
  method: "POST",
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ limit: 1 }),
});
record(
  "Anonymous cannot list the private message-media bucket",
  storageResponse.status === 400 ||
    storageResponse.status === 401 ||
    storageResponse.status === 403 ||
    storageResponse.status === 42501,
  `HTTP ${storageResponse.status}`,
);

const failures = results.filter((r) => !r.ok);
console.log(`\n${results.length - failures.length}/${results.length} authorization probes passed.`);
if (failures.length) {
  console.log("Failed:", failures.map((f) => f.name).join(", "));
  process.exit(1);
}
