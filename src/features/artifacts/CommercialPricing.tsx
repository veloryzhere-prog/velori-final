import { useState } from "react";
import { Link } from "react-router";
import { Check, ArrowUpRight, CalendarDays, Wallet, Layers3 } from "lucide-react";
import { ForgeHeader } from "./Header";
import { commercialPlans, formatCommercialPrice, type BillingCurrency } from "./commercial";
import "./studio.css";

/** Reviewable next commercial model. No payment is initiated before its backend is approved. */
export function CommercialPricing() {
  const [currency, setCurrency] = useState<BillingCurrency>("inr");
  return (
    <main className="vf-root">
      <ForgeHeader />
      <section className="vf-pricing-heading">
        <p className="vf-eyebrow">THE NEXT CHAPTER OF FORGE</p>
        <h1>
          Make room
          <br />
          <em>for your ideas.</em>
        </h1>
        <p className="vf-muted">
          Daily discovery. A monthly creative rhythm.
          <br />
          Extra requests whenever you need them.
        </p>
        <p className="vf-commercial-status" role="status">
          Plan preview · Awaiting commercial backend approval.
          <br />
          These prices and quotas are not active on your account.
        </p>
        <div className="vf-currency" aria-label="Preview currency">
          {(["inr", "usd"] as const).map((c) => (
            <button key={c} aria-pressed={currency === c} onClick={() => setCurrency(c)}>
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </section>
      <div className="vf-pricing-grid vf-commercial-grid">
        {(Object.keys(commercialPlans) as (keyof typeof commercialPlans)[]).map((sku) => {
          const p = commercialPlans[sku];
          const Icon = sku === "FREE" ? Layers3 : sku === "PRO_MONTHLY" ? CalendarDays : Wallet;
          const features =
            sku === "FREE"
              ? [
                  "1,000 base requests per UTC day",
                  "Basic configured models",
                  "Branded shared previews",
                ]
              : sku === "PRO_MONTHLY"
                ? [
                    "50,000 base requests per paid billing month",
                    "Advanced configured models",
                    "Unbranded shared previews",
                    "Renewal and cancellation through billing portal",
                  ]
                : [
                    "5,000 additional requests",
                    "No expiry on unused top-up requests",
                    "Used after the base allowance runs out",
                    "Available to Free and Pro accounts",
                  ];
          return (
            <article key={sku} className={sku === "PRO_MONTHLY" ? "vf-featured" : ""}>
              <Icon size={25} />
              <p className="vf-eyebrow">
                {sku === "FREE"
                  ? "A LITTLE EVERY DAY"
                  : sku === "PRO_MONTHLY"
                    ? "A MONTH OF POSSIBILITIES"
                    : "ROOM TO KEEP GOING"}
              </p>
              <h2>{p.label}</h2>
              <div className="vf-price">
                {formatCommercialPrice(sku, currency)}
                <small>
                  {sku === "PRO_MONTHLY" ? " / month" : sku === "TOPUP5000" ? " / pack" : ""}
                </small>
              </div>
              <ul>
                {features.map((t) => (
                  <li key={t}>
                    <Check size={15} />
                    {t}
                  </li>
                ))}
              </ul>
              {sku === "FREE" ? (
                <Link to="/forge">
                  Open current Studio <ArrowUpRight size={16} />
                </Link>
              ) : (
                <button disabled>Commercial rollout pending</button>
              )}
            </article>
          );
        })}
      </div>
      <section className="vf-commercial-details">
        <div>
          <p className="vf-eyebrow">A CLEARER BALANCE</p>
          <h2>
            Base first.
            <br />
            <em>Top-ups next.</em>
          </h2>
          <p>
            Free allowance resets each UTC day. Pro allowance follows the actual paid subscription
            period. Unused top-ups carry forward. Account restrictions remain separate from request
            balances.
          </p>
        </div>
        <div>
          <h3>Honest usage limits</h3>
          <p>
            Pro includes 50,000 requests per billing month. Provider capacity, rate limits and abuse
            safeguards still apply. Generation requests and any future metered server compilation
            must be clearly identified before charging.
          </p>
          <h3>Payments and receipts</h3>
          <p>
            Cards and UPI depend on merchant and payment-provider eligibility. Receipts use verified
            payment details and the purchaser's verified account email. No payment is confirmed from
            a redirect, screenshot or typed UTR.
          </p>
        </div>
      </section>
      <footer className="vf-pricing-footer">
        <Link to="/forge/pricing">Current account and billing options</Link>
        <Link to="/help">Help</Link>
        <Link to="/terms">Terms</Link>
      </footer>
    </main>
  );
}
