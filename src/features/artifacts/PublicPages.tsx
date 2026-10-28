import { studioId } from "./identity.ts";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { Check, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useInterfaceMotion } from "../../motion/InterfaceMotion";
import { parseGenerated, type Generated } from "./model";
import { parseAccountAllowance, type AccountAllowance } from "./billing";
import { appDocument } from "./document";
import { studioEnabled, studioRequest } from "./api";
import { ForgeHeader } from "./Header";
import {
  DEFAULT_REWARD_CAMPAIGN,
  appendRewardEntry,
  applyCampaignGrant,
  generateReferralCode,
  getReferralUrl,
  normalizeReferralCode,
  readRewardsProfile,
  rewardBalance,
  writeRewardsProfile,
} from "./rewards";
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
export function RewardsPage() {
  const { user } = useAuth();
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState(() => {
    if (typeof window === "undefined" || !user?.id) return null;
    return readRewardsProfile(window.localStorage, `velori-rewards:${user.id}`, user.id);
  });

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    const next = readRewardsProfile(window.localStorage, `velori-rewards:${user.id}`, user.id);
    setProfile(next);
  }, [user?.id]);

  const campaign = DEFAULT_REWARD_CAMPAIGN;
  const activeCredits = rewardBalance({
    initialCredits: campaign.introInitialCredits,
    ledger: profile?.ledger ?? [],
  });
  const code = profile?.referralCode ?? (user?.id ? generateReferralCode(user.id) : "FORGE-START");
  const referralCode = normalizeReferralCode(code);
  const shareUrl = getReferralUrl(
    referralCode,
    typeof window !== "undefined" ? window.location.origin : undefined,
  );

  function handleCopy() {
    if (!shareUrl) return;
    void navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        setNotice("Referral link copied to your clipboard.");
      })
      .catch(() => {
        setNotice("Your browser blocked clipboard access. Copy the link manually.");
      });
  }

  function claimInstallBonus() {
    if (!user?.id || !profile) {
      setNotice("Sign in to unlock the verified install reward.");
      return;
    }
    const eventId = `install-${user.id}-${Date.now()}`;
    const result = applyCampaignGrant({
      initialCredits: campaign.introInitialCredits,
      campaign,
      ledger: profile.ledger,
      eventId,
      amount: campaign.appInstallCredits,
      type: "app-install",
      userId: user.id,
    });

    if (!result.granted || !result.entry) {
      setNotice(
        result.reason === "duplicate-event"
          ? "This install reward has already been claimed."
          : "The campaign cap has already been reached.",
      );
      return;
    }

    const nextProfile = appendRewardEntry(
      window.localStorage,
      `velori-rewards:${user.id}`,
      result.entry,
      user.id,
    );
    setProfile(nextProfile);
    setNotice("Verified install reward added to your FORGE credit balance.");
  }

  return (
    <main className="vf-root">
      <ForgeHeader />
      <section className="vf-pricing-heading">
        <p className="vf-eyebrow">FORGE AI · VERIFIED REFERRALS</p>
        <h1>
          Invite friends.
          <br />
          <em>Earn extra creation rewards.</em>
        </h1>
        <p className="vf-muted">
          Earn up to five introductory credits and up to five additional referral-driven bonus
          creations, with verified app-install and referral actions only.
        </p>
      </section>

      {!user ? (
        <section className="vf-active-subscription" role="status">
          <ShieldCheck size={20} />
          <div>
            <strong>Sign in to unlock rewards</strong>
            <p>
              Referral, install, and bonus credit claims are tied to an authenticated VELORI
              account.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="vf-active-subscription" role="status">
            <ShieldCheck size={20} />
            <div>
              <strong>{campaign.name}</strong>
              <p>
                Your account has {activeCredits.remainingBalance} verified reward credits remaining
                of {campaign.introInitialCredits}.
              </p>
            </div>
          </section>

          <section className="vf-pricing-grid" style={{ marginTop: "1.4rem" }}>
            <article className="vf-pricing-card">
              <p className="vf-eyebrow">YOUR CODE</p>
              <h3>{referralCode}</h3>
              <div className="vf-currency" role="group" aria-label="Referral link copy controls">
                <button onClick={handleCopy}>{copied ? "Copied" : "Copy link"}</button>
              </div>
              <p className="vf-muted">{shareUrl}</p>
            </article>
            <article className="vf-pricing-card">
              <p className="vf-eyebrow">BONUS CAP</p>
              <h3>
                {activeCredits.grantedTotal} / {campaign.introInitialCredits}
              </h3>
              <p className="vf-muted">
                Introductory bonuses are capped at {campaign.introBonusCap} total granted credits
                and cannot exceed the verified limit.
              </p>
            </article>
            <article className="vf-pricing-card">
              <p className="vf-eyebrow">APP INSTALL</p>
              <h3>{campaign.appInstallCredits} credits</h3>
              <button className="vf-primary-button" onClick={claimInstallBonus}>
                Claim verified install reward
              </button>
            </article>
          </section>

          {notice && (
            <section className="vf-empty" role="status" style={{ marginTop: "1.2rem" }}>
              <p>{notice}</p>
            </section>
          )}

          <section className="vf-pricing-grid" style={{ marginTop: "1.4rem" }}>
            <article className="vf-pricing-card">
              <p className="vf-eyebrow">RULES</p>
              <ul className="vf-muted" style={{ paddingLeft: "1.2rem", margin: 0 }}>
                <li>Verified sign-in is required before rewards are generated.</li>
                <li>Only unique, non-self referral events qualify.</li>
                <li>
                  Clicks alone do not grant rewards; app-install and referral verification do.
                </li>
                <li>
                  Reward creation totals are tied to the same quota accounting used for FORGE
                  generation.
                </li>
              </ul>
            </article>
            <article className="vf-pricing-card">
              <p className="vf-eyebrow">CURRENT LEDGER</p>
              {profile?.ledger && profile.ledger.length > 0 ? (
                <ul className="vf-muted" style={{ paddingLeft: "1.2rem", margin: 0 }}>
                  {profile.ledger
                    .slice(-5)
                    .reverse()
                    .map((entry) => (
                      <li key={entry.id}>
                        {entry.type} · {entry.amount} credits · {entry.status}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="vf-muted">No reward events have been applied yet.</p>
              )}
            </article>
          </section>
        </>
      )}
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
