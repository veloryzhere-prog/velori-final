import type { ForgeLandingMode } from "./forge-landing-state";
import { fileChanges } from "./runtime/policy";
import type { RuntimeEvent } from "./runtime/browser";
import { parseCommercialQuota, quotaState, type CommercialQuota } from "./commercial";
import { QuotaDialog } from "./QuotaDialog";
import { PremiumOffer } from "./PremiumOffer";
import { studioId } from "./identity.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Dialog } from "../../components/ui";
import {
  Aperture,
  ArrowUp,
  ImagePlus,
  X,
  Check,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Info,
  UserRound,
  ShieldCheck,
  Sparkles,
  MessageCircle,
  Code2,
  HardDrive,
  ExternalLink,
} from "lucide-react";
import { parseGenerated, type Generated, type Project, type Quota } from "./model";
import {
  prepareImage,
  studioEnabled,
  studioRequest,
  StudioError,
  type ReferenceImage,
} from "./api";
import {
  ForgePermissionFlow,
  readForgeConsent,
  revokeForgeConsent,
  saveForgeConsent,
  type ForgeAction,
  type ForgePermissionFeedback,
  type ForgeQuotaResult,
  type ForgeReadinessResult,
} from "./assistant-permissions";
export type Capabilities = {
  cloud: boolean;
  generation: boolean;
  billing?: boolean;
  checks?: {
    database: boolean;
    encryption: boolean;
    serverEnabled: boolean;
    provider: boolean;
    generationEnabled: boolean;
    billing: boolean;
  };
};
type ConnectionCheckResult =
  | { ok: true; capabilities: Capabilities }
  | {
      ok: false;
      state: "authentication-required" | "server-unavailable" | "server-setup-incomplete";
      message: string;
    };
type QuotaRefreshResult =
  | {
      ok: true;
      quota: Quota;
      commercialQuota: CommercialQuota | null;
      allowance: ForgeQuotaResult & { ok: true };
    }
  | {
      ok: false;
      state: "account-allowance-unavailable";
      message: string;
    };

function isCapabilities(value: unknown): value is Capabilities {
  if (!value || typeof value !== "object") return false;
  const caps = value as Partial<Capabilities>;
  if (typeof caps.cloud !== "boolean" || typeof caps.generation !== "boolean") return false;
  if (caps.billing !== undefined && typeof caps.billing !== "boolean") return false;
  if (caps.checks === undefined) return true;
  return (
    !!caps.checks &&
    [
      caps.checks.database,
      caps.checks.encryption,
      caps.checks.serverEnabled,
      caps.checks.provider,
      caps.checks.generationEnabled,
      caps.checks.billing,
    ].every((check) => typeof check === "boolean")
  );
}

function parseLegacyQuota(value: unknown): Quota {
  if (!value || typeof value !== "object") throw new Error("The server returned no allowance.");
  const quota = value as Partial<Quota>;
  if (
    !["FREE", "PREMIUM"].includes(quota.plan ?? "") ||
    ![quota.freeLeft, quota.tokens, quota.editorLeft].every(
      (amount) => typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0,
    ) ||
    typeof quota.canGenerate !== "boolean" ||
    typeof quota.canEdit !== "boolean"
  )
    throw new Error("The server returned an invalid account allowance.");
  return quota as Quota;
}

