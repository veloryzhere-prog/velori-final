import { Link } from "react-router";
import { Building2, Gauge, Megaphone, Sparkles, Users, ArrowUpRight } from "lucide-react";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen } from "../frame";
import { useAdminSession, usePermissions } from "../session";
import { Card, Notice, Pill } from "../widgets";

const MODULES = [
  {
    to: "/admin/business-growth/offers",
    label: "Offers",
    status: "Reserved",
    note: "Campaign configuration and lifecycle management will live here.",
  },
  {
    to: "/admin/business-growth/pricing",
    label: "Pricing",
    status: "Reserved",
    note: "Plan definitions and commercial configuration are still under design.",
  },
  {
    to: "/admin/business-growth/subscriptions",
    label: "Subscriptions",
    status: "Reserved",
    note: "Customer entitlements and billing states remain pending implementation.",
  },
  {
    to: "/admin/business-growth/referrals",
    label: "Referrals",
    status: "Reserved",
    note: "Attribution and referral rewards are intentionally not exposed yet.",
  },
  {
    to: "/admin/business-growth/rewards",
    label: "Rewards",
    status: "Reserved",
    note: "Reward credits, ledger actions and approval flows need server-side contracts.",
  },
  {
    to: "/admin/business-growth/usage",
    label: "Usage & credits",
    status: "Reserved",
    note: "Usage guards, quotas and ledger rules are not implemented in this phase.",
  },
  {
    to: "/admin/business-growth/app-rewards",
    label: "APK Promotions",
    status: "Draft only",
    note: "Admins can manage unpublished promotion drafts. Activation requires trusted Android installation verification.",
  },
  {
    to: "/admin/business-growth/customers",
    label: "Customer entitlements",
    status: "Reserved",
    note: "User-level commercial access is managed by server-authoritative policy later.",
  },
  {
    to: "/admin/business-growth/analytics",
    label: "Analytics",
    status: "Reserved",
    note: "Business reporting and executive views will be added after the data model exists.",
  },
  {
    to: "/admin/business-growth/audit",
    label: "Audit log",
    status: "Reserved",
    note: "Administrator and entitlement changes will be recorded against the established audit system.",
  },
] as const;

function BusinessGrowthPlaceholderBody({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">Business & Growth</p>
          <Heading1>{title}</Heading1>
          <p>{description}</p>
        </div>
        <div className="admin-row-actions">
          <Link className="admin-button" to="/admin/business-growth">
            Back to overview
          </Link>
        </div>
      </div>

      <Card
        title="Reserved for future implementation"
        subtitle="This route is intentionally not a live business tool yet."
      >
        <Notice tone="info">
          The current codebase does not expose a live server contract or database model for this
          module. This landing page is kept honest and does not invent business data or actions.
        </Notice>
        <div className="admin-info-list" style={{ marginTop: 16 }}>
          <div>
            <span className="admin-muted">Current status</span>
            <strong>Not implemented</strong>
          </div>
          <div>
            <span className="admin-muted">Access model</span>
            <strong>Existing admin session and permission checks only</strong>
          </div>
          <div>
            <span className="admin-muted">Required next step</span>
            <strong>
              Define the server-side contract and migration before exposing the module.
            </strong>
          </div>
        </div>
      </Card>
    </>
  );
}

