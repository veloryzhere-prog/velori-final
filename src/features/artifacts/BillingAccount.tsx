import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, CircleCheck, CreditCard, ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { ForgeHeader } from "./Header";
import { studioEnabled, studioRequest } from "./api";
import {
  formatBillingAmount,
  parseAccountAllowance,
  parseBillingHistory,
  type AccountAllowance,
  type BillingHistory,
} from "./billing";
import "./studio.css";

type SubscriptionInfo = {
  available: boolean;
  active: boolean;
  status: string;
  renewalAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  canManage?: boolean;
};

function dateLabel(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(value));
}

export function BillingAccount() {
  const { user } = useAuth();
  const [allowance, setAllowance] = useState<AccountAllowance | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [history, setHistory] = useState<BillingHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!user || !studioEnabled) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void Promise.allSettled([
      studioRequest<unknown>("quota"),
      studioRequest<SubscriptionInfo>("subscriptionStatus"),
      studioRequest<unknown>("billingHistory"),
    ]).then((results) => {
      if (!active) return;
      const failures: string[] = [];
      const [quotaResult, subscriptionResult, historyResult] = results;
      if (quotaResult.status === "fulfilled") {
        try {
          setAllowance(parseAccountAllowance(quotaResult.value));
        } catch (cause) {
          failures.push(
            cause instanceof Error ? cause.message : "Account allowance is unavailable.",
          );
        }
      } else {
        failures.push("Account allowance could not be loaded.");
      }
      if (subscriptionResult.status === "fulfilled") setSubscription(subscriptionResult.value);
      else failures.push("Subscription status could not be loaded.");
      if (historyResult.status === "fulfilled") {
        try {
          setHistory(parseBillingHistory(historyResult.value));
        } catch (cause) {
          failures.push(cause instanceof Error ? cause.message : "Payment history is unavailable.");
        }
      } else {
        failures.push("Payment history could not be loaded.");
      }
      setError(failures.join(" "));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

  async function manageBilling() {
    if (!user || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await studioRequest<{ url: string }>("manageSubscription");
      const destination = new URL(result.url);
      if (destination.protocol !== "https:" || destination.hostname !== "billing.stripe.com")
        throw new Error("The billing portal destination could not be verified.");
      location.assign(destination.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing management is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  const currentPlan = !allowance
    ? "Plan status unavailable"
    : allowance.plan === "PRO"
      ? "Forge Pro subscription"
      : allowance.plan === "PREMIUM"
        ? subscription?.active
          ? "Forge Pro subscription"
          : "Forge Premium one-time purchase"
        : "Forge Free";
  const renewal = dateLabel(subscription?.renewalAt);

  return (
    <main className="vf-root">
      <ForgeHeader />
      <section className="vf-billing-page">
        <p className="vf-eyebrow">YOUR ACCOUNT</p>
        <h1>Plan &amp; billing</h1>
        <p className="vf-muted">
          Account access and balances come from verified FORGE records. Your local projects and
          source exports stay available regardless of plan status.
        </p>

        {!user ? (
          <section className="vf-billing-panel">
            <h2>Sign in to view account billing</h2>
            <Link
              className="vf-primary"
              to="/login"
              state={{ from: "/forge/account/subscription" }}
            >
              Sign in securely <ArrowUpRight size={16} />
            </Link>
          </section>
        ) : !studioEnabled ? (
          <p className="vf-billing-message" role="status">
            Account billing is not connected in this environment. No subscription or payment status
            is being assumed.
          </p>
        ) : (
          <>
            {error && (
              <p className="vf-error" role="alert">
                {error}
              </p>
            )}
            {loading ? (
              <p className="vf-billing-message" role="status">
                Loading verified account details…
              </p>
            ) : (
              <>
                <section className="vf-billing-panel vf-billing-current">
                  <div className="vf-billing-panel-heading">
                    <span className="vf-billing-icon">
                      <ShieldCheck size={21} />
                    </span>
                    <div>
                      <p className="vf-eyebrow">CURRENT PLAN</p>
                      <h2>{currentPlan}</h2>
                    </div>
                    {allowance && allowance.plan !== "FREE" && (
                      <CircleCheck size={20} aria-label="Verified entitlement" />
                    )}
                  </div>
                  <dl className="vf-billing-facts">
                    <div>
                      <dt>Billing status</dt>
                      <dd>
                        {subscription?.available
                          ? subscription.status.replace(/_/g, " ")
                          : allowance?.plan === "PREMIUM"
                            ? "One-time entitlement"
                            : "Not available"}
                      </dd>
                    </div>
                    <div>
                      <dt>Renewal</dt>
                      <dd>
                        {subscription?.active
                          ? subscription.cancelAtPeriodEnd
                            ? `Access through ${renewal ?? "the verified period end"}`
                            : renewal
                              ? `Renews ${renewal}`
                              : "Date not available"
                          : subscription?.available
                            ? "No recurring renewal"
                            : "Not available"}
                      </dd>
                    </div>
                    <div>
                      <dt>Plan period ends</dt>
                      <dd>{dateLabel(allowance?.periodEnd) ?? "Not provided by this plan"}</dd>
                    </div>
                  </dl>
                  {subscription?.canManage && (
                    <button
                      className="vf-primary"
                      type="button"
                      onClick={() => void manageBilling()}
                      disabled={busy}
                    >
                      {busy ? "Opening secure billing…" : "Manage billing"}
                      <ArrowUpRight size={16} />
                    </button>
                  )}
                  {!subscription?.active && (
                    <Link className="vf-primary" to="/forge/pricing">
                      View verified plans <ArrowUpRight size={16} />
                    </Link>
                  )}
                </section>

                <section className="vf-billing-panel">
                  <h2>FORGE usage</h2>
                  <dl className="vf-billing-facts">
                    <div>
                      <dt>Base allowance remaining</dt>
                      <dd>{allowance?.baseRemaining.toLocaleString() ?? "Unavailable"}</dd>
                    </div>
                    <div>
                      <dt>Purchased requests remaining</dt>
                      <dd>{allowance?.topupRemaining.toLocaleString() ?? "Unavailable"}</dd>
                    </div>
                    <div>
                      <dt>Allowance period ends</dt>
                      <dd>{dateLabel(allowance?.periodEnd) ?? "No reset date provided"}</dd>
                    </div>
                  </dl>
                  <p>
                    Base allowance and purchased requests are separate balances. A VELORI balance
                    cannot override temporary limits from the configured AI provider.
                  </p>
                </section>

                <section className="vf-billing-panel">
                  <div className="vf-billing-panel-heading">
                    <CreditCard size={21} />
                    <h2>Recent payment history</h2>
                  </div>
                  {history?.available && history.purchases.length ? (
                    <div className="vf-purchase-list">
                      {history.purchases.map((purchase, index) => (
                        <article key={`${purchase.createdAt}-${purchase.sku}-${index}`}>
                          <div>
                            <strong>
                              {purchase.sku === "PACK100"
                                ? "100-request pack · one-time"
                                : "Forge Premium · one-time"}
                            </strong>
                            <small>{dateLabel(purchase.paidAt ?? purchase.createdAt)}</small>
                          </div>
                          <span>{formatBillingAmount(purchase.amount, purchase.currency)}</span>
                          <span className={`vf-payment-status vf-payment-${purchase.status}`}>
                            {purchase.status}
                          </span>
                        </article>
                      ))}
                    </div>
                  ) : history?.available ? (
                    <p>No purchases are recorded for this account.</p>
                  ) : (
                    <p>Payment history is not available in this environment.</p>
                  )}
                </section>
              </>
            )}
          </>
        )}

        <footer className="vf-pricing-footer">
          <Link to="/forge/pricing">Pricing</Link>
          <Link to="/help">Billing help</Link>
          <Link to="/terms">Terms</Link>
        </footer>
      </section>
    </main>
  );
}
