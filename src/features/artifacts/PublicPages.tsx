import { studioId } from "./identity.ts";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { Check, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { friendlyError, supabase } from "../../lib/supabase";
import { isEligibleForApkPromotions } from "../../lib/apk-promotion-eligibility.mjs";
import { useInterfaceMotion } from "../../motion/InterfaceMotion";
import { parseGenerated, type Generated } from "./model";
import { parseAccountAllowance, type AccountAllowance } from "./billing";
import { appDocument } from "./document";
import { studioEnabled, studioRequest } from "./api";
import { ForgeHeader } from "./Header";
import "./studio.css";
export function SharedPreview() {
  const { secretToken } = useParams();
  const { mode } = useInterfaceMotion();
  const [code, setCode] = useState<Generated | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setCode(null);
    setError("");
    if (!secretToken || !/^[a-f0-9]{64}$/.test(secretToken)) {
      setError("This share link is invalid or expired.");
      return;
    }
    void studioRequest("preview", { token: secretToken })
      .then((r) => {
        const p = parseGenerated(r);
        if (active) setCode(p);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "This preview is unavailable.");
      });
    return () => {
      active = false;
    };
  }, [secretToken]);
  return code ? (
    <>
      <iframe
        className="vf-shared-frame"
        title={code.title}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={appDocument(code.pages, code.title, mode !== "off")}
      />
      {code.branded !== false && (
        <Link className="vf-shared-brand" to="/forge">
          Made with VELORI Forge ↗
        </Link>
      )}
    </>
  ) : (
    <main className="vf-root">
      <ForgeHeader />
      <section className="vf-empty" role="status">
        <h1>{error ? "A moment off canvas." : "Opening this app…"}</h1>
        <p>{error || "Loading your shared preview."}</p>
        <Link to="/forge">Open VELORI Forge ↗</Link>
      </section>
    </main>
  );
}
type Plan = {
  sku: "PACK100" | "PREMIUM" | "PRO_MONTHLY";
  currency: string;
  amount: number | null;
  available: boolean;
};
type SubscriptionInfo = {
  available: boolean;
  active: boolean;
  status: string;
  renewalAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  canManage?: boolean;
};
function isPlan(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  const amountValid =
    plan.amount === null || (Number.isSafeInteger(plan.amount) && (plan.amount as number) > 0);
  return (
    ["PACK100", "PREMIUM", "PRO_MONTHLY"].includes(String(plan.sku)) &&
    typeof plan.currency === "string" &&
    ["inr", "usd"].includes(plan.currency.toLowerCase()) &&
    amountValid &&
    typeof plan.available === "boolean" &&
    (!plan.available || (Number.isSafeInteger(plan.amount) && (plan.amount as number) > 0))
  );
}
type ReferralDashboard = {
  program: {
    enabled: boolean;
    starts_at: string | null;
    ends_at: string | null;
    require_verified_email: boolean;
    min_successful_generations: number;
    inviter_reward_tokens: number;
    invitee_reward_tokens: number;
  };
  code: { value: string; enabled: boolean; expires_at: string | null } | null;
  tokens: number;
  referrals: {
    id: string;
    status: string;
    status_reason: string | null;
    registered_at: string;
    qualified_at: string | null;
    display_name: string | null;
  }[];
  rewards: {
    id: string;
    reward_type: string;
    amount: number;
    status: string;
    created_at: string;
    reversed_at: string | null;
    reversal_reason: string | null;
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isReferralDashboard(value: unknown): value is ReferralDashboard {
  if (!isRecord(value)) return false;
  const dashboard = value;
  const program = dashboard.program;
  const code = dashboard.code;
  const validProgram = isRecord(program) &&
    typeof program.enabled === "boolean" &&
    (program.starts_at === null || typeof program.starts_at === "string") &&
    (program.ends_at === null || typeof program.ends_at === "string") &&
    typeof program.require_verified_email === "boolean" &&
    typeof program.min_successful_generations === "number" &&
    typeof program.inviter_reward_tokens === "number" &&
    typeof program.invitee_reward_tokens === "number";
  const validCode = code === null || (isRecord(code) &&
    typeof code.value === "string" &&
    typeof code.enabled === "boolean" &&
    (code.expires_at === null || typeof code.expires_at === "string"));
  const validReferrals = Array.isArray(dashboard.referrals) && dashboard.referrals.every((entry: unknown) =>
    isRecord(entry) &&
    typeof entry.id === "string" &&
    typeof entry.status === "string" &&
    (entry.status_reason === null || typeof entry.status_reason === "string") &&
    typeof entry.registered_at === "string" &&
    (entry.qualified_at === null || typeof entry.qualified_at === "string") &&
    (entry.display_name === null || typeof entry.display_name === "string")
  );
  const validRewards = Array.isArray(dashboard.rewards) && dashboard.rewards.every((entry: unknown) =>
    isRecord(entry) &&
    typeof entry.id === "string" &&
    typeof entry.reward_type === "string" &&
    typeof entry.amount === "number" &&
    typeof entry.status === "string" &&
    typeof entry.created_at === "string" &&
    (entry.reversed_at === null || typeof entry.reversed_at === "string") &&
    (entry.reversal_reason === null || typeof entry.reversal_reason === "string")
  );
  return (
    typeof dashboard.tokens === "number" &&
    validProgram &&
    validCode &&
    validReferrals &&
    validRewards
  );
}

function referralReason(reason: unknown) {
  const messages: Record<string, string> = {
    invalid_code: "This referral code is invalid.",
    disabled_code: "This referral code has been disabled.",
    expired_code: "This referral code has expired.",
    program_disabled: "The referral program is currently paused.",
    program_not_started: "The referral program has not started yet.",
    program_expired: "The referral program has ended.",
    self_referral: "You cannot refer your own account.",
    already_used: "Your account already has referral attribution.",
  };
  return typeof reason === "string" ? messages[reason] ?? "This referral code cannot be used." : "This referral code cannot be used.";
}

export function RewardsPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isEligibleForApkPromotions()) {
      setDashboard(null);
      setError("");
      setLoading(false);
      return;
    }
    if (!user?.id) {
      setDashboard(null);
      setError("");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      const { error: qualifyError } = await supabase.rpc("velori_qualify_my_referral");
      if (qualifyError) throw new Error(friendlyError(qualifyError));
      const { data, error: dashboardError } = await supabase.rpc("velori_my_referral_dashboard");
      if (dashboardError) throw new Error(friendlyError(dashboardError));
      if (!isReferralDashboard(data)) throw new Error("Referral data returned an unexpected response.");
      if (active) setDashboard(data);
    })()
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Referral data could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, refreshKey]);

  if (!isEligibleForApkPromotions()) {
    return (
      <main className="vf-root vf-referral-studio">
        <ForgeHeader />
        <section className="vf-empty" role="status">
          <h1>Referrals aren’t available here</h1>
          <p>
            Referral codes and rewards are restricted to a verified VELORI Android app. This
            website cannot verify an APK installation, so referral tools are unavailable here.
          </p>
          <Link to="/forge">Return to Forge</Link>
        </section>
      </main>
    );
  }

  const now = Date.now();
  const codeActive = Boolean(
    dashboard?.code?.enabled &&
      (!dashboard.code.expires_at || Date.parse(dashboard.code.expires_at) > now),
  );
  const programActive = !!dashboard?.program.enabled &&
    (!dashboard.program.starts_at || Date.parse(dashboard.program.starts_at) <= now) &&
    (!dashboard.program.ends_at || Date.parse(dashboard.program.ends_at) > now) &&
    codeActive;
  const referralCode = dashboard?.code?.value;
  const shareUrl = typeof window !== "undefined" && codeActive && programActive && referralCode
    ? `${window.location.origin}/signup?ref=${encodeURIComponent(referralCode)}`
    : "";

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(successMessage);
      return true;
    } catch {
      setNotice("Clipboard access was blocked. Select and copy the text instead.");
      return false;
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    if (await copyText(shareUrl, "Referral link copied.")) setCopied(true);
  }

  async function copyCode() {
    if (!dashboard?.code?.value || !codeActive) return;
    await copyText(dashboard.code.value, "Referral code copied.");
  }

  async function shareLink() {
    if (!shareUrl || !("share" in navigator)) return;
    try {
      await navigator.share({
        title: "Join me on VELORI",
        text: dashboard?.code?.value ? `My VELORI invitation code is ${dashboard.code.value}.` : undefined,
        url: shareUrl,
      });
    } catch (caught) {
      if (caught instanceof Error && caught.name !== "AbortError") {
        setNotice("The share sheet could not be opened.");
      }
    }
  }

  return (
    <main className="vf-root vf-referral-studio">
      <ForgeHeader />
      <section className="vf-referral-hero">
        <div className="vf-referral-hero-copy">
          <p className="vf-eyebrow">FORGE AI · REFERRALS &amp; REWARDS</p>
          <h1>Invite friends.<br /><em>Grow together.</em></h1>
          <p className="vf-muted">A personal invitation with progress based on saved referral records. Link opens and downloads are not proof of installation or qualification.</p>
        </div>
        <div className="vf-referral-art" aria-hidden="true">
          <div className="vf-referral-art-orbit vf-referral-art-orbit-one" />
          <div className="vf-referral-art-orbit vf-referral-art-orbit-two" />
          <div className="vf-referral-art-person vf-referral-art-person-one"><span>V</span></div>
          <div className="vf-referral-art-person vf-referral-art-person-two"><span>+</span></div>
          <div className="vf-referral-art-path" />
          <div className="vf-referral-art-card">
            <span>YOUR VELORI INVITATION</span>
            <strong>Made for sharing</strong>
            <small>Rewards require trusted Android installation verification.</small>
          </div>
        </div>
      </section>
      {!user ? (
        <section className="vf-active-subscription" role="status">
          <ShieldCheck size={20} />
          <div><strong>Sign in to view referrals</strong><p>Your referral code and reward history are attached to your account.</p></div>
          <Link to="/login">Sign in</Link>
        </section>
      ) : loading ? (
        <section className="vf-empty" role="status"><p>Loading your referral records…</p></section>
      ) : error ? (
        <section className="vf-empty" role="alert"><p>{error}</p></section>
      ) : dashboard ? (
        <>
          <section className="vf-active-subscription" role="status">
            <ShieldCheck size={20} />
            <div><strong>{programActive ? "Referral program active" : "Referral program unavailable"}</strong><p>{dashboard.tokens} Forge tokens currently available in your account.</p></div>
            <button onClick={() => setRefreshKey((key) => key + 1)}>Refresh status</button>
          </section>
          <section className="vf-pricing-grid" style={{ marginTop: "1.4rem" }}>
            <article className="vf-pricing-card">
              <p className="vf-eyebrow">YOUR REFERRAL CODE</p>
              <h3>{dashboard.code?.value ?? "Not available"}</h3>
              <div className="vf-currency vf-referral-actions" role="group" aria-label="Referral link actions">
                <button disabled={!shareUrl} onClick={() => void copyLink()}>{copied ? "Copied" : "Copy link"}</button>
                {typeof navigator !== "undefined" && "share" in navigator && <button disabled={!shareUrl} onClick={() => void shareLink()}>Share</button>}
              </div>
              <button className="vf-referral-copy-code" disabled={!dashboard.code?.value || !codeActive} onClick={() => void copyCode()}>Copy code</button>
              {shareUrl && <p className="vf-muted" style={{ overflowWrap: "anywhere" }}>{shareUrl}</p>}
              {!programActive && <p className="vf-muted">Sharing is paused while the program is inactive.</p>}
              {notice && <p className="vf-muted" role="status">{notice}</p>}
            </article>
            <article className="vf-pricing-card">
              <p className="vf-eyebrow">QUALIFICATION</p>
              <h3>Installation verification required</h3>
              <p className="vf-muted">A signup, APK download, or Forge generation is not installation proof. This repository does not yet include a trusted Android verification integration, so the referral program remains disabled and no referral rewards can be issued.</p>
            </article>
            <article className="vf-pricing-card">
              <p className="vf-eyebrow">REFERRALS</p>
              <h3>{dashboard.referrals.length}</h3>
              <p className="vf-muted">{dashboard.referrals.filter((referral) => referral.status === "qualified").length} qualified from saved referral records. Registration alone does not grant rewards.</p>
            </article>
          </section>
          <section className="vf-pricing-grid" style={{ marginTop: "1.4rem" }}>
            <article className="vf-pricing-card">
              <p className="vf-eyebrow">REFERRAL HISTORY</p>
              {dashboard.referrals.length ? <ul className="vf-muted" style={{ paddingLeft: "1.2rem", margin: 0 }}>{dashboard.referrals.map((referral) => <li key={referral.id}>Referred account · {referral.status} · {new Date(referral.registered_at).toLocaleDateString()}{referral.status_reason ? ` (${referralReason(referral.status_reason)})` : ""}</li>)}</ul> : <p className="vf-muted">No referred accounts have registered yet.</p>}
            </article>
            <article className="vf-pricing-card">
              <p className="vf-eyebrow">REWARD TRANSACTIONS</p>
              {dashboard.rewards.length ? <ul className="vf-muted" style={{ paddingLeft: "1.2rem", margin: 0 }}>{dashboard.rewards.map((reward) => <li key={reward.id}>{reward.reward_type.replace(/_/g, " ")} · {reward.amount} tokens · {reward.status}{reward.reversed_at ? ` · reversed ${new Date(reward.reversed_at).toLocaleDateString()}` : ""}</li>)}</ul> : <p className="vf-muted">No reward transactions have been issued.</p>}
            </article>
          </section>
          <section className="vf-empty" style={{ marginTop: "1.4rem" }}>
            <p>When trusted Android installation verification is available, qualification will also require {dashboard.program.require_verified_email ? "a verified email and " : ""}{dashboard.program.min_successful_generations} successful Forge generation(s). Referral-link clicks are not tracked.</p>
          </section>
        </>
      ) : null}
    </main>
  );
}

