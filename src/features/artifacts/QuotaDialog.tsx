import { Link } from "react-router";
import { Gauge, ArrowUpRight } from "lucide-react";
import { Dialog } from "../../components/ui";
import { quotaState, type CommercialQuota } from "./commercial";
import type { Quota } from "./model";

/** Uses server allowance only; no fabricated balances, countdowns or applied discounts. */
export function QuotaDialog({
  quota,
  open,
  onClose,
}: {
  quota: CommercialQuota | Quota;
  open: boolean;
  onClose: () => void;
}) {
  const modern = "model" in quota;
  const modernState = modern ? quotaState(quota) : null;
  const legacyQuota = modern ? null : quota;
  const baseRemaining = modernState
    ? modernState.baseRemaining
    : Math.max(0, legacyQuota?.freeLeft ?? 0);
  const topupRemaining = modernState
    ? modernState.topupRemaining
    : Math.max(0, legacyQuota?.tokens ?? 0);
  const exhausted = modernState ? modernState.exhausted : !legacyQuota?.canGenerate;
  const warning = modernState?.warning ?? false;
  const accountLocked = modern ? quota.accountLocked : false;
  const periodEnd = modern ? new Date(quota.periodEnd).toLocaleString() : null;
  return (
    <Dialog
      title={
        accountLocked
          ? "Account requests are paused"
          : exhausted
            ? "Your request balance is used"
            : "A little more room to create"
      }
      open={open}
      onClose={onClose}
    >
      <div className="vf-commercial-dialog">
        <Gauge size={32} />
        <p>
          {accountLocked
            ? "This account has an administrative restriction. Buying requests will not remove it; contact support."
            : exhausted
              ? "Your base allowance and top-up balance are empty. Your project remains saved, and exports are available."
              : warning
                ? "You have used at least 90% of this period's base allowance. Purchased requests are used only after that allowance runs out."
                : modern
                  ? "Your verified base allowance and purchased-request balance are shown below."
                  : "Your verified balances are shown below. This account model does not provide a low-balance threshold or reset date."}
        </p>
        <dl>
          <div>
            <dt>Base requests remaining</dt>
            <dd>{baseRemaining.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Purchased requests remaining</dt>
            <dd>{topupRemaining.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Allowance period ends</dt>
            <dd>{periodEnd ?? "Not provided by this account model"}</dd>
          </div>
        </dl>
        <Link
          className="vf-primary"
          to={accountLocked ? "/help" : "/forge/pricing"}
          onClick={onClose}
        >
          {accountLocked ? "Contact support" : "View plans and request packs"}
          <ArrowUpRight size={16} />
        </Link>
        <Link to="/forge/account/subscription" onClick={onClose}>
          Open account billing
        </Link>
        <button onClick={onClose}>Return to my project</button>
      </div>
    </Dialog>
  );
}
