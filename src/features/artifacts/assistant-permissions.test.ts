import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FORGE_CONSENT_SCOPE,
  FORGE_CONSENT_VERSION,
  ForgePermissionFlow,
  forgeConsentKey,
  readForgeConsent,
  revokeForgeConsent,
  saveForgeConsent,
  type ForgeAction,
  type ForgePermissionFeedback,
  type ForgeQuotaResult,
  type ForgeReadinessResult,
} from "./assistant-permissions.ts";
import type { Quota } from "./model.ts";

const quota: Quota = {
  plan: "FREE",
  freeLeft: 2,
  tokens: 0,
  editorLeft: 2,
  canGenerate: true,
  canEdit: true,
};

function harness(
  overrides: {
    authenticated?: boolean;
    consent?: boolean;
    hasPrompt?: boolean;
    consentSave?: boolean;
    readiness?: ForgeReadinessResult;
    allowance?: ForgeQuotaResult;
  } = {},
) {
  const calls: string[] = [];
  const feedback: ForgePermissionFeedback[] = [];
  let pendingAction: ForgeAction | null = null;
  let consentDialogOpen = false;
  let consent = overrides.consent ?? false;
  let quotaDialogOpens = 0;
  let submit: (action: ForgeAction) => Promise<void> = async (action) => {
    calls.push(`submit:${action}`);
  };
  const flow = new ForgePermissionFlow({
    hasPrompt: (action) => {
      calls.push(`prompt:${action}`);
      return overrides.hasPrompt ?? true;
    },
    isAuthenticated: () => overrides.authenticated ?? true,
    checkReadiness: async () => {
      calls.push("readiness");
      return overrides.readiness ?? { ok: true };
    },
    hasConsent: () => consent,
    saveConsent: () => {
      calls.push("save-consent");
      consent = overrides.consentSave ?? true;
      return consent;
    },
    refreshQuota: async () => {
      calls.push("quota");
      return (
        overrides.allowance ?? {
          ok: true,
          quota,
          canRequest: true,
          exhausted: false,
          accountLocked: false,
        }
      );
    },
    submit: (action) => submit(action),
    cancelGeneration: () => calls.push("cancel-generation"),
    onPendingAction: (action) => {
      pendingAction = action;
    },
    onConsentDialog: (open) => {
      consentDialogOpen = open;
    },
    onFeedback: (message) => {
      if (message) feedback.push(message);
    },
    onQuotaUnavailable: () => {
      quotaDialogOpens += 1;
    },
  });
  return {
    calls,
    feedback,
    flow,
    get consentDialogOpen() {
      return consentDialogOpen;
    },
    get pendingAction() {
      return pendingAction;
    },
    get quotaDialogOpens() {
      return quotaDialogOpens;
    },
    setSubmit(handler: (action: ForgeAction) => Promise<void>) {
      submit = handler;
    },
  };
}

test("Build click checks readiness and opens consent without submitting", async () => {
  const h = harness();
  await h.flow.request("build");
  assert.equal(h.consentDialogOpen, true);
  assert.equal(h.pendingAction, "build");
  assert.deepEqual(h.calls, ["prompt:build", "readiness"]);
  assert.equal(h.feedback.at(-1)?.state, "consent-required");
});

test("Ask click opens the same explicit consent gate", async () => {
  const h = harness();
  await h.flow.request("ask");
  assert.equal(h.consentDialogOpen, true);
  assert.equal(h.pendingAction, "ask");
  assert.equal(h.calls.includes("submit:ask"), false);
});

test("unchecked consent cannot save consent, refresh quota, or submit", async () => {
  const h = harness();
  await h.flow.request("build");
  await h.flow.acceptConsent(false);
  assert.equal(h.calls.includes("save-consent"), false);
  assert.equal(h.calls.includes("quota"), false);
  assert.equal(
    h.calls.some((call) => call.startsWith("submit:")),
    false,
  );
  assert.equal(h.consentDialogOpen, true);
});

test("consent storage failure prevents automatic continuation", async () => {
  const h = harness({ consentSave: false });
  await h.flow.request("ask");
  await h.flow.acceptConsent(true);
  assert.equal(h.feedback.at(-1)?.state, "consent-not-saved");
  assert.equal(h.consentDialogOpen, true);
  assert.equal(h.calls.includes("quota"), false);
  assert.equal(h.calls.includes("submit:ask"), false);
});

test("accepting consent automatically continues the original Build action", async () => {
  const h = harness();
  await h.flow.request("build");
  await h.flow.acceptConsent(true);
  assert.deepEqual(h.calls.slice(-3), ["save-consent", "quota", "submit:build"]);
  assert.equal(h.pendingAction, null);
});

test("accepting consent automatically continues the original Ask action", async () => {
  const h = harness();
  await h.flow.request("ask");
  await h.flow.acceptConsent(true);
  assert.deepEqual(h.calls.slice(-3), ["save-consent", "quota", "submit:ask"]);
});

test("cancelling consent does not submit or keep a pending action", async () => {
  const h = harness();
  await h.flow.request("ask");
  h.flow.cancelConsent();
  assert.equal(h.pendingAction, null);
  assert.equal(h.consentDialogOpen, false);
  assert.equal(
    h.calls.some((call) => call.startsWith("submit:")),
    false,
  );
  assert.equal(h.feedback.at(-1)?.state, "consent-cancelled");
});

test("previously granted consent does not interrupt a ready action", async () => {
  const h = harness({ consent: true });
  await h.flow.request("build");
  assert.equal(h.consentDialogOpen, false);
  assert.deepEqual(h.calls.slice(-2), ["quota", "submit:build"]);
});

