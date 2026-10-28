/* Copyright © 2026 VELORYZ. Contextual, dismissible plan discovery. */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Sparkles, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Dialog } from "../../components/ui";
import { studioRequest } from "./api";
import type { Quota } from "./model";
const LAST_SHOWN = "velori.forge.premium.discovery.v1";
const PERIOD_MS = 7 * 86400000;
type Plan = { sku: string; currency: string; amount: number; available: boolean };
export function PremiumOffer({
  signedIn,
  quota,
  completed,
  busy,
}: {
  signedIn: boolean;
  quota: Quota | null;
  completed: number;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (
      !signedIn ||
      busy ||
      quota?.plan !== "FREE" ||
      (completed < 2 && quota.canGenerate) ||
      checked
    )
      return;
    try {
      if (Date.now() - Number(localStorage.getItem(LAST_SHOWN) ?? 0) < PERIOD_MS) return;
    } catch {
      // Private browsing can disable local storage; the in-memory check still prevents repeats.
    }
    setChecked(true);
    void studioRequest<{ plans: Plan[] }>("plans")
      .then((result) => {
        const offered = result.plans.filter(
          (plan) =>
            ["PREMIUM", "PRO_MONTHLY"].includes(plan.sku) &&
            plan.available &&
            Number.isSafeInteger(plan.amount) &&
            plan.amount > 0 &&
            ["inr", "usd"].includes(plan.currency.toLowerCase()),
        );
        if (offered.length) {
          setPlans(offered);
          setOpen(true);
        }
      })
      .catch(() => setError("Plan details could not be loaded. No offer or discount was applied."));
  }, [signedIn, busy, quota?.plan, quota?.canGenerate, completed, checked]);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(LAST_SHOWN, String(Date.now()));
    } catch {
      // The in-memory check prevents the dialog from reopening in this workspace session.
    }
  }
  const preferred = plans.some((plan) => plan.sku === "PRO_MONTHLY") ? "PRO_MONTHLY" : "PREMIUM";
  const pricePlan =
    plans.find((plan) => plan.currency === "inr" && plan.sku === preferred) ??
    plans.find((plan) => plan.sku === preferred);
  const price =
    pricePlan &&
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: pricePlan.currency.toUpperCase(),
    }).format(pricePlan.amount / 100);

  return (
    <>
      {error && (
        <p className="vf-offer-error" role="status">
          {error}
          <button
            type="button"
            onClick={() => {
              setError("");
              setChecked(false);
            }}
          >
            Retry
          </button>
        </p>
      )}
      <Dialog open={open} title="Explore verified plan options" onClose={close}>
        <div className="vf-premium-offer">
          <span className="vf-premium-emblem">
            <Sparkles size={23} />
          </span>
          <h3>More room for your ideas</h3>
          <p>
            Compare verified account benefits. Your local projects, source editing, and exports
            remain available without an upgrade.
          </p>
          {price && (
            <p className="vf-premium-price">
              {price}
              <small>
                {preferred === "PRO_MONTHLY"
                  ? " / month · recurring subscription"
                  : " · one-time purchase"}
              </small>
            </p>
          )}
          <p className="vf-premium-detail">
            <ShieldCheck size={16} />
            No discount is being applied. Payment and access are verified by the FORGE backend.
          </p>
          <div className="vf-premium-cta">
            <Link to="/forge/pricing" onClick={close} className="vf-primary">
              See plans and terms <ArrowUpRight size={15} />
            </Link>
            <button type="button" onClick={close}>
              Not now
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