function BusinessGrowthOverviewBody() {
  const { me } = useAdminSession();
  const permissions = usePermissions();
  const canAccess =
    permissions.has("settings.view") ||
    permissions.has("flags.view") ||
    permissions.has("cms.view");

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">Business & Growth</p>
          <Heading1>Business & Growth Console</Heading1>
          <p>
            A secure administrative foundation for offers, pricing, subscriptions, referrals, and
            reward operations.
          </p>
        </div>
        <div className="admin-row-actions">
          <Button type="button" onClick={() => window.location.reload()}>
            Refresh access
          </Button>
        </div>
      </div>

      <div className="admin-metrics-grid" aria-label="Business growth status overview">
        <div className="admin-metric">
          <span className="admin-muted">Session</span>
          <strong>{me ? me.displayName || me.username : "Not signed in"}</strong>
        </div>
        <div className="admin-metric">
          <span className="admin-muted">Access</span>
          <strong>{canAccess ? "Allowed" : "Restricted"}</strong>
        </div>
        <div className="admin-metric">
          <span className="admin-muted">Console state</span>
          <strong>Foundation only</strong>
        </div>
        <div className="admin-metric">
          <span className="admin-muted">Data availability</span>
          <strong>Not yet live</strong>
        </div>
      </div>

      <Card
        title="Current implementation status"
        subtitle="The admin shell is in place, but no live business-growth server contract or database table set is exposed yet."
      >
        <div className="admin-info-list">
          <div>
            <span className="admin-muted">Source of truth</span>
            <strong>Existing admin session + permission model only</strong>
          </div>
          <div>
            <span className="admin-muted">Backend contract</span>
            <strong>Not implemented in the current repository</strong>
          </div>
          <div>
            <span className="admin-muted">Data policy</span>
            <strong>
              No fabricated revenue, subscription, referral or reward totals are displayed
            </strong>
          </div>
        </div>
      </Card>

      <Card
        title="Business module map"
        subtitle="These sections are reserved for future work and kept honest until the server contract exists."
      >
        <div style={{ display: "grid", gap: 12 }}>
          {MODULES.map((module) => (
            <Link
              key={module.to}
              to={module.to}
              className="admin-command-card"
              style={{ textDecoration: "none", display: "block" }}
            >
              <span>
                <strong>{module.label}</strong>
                <ArrowUpRight aria-hidden="true" />
              </span>
              <small>{module.note}</small>
              <span className="admin-command-open">
                <Pill tone="neutral">{module.status}</Pill>
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <Card
        title="Security and preservation rules"
        subtitle="The console follows the existing admin shell and does not create a new auth flow."
      >
        <ul className="admin-list">
          <li>Reuse the verified admin session and permission checks from the console shell.</li>
          <li>
            Do not expose service-role keys, secret provider values, or private session signing
            data.
          </li>
          <li>
            Keep future business routes behind server-side authorization and validated payloads.
          </li>
          <li>Present honest unavailable states instead of fake production metrics.</li>
        </ul>
      </Card>
    </>
  );
}

export function BusinessGrowthOverviewScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <BusinessGrowthOverviewBody />
    </ConsoleScreen>
  );
}

export function BusinessGrowthOffersScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <BusinessGrowthPlaceholderBody
        title="Offers"
        description="Administrative campaign configuration and promotion lifecycle management will be added here in a later phase."
      />
    </ConsoleScreen>
  );
}

export function BusinessGrowthPricingScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <BusinessGrowthPlaceholderBody
        title="Pricing"
        description="Plan definitions and commercial configuration will be added after the billing and entitlement data model is mapped."
      />
    </ConsoleScreen>
  );
}

export function BusinessGrowthSubscriptionsScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <BusinessGrowthPlaceholderBody
        title="Subscriptions"
        description="Active plans and provider-backed lifecycle state remain outside the current implemented contract."
      />
    </ConsoleScreen>
  );
}

export function BusinessGrowthReferralsScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <BusinessGrowthPlaceholderBody
        title="Referrals"
        description="Referral campaigns, attribution, and reward qualification will be implemented only after the relevant ledger policy is reviewed."
      />
    </ConsoleScreen>
  );
}

export function BusinessGrowthRewardsScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <BusinessGrowthPlaceholderBody
        title="Rewards"
        description="Credits and ledger actions require the transactional model to be mapped before they can be safely managed in the console."
      />
    </ConsoleScreen>
  );
}

export function BusinessGrowthUsageScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <BusinessGrowthPlaceholderBody
        title="Usage & credits"
        description="Usage controls, quotas and credits are deferred until the business rules are implemented server-side."
      />
    </ConsoleScreen>
  );
}

export function BusinessGrowthAppRewardsScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <BusinessGrowthPlaceholderBody
        title="App rewards"
        description="Installation and app-install reward campaigns will be implemented when the public and server-side contract are available."
      />
    </ConsoleScreen>
  );
}

export function BusinessGrowthCustomersScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <BusinessGrowthPlaceholderBody
        title="Customer entitlements"
        description="User-level business entitlements are intentionally not exposed until the authorization and ledger model is in place."
      />
    </ConsoleScreen>
  );
}

export function BusinessGrowthAnalyticsScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <BusinessGrowthPlaceholderBody
        title="Analytics"
        description="Operational reporting is reserved for the later analytics service contract and data model review."
      />
    </ConsoleScreen>
  );
}

export function BusinessGrowthAuditScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <BusinessGrowthPlaceholderBody
        title="Audit history"
        description="Sensitive business changes will be recorded using the existing admin audit patterns once the business modules are implemented."
      />
    </ConsoleScreen>
  );
}
