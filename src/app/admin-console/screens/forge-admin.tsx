import { Link } from "react-router";
import {
  adminAnnouncements,
  adminFeatureFlags,
  adminPlatformSettings,
  adminSiteSettings,
} from "../../../lib/admin-api";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen } from "../frame";
import { Card, Empty, Loading, Notice, Pill, Table, useResource } from "../widgets";

const FORGE_POLICY_KEYS = [
  "FORGE_ENABLED",
  "FORGE_BUILD_ENABLED",
  "FORGE_ASK_ENABLED",
  "REACT_RUNTIME_ENABLED",
  "PYTHON_RUNTIME_ENABLED",
  "LOCAL_MODELS_ENABLED",
  "REMOTE_AI_ENABLED",
  "PROMOTIONAL_OFFERS_ENABLED",
  "REFERRALS_ENABLED",
  "APP_REWARDS_ENABLED",
  "CREDIT_PACKS_ENABLED",
  "PREMIUM_CHECKOUT_ENABLED",
  "ADVANCED_EDITOR_ENABLED",
] as const;

function ForgeAdminBody() {
  const flags = useResource(() => adminFeatureFlags(), []);
  const siteSettings = useResource(() => adminSiteSettings(), []);
  const platformSettings = useResource(() => adminPlatformSettings(), []);
  const announcements = useResource(() => adminAnnouncements({ page: 1, perPage: 5 }), []);

  const flagMap = new Map(
    ((flags.data?.flags ?? []) as Record<string, unknown>[]).map((flag) => [
      String(flag.key),
      flag,
    ]),
  );
  const knownFlags = FORGE_POLICY_KEYS.map((key) => ({
    key,
    data: flagMap.get(key),
  }));

  const systemStatus = knownFlags.some(({ data }) => data && data.enabled === true)
    ? "Operational"
    : "Review required";

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>FORGE AI administration</Heading1>
          <p>
            Secure configuration and operational review for the FORGE AI product, commercial
            controls, runtime security and public experience.
          </p>
        </div>
        <div className="admin-row-actions">
          <Button
            type="button"
            onClick={() => {
              flags.reload();
              siteSettings.reload();
              platformSettings.reload();
              announcements.reload();
            }}
          >
            Refresh status
          </Button>
        </div>
      </div>

      {flags.error || siteSettings.error || platformSettings.error ? (
        <Notice tone="error">{flags.error ?? siteSettings.error ?? platformSettings.error}</Notice>
      ) : null}
      {flags.loading || siteSettings.loading || platformSettings.loading ? (
        <Loading label="Loading FORGE configuration" />
      ) : null}

      <div className="admin-metrics-grid" aria-label="FORGE status overview">
        <div className="admin-metric">
          <span className="admin-muted">Runtime status</span>
          <strong>{systemStatus}</strong>
        </div>
        <div className="admin-metric">
          <span className="admin-muted">Protected AI</span>
          <strong>
            {knownFlags.some(
              (flag) => flag.key === "REMOTE_AI_ENABLED" && flag.data?.enabled === true,
            )
              ? "Enabled"
              : "Needs config"}
          </strong>
        </div>
        <div className="admin-metric">
          <span className="admin-muted">Feature policy</span>
          <strong>{knownFlags.length} tracked flags</strong>
        </div>
        <div className="admin-metric">
          <span className="admin-muted">Announcements</span>
          <strong>{announcements.data?.total ?? 0}</strong>
        </div>
      </div>

      <div className="admin-row-actions" style={{ margin: "18px 0" }}>
        <Link className="admin-button" to="/admin/feature-flags">
          Feature flags
        </Link>
        <Link className="admin-button" to="/admin/system">
          System health
        </Link>
        <Link className="admin-button" to="/admin/settings">
          Site settings
        </Link>
      </div>

      <Card
        title="Secure operation checklist"
        subtitle="The controls below reflect the server-authoritative configuration model used by the platform."
      >
        <Table>
          <thead>
            <tr>
              <th>Control</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: "Protected AI runtime",
                status: knownFlags.some(
                  (flag) => flag.key === "REMOTE_AI_ENABLED" && flag.data?.enabled === true,
                )
                  ? "allowed"
                  : "not configured",
                note: "Remote inference requires admin-only configuration and server-side consent rules.",
              },
              {
                label: "Local model runtime",
                status: knownFlags.some(
                  (flag) => flag.key === "LOCAL_MODELS_ENABLED" && flag.data?.enabled === true,
                )
                  ? "allowed"
                  : "restricted",
                note: "Local-model operation stays separate from remote provider quotas and user consent.",
              },
              {
                label: "Commercial publish pipeline",
                status: knownFlags.some(
                  (flag) => flag.key === "PREMIUM_CHECKOUT_ENABLED" && flag.data?.enabled === true,
                )
                  ? "visible"
                  : "draft-only",
                note: "Direct billing changes remain server-authoritative and should not be modified from browser state alone.",
              },
              {
                label: "Offer and rewards",
                status: knownFlags.some(
                  (flag) => flag.key === "REFERRALS_ENABLED" && flag.data?.enabled === true,
                )
                  ? "enabled"
                  : "paused",
                note: "Referral and campaign mechanics should preserve historical ledger state and cap enforcement.",
              },
            ].map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>
                  <Pill
                    tone={
                      row.status === "allowed" ||
                      row.status === "enabled" ||
                      row.status === "visible"
                        ? "ok"
                        : row.status === "not configured" ||
                            row.status === "restricted" ||
                            row.status === "paused"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {row.status}
                  </Pill>
                </td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card
        title="FORGE flag policy"
        subtitle="These keys are the production policy controls this codebase reads."
      >
        {knownFlags.length === 0 ? (
          <Empty>No FORGE flags were found in the current environment.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Flag</th>
                <th>State</th>
                <th>Rollout</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {knownFlags.map(({ key, data }) => {
                const enabled = Boolean(data?.enabled);
                const rollout = Number(data?.rollout ?? 0);
                return (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>
                      <Pill tone={enabled ? "ok" : "warn"}>{enabled ? "on" : "off"}</Pill>
                    </td>
                    <td>{Number.isFinite(rollout) ? `${rollout}%` : "0%"}</td>
                    <td>{String(data?.description ?? "Server-backed operational control")}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card
        title="Current public-facing controls"
        subtitle="The admin console remains server-authoritative and should never expose provider secrets in browser state."
      >
        <div className="admin-info-list">
          <div>
            <span className="admin-muted">Site configuration</span>
            <strong>{siteSettings.data ? "Ready" : "Unavailable"}</strong>
          </div>
          <div>
            <span className="admin-muted">Platform configuration</span>
            <strong>{platformSettings.data ? "Ready" : "Unavailable"}</strong>
          </div>
          <div>
            <span className="admin-muted">Operational messages</span>
            <strong>{announcements.data?.total ?? 0} active/admin managed items</strong>
          </div>
        </div>
      </Card>
    </>
  );
}

export function ForgeAdminScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view", "flags.view", "cms.view"]}>
      <ForgeAdminBody />
    </ConsoleScreen>
  );
}
