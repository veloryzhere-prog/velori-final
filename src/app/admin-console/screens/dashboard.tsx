import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, CircleAlert, Clock3, ShieldCheck } from "lucide-react";
import {
  adminDashboard,
  adminSystemHealth,
  type AdminDashboardReport,
  type AdminHealthReport,
} from "../../../lib/admin-api";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen } from "../frame";
import { AREAS, GROUPS } from "../navigation";
import { areaDestination } from "../tools.mjs";
import { useAdminSession, usePermissions } from "../session";
import { Card, Empty, Loading, Metric, Notice, formatDate, useResource } from "../widgets";

const RANGES = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
] as const;

type Range = (typeof RANGES)[number]["value"];
type RecordRow = Record<string, unknown>;

const QUICK_ACTIONS = [
  { label: "Manage administrators", to: "/admin/admins", permission: "admins.view" },
  { label: "Forge guides & billing", to: "/admin/cms#cms-forge", permission: "cms.view" },
  {
    label: "Create announcement",
    to: "/admin/announcements?create=1",
    permission: "notifications.edit",
  },
  { label: "Create advertisement", to: "/admin/ads?create=1", permission: "ads.edit" },
  { label: "Create page", to: "/admin/cms?create=1", permission: "cms.edit" },
  { label: "Review reports", to: "/admin/reports", permission: "reports.view" },
  { label: "Manage users", to: "/admin/users", permission: "users.view" },
] as const;

