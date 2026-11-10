import type { ForgeLandingMode } from "./forge-landing-state";
import { fileChanges } from "./runtime/policy";
import type { RuntimeEvent } from "./runtime/browser";
import { parseCommercialQuota, quotaState, type CommercialQuota } from "./commercial";
import { QuotaDialog } from "./QuotaDialog";
import { PremiumOffer } from "./PremiumOffer";
import { studioId } from "./identity.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
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
export function useConnection(signedIn: boolean) {
  const [caps, setCaps] = useState<Capabilities>({ cloud: false, generation: false });
  const [quota, setQuota] = useState<Quota | null>(null);
  const [commercialQuota, setCommercialQuota] = useState<CommercialQuota | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const alive = useRef(true);
  const checkingRef = useRef(false);
  const refresh = useCallback(async () => {
    if (!signedIn || !studioEnabled) return;
    try {
      const raw = await studioRequest<Quota | CommercialQuota>("quota");
      const modern = "model" in raw && raw.model === "hybrid-v2" ? parseCommercialQuota(raw) : null;
      const state = modern ? quotaState(modern) : null;
      const q: Quota =
        modern && state
          ? {
              plan: modern.plan === "PRO" ? "PREMIUM" : "FREE",
              freeLeft: state.baseRemaining,
              tokens: state.topupRemaining,
              editorLeft: state.baseRemaining,
              canGenerate: state.canRequest,
              canEdit: state.canRequest,
            }
          : (raw as Quota);
      if (alive.current) setCommercialQuota(modern);
      if (alive.current) {
        setQuota(q);
        setError("");
      }
    } catch {
      if (alive.current)
        setError("Account allowance could not be checked. Your browser draft is safe.");
    }
  }, [signedIn]);
  const reconnect = useCallback(async () => {
    if (!studioEnabled || checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setError("");
    try {
      const r = await studioRequest<Capabilities>("status");
      if (alive.current) {
        setCaps(r);
        if (r.cloud) await refresh();
        else setQuota(null);
      }
    } catch {
      if (alive.current) setError("The cloud connection is unavailable. Local creation is ready.");
    } finally {
      checkingRef.current = false;
      if (alive.current) setChecking(false);
    }
  }, [refresh]);
  useEffect(() => {
    alive.current = true;
    void reconnect();
    return () => {
      alive.current = false;
    };
  }, [reconnect]);
  return { caps, quota, commercialQuota, refresh, reconnect, checking, error };
}
type ChatActivity = {
  id: string;
  kind: "user" | "status" | "success" | "error" | "assistant";
  text: string;
};
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
  const [remoteConsent, setRemoteConsent] = useState(false);
  const inference = useRef<AbortController | null>(null);
  const cancelled = useRef(false);
  useEffect(() => () => inference.current?.abort(), []);
  const [prompt, setPrompt] = useState(initialPrompt);
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
  async function generate() {
    if (
      pending.current ||
      !prompt.trim() ||
      !remoteConsent ||
      !signedIn ||
      !connection.caps.generation ||
      (!connection.quota?.canGenerate && !retry.current)
    )
      return;
    const chatTurns: Array<{ prompt: string; result: string }> = [];
    for (const row of activity.filter((e) => e.kind === "user" || e.kind === "assistant")) {
      if (row.kind === "user") chatTurns.push({ prompt: row.text.slice(0, 4000), result: "" });
      else if (chatTurns.length) chatTurns[chatTurns.length - 1].result = row.text.slice(0, 500);
    }
    const context = [...project.history.slice(-3), ...chatTurns.slice(-3)].slice(-6);
    const payload = {
      prompt: prompt.trim(),
      pages: project.pages,
      files: project.files ?? [],
      stack: project.stack ?? "static",
      history: context,
      image: image ? { mimeType: image.mimeType, data: image.data } : undefined,
    };
    const text =
      mode === "ask"
        ? JSON.stringify({ mode, prompt: payload.prompt, history: payload.history })
        : JSON.stringify({ ...payload, mode });
    if (new TextEncoder().encode(text).length > 3900000) {
      log(
        "error",
        "This project and image exceed the request limit. Use a smaller reference image.",
      );
      return;
    }
    if (retry.current?.text !== text) retry.current = { text, id: studioId() };
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
      mode === "build"
        ? "Build requested. FORGE is preparing a source revision; current files remain untouched until you approve it."
        : "Question submitted. FORGE is preparing an answer; no source files will be edited.",
    );
    try {
      if (mode === "ask") {
        const projectContext = JSON.stringify({
          stack: project.stack ?? "static",
          pages: project.pages.slice(0, 8).map((p) => ({
            path: p.path,
            html: p.html.slice(0, 1800),
            css: p.css.slice(0, 1200),
            js: p.js.slice(0, 1200),
          })),
          files: (project.files ?? [])
            .slice(0, 10)
            .map((f) => ({ path: f.path, content: f.content.slice(0, 1200) })),
        }).slice(0, 12000);
        const response = await studioRequest<{ reply: string; followUps: string[] }>("converse", {
          requestId: retry.current!.id,
          prompt: payload.prompt,
          projectTitle: project.title,
          history: context,
          projectContext,
        });
        if (alive.current && !cancelled.current) {
          log("assistant", response.reply);
          setFollowUps(response.followUps ?? []);
          setPrompt("");
          retry.current = null;
          setCompleted((count) => count + 1);
        }
      } else {
        const code = parseGenerated(
          await studioRequest("generate", { ...payload, requestId: retry.current!.id }),
        );
        if (alive.current && !cancelled.current) {
          setCandidate({ code, prompt: prompt.trim(), base: project.updatedAt });
          log(
            "success",
            `A revision is ready: ${code.pages.length} preview page(s) and ${(code.files ?? []).length} source file(s). Approve to apply changes.`,
          );
          setFollowUps([]);
          retry.current = null;
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
      if (alive.current)
        log(
          "error",
          e instanceof Error ? e.message : "Generation failed. Your draft is unchanged.",
        );
    } finally {
      pending.current = false;
      activeRun.current = null;
      if (alive.current) {
        setBusy(false);
        void connection.refresh();
      }
    }
  }
  return (
    <section className="vf-assistant" aria-label="Creative assistant">
      <PremiumOffer
        signedIn={signedIn}
        quota={connection.quota}
        completed={completed}
        busy={busy}
      />
      {connection.quota && (
        <QuotaDialog
          quota={connection.commercialQuota ?? connection.quota}
          open={quotaOpen}
          onClose={() => setQuotaOpen(false)}
        />
      )}
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
                <button type="button" onClick={() => void connection.refresh()}>
                  Refresh usage
                </button>
                <button type="button" onClick={() => setQuotaOpen(true)}>
                  Usage details
                </button>
                <Link to="/forge/account/subscription">Account billing</Link>
              </div>
            </div>
          </div>
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
        <label>
          <input
            type="checkbox"
            checked={remoteConsent}
            onChange={(e) => setRemoteConsent(e.target.checked)}
          />{" "}
          Allow this project's prompts, source context and attached image to be sent through the
          server-managed AI runtime.
        </label>
        <p>Provider credentials and model configuration are managed by VELORI administrators.</p>
      </details>
      {busy && (
        <button
          type="button"
          onClick={() => {
            cancelled.current = true;
            inference.current?.abort();
            log(
              "status",
              "Cancellation requested. Pending remote inference may finish and consume allowance; its result will be discarded.",
            );
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
              void generate();
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
            title="Generate app"
            disabled={
              busy ||
              imageBusy ||
              !remoteConsent ||
              !signedIn ||
              !connection.caps.generation ||
              (!connection.quota?.canGenerate && !retry.current) ||
              !prompt.trim()
            }
            onClick={() => void generate()}
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