test("revoked consent opens the permission dialog again", async () => {
  const h = harness({ consent: false });
  await h.flow.request("ask");
  assert.equal(h.consentDialogOpen, true);
  assert.equal(h.pendingAction, "ask");
});

test("versioned consent storage rejects old scope and supports explicit revocation", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
  };
  const key = forgeConsentKey("project-1");
  values.set(
    key,
    JSON.stringify({
      version: FORGE_CONSENT_VERSION,
      scope: "old-processing-scope",
      consented: true,
      acceptedAt: new Date().toISOString(),
    }),
  );
  assert.equal(readForgeConsent(storage, "project-1"), false);
  assert.equal(saveForgeConsent(storage, "project-1"), true);
  assert.equal(readForgeConsent(storage, "project-1"), true);
  assert.equal(JSON.parse(values.get(key)!).scope, FORGE_CONSENT_SCOPE);
  assert.equal(revokeForgeConsent(storage, "project-1"), true);
  assert.equal(readForgeConsent(storage, "project-1"), false);
});

test("missing authentication shows sign-in feedback before readiness checks", async () => {
  const h = harness({ authenticated: false });
  await h.flow.request("build");
  assert.equal(h.feedback.at(-1)?.state, "authentication-required");
  assert.equal(h.calls.includes("readiness"), false);
  assert.equal(h.pendingAction, null);
});

test("empty prompts show feedback without checking readiness or sending a request", async () => {
  const h = harness({ hasPrompt: false });
  await h.flow.request("build");
  assert.equal(h.feedback.at(-1)?.state, "empty-prompt");
  assert.equal(h.calls.includes("readiness"), false);
  assert.equal(
    h.calls.some((call) => call.startsWith("submit:")),
    false,
  );
});

test("server unavailability and incomplete setup are explained without submission", async () => {
  for (const readiness of [
    {
      ok: false as const,
      state: "server-unavailable" as const,
      message: "The server is unavailable.",
    },
    {
      ok: false as const,
      state: "server-setup-incomplete" as const,
      message: "The database setup is incomplete.",
    },
    {
      ok: false as const,
      state: "provider-unavailable" as const,
      message: "The AI provider is unavailable.",
    },
  ]) {
    const h = harness({ readiness });
    await h.flow.request("ask");
    assert.equal(h.feedback.at(-1)?.state, readiness.state);
    assert.equal(
      h.calls.some((call) => call.startsWith("submit:")),
      false,
    );
  }
});

test("missing quota response and failed refresh stop submission with actionable feedback", async () => {
  for (const allowance of [
    {
      ok: false as const,
      state: "account-allowance-unavailable" as const,
      message: "The server returned no allowance.",
    },
    {
      ok: false as const,
      state: "account-allowance-unavailable" as const,
      message: "The account allowance refresh failed.",
    },
  ]) {
    const h = harness({ consent: true, allowance });
    await h.flow.request("build");
    assert.equal(h.feedback.at(-1)?.state, "account-allowance-unavailable");
    assert.match(h.feedback.at(-1)?.message ?? "", /allowance/);
    assert.equal(
      h.calls.some((call) => call.startsWith("submit:")),
      false,
    );
  }
});

test("exhausted verified quota opens quota details and prevents submission", async () => {
  const h = harness({
    consent: true,
    allowance: {
      ok: true,
      quota: { ...quota, freeLeft: 0, canGenerate: false },
      canRequest: false,
      exhausted: true,
      accountLocked: false,
    },
  });
  await h.flow.request("build");
  assert.equal(h.quotaDialogOpens, 1);
  assert.equal(h.feedback.at(-1)?.state, "generation-quota-exhausted");
  assert.equal(
    h.calls.some((call) => call.startsWith("submit:")),
    false,
  );
});

test("duplicate actions are ignored while the first action is awaiting readiness", async () => {
  let finishReadiness: ((value: ForgeReadinessResult) => void) | undefined;
  const h = harness();
  const blocked = new ForgePermissionFlow({
    hasPrompt: () => true,
    isAuthenticated: () => true,
    checkReadiness: () =>
      new Promise((resolve) => {
        finishReadiness = resolve;
      }),
    hasConsent: () => false,
    saveConsent: () => true,
    refreshQuota: async () => {
      throw new Error("should not refresh quota");
    },
    submit: async () => {
      throw new Error("should not submit");
    },
    cancelGeneration() {},
    onPendingAction: (action) => {
      if (action) h.calls.push(`pending:${action}`);
    },
    onConsentDialog() {},
    onFeedback() {},
    onQuotaUnavailable() {},
  });
  const first = blocked.request("build");
  await blocked.request("ask");
  finishReadiness?.({ ok: true });
  await first;
  assert.deepEqual(h.calls, ["pending:build"]);
});

test("cancellation reaches active generation and duplicate submits remain blocked", async () => {
  let finishSubmission: (() => void) | undefined;
  let markStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const h = harness({ consent: true });
  h.setSubmit(
    (action) =>
      new Promise<void>((resolve) => {
        h.calls.push(`submit:${action}`);
        finishSubmission = resolve;
        markStarted?.();
      }),
  );
  const first = h.flow.request("ask");
  await started;
  h.flow.cancelRequest();
  await h.flow.request("build");
  assert.equal(h.calls.filter((call) => call.startsWith("submit:")).length, 1);
  assert.equal(h.calls.includes("cancel-generation"), true);
  finishSubmission?.();
  await first;
  assert.equal(h.pendingAction, null);
});

test("Ask and Build do not request camera, microphone, location, or notification permissions", async () => {
  const source = await readFile(new URL("./Assistant.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(
    source,
    /getUserMedia|navigator\.mediaDevices|navigator\.geolocation|Notification\.requestPermission|permissions\.request/,
  );
});