const COMMAND_AREAS = [
  {
    title: "Site",
    description: "Configure VELORI’s pages, brand and appearance.",
    to: "/admin/website",
    permissions: ["cms.view", "navigation.view", "branding.view"],
  },
  {
    title: "Content Studio",
    description: "Manage pages, publishing and media content.",
    to: "/admin/cms",
    permissions: ["cms.view"],
  },
  {
    title: "Social",
    description: "Review users, groups and community activity.",
    to: "/admin/users",
    permissions: ["users.view", "groups.view", "posts.view", "reports.view"],
  },
  {
    title: "Communications",
    description: "Create announcements and notifications.",
    to: "/admin/announcements",
    permissions: ["notifications.view"],
  },
  {
    title: "Monetization",
    description: "Manage advertisements and placements.",
    to: "/admin/ads",
    permissions: ["ads.view"],
  },
  {
    title: "System",
    description: "Monitor health, settings and maintenance.",
    to: "/admin/system",
    permissions: ["system.view", "settings.view", "flags.view"],
  },
  {
    title: "Administration",
    description: "Manage administrator access and security.",
    to: "/admin/admins",
    permissions: ["admins.view", "audit.view"],
  },
] as const;

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : value.toLocaleString();
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardBody() {
  const [range, setRange] = useState<Range>("7d");
  const permissions = usePermissions();
  const { me } = useAdminSession();
  const report = useResource<AdminDashboardReport>(() => adminDashboard(range), [range]);
  const health = useResource<AdminHealthReport | null>(
    () => (permissions.has("system.view") ? adminSystemHealth() : Promise.resolve(null)),
    [permissions],
  );

  if (report.loading && !report.data) return <Loading label="Loading your overview" />;
  if (report.error && !report.data) return <Notice tone="error">{report.error}</Notice>;
  if (!report.data) return <Empty>Overview data is not available right now.</Empty>;

  const data = report.data;
  const totals = data.totals ?? {};
  const canViewReports = permissions.has("reports.view");
  const canViewSystem = permissions.has("system.view");
  const canViewAudit = permissions.has("audit.view");
  const pendingReports = canViewReports ? ((data.recentReports ?? []) as RecordRow[]) : [];
  const recentActions = canViewAudit ? ((data.recentAdminActions ?? []) as RecordRow[]) : [];
  const systemState = !canViewSystem
    ? "restricted"
    : health.error
      ? "unavailable"
      : (health.data?.overall ?? "loading");
  const systemLabel =
    systemState === "operational"
      ? "All systems operational"
      : systemState === "degraded"
        ? "Needs attention"
        : systemState === "unavailable"
          ? "Status unavailable"
          : systemState === "unknown"
            ? "Status unknown"
            : "Checking systems";
  const checks = health.data?.checks ?? [];
  const needsAttention = canViewSystem
    ? checks.filter((check) => check.status === "degraded" || check.status === "unavailable")
    : [];
  const openReportCount = canViewReports ? Number(totals.openReports ?? 0) : 0;
  const systemHasIssue = ["degraded", "unavailable", "unknown"].includes(systemState);
  const firstName = (me?.displayName || me?.username || "there").split(/[ .]/)[0];

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard-heading">
        <div>
          <p className="admin-eyebrow">Overview</p>
          <Heading1>
            {greeting()}, {firstName}
          </Heading1>
          <p>Here’s what’s happening across VELORI.</p>
        </div>
        <div className="admin-dashboard-controls">
          <div className="admin-range-switch" role="group" aria-label="Reporting period">
            {RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={range === option.value}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            disabled={report.loading || health.loading}
            onClick={() => {
              report.reload();
              health.reload();
            }}
          >
            {report.loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </header>

      <section className="admin-command-center" aria-labelledby="admin-command-heading">
        <div className="admin-command-heading">
          <div>
            <p className="admin-eyebrow">VELORI ADMIN</p>
            <h2 id="admin-command-heading">Command Center</h2>
            <p>Choose an area to manage the platform.</p>
          </div>
        </div>
        <div className="admin-command-center-grid">
          {COMMAND_AREAS.filter((area) =>
            areaDestination(
              AREAS.find((item) => item.label === area.title)!,
              GROUPS,
              permissions,
            ),
          ).map((area) => (
            <Link
              className="admin-command-card"
              to={areaDestination(
                AREAS.find((item) => item.label === area.title)!,
                GROUPS,
                permissions,
              )!}
              key={area.title}
            >
              <span>
                <strong>{area.title}</strong>
                <ArrowUpRight aria-hidden="true" />
              </span>
              <small>{area.description}</small>
              <span className="admin-command-open">
                Open area <ArrowUpRight aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {report.error ? <Notice>Some overview information could not be refreshed.</Notice> : null}

      <section className="admin-overview-metrics" aria-label="Platform overview">
        {permissions.has("users.view") ? (
          <Metric
            label="Total users"
            value={formatCount(totals.users)}
            note={`${formatCount(data.period?.newUsers)} joined in this period`}
          />
        ) : null}
        {permissions.has("posts.view") ? (
          <Metric
            label="Posts"
            value={formatCount(totals.posts)}
            note={`${formatCount(data.period?.newPosts)} created in this period`}
          />
        ) : null}
        {canViewReports ? (
          <Metric
            label="Reports to review"
            value={formatCount(totals.openReports)}
            note={`${formatCount(data.period?.newReports)} new in this period`}
          />
        ) : null}
        {permissions.has("admins.view") ? (
          <Metric
            label="Active admin sessions"
            value={formatCount(totals.activeAdminSessions)}
            note="Current administrator sessions"
          />
        ) : null}
      </section>

      <div className={`admin-dashboard-columns${canViewSystem ? "" : " is-single"}`}>
        <Card
          title="Needs attention"
          subtitle="Open work and service checks that may need a closer look."
        >
          <div className="admin-attention-list">
            {pendingReports.slice(0, 5).map((item) => (
              <Link to="/admin/reports" className="admin-attention-row" key={String(item.id)}>
                <span className="admin-attention-icon is-warning">
                  <CircleAlert aria-hidden="true" />
                </span>
                <span className="admin-attention-copy">
                  <strong>
                    {String(item.category || item.target_type || "Report needs review")}
                  </strong>
                  <small>{String(item.reason || "Open report")}</small>
                </span>
                <time>{formatDate(String(item.created_at ?? ""))}</time>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            ))}
            {openReportCount > 0 && pendingReports.length === 0 ? (
              <Link to="/admin/reports" className="admin-attention-row">
                <span className="admin-attention-icon is-warning">
                  <CircleAlert aria-hidden="true" />
                </span>
                <span className="admin-attention-copy">
                  <strong>{openReportCount} reports need review</strong>
                  <small>Open the moderation queue to review them.</small>
                </span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            ) : null}
            {needsAttention.map((check) => (
              <Link to="/admin/system" className="admin-attention-row" key={check.name}>
                <span className="admin-attention-icon is-warning">
                  <CircleAlert aria-hidden="true" />
                </span>
                <span className="admin-attention-copy">
                  <strong>{check.name}</strong>
                  <small>
                    {check.status === "unavailable"
                      ? "Service unavailable"
                      : "Check requires attention"}
                  </small>
                </span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            ))}
            {canViewSystem && !health.error && systemHasIssue && needsAttention.length === 0 ? (
              <Link to="/admin/system" className="admin-attention-row">
                <span className="admin-attention-icon is-warning">
                  <CircleAlert aria-hidden="true" />
                </span>
                <span className="admin-attention-copy">
                  <strong>{systemLabel}</strong>
                  <small>Review the latest system report.</small>
                </span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            ) : null}
            {!openReportCount &&
            !needsAttention.length &&
            !systemHasIssue &&
            !health.error &&
            (canViewReports || canViewSystem) &&
            (!canViewSystem || Boolean(health.data)) ? (
              <div className="admin-caught-up">
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>You’re all caught up</strong>
                  <small>
                    {canViewReports ? "No open reports" : "No additional review items"}
                    {canViewSystem ? " or system warnings were returned." : "."}
                  </small>
                </span>
              </div>
            ) : null}
            {canViewSystem && health.error ? (
              <Link to="/admin/system" className="admin-attention-row">
                <span className="admin-attention-icon is-muted">
                  <CircleAlert aria-hidden="true" />
                </span>
                <span className="admin-attention-copy">
                  <strong>System status could not be checked</strong>
                  <small>Open system health to retry the checks.</small>
                </span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            ) : null}
            {!canViewReports && !canViewSystem ? (
              <Empty>No review queue is included in your current access.</Empty>
            ) : null}
          </div>
        </Card>

        {canViewSystem ? (
          <Card title="System health" subtitle="Latest checks from the administrator service.">
            <div className={`admin-health-summary state-${systemState}`}>
              <span className="admin-health-indicator" aria-hidden="true" />
              <strong>{systemLabel}</strong>
              {health.data?.checkedAt ? <time>{formatDate(health.data.checkedAt)}</time> : null}
            </div>
            {health.data ? (
              <ul className="admin-health-checks">
                {health.data.checks.slice(0, 5).map((check) => (
                  <li key={check.name}>
                    <span>{check.name}</span>
                    <strong className={`state-${check.status}`}>
                      {check.status === "operational"
                        ? "Operational"
                        : check.status === "degraded"
                          ? "Review"
                          : check.status === "unavailable"
                            ? "Unavailable"
                            : "Status unknown"}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : health.error ? (
              <p className="admin-health-unavailable">The health report could not be loaded.</p>
            ) : (
              <p className="admin-health-unavailable">Checking service availability…</p>
            )}
            <Link to="/admin/system" className="admin-inline-link">
              View system health <ArrowUpRight aria-hidden="true" />
            </Link>
          </Card>
        ) : null}
      </div>

      <div
        className={`admin-dashboard-columns admin-dashboard-lower${canViewAudit ? "" : " is-single"}`}
      >
        {canViewAudit ? (
          <Card title="Recent administrator activity" subtitle="Actions recorded in the audit log.">
            {recentActions.length ? (
              <ol className="admin-activity-list">
                {recentActions.slice(0, 8).map((item) => (
                  <li key={String(item.id)}>
                    <span className="admin-activity-mark" aria-hidden="true" />
                    <div>
                      <strong>
                        {String(item.action || "Administrator action").replace(/\./g, " ")}
                      </strong>
                      <small>
                        {String(item.target_type || "Platform")}
                        {item.result ? ` · ${String(item.result)}` : ""}
                      </small>
                    </div>
                    <time>{formatDate(String(item.created_at ?? ""))}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>No administrator activity has been recorded yet.</Empty>
            )}
            <Link to="/admin/audit" className="admin-inline-link">
              Open audit log <ArrowUpRight aria-hidden="true" />
            </Link>
          </Card>
        ) : null}

        <Card title="Quick actions" subtitle="Go straight to common admin tasks.">
          <div className="admin-quick-actions-grid">
            {QUICK_ACTIONS.filter((action) => permissions.has(action.permission)).map((action) => (
              <Link to={action.to} key={action.label}>
                <span>{action.label}</span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            ))}
          </div>
          {!QUICK_ACTIONS.some((action) => permissions.has(action.permission)) ? (
            <p className="admin-muted">No quick actions are available for this role.</p>
          ) : null}
        </Card>
      </div>

      {canViewSystem && !data.storage.available ? (
        <Notice>
          <Clock3 aria-hidden="true" />{" "}
          {data.storage.diagnosis || "Storage availability could not be confirmed."}
        </Notice>
      ) : null}
    </div>
  );
}

export function DashboardScreen() {
  return (
    <ConsoleScreen anyOf={["system.view", "users.view"]}>
      <DashboardBody />
    </ConsoleScreen>
  );
}