export function Pricing() {
  const { user } = useAuth();
  const routeLocation = useLocation();
  const [currency, setCurrency] = useState("inr");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [notice, setNotice] = useState("");
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [allowance, setAllowance] = useState<AccountAllowance | null>(null);
  const [plansState, setPlansState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef(false);
  const checkoutResult = new URLSearchParams(routeLocation.search).get("checkout");
  useEffect(() => {
    let active = true;
    if (!studioEnabled) {
      setPlansState("unavailable");
      setNotice("Payments are not connected in this environment. No payment was started.");
      return () => {
        active = false;
      };
    }
    void studioRequest<{ plans: Plan[] }>("plans")
      .then((r) => {
        if (!active) return;
        if (!Array.isArray(r.plans) || r.plans.some((plan) => !isPlan(plan)))
          throw new Error("Pricing response is invalid.");
        setPlans(r.plans);
        setPlansState("ready");
        if (
          !r.plans.some((p) => p.currency.toLowerCase() === "inr" && p.available) &&
          r.plans.some((p) => p.currency.toLowerCase() === "usd" && p.available)
        ) {
          setCurrency("usd");
        }
      })
      .catch(() => {
        if (active) {
          setPlansState("unavailable");
          setNotice("Verified plan prices could not be loaded. No payment was started.");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!user || !studioEnabled) {
      setSubscription(null);
      setAllowance(null);
      return;
    }
    let active = true;
    void Promise.all([
      studioRequest<SubscriptionInfo>("subscriptionStatus"),
      studioRequest<unknown>("quota"),
    ])
      .then(([status, quota]) => {
        if (!active) return;
        setSubscription(status);
        setAllowance(parseAccountAllowance(quota));
      })
      .catch(() => {
        if (active) setNotice("Your verified account status could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    if (checkoutResult === "cancelled") {
      setNotice("Checkout was cancelled. Your plan and account balances have not changed.");
    } else if (checkoutResult === "returned") {
      setNotice(
        "Checking your verified account status. A return from checkout alone does not activate a plan.",
      );
    }
  }, [checkoutResult]);

  async function refreshAccountStatus() {
    if (!user || !studioEnabled) return;
    setBusy("verify");
    setNotice("Checking verified account status…");
    try {
      const [status, rawAllowance] = await Promise.all([
        studioRequest<SubscriptionInfo>("subscriptionStatus"),
        studioRequest<unknown>("quota"),
      ]);
      const accountAllowance = parseAccountAllowance(rawAllowance);
      setSubscription(status);
      setAllowance(accountAllowance);
      const activeEntitlement =
        status.active || accountAllowance.plan !== "FREE" || accountAllowance.topupRemaining > 0;
      setNotice(
        activeEntitlement
          ? "Your verified FORGE plan or purchased balance is available below."
          : "Payment processing is still being confirmed. Your account has not received a new entitlement yet.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Account status could not be verified.");
    } finally {
      setBusy(null);
    }
  }
  async function manageBilling() {
    if (pending.current || !user) return;
    pending.current = true;
    setBusy("manage");
    setNotice("");
    try {
      const r = await studioRequest<{ url: string }>("manageSubscription");
      const uri = new URL(r.url);
      if (uri.protocol !== "https:" || uri.hostname !== "billing.stripe.com")
        throw new Error("Billing portal verification failed.");
      window.location.assign(uri.href);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Billing management unavailable.");
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }
  async function checkout(sku: string) {
    if (pending.current || !user) return;
    pending.current = true;
    setBusy(sku);
    setNotice("");
    try {
      const r = await studioRequest<{ url: string }>(
        sku === "PRO_MONTHLY" ? "checkoutSubscription" : "checkout",
        {
          ...(sku === "PRO_MONTHLY" ? {} : { sku }),
          currency,
          requestId: studioId(),
        },
      );
      const url = new URL(r.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
        throw new Error("The checkout destination could not be verified.");
      window.location.assign(url.href);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Checkout could not start.");
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }
  const availableCurrencies = ["inr", "usd"].filter((value) =>
    plans.some((p) => p.available && p.currency.toLowerCase() === value),
  );
  const currentPlan =
    !user || !allowance
      ? null
      : allowance.plan === "PRO" || subscription?.active
        ? "PRO_MONTHLY"
        : allowance.plan === "PREMIUM"
          ? "PREMIUM"
          : "FREE";
  return (
    <main className="vf-root">
      <ForgeHeader />
      <section className="vf-pricing-heading">
        <p className="vf-eyebrow">FORGE AI · CLEAR, VERIFIED PLANS</p>
        <h1>
          Find your way
          <br />
          <em>to build more.</em>
        </h1>
        <p className="vf-muted">
          Start with FORGE AI for free, then choose the creation allowance and features that match
          your projects. Only verified provider prices can be purchased.
        </p>
        {availableCurrencies.length > 1 && (
          <div className="vf-currency" role="group" aria-label="Billing currency">
            {availableCurrencies.map((c) => (
              <button key={c} aria-pressed={currency === c} onClick={() => setCurrency(c)}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        <p className="vf-pricing-cadence">
          {plansState === "loading"
            ? "Checking available billing periods…"
            : plansState === "unavailable"
              ? "Billing availability could not be verified."
              : plans.some((p) => p.sku === "PRO_MONTHLY" && p.available)
                ? "Monthly billing is available where shown. Yearly billing is not configured."
                : "No recurring billing period is currently available."}
        </p>
      </section>
      {user && allowance && (
        <section className="vf-active-subscription" role="status">
          <ShieldCheck size={20} />
          <div>
            <strong>
              {currentPlan === "PRO_MONTHLY"
                ? "Verified Forge Pro access"
                : currentPlan === "PREMIUM"
                  ? "Verified one-time Premium access"
                  : "Forge Free account"}
            </strong>
            <p>
              {allowance.baseRemaining.toLocaleString()} base requests and{" "}
              {allowance.topupRemaining.toLocaleString()} purchased requests remaining.
              {subscription?.active &&
                subscription.renewalAt &&
                ` Access through ${new Date(subscription.renewalAt).toLocaleDateString()}.`}
            </p>
          </div>
          <Link to="/forge/account/subscription">Account billing</Link>
          {subscription?.canManage && (
            <button onClick={() => void manageBilling()} disabled={!!busy}>
              Manage billing
            </button>
          )}
        </section>
      )}
      <div className="vf-pricing-grid">
        <article>
          {currentPlan === "FREE" && <span className="vf-plan-state">Current plan</span>}
          <p className="vf-eyebrow">START HERE</p>
          <h2>Free</h2>
          <div className="vf-price">
            0 <small>{currency.toUpperCase()}</small>
          </div>
          <p>Explore FORGE and start creating at your own pace.</p>
          <ul>
            {[
              "Your account allowance is verified in the workspace",
              "Manual source editing and local project storage",
              "Downloadable source ZIP and offline app export",
              "Provider and service capacity limits still apply",
            ].map((t) => (
              <li key={t}>
                <Check size={15} />
                {t}
              </li>
            ))}
          </ul>
          <Link
            to={user ? "/forge" : "/login"}
            state={user ? undefined : { from: "/forge/pricing" }}
          >
            {user ? "Open Studio" : "Sign in to get started"} <ArrowUpRight size={16} />
          </Link>
        </article>
        {(["PRO_MONTHLY", "PREMIUM", "PACK100"] as const).map((sku) => {
          const p = plans.find((r) => r.sku === sku && r.currency.toLowerCase() === currency);
          return (
            <article
              className={sku === "PRO_MONTHLY" ? "vf-featured vf-monthly-plan" : ""}
              key={sku}
            >
              {currentPlan === sku && <span className="vf-plan-state">Current plan</span>}
              <p className="vf-eyebrow">
                {sku === "PRO_MONTHLY"
                  ? "RENEWING MEMBERSHIP"
                  : sku === "PACK100"
                    ? "MORE GENERATION REQUESTS"
                    : "ONE-TIME PREMIUM ACCESS"}
              </p>
              <h2>
                {sku === "PRO_MONTHLY"
                  ? "Forge Pro Monthly"
                  : sku === "PACK100"
                    ? "Credit pack"
                    : "Premium access"}
              </h2>
              <div className="vf-price">
                {p?.available && p.amount !== null
                  ? new Intl.NumberFormat("en", { style: "currency", currency }).format(
                      p.amount / 100,
                    )
                  : plansState === "loading"
                    ? "Checking verified price…"
                    : plansState === "unavailable"
                      ? "Pricing unavailable"
                      : p?.available === false
                        ? "Temporarily unavailable"
                        : "Price unavailable"}
                {sku === "PRO_MONTHLY" && p?.available && (
                  <small className="vf-billing-period"> / month</small>
                )}
              </div>
              <p>
                {sku === "PRO_MONTHLY"
                  ? "A renewing subscription. Upgrade only through verified Stripe recurring checkout; manage or cancel in the secure billing portal."
                  : sku === "PACK100"
                    ? "A one-time pack of 100 additional generation requests."
                    : "A one-time Premium access offer connected to verified payment. Not a recurring subscription."}
              </p>
              <ul>
                {(sku === "PRO_MONTHLY"
                  ? [
                      "Verified monthly entitlement after successful payment",
                      "Premium generation access during the active billing period",
                      "Cancel or manage billing from Stripe's hosted portal",
                      "Your local projects and ZIP exports remain yours",
                      "Provider and fair-use limits still apply",
                    ]
                  : sku === "PACK100"
                    ? [
                        "100 additional generations",
                        "Local file editing and exports remain available",
                        "Existing projects stay on your device",
                      ]
                    : [
                        "Generation credits no longer deducted",
                        "Verified Premium entitlement after checkout",
                        "Local source files remain editable and exportable",
                        "Provider capacity and fair-use limits apply",
                      ]
                ).map((t) => (
                  <li key={t}>
                    <Check size={15} />
                    {t}
                  </li>
                ))}
              </ul>
              {user ? (
                <button
                  disabled={!p?.available || !!busy || currentPlan === sku}
                  onClick={() => void checkout(sku)}
                >
                  {busy === sku
                    ? "Opening secure checkout…"
                    : currentPlan === sku
                      ? "Current plan"
                      : p?.available
                        ? sku === "PRO_MONTHLY"
                          ? "Subscribe securely"
                          : "Continue to checkout"
                        : "Checkout unavailable"}
                  <ArrowUpRight size={16} />
                </button>
              ) : (
                <Link to="/login" state={{ from: "/forge/pricing" }}>
                  Sign in to view options <ArrowUpRight size={16} />
                </Link>
              )}
            </article>
          );
        })}
      </div>
      {checkoutResult === "returned" && user && (
        <p className="vf-billing-note" role="status">
          Checkout returned to VELORI. Confirm the result against your account before assuming
          payment or access has changed.
          <button
            type="button"
            onClick={() => void refreshAccountStatus()}
            disabled={busy === "verify"}
          >
            {busy === "verify" ? "Checking…" : "Refresh verified status"}
          </button>
        </p>
      )}
      <p className="vf-billing-note">
        <ShieldCheck size={16} /> Access changes only after verified payment. Cards and UPI appear
        when supported by the merchant account, currency and customer. Monthly subscriptions appear
        as available only when a real recurring Stripe price and entitlement database are ready. No
        card details are stored here.
      </p>
      <section className="vf-pricing-extra" aria-labelledby="forge-comparison-title">
        <div>
          <p className="vf-eyebrow">FEATURES, WITHOUT THE GUESSWORK</p>
          <h2 id="forge-comparison-title">What each option actually includes</h2>
        </div>
        <div className="vf-comparison-table-wrap">
          <table className="vf-comparison-table">
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Free</th>
                <th scope="col">Pro monthly</th>
                <th scope="col">Premium one-time</th>
                <th scope="col">100-request pack</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">AI generation</th>
                <td data-label="Free">Verified starter balance</td>
                <td data-label="Pro monthly">During verified active term</td>
                <td data-label="Premium one-time">Premium entitlement</td>
                <td data-label="100-request pack">Additional requests</td>
              </tr>
              <tr>
                <th scope="row">Source editing</th>
                <td data-label="Free">Included</td>
                <td data-label="Pro monthly">Included</td>
                <td data-label="Premium one-time">Included</td>
                <td data-label="100-request pack">Plan unchanged</td>
              </tr>
              <tr>
                <th scope="row">Local projects &amp; export</th>
                <td data-label="Free">Included</td>
                <td data-label="Pro monthly">Included</td>
                <td data-label="Premium one-time">Included</td>
                <td data-label="100-request pack">Plan unchanged</td>
              </tr>
              <tr>
                <th scope="row">Cloud hosting</th>
                <td data-label="Free">Not included</td>
                <td data-label="Pro monthly">Not included</td>
                <td data-label="Premium one-time">Not included</td>
                <td data-label="100-request pack">Not included</td>
              </tr>
              <tr>
                <th scope="row">Renewal</th>
                <td data-label="Free">None</td>
                <td data-label="Pro monthly">Monthly; manage or cancel in billing portal</td>
                <td data-label="Premium one-time">None</td>
                <td data-label="100-request pack">None</td>
              </tr>
              <tr>
                <th scope="row">Provider limits</th>
                <td data-label="Free">Apply</td>
                <td data-label="Pro monthly">Apply</td>
                <td data-label="Premium one-time">Apply</td>
                <td data-label="100-request pack">Apply</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="vf-pricing-extra vf-pricing-terms">
        <div>
          <p className="vf-eyebrow">USAGE &amp; BILLING</p>
          <h2>Know what counts</h2>
        </div>
        <div>
          <p>
            An AI generation request uses FORGE's server-side allowance. Opening the workspace,
            editing code, previewing a project, and exporting files do not consume a generation
            request. A failed provider generation releases its reservation where the server can
            verify the failure.
          </p>
          <p>
            A recurring plan renews monthly through Stripe and can be managed in its hosted billing
            portal. Premium and request-pack purchases are one-time payments and do not auto-renew.
            Unused request expiry and any applicable refund terms are shown in the provider checkout
            and VELORI's published terms; no expiry is promised here.
          </p>
          <p>
            VELORI request balances do not override the configured AI provider's own quota,
            availability, or rate limits. Local editing and exports remain available if AI is
            unavailable or an account allowance is exhausted.
          </p>
        </div>
      </section>
      <section className="vf-pricing-extra vf-pricing-faq" aria-labelledby="forge-faq-title">
        <p className="vf-eyebrow">COMMON QUESTIONS</p>
        <h2 id="forge-faq-title">A few useful details</h2>
        <details>
          <summary>Is Pro a one-time purchase?</summary>
          <p>
            No. Pro is a monthly recurring subscription when an active Stripe recurring price is
            configured. Manage or cancel it through the billing portal.
          </p>
        </details>
        <details>
          <summary>Does Premium renew?</summary>
          <p>
            No. The existing Premium product is a one-time purchase. Its entitlement is verified by
            the FORGE backend.
          </p>
        </details>
        <details>
          <summary>What if I already own one-time Premium?</summary>
          <p>
            Your existing one-time entitlement is retained if a recurring subscription is later
            canceled. Pro and one-time Premium do not stack extra generation credits; request packs
            remain a separate balance.
          </p>
        </details>
        <details>
          <summary>What happens when AI requests run out?</summary>
          <p>
            Your saved local projects, manual editing, previews, and exports remain available. New
            remote AI generation may be unavailable until an allowance resets or verified credits
            are added.
          </p>
        </details>
        <details>
          <summary>Does paying guarantee the AI provider is available?</summary>
          <p>
            No. Provider quota, temporary outages, and rate limits are separate from your VELORI
            account balance.
          </p>
        </details>
        <details>
          <summary>Are yearly billing or promotional discounts available?</summary>
          <p>
            Yearly billing and discounts are not shown unless they are configured and verified by
            the commercial backend. No promotional offer is active on this page.
          </p>
        </details>
      </section>
      {notice && (
        <p className="vf-error" role="status">
          {notice}
        </p>
      )}
      <footer className="vf-pricing-footer">
        {user && <Link to="/forge/account/subscription">Account billing</Link>}
        <Link to="/help">Billing and account help</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/contact">Contact VELORI</Link>
      </footer>
    </main>
  );
}
