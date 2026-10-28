#!/usr/bin/env node
/**
 * Live regression probe for recipient message privacy. It temporarily sets the
 * QA stranger's DM preference to "nobody", verifies the owner cannot open a
 * direct conversation, and restores the original preference in a finally block.
 */
import { resolveValue } from "./env.mjs";
import { createClient } from "@supabase/supabase-js";

const url = resolveValue("VITE_SUPABASE_URL")?.replace(/\/$/, "");
const anonKey = resolveValue("VITE_SUPABASE_PUBLISHABLE_KEY");
const serviceKey = resolveValue("SUPABASE_SERVICE_ROLE_KEY", { secret: true });
const ownerEmail = resolveValue("VELORI_QA_OWNER_EMAIL", { secret: true });
const ownerPassword = resolveValue("VELORI_QA_OWNER_PASSWORD", { secret: true });
const strangerEmail = resolveValue("VELORI_QA_STRANGER_EMAIL", { secret: true });
const strangerPassword = resolveValue("VELORI_QA_STRANGER_PASSWORD", { secret: true });

if (
  !url ||
  !anonKey ||
  !serviceKey ||
  !ownerEmail ||
  !ownerPassword ||
  !strangerEmail ||
  !strangerPassword
) {
  console.error("Messaging privacy probe needs Supabase keys and QA owner/stranger credentials.");
  process.exit(2);
}

async function signIn(email, password) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token || !body.user?.id) {
    throw new Error(`QA sign-in failed with HTTP ${response.status}.`);
  }
  return body;
}

async function serviceRequest(path, init = {}) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

const [owner, stranger] = await Promise.all([
  signIn(ownerEmail, ownerPassword),
  signIn(strangerEmail, strangerPassword),
]);
const settingsResponse = await serviceRequest(
  `account_settings?select=profile_id,message_permission&profile_id=eq.${stranger.user.id}`,
);
if (!settingsResponse.ok)
  throw new Error(`Could not read QA privacy settings (${settingsResponse.status}).`);
const settingsRows = await settingsResponse.json();
const originalPermission = settingsRows[0]?.message_permission ?? null;
let insertedSettings = false;
let changedSettings = false;

try {
  if (settingsRows.length) {
    const changed = await serviceRequest(`account_settings?profile_id=eq.${stranger.user.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ message_permission: "nobody" }),
    });
    if (!changed.ok)
      throw new Error(`Could not set temporary QA privacy preference (${changed.status}).`);
  } else {
    const created = await serviceRequest("account_settings", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ profile_id: stranger.user.id, message_permission: "nobody" }),
    });
    if (!created.ok)
      throw new Error(`Could not create temporary QA privacy preference (${created.status}).`);
    insertedSettings = true;
  }
  changedSettings = true;

  const attempt = await fetch(`${url}/rest/v1/rpc/open_direct_conversation`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${owner.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_other_user_id: stranger.user.id }),
  });
  const rejected = attempt.status === 401 || attempt.status === 403;
  console.log(
    `${rejected ? "PASS" : "FAIL"} DM open respects recipient privacy (HTTP ${attempt.status})`,
  );
  if (!rejected) process.exitCode = 1;
} finally {
  if (changedSettings) {
    const restored = insertedSettings
      ? await serviceRequest(`account_settings?profile_id=eq.${stranger.user.id}`, {
          method: "DELETE",
        })
      : await serviceRequest(`account_settings?profile_id=eq.${stranger.user.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ message_permission: originalPermission }),
        });
    if (!restored.ok) {
      console.error(
        `Could not restore QA privacy settings (HTTP ${restored.status}); manual recovery is required.`,
      );
      process.exitCode = 1;
    }
  }
}

const [ownerMembershipsResponse, strangerMembershipsResponse] = await Promise.all([
  serviceRequest(`conversation_participants?select=conversation_id&user_id=eq.${owner.user.id}`),
  serviceRequest(`conversation_participants?select=conversation_id&user_id=eq.${stranger.user.id}`),
]);
if (!ownerMembershipsResponse.ok || !strangerMembershipsResponse.ok) {
  throw new Error("Could not read QA conversation memberships for the Realtime probe.");
}
const ownerMemberships = await ownerMembershipsResponse.json();
const strangerMemberships = new Set(
  (await strangerMembershipsResponse.json()).map((row) => row.conversation_id),
);
const privateConversationId = ownerMemberships.find(
  (row) => !strangerMemberships.has(row.conversation_id),
)?.conversation_id;

if (!privateConversationId) {
  console.log("SKIP private typing authorization probe (no isolated QA conversation available)");
} else {
  const ownerClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const strangerClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await Promise.all([
    ownerClient.auth.setSession({
      access_token: owner.access_token,
      refresh_token: owner.refresh_token,
    }),
    strangerClient.auth.setSession({
      access_token: stranger.access_token,
      refresh_token: stranger.refresh_token,
    }),
  ]);
  const topic = `velori:conversation:${privateConversationId}`;
  const ownerChannel = ownerClient.channel(topic, {
    config: { private: true, broadcast: { ack: true }, presence: { key: owner.user.id } },
  });
  const strangerChannel = strangerClient.channel(topic, {
    config: { private: true, broadcast: { ack: true }, presence: { key: stranger.user.id } },
  });
  const waitForStatus = (channel) =>
    new Promise((resolve) => {
      const timeout = setTimeout(() => resolve("TIMED_OUT"), 8000);
      channel.subscribe((status) => {
        if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
          clearTimeout(timeout);
          resolve(status);
        }
      });
    });
  try {
    const ownerStatus = await waitForStatus(ownerChannel);
    console.log(
      `${ownerStatus === "SUBSCRIBED" ? "PASS" : "FAIL"} member can join private typing topic`,
    );
    if (ownerStatus !== "SUBSCRIBED") process.exitCode = 1;
    if (ownerStatus === "SUBSCRIBED") {
      const sent = await ownerChannel.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: owner.user.id },
      });
      console.log(`${sent === "ok" ? "PASS" : "FAIL"} member can broadcast typing event`);
      if (sent !== "ok") process.exitCode = 1;
      const tracked = await ownerChannel.track({ user_id: owner.user.id });
      console.log(
        `${tracked === "ok" ? "PASS" : "FAIL"} member can publish private online presence`,
      );
      if (tracked !== "ok") process.exitCode = 1;
    }
    const strangerStatus = await waitForStatus(strangerChannel);
    const denied = strangerStatus === "CHANNEL_ERROR" || strangerStatus === "TIMED_OUT";
    console.log(
      `${denied ? "PASS" : "FAIL"} nonmember cannot join private typing topic (${strangerStatus})`,
    );
    if (!denied) process.exitCode = 1;
  } finally {
    ownerClient.realtime.disconnect();
    strangerClient.realtime.disconnect();
  }
}