export function useConnection(signedIn: boolean) {
  const [caps, setCaps] = useState<Capabilities>({ cloud: false, generation: false });
  const [quota, setQuota] = useState<Quota | null>(null);
  const [commercialQuota, setCommercialQuota] = useState<CommercialQuota | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const alive = useRef(true);
  const statusRequest = useRef<Promise<ConnectionCheckResult> | null>(null);
  const quotaRequest = useRef<Promise<QuotaRefreshResult> | null>(null);
  const refresh = useCallback(async (): Promise<QuotaRefreshResult> => {
    if (!signedIn)
      return {
        ok: false,
        state: "account-allowance-unavailable",
        message: "Sign in before checking your account allowance.",
      };
    if (!studioEnabled)
      return {
        ok: false,
        state: "account-allowance-unavailable",
        message: "Account allowance checks await server setup. No request was sent.",
      };
    if (quotaRequest.current) return quotaRequest.current;
    const request = (async (): Promise<QuotaRefreshResult> => {
      if (alive.current) setQuotaLoading(true);
      try {
        const raw = await studioRequest<unknown>("quota");
        let modern: CommercialQuota | null = null;
        let normalized: Quota;
        if (raw && typeof raw === "object" && "model" in raw) {
          modern = parseCommercialQuota(raw);
          const state = quotaState(modern);
          normalized = {
            plan: modern.plan === "PRO" ? "PREMIUM" : "FREE",
            freeLeft: state.baseRemaining,
            tokens: state.topupRemaining,
            editorLeft: state.baseRemaining,
            canGenerate: state.canRequest,
            canEdit: state.canRequest,
          };
        } else {
          normalized = parseLegacyQuota(raw);
        }
        const state = modern ? quotaState(modern) : null;
        const allowance: ForgeQuotaResult & { ok: true } = {
          ok: true,
          quota: modern ?? normalized,
          canRequest: state?.canRequest ?? normalized.canGenerate,
          exhausted:
            state?.exhausted ??
            (!normalized.canGenerate && normalized.freeLeft + normalized.tokens === 0),
          accountLocked: modern?.accountLocked ?? false,
        };
        if (alive.current) {
          setCommercialQuota(modern);
          setQuota(normalized);
          setError("");
        }
        return { ok: true, quota: normalized, commercialQuota: modern, allowance };
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Account allowance could not be verified. No request was sent.";
        if (alive.current) {
          setCommercialQuota(null);
          setQuota(null);
          setError(message);
        }
        return { ok: false, state: "account-allowance-unavailable", message };
      } finally {
        if (alive.current) setQuotaLoading(false);
        quotaRequest.current = null;
      }
    })();
    quotaRequest.current = request;
    return request;
  }, [signedIn]);
  const reconnect = useCallback(async (): Promise<ConnectionCheckResult> => {
    if (statusRequest.current) return statusRequest.current;
    if (!signedIn) {
      const result: ConnectionCheckResult = {
        ok: false,
        state: "authentication-required",
        message: "Sign in to verify FORGE server readiness.",
      };
      if (alive.current) {
        setCaps({ cloud: false, generation: false });
        setQuota(null);
        setCommercialQuota(null);
      }
      return result;
    }
    if (!studioEnabled) {
      const result: ConnectionCheckResult = {
        ok: false,
        state: "server-setup-incomplete",
        message: "FORGE server setup is incomplete. Read the setup guide before retrying.",
      };
      if (alive.current) {
        setError(result.message);
        setQuota(null);
        setCommercialQuota(null);
      }
      return result;
    }
    if (alive.current) {
      setChecking(true);
      setError("");
    }
    const request = (async (): Promise<ConnectionCheckResult> => {
      try {
        const response = await studioRequest<unknown>("status");
        if (!isCapabilities(response)) {
          const result: ConnectionCheckResult = {
            ok: false,
            state: "server-setup-incomplete",
            message: "The FORGE server returned incomplete readiness details. Check server setup.",
          };
          if (alive.current) {
            setCaps({ cloud: false, generation: false });
            setQuota(null);
            setCommercialQuota(null);
            setError(result.message);
          }
          return result;
        }
        if (alive.current) setCaps(response);
        if (!response.cloud) {
          const result: ConnectionCheckResult = {
            ok: false,
            state: "server-setup-incomplete",
            message:
              response.checks?.database === false
                ? "Server setup is incomplete: database installation is awaiting approval."
                : response.checks?.encryption === false
                  ? "Server setup is incomplete: the protected encryption key is not configured."
                  : response.checks?.serverEnabled === false
                    ? "Server setup is incomplete: the FORGE server has not been activated."
                    : "Server setup is incomplete. Review the connection diagnostics and setup guide.",
          };
          if (alive.current) {
            setQuota(null);
            setCommercialQuota(null);
            setError(result.message);
          }
          return result;
        }
        return { ok: true, capabilities: response };
      } catch (caught) {
        const result: ConnectionCheckResult = {
          ok: false,
          state: "server-unavailable",
          message:
            caught instanceof Error
              ? caught.message
              : "The FORGE server could not be reached. Check the connection and retry.",
        };
        if (alive.current) {
          setCaps({ cloud: false, generation: false });
          setQuota(null);
          setCommercialQuota(null);
          setError(result.message);
        }
        return result;
      } finally {
        if (alive.current) setChecking(false);
        statusRequest.current = null;
      }
    })();
    statusRequest.current = request;
    return request;
  }, [signedIn]);
  useEffect(() => {
    alive.current = true;
    void reconnect().then((result) => {
      if (result.ok && result.capabilities.cloud) void refresh();
    });
    return () => {
      alive.current = false;
    };
  }, [reconnect, refresh]);
  return { caps, quota, commercialQuota, refresh, reconnect, checking, quotaLoading, error };
}
type ChatActivity = {
  id: string;
  kind: "user" | "status" | "success" | "error" | "assistant";
  text: string;
};
type ForgeRequestSnapshot = {
  action: ForgeAction;
  projectId: string;
  prompt: string;
  pages: Project["pages"];
  files: NonNullable<Project["files"]>;
  stack: NonNullable<Project["stack"]>;
  history: Array<{ prompt: string; result: string }>;
  image?: { mimeType: string; data: string };
  projectTitle: string;
  projectContext: string;
  projectUpdatedAt: string;
};

function storedConsent(projectId: string): boolean {
  try {
    return readForgeConsent(window.localStorage, projectId);
  } catch {
    return false;
  }
}

export function Assistant({
  project,
  signedIn,
  initialPrompt,
  initialMode = "build",
  connection,
  onApply,
  onGuide,
  previewError = "",
  runtimeEvents = [],
}: {
  project: Project;
  signedIn: boolean;
  initialPrompt: string;
  initialMode?: ForgeLandingMode;
  initialProvider?: "gemini" | "local";
  connection: ReturnType<typeof useConnection>;
  onApply: (code: Generated, prompt: string) => void;
  onGuide: () => void;
  previewError?: string;
  runtimeEvents?: RuntimeEvent[];
}) {
  const [remoteConsent, setRemoteConsent] = useState(() => storedConsent(project.id));
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [pendingAction, setPendingAction] = useState<ForgeAction | null>(null);
  const [permissionFeedback, setPermissionFeedback] = useState<ForgePermissionFeedback | null>(
    null,
  );
  const [quotaDialogQuota, setQuotaDialogQuota] = useState<CommercialQuota | Quota | null>(null);
  const projectIdRef = useRef(project.id);
  projectIdRef.current = project.id;
  const consentOverrides = useRef(new Map<string, boolean>());
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;
  const requestSnapshot = useRef<ForgeRequestSnapshot | null>(null);
  const permissionFlow = useRef<ForgePermissionFlow | null>(null);
  const inference = useRef<AbortController | null>(null);
  const cancelled = useRef(false);
  useEffect(() => () => inference.current?.abort(), []);
  useEffect(() => {
    setRemoteConsent(consentOverrides.current.get(project.id) ?? storedConsent(project.id));
  }, [project.id]);
  const [prompt, setPrompt] = useState(initialPrompt);
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  const [mode, setMode] = useState<ForgeLandingMode>(initialMode);
  useEffect(() => setMode(initialMode), [initialMode]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [completed, setCompleted] = useState(0);
  const chatEnd = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<ReferenceImage | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [activity, setActivity] = useState<ChatActivity[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(`velori.forge.chat.v1.${project.id}`) ?? "[]");
      return Array.isArray(parsed)
        ? parsed
            .filter(
              (r) =>
                r &&
                typeof r.text === "string" &&
                ["user", "status", "success", "error", "assistant"].includes(r.kind),
            )
            .slice(-40)
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        `velori.forge.chat.v1.${project.id}`,
        JSON.stringify(activity.slice(-40)),
      );
    } catch {
      /* Browser quota warnings are shown at project save instead. */
    }
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activity, project.id]);
  const log = (kind: ChatActivity["kind"], text: string) =>
    setActivity((prior) =>
      [
        ...prior,
        { id: studioId(), kind, text: text.slice(0, kind === "assistant" ? 5000 : 1000) },
      ].slice(-36),
    );
  const [candidate, setCandidate] = useState<{
    code: Generated;
    prompt: string;
    base: string;
  } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const retry = useRef<{ text: string; id: string } | null>(null);
  const retrySnapshot = useRef<ForgeRequestSnapshot | null>(null);
  const activeRun = useRef<string | null>(null);
  const seenRunEvents = useRef(new Set<number>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const dialogQuota = quotaDialogQuota ?? connection.commercialQuota ?? connection.quota;
  useEffect(() => {
    if (!busy || !activeRun.current) return;
    let active = true;
    const sync = async () => {
      const requestId = activeRun.current;
      if (!requestId) return;
      try {
        const response = await studioRequest<{
          events: Array<{ id: number; kind: string; message: string }>;
          available: boolean;
        }>("runEvents", { requestId });
        if (!active || !response.available || !Array.isArray(response.events)) return;
        for (const event of response.events) {
          if (
            !Number.isSafeInteger(event.id) ||
            seenRunEvents.current.has(event.id) ||
            typeof event.message !== "string"
          )
            continue;
          seenRunEvents.current.add(event.id);
          log(
            event.kind === "failed" || event.kind === "quota_blocked" ? "error" : "status",
            event.message,
          );
        }
      } catch {
        // Older deployments have no event action; the request/response messages still work.
      }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [busy]);
  async function attach(selected?: File) {
    if (!selected) return;
    setImageBusy(true);
    try {
      const value = await prepareImage(selected);
      if (alive.current) setImage(value);
    } catch (e) {
      if (alive.current)
        log("error", e instanceof Error ? e.message : "Image could not be prepared.");
    } finally {
      if (alive.current) setImageBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  function createRequestSnapshot(action: ForgeAction): ForgeRequestSnapshot {
    const chatTurns: Array<{ prompt: string; result: string }> = [];
    for (const row of activity.filter((e) => e.kind === "user" || e.kind === "assistant")) {
      if (row.kind === "user") chatTurns.push({ prompt: row.text.slice(0, 4000), result: "" });
      else if (chatTurns.length) chatTurns[chatTurns.length - 1].result = row.text.slice(0, 500);
    }
    const context = [...project.history.slice(-3), ...chatTurns.slice(-3)].slice(-6);
    const projectContext =
      action === "ask"
        ? JSON.stringify({
            stack: project.stack ?? "static",
            pages: project.pages.slice(0, 8).map((page) => ({
              path: page.path,
              html: page.html.slice(0, 1800),
              css: page.css.slice(0, 1200),
              js: page.js.slice(0, 1200),
            })),
            files: (project.files ?? [])
              .slice(0, 10)
              .map((source) => ({ path: source.path, content: source.content.slice(0, 1200) })),
          }).slice(0, 12000)
        : "";
    return {
      action,
      projectId: project.id,
      prompt: prompt.trim(),
      pages: project.pages,
      files: project.files ?? [],
      stack: project.stack ?? "static",
      history: context,
      image: image ? { mimeType: image.mimeType, data: image.data } : undefined,
      projectTitle: project.title,
      projectContext,
      projectUpdatedAt: project.updatedAt,
    };
  }

  async function generateForAction(action: ForgeAction) {
    const snapshot = requestSnapshot.current;
    if (!snapshot || snapshot.action !== action)
      throw new Error(
        "The requested FORGE action is no longer available. Retry it from the composer.",
      );
    if (pending.current) throw new Error("A FORGE request is already in progress.");
    const payload = {
      prompt: snapshot.prompt,
      pages: snapshot.pages,
      files: snapshot.files,
      stack: snapshot.stack,
      history: snapshot.history,
      image: snapshot.image,
    };
    const text =
      action === "ask"
        ? JSON.stringify({
            mode: action,
            prompt: payload.prompt,
            history: payload.history,
            projectContext: snapshot.projectContext,
            image: payload.image,
          })
        : JSON.stringify({ ...payload, mode: action });
    if (new TextEncoder().encode(text).length > 3900000) {
      throw new Error(
        "This project and image exceed the request limit. Use a smaller reference image.",
      );
    }
    if (retry.current?.text !== text) {
      retry.current = { text, id: studioId() };
      retrySnapshot.current = snapshot;
    }
    cancelled.current = false;
    inference.current = new AbortController();
    pending.current = true;
    activeRun.current = retry.current!.id;
    seenRunEvents.current.clear();
    setBusy(true);
    setNotice("");
    log("user", payload.prompt);
    log(
      "status",
      action === "build"
        ? "Build requested. FORGE is preparing a source revision; current files remain untouched until you approve it."
        : "Question submitted. FORGE is preparing an answer; no source files will be edited.",
    );
    try {
      if (action === "ask") {
        const response = await studioRequest<{ reply: string; followUps: string[] }>("converse", {
          requestId: retry.current!.id,
          prompt: payload.prompt,
          projectTitle: snapshot.projectTitle,
          history: snapshot.history,
          projectContext: snapshot.projectContext,
          stack: snapshot.stack,
          image: payload.image,
        });
        if (alive.current && !cancelled.current) {
          log("assistant", response.reply);
          setFollowUps(response.followUps ?? []);
          if (promptRef.current.trim() === snapshot.prompt) setPrompt("");
          retry.current = null;
          retrySnapshot.current = null;
          setCompleted((count) => count + 1);
        }
      } else {
        const code = parseGenerated(
          await studioRequest("generate", { ...payload, requestId: retry.current!.id }),
        );
        if (alive.current && !cancelled.current) {
          setCandidate({ code, prompt: snapshot.prompt, base: snapshot.projectUpdatedAt });
          log(
            "success",
            `A revision is ready: ${code.pages.length} preview page(s) and ${(code.files ?? []).length} source file(s). Approve to apply changes.`,
          );
          setFollowUps([]);
          retry.current = null;
          retrySnapshot.current = null;
        }
      }
    } catch (e) {
      if (
        e instanceof StudioError &&
        ["quota", "capacity", "provider_quota", "generation_failed", "completed_local"].includes(
          e.code ?? "",
        )
      )
        retry.current = null;
      if (!retry.current) retrySnapshot.current = null;
      if (alive.current && !cancelled.current)
        log(
          "error",
          e instanceof Error ? e.message : "Generation failed. Your draft is unchanged.",
        );
      throw e;
    } finally {
      pending.current = false;
      activeRun.current = null;
      if (alive.current) {
        setBusy(false);
        void connectionRef.current.refresh();
      }
    }
  }
  const executeAction = useRef<(action: ForgeAction) => Promise<void>>(generateForAction);
  executeAction.current = generateForAction;
  if (!permissionFlow.current) {
    permissionFlow.current = new ForgePermissionFlow({
      hasPrompt: (action) =>
        requestSnapshot.current?.action === action &&
        Boolean(requestSnapshot.current.prompt.trim()),
      isAuthenticated: () => signedInRef.current,
      checkReadiness: async (): Promise<ForgeReadinessResult> => {
        const result = await connectionRef.current.reconnect();
        if (!result.ok) return result;
        const readiness = result.capabilities;
        if (!readiness.generation) {
          return {
            ok: false,
            state: "provider-unavailable",
            message:
              readiness.checks?.provider === false
                ? "The configured AI provider is unavailable. Ask the server administrator to complete provider setup."
                : readiness.checks?.generationEnabled === false
                  ? "AI generation is disabled in FORGE server settings. Ask the administrator to enable it before retrying."
                  : "FORGE cannot generate right now. Check the AI connection diagnostics and retry.",
          };
        }
        return { ok: true };
      },
      hasConsent: (action) => {
        const snapshot = requestSnapshot.current;
        const projectId = snapshot?.action === action ? snapshot.projectId : projectIdRef.current;
        return consentOverrides.current.get(projectId) ?? storedConsent(projectId);
      },
      saveConsent: (action) => {
        try {
          const snapshot = requestSnapshot.current;
          if (!snapshot || snapshot.action !== action) return false;
          const saved = saveForgeConsent(window.localStorage, snapshot.projectId);
          if (saved) {
            consentOverrides.current.set(snapshot.projectId, true);
            if (projectIdRef.current === snapshot.projectId) setRemoteConsent(true);
          }
          return saved;
        } catch {
          return false;
        }
      },
      refreshQuota: async () => {
        const result = await connectionRef.current.refresh();
        setQuotaDialogQuota(result.ok ? (result.commercialQuota ?? result.quota) : null);
        return result.ok ? result.allowance : result;
      },
      submit: (action) => executeAction.current(action),
      cancelGeneration: () => {
        if (cancelled.current) return;
        cancelled.current = true;
        inference.current?.abort();
        log(
          "status",
          "Cancellation requested. Pending remote inference may finish and consume allowance; its result will be discarded.",
        );
      },
      onPendingAction: setPendingAction,
      onConsentDialog: (open) => {
        if (open) setConsentChecked(false);
        setConsentOpen(open);
      },
      onFeedback: setPermissionFeedback,
      onQuotaUnavailable: (value) => {
        setQuotaDialogQuota(value);
        setQuotaOpen(true);
      },
    });
  }

  function requestAction(action: ForgeAction) {
    const previous = retrySnapshot.current;
    const sameImage =
      previous?.image?.mimeType === image?.mimeType && previous?.image?.data === image?.data;
    requestSnapshot.current =
      retry.current &&
      previous?.action === action &&
      previous.projectId === project.id &&
      previous.projectUpdatedAt === project.updatedAt &&
      previous.prompt === prompt.trim() &&
      sameImage
        ? previous
        : createRequestSnapshot(action);
    void permissionFlow.current?.request(action);
  }

  function revokeConsent() {
    let revoked = false;
    try {
      revoked = revokeForgeConsent(window.localStorage, projectIdRef.current);
    } catch {
      revoked = false;
    }
    consentOverrides.current.set(projectIdRef.current, false);
    setRemoteConsent(false);
    setPermissionFeedback({
      state: "consent-cancelled",
      message: revoked
        ? "AI processing consent was revoked for this project. The next Ask or Build request will ask again."
        : "Consent is disabled for this session, but browser storage blocked the saved revocation. Clear this site's saved data before using another session.",
    });
  }

  function showQuotaDetails() {
    setQuotaDialogQuota(connection.commercialQuota ?? connection.quota);
    setQuotaOpen(true);
  }

  return (
    <section className="vf-assistant" aria-label="Creative assistant">
      <PremiumOffer
        signedIn={signedIn}
        quota={connection.quota}
        completed={completed}
        busy={busy}
      />
      {dialogQuota && (
        <QuotaDialog
          quota={dialogQuota}
          open={quotaOpen}
          onClose={() => setQuotaOpen(false)}
        />
      )}
      <Dialog
        open={consentOpen}
        title="Allow FORGE to process this request?"
        description={`Review the data use for your ${pendingAction === "ask" ? "Ask FORGE" : "Build / Edit"} request. Nothing is sent until you accept.`}
        onClose={() => permissionFlow.current?.cancelConsent()}
        className="vf-forge-consent-dialog"
        dismissOnBackdrop={false}
        actions={
          <>
            <button type="button" onClick={() => permissionFlow.current?.cancelConsent()}>
              Cancel
            </button>
            <button
              type="button"
              className="vf-primary"
              disabled={!consentChecked}
              onClick={() => void permissionFlow.current?.acceptConsent(consentChecked)}
            >
              Continue and {pendingAction === "ask" ? "ask FORGE" : "build"}
            </button>
          </>
        }
      >
        <div className="vf-forge-consent-content">
          <p>
            FORGE sends this request to the server-managed Gemini AI provider. For both Ask and
            Build, your prompt and relevant conversation context may be processed.
          </p>
          <p>
            FORGE also sends relevant project source for context, and includes your attached
            reference image when one is selected.
          </p>
          <p>
            Ask generates a conversational answer. Build / Edit can return proposed source files for
            review. Your existing project stays unchanged until you explicitly apply a generated
            revision.
          </p>
          <label>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
            />
            I understand and consent to sending this request's prompt, relevant project source,
            conversation context, and any attached image to FORGE's server-managed AI provider.
          </label>
        </div>
      </Dialog>
      <header className="vf-chat-header">
        <span className="vf-chat-logo">
          <Aperture size={19} aria-hidden="true" />
        </span>
        <div>
          <strong>FORGE AI</strong>
          <small>Collaborate · plan · build · iterate</small>
        </div>
        <span
          className="vf-chat-capability"
          aria-label={connection.caps.generation ? "AI available" : "AI offline"}
        >
          {connection.caps.generation ? "Connected" : "Awaiting setup"}
        </span>
      </header>
      <div
        className="vf-conversation"
        role="log"
        aria-label="FORGE project conversation"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {!project.history.length && !activity.length && (
          <div className="vf-forge-welcome">
            <span className="vf-forge-avatar">
              <Sparkles size={22} />
            </span>
            <h2>What are we making today?</h2>
            <p>
              Tell me what you have in mind. I can help refine the idea, explain code, or prepare
              project source for your review.
            </p>
            <div className="vf-forge-promises">
              <span>
                <MessageCircle size={14} /> Questions welcome
              </span>
              <span>
                <Code2 size={14} /> Multi-file source
              </span>
              <span>
                <HardDrive size={14} /> Saved on your device
              </span>
            </div>
          </div>
        )}
        {project.history.map((turn) => (
          <div className="vf-chat-exchange" key={turn.id}>
            <div className="vf-chat-bubble vf-chat-user">
              <UserRound size={15} aria-hidden="true" />
              <p>{turn.prompt}</p>
            </div>
            <div className="vf-chat-bubble vf-chat-forge">
              <CheckCircle2 size={15} aria-hidden="true" />
              <p>{turn.result}</p>
            </div>
          </div>
        ))}
        {activity.map((event) => (
          <div key={event.id} className={`vf-chat-bubble vf-chat-${event.kind}`}>
            {event.kind === "user" ? (
              <UserRound size={15} aria-hidden="true" />
            ) : event.kind === "assistant" ? (
              <Sparkles size={15} aria-hidden="true" />
            ) : event.kind === "error" ? (
              <AlertCircle size={15} aria-hidden="true" />
            ) : event.kind === "success" ? (
              <CheckCircle2 size={15} aria-hidden="true" />
            ) : (
              <Info size={15} aria-hidden="true" />
            )}
            <p>{event.text}</p>
          </div>
        ))}
        {runtimeEvents.length > 0 && (
          <details className="vf-chat-runtime" open>
            <summary>Runtime activity · {runtimeEvents.length} events</summary>
            {runtimeEvents.map((event, index) => (
              <details key={`${event.time}-${index}`}>
                <summary>
                  {event.kind === "error" ? "Error · " : ""}
                  {event.message.slice(0, 160)}
                </summary>
                <pre>{event.message}</pre>
                <small>{event.time}</small>
              </details>
            ))}
          </details>
        )}
        {busy && (
          <div className="vf-chat-bubble vf-chat-status" role="status">
            <LoaderCircle className="vf-spin" size={16} aria-hidden="true" />
            <p>
              {mode === "ask"
                ? "Awaiting a conversational response from the AI provider."
                : "Awaiting generated source files. No build commands have run."}
            </p>
          </div>
        )}
        {candidate && (
          <div className="vf-chat-review" role="group" aria-label="Review generated revision">
            <strong>{candidate.code.title}</strong>
            <p>{candidate.code.pages.map((page) => `/${page.path}`).join(" · ")}</p>
            {candidate.base !== project.updatedAt && (
              <p>
                Your local draft changed while generating. Approval replaces those changes; undo
                remains available.
              </p>
            )}
            <details>
              <summary>Source changes</summary>
              {fileChanges(project.files ?? [], candidate.code.files ?? project.files ?? []).map(
                (change) => (
                  <details key={change.path}>
                    <summary>
                      {change.path} ·{" "}
                      {change.before === undefined
                        ? "Added"
                        : change.after === undefined
                          ? "Removed"
                          : "Modified"}
                    </summary>
                    <pre>
                      {change.before === undefined ? "" : `--- Before\n${change.before}`}
                      {change.after === undefined ? "" : `\n+++ After\n${change.after}`}
                    </pre>
                  </details>
                ),
              )}
            </details>
            <div className="vf-chat-actions">
              <button
                type="button"
                className="vf-primary"
                onClick={() => {
                  if (candidate.base !== project.updatedAt) {
                    log(
                      "error",
                      "Your files changed. Reject this stale revision and generate again against the current project.",
                    );
                    return;
                  }
                  onApply(candidate.code, candidate.prompt);
                  setCandidate(null);
                  setPrompt("");
                  setImage(null);
                  setCompleted((v) => v + 1);
                  log(
                    "assistant",
                    "Applied revision. I preserved your local project and prepared the updated source for preview or download.",
                  );
                  setNotice("Revision applied; your device backup updates automatically.");
                }}
              >
                <Check size={14} /> Apply revision
              </button>
              <button
                type="button"
                onClick={() => {
                  setCandidate(null);
                  log("status", "Revision rejected. Your draft was not changed.");
                }}
              >
                <X size={14} /> Keep existing draft
              </button>
            </div>
          </div>
        )}
        {previewError && (
          <div className="vf-chat-bubble vf-chat-error">
            <AlertCircle size={15} aria-hidden="true" />
            <div>
              <p>Preview error: {previewError}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setPrompt(
                    (
                      "Fix this preview error: " +
                      previewError +
                      ". Return corrected complete code while preserving all working features."
                    ).slice(0, 4000),
                  )
                }
              >
                Prepare a repair request
              </button>
            </div>
          </div>
        )}
        {connection.error && (
          <div className="vf-chat-bubble vf-chat-error">
            <AlertCircle size={15} aria-hidden="true" />
            <p>{connection.error}</p>
          </div>
        )}
        {followUps.length > 0 && (
          <div className="vf-chat-followups" aria-label="FORGE follow-up suggestions">
            <strong>Continue the conversation</strong>
            {followUps.map((question, i) => (
              <button
                type="button"
                key={`${question}-${i}`}
                onClick={() => {
                  setPrompt(question);
                  setMode("ask");
                }}
              >
                {question}
              </button>
            ))}
          </div>
        )}
        <div ref={chatEnd} />
        {notice && (
          <div className="vf-chat-bubble vf-chat-status">
            <Info size={15} aria-hidden="true" />
            <p>{notice}</p>
          </div>
        )}
        {permissionFeedback && (
          <div
            className={`vf-permission-feedback ${
              ["server-checking", "account-allowance-loading"].includes(permissionFeedback.state)
                ? "is-loading"
                : "is-error"
            }`}
            role={
              ["server-checking", "account-allowance-loading"].includes(permissionFeedback.state)
                ? "status"
                : "alert"
            }
            aria-live="polite"
          >
            <Info size={16} aria-hidden="true" />
            <div>
              <p>{permissionFeedback.message}</p>
              <div className="vf-chat-actions">
                {permissionFeedback.state === "authentication-required" && (
                  <Link to="/login" state={{ from: `/studio/${project.id}` }}>
                    Sign in to continue
                  </Link>
                )}
                {permissionFeedback.action && (
                  <button
                    type="button"
                    onClick={() =>
                      requestAction(
                        permissionFeedback.action === "ask" ? "ask" : "build",
                      )
                    }
                  >
                    Retry {permissionFeedback.action === "ask" ? "Ask" : "Build"}
                  </button>
                )}
                {["generation-quota-exhausted", "account-allowance-unavailable"].includes(
                  permissionFeedback.state,
                ) &&
                  quotaDialogQuota && (
                    <button type="button" onClick={showQuotaDetails}>
                      Usage details
                    </button>
                  )}
                {["server-unavailable", "server-setup-incomplete", "provider-unavailable"].includes(
                  permissionFeedback.state,
                ) && (
                  <>
                    <button type="button" onClick={() => void connection.reconnect()}>
                      Check connection
                    </button>
                    <button type="button" onClick={onGuide}>
                      Read setup guide
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {!connection.caps.generation && (
          <div className="vf-chat-bubble vf-chat-status">
            <Info size={15} aria-hidden="true" />
            <p>
              FORGE AI is temporarily unavailable. Manual editing and downloads still work; the
              connection status can be checked below.
            </p>
          </div>
        )}
        {connection.quota && (
          <div className="vf-chat-bubble vf-chat-quota">
            <ShieldCheck size={15} aria-hidden="true" />
            <div>
              <p>
                {connection.quota.canGenerate
                  ? `${connection.quota.plan} · ${connection.quota.freeLeft.toLocaleString()} base requests and ${connection.quota.tokens.toLocaleString()} purchased requests remaining.`
                  : "Your account has no generation requests remaining. Existing files and downloads are safe."}
              </p>
              <div className="vf-chat-actions">
                <button
                  type="button"
                  onClick={() =>
                    void connection
                      .refresh()
                      .then((result) =>
                        setQuotaDialogQuota(
                          result.ok ? (result.commercialQuota ?? result.quota) : null,
                        ),
                      )
                  }
                >
                  Refresh usage
                </button>
                <button type="button" onClick={showQuotaDetails}>
                  Usage details
                </button>
                <Link to="/forge/account/subscription">Account billing</Link>
              </div>
            </div>
          </div>
        )}
        {connection.quotaLoading && (
          <p className="vf-account-allowance-loading" role="status">
            Checking your account allowance…
          </p>
        )}
        <details className="vf-setup-status">
          <summary>Connection details · AI status</summary>
          {connection.checking ? (
            <p role="status">Checking the server…</p>
          ) : (
            <>
              <p>
                {connection.caps.cloud
                  ? "Account services are connected."
                  : "Account services need the owner's server setup."}
              </p>
              {connection.caps.checks && (
                <ul>
                  <li>
                    Database:{" "}
                    {connection.caps.checks.database ? "ready" : "installation awaiting approval"}
                  </li>
                  <li>
                    Encryption:{" "}
                    {connection.caps.checks.encryption ? "configured" : "server key required"}
                  </li>
                  <li>
                    AI runtime:{" "}
                    {connection.caps.checks.provider ? "configured" : "server setup required"}
                  </li>
                  <li>
                    Server:{" "}
                    {connection.caps.checks.serverEnabled ? "enabled" : "activation required"}
                  </li>
                </ul>
              )}
            </>
          )}
          <p>
            Private credentials stay in protected server settings. Never paste them into a project
            prompt.
          </p>
          {!studioEnabled && <p>Connection checks activate after the server is installed.</p>}
          <button
            disabled={connection.checking || !studioEnabled}
            onClick={() => void connection.reconnect()}
          >
            {connection.checking ? "Checking…" : "Check connection again"}
          </button>
          <button onClick={onGuide}>Read setup guide</button>
        </details>
      </div>
      <details className="vf-provider-settings">
        <summary>AI privacy & connection</summary>
        <p>
          Project consent is {remoteConsent ? "granted" : "not granted"} for the current versioned
          Ask / Build processing scope.
        </p>
        <p>
          Ask and Build send the prompt, relevant source and conversation context; an attached image
          is included when selected. Provider credentials and configuration remain protected in
          server settings.
        </p>
        {remoteConsent && (
          <button type="button" onClick={revokeConsent}>
            Revoke AI processing consent
          </button>
        )}
        {!remoteConsent && <p>The permission dialog appears before the next request is sent.</p>}
      </details>
      {busy && (
        <button
          type="button"
          onClick={() => {
            permissionFlow.current?.cancelRequest();
          }}
        >
          Cancel request
        </button>
      )}
      <div className="vf-composer-tabs" role="group" aria-label="FORGE interaction mode">
        <button type="button" aria-pressed={mode === "build"} onClick={() => setMode("build")}>
          <Code2 size={15} /> Build / edit
        </button>
        <button type="button" aria-pressed={mode === "ask"} onClick={() => setMode("ask")}>
          <MessageCircle size={15} /> Ask FORGE
        </button>
      </div>
      <label htmlFor="vf-prompt">
        {mode === "ask"
          ? "Ask a question or plan your next step"
          : project.history.length
            ? "Describe the next change"
            : "Describe what to build"}
      </label>
      <div className="vf-prompt">
        <textarea
          id="vf-prompt"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              requestAction(mode);
            }
          }}
          rows={5}
          maxLength={4000}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === "ask"
              ? "Why isn’t this animation working? What should we improve next?"
              : "Build an elegant React portfolio with responsive layouts and real interactions…"
          }
        />
        {image && (
          <div className="vf-reference">
            <img src={image.preview} alt="Your design reference" />
            <span>{image.name}</span>
            <button aria-label="Remove design reference" onClick={() => setImage(null)}>
              <X size={13} />
            </button>
          </div>
        )}
        <div className="vf-prompt-tools">
          <button
            aria-label="Attach design reference"
            title="Attach JPG, PNG or WebP"
            disabled={imageBusy || busy}
            onClick={() => file.current?.click()}
          >
            {imageBusy ? <LoaderCircle className="vf-spin" size={17} /> : <ImagePlus size={17} />}
          </button>
          <small>{prompt.length}/4000</small>
          <button
            className="vf-build-button"
            aria-label={
              mode === "ask" ? "Send to FORGE" : project.history.length ? "Update app" : "Build app"
            }
            title={mode === "ask" ? "Ask FORGE" : "Build or update app"}
            disabled={busy || imageBusy || !prompt.trim()}
            aria-busy={busy}
            onClick={() => requestAction(mode)}
          >
            {busy ? <LoaderCircle className="vf-spin" size={17} /> : <ArrowUp size={18} />}
            <span>
              {busy
                ? "Working…"
                : mode === "ask"
                  ? "Ask FORGE"
                  : project.history.length
                    ? "Update app"
                    : "Build app"}
            </span>
          </button>
        </div>
      </div>
      <div className="vf-quick-prompts" aria-label="Prompt suggestions">
        {[
          [
            "Mobile layout",
            "Improve this app for phones from 320px, with clear navigation, readable type and 44px touch targets. Preserve working features.",
          ],
          [
            "Smooth motion",
            "Add polished, lightweight transitions and loading feedback. Respect reduced motion and keep controls easy to use.",
          ],
          [
            "Fix interactions",
            "Review every existing interaction, correct errors, and preserve all current pages and requested functionality.",
          ],
        ].map(([label, text]) => (
          <button
            key={label}
            disabled={busy}
            onClick={() => setPrompt((p) => (p ? p + "\n\n" + text : text).slice(0, 4000))}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        hidden
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => void attach(e.target.files?.[0])}
      />
      <div className="vf-assistant-bottom">
        <Link to="/forge/pricing">
          <Sparkles size={13} /> Explore verified Premium plans <ExternalLink size={12} />
        </Link>
        <span>
          FORGE uses one provider request per Build or Ask. Source stays on your device; AI
          processing sends the current request to the configured provider.
        </span>
      </div>
    </section>
  );
}
