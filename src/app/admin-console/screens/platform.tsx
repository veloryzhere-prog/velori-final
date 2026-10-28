import { Maintenance } from "../../shell";
import { StatusIllustration } from "../../../components/StatusIllustration";
import { PUBLIC_PAGE_REGISTRY } from "../page-registry";
import { useFeatureFlag } from "../../../lib/feature-flags";
import { Link } from "react-router";
import {
  AnnouncementPaper,
  type AnnouncementCreative,
} from "../../../features/campaigns/AnnouncementPaper";
import { SponsoredCard } from "../../../features/campaigns/SponsoredCard";
import { safeCampaignUrl } from "../../../features/campaigns/policy.mjs";
import "../../../features/campaigns/campaign-admin.css";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  adminCreateAd,
  adminAds,
  adminCreateAnnouncement,
  adminAnnouncements,
  adminUploadAnnouncementMedia,
  adminCreateNotification,
  adminDeleteAd,
  adminDeleteAnnouncement,
  adminDeleteNotification,
  adminEmails,
  adminEmergencyMode,
  adminFeatureFlags,
  adminNotifications,
  adminPatchAd,
  adminPatchAnnouncement,
  adminPublishAnnouncement,
  adminAnnouncementVersions,
  adminRestoreAnnouncementVersion,
  adminPatchEmail,
  adminPatchFeatureFlag,
  adminPlatformSettings,
  adminSavePlatformSettings,
  adminSaveSiteSettings,
  adminSiteSettings,
  adminTestEmail,
  adminUploadAsset,
  adminUploadAdMedia,
  adminPublishAd,
} from "../../../lib/admin-api";
import { customHtmlDocument } from "../../../lib/custom-html-document";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen, useScreenReauth } from "../frame";
import { usePermission } from "../session";
import {
  AreaField,
  Card,
  Dialog,
  Empty,
  Loading,
  Metric,
  Notice,
  Pager,
  Pill,
  ReasonDialog,
  SelectField,
  Table,
  TextField,
  ToggleField,
  formatDate,
  useGuardedAction,
  useResource,
} from "../widgets";

const PER_PAGE = 20;

function row(record: unknown) {
  return (record ?? {}) as Record<string, unknown>;
}

function localDateTimeInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------

const SITE_TEXT_FIELDS = [
  { key: "site_name", label: "Site name" },
  { key: "site_title", label: "Browser title" },
  { key: "footer_text", label: "Footer text" },
  { key: "announcement_text", label: "Announcement bar" },
  { key: "homepage_kicker", label: "Homepage kicker" },
  { key: "contact_email", label: "Contact email" },
  { key: "website_url", label: "Website URL" },
] as const;

const PWA_TEXT_FIELDS = [
  { key: "pwa_install_title", label: "Install banner title" },
  { key: "pwa_install_description", label: "Install banner description" },
  { key: "pwa_install_cta", label: "Install button label" },
] as const;

function SiteSettingsBody() {
  const settings = useResource(() => adminSiteSettings(), []);
  const canEdit = usePermission("settings.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const theme = row(settings.data?.settings);

  const value = (key: string) => draft[key] ?? String(theme[key] ?? "");

  const save = () =>
    void guarded(async () => {
      setError(null);
      setSaved(false);
      const payload: Record<string, unknown> = {};
      for (const field of [...SITE_TEXT_FIELDS, ...PWA_TEXT_FIELDS]) {
        if (value(field.key) !== String(theme[field.key] ?? ""))
          payload[field.key] = value(field.key);
      }
      if (value("pwa_install_enabled") !== String(theme.pwa_install_enabled ?? true))
        payload.pwa_install_enabled = value("pwa_install_enabled") === "true";
      await adminSaveSiteSettings(payload);
      setDraft({});
      setSaved(true);
      settings.reload();
    }).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Site settings</Heading1>
          <p>
            The text and links the public shell reads. Only changed fields are sent, so an untouched
            field is never rewritten.
          </p>
        </div>
        <div className="admin-row-actions">
          {canEdit ? (
            <Button
              type="button"
              className="admin-primary"
              disabled={busy || Object.keys(draft).length === 0}
              onClick={save}
            >
              {busy ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice tone="success">Settings saved.</Notice> : null}
      {settings.loading ? <Loading label="Loading site settings" /> : null}
      {settings.error ? <Notice tone="error">{settings.error}</Notice> : null}

      {!settings.loading && !settings.error ? (
        <>
          <Card title="Public copy">
            {SITE_TEXT_FIELDS.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                value={value(field.key)}
                disabled={!canEdit}
                onChange={(next) => setDraft((current) => ({ ...current, [field.key]: next }))}
              />
            ))}
          </Card>
          <Card
            title="Install experience"
            subtitle="Choose the short invitation shown to eligible mobile browsers. Browser installation and iOS guidance remain automatic."
          >
            <ToggleField
              label="Show the VELORI install invitation"
              checked={value("pwa_install_enabled") !== "false"}
              disabled={!canEdit}
              onChange={(next) =>
                setDraft((current) => ({ ...current, pwa_install_enabled: String(next) }))
              }
            />
            {PWA_TEXT_FIELDS.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                value={value(field.key)}
                disabled={!canEdit || value("pwa_install_enabled") === "false"}
                onChange={(next) => setDraft((current) => ({ ...current, [field.key]: next }))}
              />
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Platform settings and maintenance mode
// ---------------------------------------------------------------------------

function PlatformBody() {
  const settings = useResource(() => adminPlatformSettings(), []);
  const siteSettings = useResource(() => adminSiteSettings(), []);
  const canEdit = usePermission("settings.edit");
  const canEmergency = usePermission("system.emergency");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const mediaInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [maintenanceDraft, setMaintenanceDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [maintenanceSaved, setMaintenanceSaved] = useState(false);
  const [maintenanceModeNotice, setMaintenanceModeNotice] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [emergency, setEmergency] = useState(false);

  const current = row(settings.data?.settings);
  const site = row(siteSettings.data?.settings);
  const maintenanceEnabled = site.maintenance_mode === true;

  const value = (key: string) => draft[key] ?? String(current[key] ?? "");
  const maintenanceValue = (key: string) => {
    if (key in maintenanceDraft) return maintenanceDraft[key];
    const stored = site[key];
    return key === "maintenance_starts_at" || key === "maintenance_ends_at"
      ? localDateTimeInput(stored)
      : String(stored ?? "");
  };
  const maintenanceDirty = [
    "maintenance_scope",
    "maintenance_route",
    "maintenance_starts_at",
    "maintenance_ends_at",
    "maintenance_animation_url",
  ].some(
    (key) =>
      maintenanceValue(key) !==
      (key === "maintenance_starts_at" || key === "maintenance_ends_at"
        ? localDateTimeInput(site[key])
        : String(site[key] ?? "")),
  );

  const numeric = (key: string, fallback: number) => {
    const parsed = Number(value(key));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const save = () =>
    void guarded(async () => {
      setError(null);
      setSaved(false);
      await adminSavePlatformSettings({
        admin_session_timeout_minutes: numeric("admin_session_timeout_minutes", 60),
        require_admin_reauth_minutes: numeric("require_admin_reauth_minutes", 10),
        content_report_auto_hide: value("content_report_auto_hide") === "true",
        reduce_motion_safe_mode: value("reduce_motion_safe_mode") === "true",
      });
      setDraft({});
      setSaved(true);
      settings.reload();
    }).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );

  const saveMaintenanceSettings = () =>
    void guarded(async () => {
      setError(null);
      setMaintenanceSaved(false);
      const payload: Record<string, unknown> = {};
      const scheduleStart = maintenanceValue("maintenance_starts_at");
      const scheduleEnd = maintenanceValue("maintenance_ends_at");
      if (scheduleStart && !Number.isFinite(new Date(scheduleStart).getTime())) {
        throw new Error("Choose a valid maintenance start date and time.");
      }
      if (scheduleEnd && !Number.isFinite(new Date(scheduleEnd).getTime())) {
        throw new Error("Choose a valid maintenance end date and time.");
      }
      if (scheduleStart && scheduleEnd && new Date(scheduleEnd) <= new Date(scheduleStart)) {
        throw new Error("The maintenance end time must be after its start time.");
      }
      for (const key of [
        "maintenance_scope",
        "maintenance_route",
        "maintenance_starts_at",
        "maintenance_ends_at",
        "maintenance_animation_url",
      ]) {
        if (maintenanceValue(key) === localDateTimeInput(site[key]) && key.includes("_at"))
          continue;
        if (key === "maintenance_starts_at" || key === "maintenance_ends_at") {
          payload[key] = maintenanceValue(key)
            ? new Date(maintenanceValue(key)).toISOString()
            : null;
        } else if (maintenanceValue(key) !== String(site[key] ?? "")) {
          payload[key] = maintenanceValue(key) || null;
        }
      }
      if (
        maintenanceValue("maintenance_scope") !== "site" &&
        !maintenanceValue("maintenance_route")
      ) {
        throw new Error("Enter a route or route group before saving targeted maintenance.");
      }
      if (Object.keys(payload).length === 0) {
        setMaintenanceDraft({});
        return;
      }
      await adminSaveSiteSettings(payload);
      setMaintenanceDraft({});
      setMaintenanceSaved(true);
      siteSettings.reload();
    }).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );

  const uploadMaintenanceMedia = (file: File) => {
    setUploadingMedia(true);
    void guarded(async () => {
      setError(null);
      const uploaded = await adminUploadAsset(file, "maintenance_animation_url");
      setMaintenanceDraft((currentDraft) => ({
        ...currentDraft,
        maintenance_animation_url: uploaded.url,
      }));
    })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : String(caught)),
      )
      .finally(() => setUploadingMedia(false));
  };

  const maintenancePages = [
    ...[
      ["/", "Welcome"],
      ["/home", "Home"],
      ["/feed", "Feed"],
      ["/explore", "Explore"],
      ["/search", "Search"],
      ["/people", "People"],
      ["/reels", "Reels"],
      ["/reels/create", "Reel Studio"],
      ["/stories", "Stories"],
      ["/stories/create", "Story Studio"],
      ["/stories/archive", "Story archive"],
      ["/create", "Create post"],
      ["/notifications", "Notifications"],
      ["/messages", "Messages"],
      ["/saved", "Saved"],
      ["/profile", "Own profile"],
      ["/groups", "Groups"],
      ["/groups/create", "Create group"],
      ["/archive", "Post archive"],
      ["/trash", "Trash"],
      ["/drafts", "Drafts"],
      ["/settings", "Settings"],
      ["/settings/privacy", "Privacy settings"],
      ["/settings/appearance", "Appearance"],
      ["/settings/account", "Account settings"],
      ["/settings/notifications", "Notification settings"],
      ["/settings/follow-requests", "Follow requests"],
    ].map(([value, label]) => ({ value, label: label + " · " + value })),
    ...PUBLIC_PAGE_REGISTRY.map((page) => ({
      value: page.route,
      label: page.title + " · " + page.route,
    })),
  ];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Platform &amp; maintenance</Heading1>
          <p>
            Enforcement settings for the console itself: how long a session lasts, how recently a
            password must have been re-entered, and maintenance mode.
          </p>
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice tone="success">Platform settings saved.</Notice> : null}
      {maintenanceModeNotice ? <Notice tone="success">{maintenanceModeNotice}</Notice> : null}
      {settings.loading ? <Loading label="Loading platform settings" /> : null}
      {settings.error ? <Notice tone="error">{settings.error}</Notice> : null}

      {!settings.loading && !settings.error ? (
        <>
          <Card title="Sessions and reauthentication">
            <TextField
              label="Session timeout (minutes)"
              value={value("admin_session_timeout_minutes")}
              disabled={!canEdit}
              onChange={(next) =>
                setDraft((state) => ({ ...state, admin_session_timeout_minutes: next }))
              }
            />
            <TextField
              label="Reauthentication window (minutes)"
              value={value("require_admin_reauth_minutes")}
              disabled={!canEdit}
              onChange={(next) =>
                setDraft((state) => ({ ...state, require_admin_reauth_minutes: next }))
              }
              hint="How recently a password must be re-entered before a sensitive action."
            />
          </Card>

          <Card title="Moderation behaviour">
            <ToggleField
              label="Hide reported content automatically"
              checked={value("content_report_auto_hide") === "true"}
              disabled={!canEdit}
              onChange={(next) =>
                setDraft((state) => ({ ...state, content_report_auto_hide: String(next) }))
              }
            />
            <ToggleField
              label="Reduce-motion safe mode"
              checked={value("reduce_motion_safe_mode") === "true"}
              disabled={!canEdit}
              onChange={(next) =>
                setDraft((state) => ({ ...state, reduce_motion_safe_mode: String(next) }))
              }
            />
          </Card>

          {canEdit ? (
            <Card
              title="Save"
              actions={
                <Button
                  type="button"
                  className="admin-primary"
                  disabled={busy || Object.keys(draft).length === 0}
                  onClick={save}
                >
                  {busy ? "Saving…" : "Save changes"}
                </Button>
              }
            >
              <Empty>Only fields you changed are sent to the server.</Empty>
            </Card>
          ) : null}
        </>
      ) : null}

      <Card
        title="Maintenance mode"
        subtitle="Target the full site, a page, route, or route group. Optional start and end times schedule the active window; use the emergency control below to arm or disarm it."
      >
        {siteSettings.error ? <Notice tone="error">{siteSettings.error}</Notice> : null}
        {siteSettings.loading ? <Loading label="Loading maintenance settings" /> : null}
        {!siteSettings.loading && !siteSettings.error ? (
          <>
            <div className="maintenance-control-summary">
              <StatusIllustration kind="maintenance" />
              <div>
                <h3>{maintenanceEnabled ? "Maintenance is armed" : "Normal access is enabled"}</h3>
                <p>
                  Saved scope:{" "}
                  {site.maintenance_scope === "site" || !site.maintenance_scope
                    ? "Whole site"
                    : String(site.maintenance_route || "No route selected")}
                </p>
                <small>
                  {site.maintenance_ends_at
                    ? "Scheduled end: " + formatDate(String(site.maintenance_ends_at))
                    : "No automatic end scheduled"}{" "}
                  · Admin and sign-in access stay available.
                </small>
              </div>
            </div>
            <div className="admin-form-grid">
              <SelectField
                label="Maintenance scope"
                value={maintenanceValue("maintenance_scope") || "site"}
                options={[
                  { value: "site", label: "Whole site" },
                  { value: "page", label: "Selected page" },
                  { value: "route", label: "Exact route" },
                  { value: "group", label: "Route group" },
                ]}
                disabled={!canEdit || siteSettings.loading}
                onChange={(next) =>
                  setMaintenanceDraft((state) => ({
                    ...state,
                    maintenance_scope: next,
                    maintenance_route:
                      next === "site"
                        ? ""
                        : next === "group"
                          ? maintenanceValue("maintenance_route").endsWith("/*")
                            ? maintenanceValue("maintenance_route")
                            : "/messages/*"
                          : next === "route"
                            ? maintenanceValue("maintenance_route").startsWith("/") &&
                              !maintenanceValue("maintenance_route").includes("*")
                              ? maintenanceValue("maintenance_route")
                              : "/messages"
                            : maintenancePages.some(
                                  (page) => page.value === maintenanceValue("maintenance_route"),
                                )
                              ? maintenanceValue("maintenance_route")
                              : "/home",
                  }))
                }
              />
              {maintenanceValue("maintenance_scope") === "page" ? (
                <SelectField
                  label="Page"
                  value={maintenanceValue("maintenance_route") || "/home"}
                  options={maintenancePages}
                  disabled={!canEdit}
                  onChange={(next) =>
                    setMaintenanceDraft((state) => ({ ...state, maintenance_route: next }))
                  }
                />
              ) : null}
              {maintenanceValue("maintenance_scope") === "route" ||
              maintenanceValue("maintenance_scope") === "group" ? (
                <TextField
                  label={
                    maintenanceValue("maintenance_scope") === "group"
                      ? "Route pattern"
                      : "Exact route"
                  }
                  value={maintenanceValue("maintenance_route")}
                  disabled={!canEdit}
                  onChange={(next) =>
                    setMaintenanceDraft((state) => ({ ...state, maintenance_route: next }))
                  }
                  hint={
                    maintenanceValue("maintenance_scope") === "group"
                      ? "Use a pattern such as /messages/*"
                      : "Use a public path such as /messages"
                  }
                />
              ) : null}
            </div>
            <div className="admin-form-grid">
              <TextField
                label="Scheduled start"
                type="datetime-local"
                value={maintenanceValue("maintenance_starts_at")}
                disabled={!canEdit}
                onChange={(next) =>
                  setMaintenanceDraft((state) => ({
                    ...state,
                    maintenance_starts_at: next,
                  }))
                }
                hint="Leave empty to start immediately when maintenance is enabled."
              />
              <TextField
                label="Scheduled end"
                type="datetime-local"
                value={maintenanceValue("maintenance_ends_at")}
                disabled={!canEdit}
                onChange={(next) =>
                  setMaintenanceDraft((state) => ({
                    ...state,
                    maintenance_ends_at: next,
                  }))
                }
                hint="Leave empty for no automatic end. The public site returns when this time passes."
              />
            </div>
            <input
              ref={mediaInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) uploadMaintenanceMedia(file);
              }}
            />
            <div className="admin-form-grid">
              <TextField
                label="Maintenance image or video"
                value={maintenanceValue("maintenance_animation_url")}
                onChange={() => undefined}
                disabled
                hint="Upload a PNG, JPEG, WebP image or MP4 video (10 MB maximum)."
              />
              {canEdit ? (
                <div className="admin-row-actions">
                  <Button
                    type="button"
                    disabled={busy || uploadingMedia}
                    onClick={() => mediaInput.current?.click()}
                  >
                    {uploadingMedia ? "Uploading…" : "Choose image or video"}
                  </Button>
                </div>
              ) : null}
            </div>
            {maintenanceValue("maintenance_animation_url") ? (
              <Button
                type="button"
                disabled={!canEdit}
                onClick={() =>
                  setMaintenanceDraft((state) => ({
                    ...state,
                    maintenance_animation_url: "",
                  }))
                }
              >
                Remove maintenance media
              </Button>
            ) : null}
            {canEdit ? (
              <div className="admin-row-actions">
                <Button
                  type="button"
                  className="admin-primary"
                  disabled={busy || !maintenanceDirty}
                  onClick={saveMaintenanceSettings}
                >
                  {busy ? "Saving…" : "Save maintenance settings"}
                </Button>
              </div>
            ) : null}
            {maintenanceSaved ? <Notice tone="success">Maintenance settings saved.</Notice> : null}
            <details className="maintenance-admin-preview">
              <summary>Preview visitor maintenance screen</summary>
              <p>
                This preview does not turn maintenance on. Published text and motion settings are
                preserved.
              </p>
              <Maintenance
                preview
                previewPathname={
                  maintenanceValue("maintenance_route").replace(/\/\*$/, "") || "/home"
                }
                previewSettings={{
                  maintenance_scope: (maintenanceValue("maintenance_scope") || "site") as
                    | "site"
                    | "page"
                    | "route"
                    | "group",
                  maintenance_route: maintenanceValue("maintenance_route") || null,
                  maintenance_ends_at:
                    maintenanceValue("maintenance_ends_at") &&
                    Number.isFinite(new Date(maintenanceValue("maintenance_ends_at")).getTime())
                      ? new Date(maintenanceValue("maintenance_ends_at")).toISOString()
                      : null,
                  maintenance_animation_url: maintenanceValue("maintenance_animation_url") || null,
                }}
              />
            </details>
          </>
        ) : null}
        {maintenanceDirty && !maintenanceEnabled ? (
          <Notice>
            Save the scope and schedule before turning maintenance on. The switch always applies the
            saved settings.
          </Notice>
        ) : null}
        <Notice>
          Switching maintenance on or off requires the emergency-mode permission, a recent password
          confirmation, and an audit reason.
        </Notice>
        {!canEmergency ? (
          <Notice>
            Your role can view these settings but does not have permission to activate or deactivate
            maintenance mode.
          </Notice>
        ) : null}
        <div className="admin-row-actions">
          <Button
            type="button"
            className="admin-primary"
            disabled={
              busy ||
              uploadingMedia ||
              (!maintenanceEnabled && maintenanceDirty) ||
              !canEmergency ||
              siteSettings.loading ||
              !!siteSettings.error
            }
            onClick={() => setEmergency(true)}
          >
            {maintenanceEnabled ? "Turn maintenance off" : "Turn maintenance on"}
          </Button>
        </div>
      </Card>

      {emergency ? (
        <ReasonDialog
          title={maintenanceEnabled ? "Turn maintenance mode off?" : "Turn maintenance mode on?"}
          description={
            maintenanceEnabled
              ? "Visitors regain normal access when the updated setting reaches their tab."
              : "Enable maintenance for the saved scope: " +
                (site.maintenance_scope === "site" || !site.maintenance_scope
                  ? "whole site"
                  : String(site.maintenance_route || "selected route")) +
                ". The saved start and end times apply. Admin and sign-in remain available."
          }
          confirmLabel="Confirm"
          busy={busy}
          minimumLength={8}
          onClose={() => setEmergency(false)}
          onConfirm={async (reason) => {
            await guarded(async () => {
              if (!maintenanceEnabled && maintenanceDirty)
                throw new Error("Save the maintenance settings before enabling maintenance.");
              const result = await adminEmergencyMode({
                enabled: !maintenanceEnabled,
                reason,
              });
              if (result.settings.maintenance_mode !== !maintenanceEnabled) {
                throw new Error("The server did not confirm the maintenance mode change.");
              }
              setEmergency(false);
              setError(result.warning ?? null);
              setMaintenanceModeNotice(
                result.warning ??
                  `Maintenance mode turned ${result.settings.maintenance_mode ? "on" : "off"}.`,
              );
              siteSettings.setData({
                settings: {
                  ...(siteSettings.data?.settings ?? {}),
                  maintenance_mode: !maintenanceEnabled,
                },
              });
            }).catch((caught: unknown) => {
              setError(caught instanceof Error ? caught.message : String(caught));
              throw caught;
            });
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

function FeatureFlagsBody() {
  const flags = useResource(() => adminFeatureFlags(), []);
  const canEdit = usePermission("flags.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [draft, setDraft] = useState<Record<string, { enabled: boolean; rollout: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const rows = (flags.data?.flags ?? []) as Record<string, unknown>[];

  const value = (key: string, fallback: { enabled: boolean; rollout: string }) =>
    draft[key] ?? {
      enabled: fallback.enabled,
      rollout: String(fallback.rollout ?? 0),
    };

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Feature flags</Heading1>
          <p>
            A flag only affects the console if the code reads it. The list below also names the
            flags this codebase actually reads.
          </p>
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {flags.loading ? <Loading label="Loading feature flags" /> : null}
      {flags.error ? <Notice tone="error">{flags.error}</Notice> : null}

      {!flags.loading && !flags.error ? (
        <>
          <Card title="Flags" subtitle={`${rows.length} flags.`}>
            {rows.length === 0 ? (
              <Empty>No flags are defined.</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Description</th>
                    <th>State</th>
                    <th>Rollout</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((flag) => {
                    const key = String(flag.key);
                    const current = value(key, {
                      enabled: flag.enabled === true,
                      rollout: String(flag.rollout ?? 0),
                    });
                    return (
                      <tr key={key}>
                        <td>
                          <strong>{key}</strong>
                        </td>
                        <td>{String(flag.description ?? "—")}</td>
                        <td>
                          <Pill tone={current.enabled ? "ok" : "warn"}>
                            {current.enabled ? "on" : "off"}
                          </Pill>
                        </td>
                        <td>{current.rollout}%</td>
                        <td>
                          {canEdit ? (
                            <div className="admin-row-actions">
                              <ToggleField
                                label="Enabled"
                                checked={current.enabled}
                                onChange={(next) =>
                                  setDraft((state) => ({
                                    ...state,
                                    [key]: { ...current, enabled: next },
                                  }))
                                }
                              />
                              <TextField
                                label="Rollout percent"
                                value={current.rollout}
                                onChange={(next) =>
                                  setDraft((state) => ({
                                    ...state,
                                    [key]: { ...current, rollout: next },
                                  }))
                                }
                              />
                              <Button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void guarded(async () => {
                                    setError(null);
                                    await adminPatchFeatureFlag(key, {
                                      enabled: current.enabled,
                                      rollout: Number(current.rollout) || 0,
                                    });
                                    setDraft((state) => {
                                      const next = { ...state };
                                      delete next[key];
                                      return next;
                                    });
                                    flags.reload();
                                  }).catch((caught: unknown) =>
                                    setError(
                                      caught instanceof Error ? caught.message : String(caught),
                                    ),
                                  )
                                }
                              >
                                Save
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          <Card
            title="Flags this codebase reads"
            subtitle="If a flag is not here, nothing changes when you toggle it."
          >
            <Table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Read in</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(flags.data?.consumed ?? {}).map(([key, description]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>{description}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

function AnnouncementsBody() {
  const location = useLocation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const list = useResource(
    () =>
      adminAnnouncements({
        page,
        perPage: 25,
        ...(statusFilter === "all" ? {} : { state: statusFilter }),
        q: search,
      }),
    [page, statusFilter, search],
  );
  const canEdit = usePermission("notifications.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Record<string, unknown> | null>(null);
  const [previewing, setPreviewing] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const rows = (list.data?.announcements ?? []) as Record<string, unknown>[];

  useEffect(() => {
    if (new URLSearchParams(location.search).get("create") !== "1") return;
    navigate(location.pathname, { replace: true });
    if (canEdit) setCreating(true);
  }, [canEdit, location.pathname, location.search, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const statusOf = (announcement: Record<string, unknown>) => {
    if (announcement.state === "archived") return "archived";
    if (announcement.ends_at && new Date(String(announcement.ends_at)).getTime() <= Date.now())
      return "expired";
    if (
      announcement.state === "scheduled" ||
      (announcement.starts_at && new Date(String(announcement.starts_at)).getTime() > Date.now())
    )
      return "scheduled";
    if (announcement.state === "live" || announcement.active === true) return "live";
    return String(announcement.state ?? "draft");
  };

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Announcements</Heading1>
          <p>Create and manage the messages visitors see across VELORI.</p>
        </div>
        <div className="admin-row-actions">
          {canEdit ? (
            <Button
              type="button"
              className="admin-primary"
              onClick={() => {
                setActionError(null);
                setCreating(true);
              }}
            >
              + Create announcement
            </Button>
          ) : null}
          <Button type="button" onClick={list.reload}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="cp-campaign-hero">
        <span aria-hidden="true">▤</span>
        <div>
          <strong>A note worth opening.</strong>
          <p>Send a vintage scroll letter, with precise audience and delivery controls.</p>
        </div>
      </div>
      {list.loading ? <Loading label="Loading announcements" /> : null}
      {list.error ? <Notice tone="error">{list.error}</Notice> : null}
      {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      {actionSuccess ? <Notice tone="success">{actionSuccess}</Notice> : null}

      {!list.loading && !list.error ? (
        <>
          <div className="admin-metrics-grid">
            {(["total", "live", "scheduled", "draft", "paused", "expired"] as const).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  className="admin-metric"
                  aria-pressed={statusFilter === (status === "total" ? "all" : status)}
                  onClick={() => {
                    setPage(1);
                    setStatusFilter(status === "total" ? "all" : status);
                  }}
                >
                  <span className="admin-muted">
                    {status === "total"
                      ? "ALL"
                      : status === "expired"
                        ? "PAST END DATE"
                        : status.toUpperCase()}
                  </span>
                  <strong>
                    {list.data?.counts?.[status] ??
                      (status === "total" ? (list.data?.total ?? 0) : 0)}
                  </strong>
                </button>
              ),
            )}
          </div>
          <div className="admin-row-actions admin-toolbar" style={{ margin: "16px 0" }}>
            <TextField
              label="Search announcements"
              value={searchInput}
              onChange={setSearchInput}
              hint="Search by title, internal label or ID."
            />
            <SelectField
              label="Status"
              value={statusFilter}
              options={[
                { value: "all", label: "All statuses" },
                { value: "draft", label: "Draft" },
                { value: "scheduled", label: "Scheduled" },
                { value: "live", label: "Live" },
                { value: "paused", label: "Paused" },
                { value: "expired", label: "Expired" },
                { value: "archived", label: "Archived" },
              ]}
              onChange={(value) => {
                setPage(1);
                setStatusFilter(value);
              }}
            />
          </div>
          <Card title="Recent announcements" subtitle={`${list.data?.total ?? 0} total messages.`}>
            {rows.length === 0 ? (
              <Empty>
                {search || statusFilter !== "all"
                  ? "No announcements match that filter."
                  : "No announcements have been created yet."}
              </Empty>
            ) : (
              <div className="admin-resource-grid">
                {rows.map((announcement) => {
                  const state = statusOf(announcement);
                  const audience = String(announcement.audience ?? "all");
                  const preview = String(announcement.message ?? "");
                  const trimmedPreview =
                    preview.length > 120 ? `${preview.slice(0, 117).trim()}…` : preview;

                  return (
                    <article key={String(announcement.id)} className="admin-resource-card">
                      <div className="admin-resource-top">
                        <span className={`admin-status-pill tone-${state}`}>
                          {state.charAt(0).toUpperCase() + state.slice(1)}
                        </span>
                        <span className="admin-resource-date">
                          {announcement.starts_at || announcement.ends_at
                            ? `${formatDate(announcement.starts_at as string)}${announcement.ends_at ? ` – ${formatDate(announcement.ends_at as string)}` : ""}`
                            : "No date"}
                        </span>
                      </div>
                      <h3>{String(announcement.title || "Untitled announcement")}</h3>
                      <p>{trimmedPreview || "No message added yet."}</p>
                      <div className="admin-resource-meta">
                        <span>{audience === "all" ? "Everyone" : audience}</span>
                        <span>{announcement.display_mode === "modal" ? "Popup" : "Banner"}</span>
                        <span>Updated {formatDate(announcement.updated_at as string)}</span>
                      </div>

                      {canEdit ? (
                        <div className="admin-resource-actions">
                          <Button type="button" onClick={() => setPreviewing(announcement)}>
                            Preview
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setActionError(null);
                              setEditing(announcement);
                            }}
                          >
                            Edit
                          </Button>
                          <Button type="button" onClick={() => setHistory(announcement)}>
                            History
                          </Button>
                          {state !== "archived" ? (
                            <Button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void guarded(async () => {
                                  await adminCreateAnnouncement({
                                    title:
                                      `${String(announcement.title || "Announcement")} copy`.slice(
                                        0,
                                        120,
                                      ),
                                    message: String(announcement.message ?? ""),
                                    internal_name:
                                      `${String(announcement.internal_name || announcement.title || "Announcement")} copy`.slice(
                                        0,
                                        120,
                                      ),
                                    priority: announcement.priority ?? "normal",
                                    audience: announcement.audience ?? "all",
                                    display_mode: announcement.display_mode ?? "modal",
                                    media_type: announcement.media_type ?? "none",
                                    media_url: announcement.media_url ?? "",
                                    custom_html: announcement.custom_html ?? "",
                                    custom_css: announcement.custom_css ?? "",
                                    media_alt: announcement.media_alt ?? "",
                                    poster_url: announcement.poster_url ?? "",
                                    cta_label: announcement.cta_label ?? "",
                                    action_type: announcement.action_type ?? "none",
                                    link: announcement.link ?? "",
                                    target_route: announcement.target_route ?? "",
                                    target_routes: announcement.target_routes ?? [],
                                    frequency_mode:
                                      announcement.frequency_mode ?? "once_per_session",
                                    max_show_count: announcement.max_show_count ?? 1,
                                    delay_seconds: announcement.delay_seconds ?? 0,
                                    dismissible: announcement.dismissible !== false,
                                    starts_at: new Date().toISOString(),
                                    ends_at: null,
                                    state: "draft",
                                  });
                                  setActionSuccess("A copy was saved as a draft.");
                                  list.reload();
                                }).catch((caught: unknown) =>
                                  setActionError(
                                    caught instanceof Error ? caught.message : String(caught),
                                  ),
                                )
                              }
                            >
                              Duplicate
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void guarded(async () => {
                                if (statusOf(announcement) === "live" && announcement.draft_payload)
                                  await adminPublishAnnouncement(
                                    String(announcement.id),
                                    Number(announcement.version ?? 1),
                                  );
                                else if (statusOf(announcement) === "live")
                                  await adminPatchAnnouncement(String(announcement.id), {
                                    state: "paused",
                                  });
                                else if (statusOf(announcement) === "paused")
                                  await adminPatchAnnouncement(String(announcement.id), {
                                    state: "live",
                                  });
                                else
                                  await adminPublishAnnouncement(
                                    String(announcement.id),
                                    Number(announcement.version ?? 1),
                                  );
                                list.reload();
                                setActionSuccess(
                                  statusOf(announcement) === "live"
                                    ? announcement.draft_payload
                                      ? "Announcement version published."
                                      : "Announcement paused."
                                    : statusOf(announcement) === "paused"
                                      ? "Announcement resumed."
                                      : "Announcement published.",
                                );
                              }).catch((caught: unknown) =>
                                setActionError(
                                  caught instanceof Error ? caught.message : String(caught),
                                ),
                              )
                            }
                          >
                            {statusOf(announcement) === "live"
                              ? announcement.draft_payload
                                ? "Publish updates"
                                : "Pause"
                              : statusOf(announcement) === "paused"
                                ? "Resume"
                                : "Publish"}
                          </Button>
                          <Button
                            type="button"
                            onClick={() =>
                              void guarded(async () => {
                                await adminPatchAnnouncement(String(announcement.id), {
                                  state: "archived",
                                });
                                list.reload();
                              }).catch((caught: unknown) =>
                                setActionError(
                                  caught instanceof Error ? caught.message : String(caught),
                                ),
                              )
                            }
                          >
                            Archive
                          </Button>
                          <Button type="button" onClick={() => setDeleting(announcement)}>
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
          <Pager page={page} perPage={25} total={list.data?.total} onPage={setPage} />
        </>
      ) : null}

      {creating ? (
        <AnnouncementEditor
          busy={busy}
          error={actionError}
          onClose={() => setCreating(false)}
          onSave={async (payload, publish) => {
            await guarded(async () => {
              const result = await adminCreateAnnouncement(payload);
              if (publish) {
                const created = result.announcement;
                await adminPublishAnnouncement(String(created.id), Number(created.version ?? 1));
              }
              setCreating(false);
              setActionSuccess(
                publish ? "Announcement published." : "Announcement saved as a draft.",
              );
              list.reload();
            }).catch((caught: unknown) =>
              setActionError(caught instanceof Error ? caught.message : String(caught)),
            );
          }}
        />
      ) : null}

      {editing ? (
        <AnnouncementEditor
          key={String(editing.id)}
          initial={editing}
          busy={busy}
          error={actionError}
          onClose={() => setEditing(null)}
          onSave={async (payload, publish) => {
            await guarded(async () => {
              await adminPatchAnnouncement(String(editing.id), payload);
              if (publish) {
                await adminPublishAnnouncement(String(editing.id), Number(editing.version ?? 1));
              }
              setEditing(null);
              setActionSuccess(
                publish ? "Announcement changes published." : "Announcement saved as a draft.",
              );
              list.reload();
            }).catch((caught: unknown) =>
              setActionError(caught instanceof Error ? caught.message : String(caught)),
            );
          }}
        />
      ) : null}

      {history ? (
        <AnnouncementHistory
          announcement={history}
          canEdit={canEdit}
          onClose={() => setHistory(null)}
          onRestored={() => {
            setHistory(null);
            list.reload();
            setActionSuccess("Previous version restored as a draft.");
          }}
          onError={(message) => setActionError(message)}
        />
      ) : null}

      {previewing ? (
        <AnnouncementPreviewDialog announcement={previewing} onClose={() => setPreviewing(null)} />
      ) : null}

      {deleting ? (
        <ReasonDialog
          title="Delete this announcement?"
          description="It disappears from every visitor's view immediately."
          confirmLabel="Delete"
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={async (reason) => {
            await guarded(async () => {
              await adminDeleteAnnouncement(String(deleting.id), reason);
              setDeleting(null);
              list.reload();
            }).catch((caught: unknown) =>
              setActionError(caught instanceof Error ? caught.message : String(caught)),
            );
          }}
        />
      ) : null}
    </>
  );
}

function AnnouncementPreviewDialog({
  announcement,
  onClose,
}: {
  announcement: Record<string, unknown>;
  onClose: () => void;
}) {
  const [replay, setReplay] = useState(0);
  const data = {
    ...announcement,
    ...(announcement.draft_payload && typeof announcement.draft_payload === "object"
      ? announcement.draft_payload
      : {}),
  };
  return (
    <Dialog
      title="Announcement preview"
      description="The same design visitors see. Previewing does not publish or record an impression."
      onClose={onClose}
      className="admin-campaign-preview-dialog"
    >
      <button type="button" className="cp-replay" onClick={() => setReplay((value) => value + 1)}>
        Replay scroll animation
      </button>
      <div className="cp-preview-stage">
        <AnnouncementPaper
          key={String(data.id) + replay}
          item={data as unknown as AnnouncementCreative}
          preview
        />
      </div>
    </Dialog>
  );
}

function AnnouncementHistory({
  announcement,
  canEdit,
  onClose,
  onRestored,
  onError,
}: {
  announcement: Record<string, unknown>;
  canEdit: boolean;
  onClose: () => void;
  onRestored: () => void;
  onError: (message: string) => void;
}) {
  const versions = useResource(
    () => adminAnnouncementVersions(String(announcement.id)),
    [announcement.id],
  );
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  return (
    <Dialog
      title={`Version history · ${String(announcement.title ?? "Announcement")}`}
      description="Restoring a version creates a private draft; publish it to deliver those contents again."
      onClose={onClose}
    >
      {versions.loading ? <Loading label="Loading version history" /> : null}
      {versions.error ? <Notice tone="error">{versions.error}</Notice> : null}
      {!versions.loading && !versions.error && !versions.data?.versions.length ? (
        <Empty>No published versions yet.</Empty>
      ) : null}
      {versions.data?.versions.map((version) => (
        <Card
          key={String(version.id)}
          title={`Version ${String(version.version)}`}
          subtitle={formatDate(version.created_at as string)}
        >
          <p>{String((version.snapshot as Record<string, unknown>)?.title ?? "")}</p>
          {canEdit ? (
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                void guarded(async () => {
                  await adminRestoreAnnouncementVersion(
                    String(announcement.id),
                    Number(version.version),
                  );
                  onRestored();
                }).catch((caught: unknown) =>
                  onError(caught instanceof Error ? caught.message : String(caught)),
                )
              }
            >
              Restore as draft
            </Button>
          ) : null}
        </Card>
      ))}
    </Dialog>
  );
}

export function AnnouncementEditor({
  initial,
  busy,
  error,
  onClose,
  onSave,
}: {
  initial?: Record<string, unknown>;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>, publish?: boolean) => void | Promise<void>;
}) {
  const formInitial =
    initial?.draft_payload && typeof initial.draft_payload === "object"
      ? { ...initial, ...(initial.draft_payload as Record<string, unknown>) }
      : initial;
  const [title, setTitle] = useState(String(formInitial?.title ?? ""));
  const [message, setMessage] = useState(String(formInitial?.message ?? ""));
  const [contentFormat, setContentFormat] = useState<"standard" | "custom_html">(
    formInitial?.custom_html ? "custom_html" : "standard",
  );
  const [customHtml, setCustomHtml] = useState(String(formInitial?.custom_html ?? ""));
  const [customCss, setCustomCss] = useState(String(formInitial?.custom_css ?? ""));
  const [internalName, setInternalName] = useState(String(formInitial?.internal_name ?? ""));
  const [priority, setPriority] = useState(String(formInitial?.priority ?? "normal"));
  const [audience, setAudience] = useState(String(formInitial?.audience ?? "all"));
  const [displayMode, setDisplayMode] = useState(String(formInitial?.display_mode ?? "modal"));
  const [mediaType, setMediaType] = useState(String(formInitial?.media_type ?? "none"));
  const [mediaUrl, setMediaUrl] = useState(String(formInitial?.media_url ?? ""));
  const [mediaAlt, setMediaAlt] = useState(String(formInitial?.media_alt ?? ""));
  const [posterUrl, setPosterUrl] = useState(String(formInitial?.poster_url ?? ""));
  const [ctaLabel, setCtaLabel] = useState(String(formInitial?.cta_label ?? ""));
  const [actionType, setActionType] = useState(String(formInitial?.action_type ?? "none"));
  const [link, setLink] = useState(String(formInitial?.link ?? ""));
  const [targetRoute, setTargetRoute] = useState(String(formInitial?.target_route ?? ""));
  const [targetRoutes, setTargetRoutes] = useState(
    Array.isArray(formInitial?.target_routes) ? formInitial.target_routes.join(", ") : "",
  );
  const [frequencyMode, setFrequencyMode] = useState(
    String(formInitial?.frequency_mode ?? "once_per_session"),
  );
  const [maxShowCount, setMaxShowCount] = useState(String(formInitial?.max_show_count ?? "1"));
  const [delaySeconds, setDelaySeconds] = useState(String(formInitial?.delay_seconds ?? "0"));
  const [dismissible, setDismissible] = useState(formInitial?.dismissible !== false);
  const [startsAt, setStartsAt] = useState(localDateTimeInput(formInitial?.starts_at));
  const [endsAt, setEndsAt] = useState(localDateTimeInput(formInitial?.ends_at));
  const [uploading, setUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<
    "content" | "appearance" | "action" | "audience" | "schedule" | "review"
  >("content");
  const [customRouteMode, setCustomRouteMode] = useState(
    Boolean(
      formInitial?.target_route &&
      !["/", "/home", "/explore", "/people", "/reels", "/stories", "/groups"].includes(
        String(formInitial.target_route),
      ),
    ),
  );
  const [scheduleLater, setScheduleLater] = useState(
    Boolean(
      formInitial?.starts_at && new Date(String(formInitial.starts_at)).getTime() > Date.now(),
    ),
  );
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [mediaFilename, setMediaFilename] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [previewSize, setPreviewSize] = useState("desktop");
  const [validationNotice, setValidationNotice] = useState("");
  const validAnnouncementSchedule =
    !scheduleLater ||
    (Boolean(startsAt) &&
      Number.isFinite(Date.parse(startsAt)) &&
      new Date(startsAt).getTime() > Date.now() &&
      (!endsAt || (Number.isFinite(Date.parse(endsAt)) && new Date(endsAt) > new Date(startsAt))));
  const announcementDraftBlockReason = busy
    ? "Saving your announcement…"
    : uploading
      ? "Wait for the media upload to finish."
      : !title.trim()
        ? "Add a title before saving."
        : !validAnnouncementSchedule
          ? "Choose a future start time and an end time after it."
          : "";
  const invalidAction =
    actionType !== "none" &&
    (!safeCampaignUrl(link) ||
      (actionType === "internal" && !link.startsWith("/")) ||
      (actionType === "external" && !link.startsWith("https://")));
  const announcementPublishBlockReason =
    announcementDraftBlockReason ||
    (invalidAction
      ? "Choose a valid destination for your announcement button."
      : contentFormat === "standard" && !message.trim()
        ? "Add a message before publishing."
        : contentFormat === "custom_html" && !customHtml.trim()
          ? "Add custom HTML before publishing."
          : contentFormat === "standard" && mediaType !== "none" && (!mediaUrl || !mediaAlt.trim())
            ? "Finish the media upload and add its description before publishing."
            : "");

  const previewTitle = title.trim() || "Your announcement title";
  const previewMessage = message.trim() || "Write the message people will see here.";
  const steps = [
    ["content", "1 · Content"],
    ["appearance", "2 · Appearance"],
    ["action", "3 · Action"],
    ["audience", "4 · Audience"],
    ["schedule", "5 · Schedule"],
    ["review", "6 · Review"],
  ] as const;
  const makePayload = () => ({
    title: title.trim(),
    message: message.trim() || title.trim(),
    custom_html: contentFormat === "custom_html" ? customHtml : "",
    custom_css: contentFormat === "custom_html" ? customCss : "",
    internal_name: internalName.trim() || title.trim(),
    priority,
    audience,
    display_mode: displayMode,
    media_type: contentFormat === "custom_html" ? "none" : mediaType,
    media_url: contentFormat === "custom_html" || mediaType === "none" ? "" : mediaUrl.trim(),
    media_alt: mediaAlt.trim(),
    poster_url: posterUrl.trim(),
    cta_label: ctaLabel.trim(),
    action_type: actionType,
    link: link.trim(),
    target_route: targetRoute.trim(),
    target_routes: targetRoutes
      .split(",")
      .map((route) => route.trim())
      .filter(Boolean),
    frequency_mode: frequencyMode,
    max_show_count: Number(maxShowCount) || 1,
    delay_seconds: Number(delaySeconds) || 0,
    dismissible,
    starts_at:
      scheduleLater && startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
    ends_at: scheduleLater && endsAt ? new Date(endsAt).toISOString() : null,
    state:
      scheduleLater && startsAt
        ? "scheduled"
        : initial?.state === "live"
          ? "live"
          : (initial?.state ?? "draft"),
  });

  return (
    <Dialog
      title={initial ? "Edit announcement" : "Create announcement"}
      description="Write your message, check the preview, then save it as a draft or publish it."
      onClose={onClose}
      className="admin-resource-editor-dialog admin-campaign-editor cp-announcement-editor"
      dismissOnBackdrop={false}
      actions={
        <>
          <Button
            type="button"
            disabled={busy || uploading}
            onClick={() => {
              if (announcementDraftBlockReason) {
                setValidationNotice(announcementDraftBlockReason);
                return;
              }
              setValidationNotice("");
              void onSave(makePayload(), false);
            }}
          >
            Save draft
          </Button>
          <Button
            type="button"
            className="admin-primary"
            disabled={busy || uploading}
            onClick={() => {
              if (announcementPublishBlockReason) {
                setValidationNotice(announcementPublishBlockReason);
                return;
              }
              setValidationNotice("");
              setPendingPayload(makePayload());
              setConfirmPublish(true);
            }}
          >
            {scheduleLater
              ? "Schedule announcement"
              : initial?.state === "live"
                ? "Publish changes"
                : "Publish announcement"}
          </Button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {mediaError ? <Notice tone="error">{mediaError}</Notice> : null}
      {validationNotice ||
      (busy ? "Saving announcement…" : uploading ? "Wait for the media upload to finish." : "") ? (
        <p className="admin-inline-warning" role="alert">
          {validationNotice ||
            (busy ? "Saving announcement…" : "Wait for the media upload to finish.")}
        </p>
      ) : null}
      <div className="admin-editor-grid">
        <div className="admin-editor-column">
          <nav className="admin-editor-steps" aria-label="Announcement setup steps">
            {steps.map(([step, label]) => (
              <button
                key={step}
                type="button"
                aria-current={activeStep === step ? "step" : undefined}
                className={activeStep === step ? "is-active" : ""}
                onClick={() => setActiveStep(step)}
              >
                {label}
              </button>
            ))}
          </nav>

          {activeStep === "content" ? (
            <div className="admin-field-section">
              <h3>What are you announcing?</h3>
              <TextField label="Title" value={title} onChange={setTitle} maxLength={120} />
              <fieldset className="admin-choice-fieldset">
                <legend>Content format</legend>
                <div className="admin-choice-grid">
                  {[
                    {
                      id: "standard",
                      title: "Standard content",
                      description: "Text with optional image or video.",
                    },
                    {
                      id: "custom_html",
                      title: "Custom HTML + CSS",
                      description: "Build a sandboxed custom announcement.",
                    },
                  ].map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      className={`admin-choice-card${contentFormat === choice.id ? " is-selected" : ""}`}
                      aria-pressed={contentFormat === choice.id}
                      onClick={() => setContentFormat(choice.id as "standard" | "custom_html")}
                    >
                      <strong>{choice.title}</strong>
                      <span>{choice.description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              {contentFormat === "standard" ? (
                <>
                  <AreaField label="Message" value={message} onChange={setMessage} rows={4} />
                  <fieldset className="admin-choice-fieldset">
                    <legend>Media</legend>
                    <div className="admin-choice-grid">
                      {[
                        { id: "none", title: "Text only", description: "A simple message." },
                        { id: "image", title: "Image + text", description: "Add a still image." },
                        { id: "video", title: "Video + text", description: "Add an MP4 video." },
                      ].map((choice) => (
                        <button
                          key={choice.id}
                          type="button"
                          className={`admin-choice-card${mediaType === choice.id ? " is-selected" : ""}`}
                          aria-pressed={mediaType === choice.id}
                          onClick={() => setMediaType(choice.id)}
                        >
                          <strong>{choice.title}</strong>
                          <span>{choice.description}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {mediaType !== "none" ? (
                    <div className="admin-upload-card">
                      {mediaUrl ? (
                        mediaType === "video" ? (
                          <video
                            className="admin-preview-media"
                            src={mediaUrl}
                            controls
                            playsInline
                          />
                        ) : (
                          <img
                            className="admin-preview-media"
                            src={mediaUrl}
                            alt={mediaAlt || "Announcement media preview"}
                          />
                        )
                      ) : null}
                      <label className="admin-field">
                        <span>{mediaUrl ? "Replace media" : "Upload media"}</span>
                        <input
                          aria-label="Upload announcement image or video"
                          type="file"
                          accept={
                            mediaType === "image" ? "image/png,image/jpeg,image/webp" : "video/mp4"
                          }
                          disabled={uploading || busy}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = "";
                            if (!file) return;
                            setMediaFilename(file.name);
                            setUploading(true);
                            setMediaError(null);
                            void adminUploadAnnouncementMedia(file)
                              .then((asset) => {
                                setMediaUrl(asset.url);
                                setMediaType(asset.type === "video/mp4" ? "video" : "image");
                              })
                              .catch((caught: unknown) =>
                                setMediaError(
                                  caught instanceof Error
                                    ? caught.message
                                    : "Media upload failed. Please try again.",
                                ),
                              )
                              .finally(() => setUploading(false));
                          }}
                        />
                        <small>
                          {uploading
                            ? "Uploading…"
                            : mediaFilename || "PNG, JPEG, WebP or MP4 · up to 10 MB"}
                        </small>
                      </label>
                      {mediaUrl ? (
                        <Button
                          type="button"
                          onClick={() => {
                            setMediaUrl("");
                            setMediaFilename("");
                          }}
                        >
                          Remove media
                        </Button>
                      ) : null}
                      <TextField
                        label={
                          mediaType === "image"
                            ? "Image description (optional)"
                            : "Video description (optional)"
                        }
                        value={mediaAlt}
                        onChange={setMediaAlt}
                        hint="Describe the media for people using screen readers."
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="admin-custom-code-fields">
                  <p className="admin-muted">
                    Scripts are removed on save. CSS runs inside a sandboxed preview and cannot load
                    remote resources.
                  </p>
                  <AreaField
                    label="Custom HTML"
                    value={customHtml}
                    onChange={setCustomHtml}
                    rows={10}
                    hint="Markup only. Do not include script tags or a full HTML document."
                  />
                  <AreaField
                    label="Custom CSS"
                    value={customCss}
                    onChange={setCustomCss}
                    rows={8}
                    hint="CSS only. HTTPS imports and resource URLs are allowed; the preview sandbox blocks scripts and connections."
                  />
                </div>
              )}
            </div>
          ) : null}

          {activeStep === "appearance" ? (
            <div className="admin-field-section">
              <h3>How should it appear?</h3>
              <div className="admin-choice-grid">
                {[
                  { id: "modal", title: "Popup", description: "A centered announcement." },
                  { id: "banner", title: "Banner", description: "A message across the page." },
                ].map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className={`admin-choice-card${displayMode === choice.id ? " is-selected" : ""}`}
                    aria-pressed={displayMode === choice.id}
                    onClick={() => setDisplayMode(choice.id)}
                  >
                    <strong>{choice.title}</strong>
                    <span>{choice.description}</span>
                  </button>
                ))}
              </div>
              <ToggleField
                label="Can people close this announcement?"
                checked={dismissible}
                onChange={setDismissible}
              />
            </div>
          ) : null}

          {activeStep === "action" ? (
            <div className="admin-field-section">
              <h3>What should happen when someone clicks the button?</h3>
              <SelectField
                label="After the click"
                value={actionType}
                options={[
                  { value: "none", label: "No button" },
                  { value: "internal", label: "Open a VELORI page" },
                  { value: "external", label: "Open an external website" },
                ]}
                onChange={setActionType}
              />
              {actionType === "internal" ? (
                <SelectField
                  label="VELORI page"
                  value={link}
                  options={[
                    { value: "/home", label: "Home" },
                    { value: "/explore", label: "Explore" },
                    { value: "/people", label: "Discover people" },
                    { value: "/reels", label: "Reels" },
                    { value: "/stories", label: "Stories" },
                    { value: "/groups", label: "Groups" },
                    { value: "/notifications", label: "Notifications" },
                    ...(link &&
                    ![
                      "/home",
                      "/explore",
                      "/people",
                      "/reels",
                      "/stories",
                      "/groups",
                      "/notifications",
                    ].includes(link)
                      ? [{ value: link, label: "Current page" }]
                      : []),
                  ]}
                  onChange={setLink}
                />
              ) : null}
              {actionType === "external" ? (
                <TextField
                  label="Website address"
                  value={link}
                  onChange={setLink}
                  hint="Use a secure https:// address."
                />
              ) : null}
              {actionType !== "none" ? (
                <TextField
                  label="Button label (optional)"
                  value={ctaLabel}
                  onChange={setCtaLabel}
                  hint="For example: Learn more, Open, or View update."
                />
              ) : null}
            </div>
          ) : null}

          {activeStep === "audience" ? (
            <div className="admin-field-section">
              <h3>Who should see this?</h3>
              <div className="admin-choice-card is-selected">
                <strong>Everyone</strong>
                <span>Show this announcement to all eligible visitors.</span>
              </div>
            </div>
          ) : null}

          {activeStep === "schedule" ? (
            <div className="admin-field-section">
              <h3>When should it appear?</h3>
              <div className="admin-choice-grid">
                {[
                  {
                    value: false,
                    title: "Publish now",
                    description: "Start showing it as soon as it is published.",
                  },
                  {
                    value: true,
                    title: "Schedule for later",
                    description: "Choose when it should start.",
                  },
                ].map((choice) => (
                  <button
                    key={String(choice.value)}
                    type="button"
                    className={`admin-choice-card${scheduleLater === choice.value ? " is-selected" : ""}`}
                    aria-pressed={scheduleLater === choice.value}
                    onClick={() => setScheduleLater(choice.value)}
                  >
                    <strong>{choice.title}</strong>
                    <span>{choice.description}</span>
                  </button>
                ))}
              </div>
              {scheduleLater ? (
                <>
                  <TextField
                    label="Start date and time"
                    type="datetime-local"
                    value={startsAt}
                    onChange={setStartsAt}
                  />
                  <TextField
                    label="End date (optional)"
                    type="datetime-local"
                    value={endsAt}
                    onChange={setEndsAt}
                  />
                  <p className="admin-muted">
                    Times use your local timezone (
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}).
                  </p>
                  {!validAnnouncementSchedule ? (
                    <p className="admin-inline-warning" role="status">
                      Choose a future start time. If you set an end time, it must be after the
                      start.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {activeStep === "review" ? (
            <div className="admin-field-section">
              <h3>Review announcement</h3>
              <dl className="admin-review-list">
                <div>
                  <dt>Content</dt>
                  <dd>
                    {previewTitle} · {previewMessage}
                  </dd>
                </div>
                <div>
                  <dt>Appearance</dt>
                  <dd>{displayMode === "modal" ? "Popup" : "Banner"}</dd>
                </div>
                <div>
                  <dt>Audience</dt>
                  <dd>Everyone</dd>
                </div>
                <div>
                  <dt>Schedule</dt>
                  <dd>
                    {scheduleLater
                      ? startsAt
                        ? `Starts ${startsAt.replace("T", " ")}`
                        : "Choose a start date and time"
                      : "Starts immediately"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <details className="admin-field-section admin-advanced-settings">
            <summary>Advanced settings</summary>
            <p className="admin-muted">
              Additional controls for how and where this announcement appears.
            </p>
            <TextField
              label="Internal name"
              value={internalName}
              onChange={setInternalName}
              hint="Only administrators see this. Use it to find the announcement later."
            />
            <SelectField
              label="Delivery priority"
              value={priority}
              options={[
                { value: "low", label: "Low" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
              ]}
              onChange={setPriority}
            />
            <SelectField
              label="Where should it appear?"
              value={customRouteMode ? "custom" : targetRoute || ""}
              options={[
                { value: "", label: "Everywhere" },
                { value: "/home", label: "Home" },
                { value: "/explore", label: "Explore" },
                { value: "/people", label: "People" },
                { value: "/reels", label: "Reels" },
                { value: "/stories", label: "Stories" },
                { value: "/groups", label: "Groups" },
                { value: "custom", label: "Specific page path" },
              ]}
              onChange={(value) => {
                if (value === "custom") {
                  setCustomRouteMode(true);
                  setTargetRoute("");
                } else {
                  setCustomRouteMode(false);
                  setTargetRoute(value);
                }
              }}
            />
            {customRouteMode ? (
              <TextField
                label="Page path"
                value={targetRoute}
                onChange={setTargetRoute}
                hint="Enter a path beginning with /, for example /profile/name."
              />
            ) : null}
            <TextField
              label="Additional page paths"
              value={targetRoutes}
              onChange={setTargetRoutes}
              hint="Optional, comma-separated paths."
            />
            <SelectField
              label="How often should people see it?"
              value={frequencyMode}
              options={[
                { value: "every_refresh", label: "Every refresh" },
                { value: "once_per_session", label: "Once per session" },
                { value: "once_per_day", label: "Once per day" },
                { value: "once_total", label: "Once only" },
              ]}
              onChange={setFrequencyMode}
            />
            <TextField
              label="Lifetime display cap (2 or more)"
              hint="1 means no extra cap; Once only always limits delivery to one view."
              type="number"
              value={maxShowCount}
              onChange={setMaxShowCount}
            />
            <TextField
              label="Wait after page opens (seconds)"
              type="number"
              value={delaySeconds}
              onChange={setDelaySeconds}
            />
            {mediaType === "video" ? (
              <TextField
                label="Video preview image URL (optional)"
                value={posterUrl}
                onChange={setPosterUrl}
              />
            ) : null}
            <TextField
              label="Media URL (advanced)"
              value={mediaUrl}
              onChange={setMediaUrl}
              hint="Use only if media was uploaded elsewhere."
            />
          </details>
        </div>

        <aside className="admin-preview-column cp-campaign-preview">
          <header>
            <span>01 / LIVE EXPERIENCE</span>
            <button type="button" onClick={() => setPreviewKey((x) => x + 1)}>
              Replay unroll ↻
            </button>
          </header>
          <div className="admin-preview-size" role="group" aria-label="Preview size">
            {["desktop", "tablet", "mobile"].map((size) => (
              <button
                key={size}
                aria-pressed={previewSize === size}
                onClick={() => setPreviewSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
          <div className={"cp-preview-stage preview-" + previewSize}>
            <AnnouncementPaper
              key={previewKey}
              preview
              item={{
                title: previewTitle,
                message: previewMessage,
                priority,
                display_mode: displayMode,
                dismissible,
                custom_html: contentFormat === "custom_html" ? customHtml : "",
                custom_css: customCss,
                media_type: mediaType,
                media_url: mediaUrl,
                media_alt: mediaAlt,
                poster_url: posterUrl,
                action_type: actionType,
                link,
                cta_label: ctaLabel,
              }}
            />
          </div>
          <p>What your community will see. Changes stay private until you publish.</p>
        </aside>
      </div>
      {confirmPublish ? (
        <Dialog
          title={scheduleLater ? "Schedule announcement?" : "Publish announcement?"}
          description="Once published, this announcement may appear to eligible visitors according to its schedule and display settings."
          onClose={() => setConfirmPublish(false)}
          actions={
            <Button
              type="button"
              className="admin-primary"
              disabled={busy || !pendingPayload}
              onClick={() => {
                setConfirmPublish(false);
                if (pendingPayload) void onSave(pendingPayload, true);
              }}
            >
              {scheduleLater ? "Schedule announcement" : "Publish announcement"}
            </Button>
          }
        />
      ) : null}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function NotificationsBody() {
  const list = useResource(() => adminNotifications({ page: 1, perPage: PER_PAGE }), []);
  const canSend = usePermission("notifications.send");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [composing, setComposing] = useState(false);
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const rows = (list.data?.notifications ?? []) as Record<string, unknown>[];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Notifications</Heading1>
          <p>
            Messages pushed into the in-app notification feed. Sends are irreversible: recipients
            cannot unsend, only read.
          </p>
        </div>
        <div className="admin-row-actions">
          {canSend ? (
            <Button type="button" className="admin-primary" onClick={() => setComposing(true)}>
              Compose
            </Button>
          ) : null}
          <Button type="button" onClick={list.reload}>
            Refresh
          </Button>
        </div>
      </div>

      {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      {actionSuccess ? <Notice tone="success">{actionSuccess}</Notice> : null}
      {list.loading ? <Loading label="Loading notifications" /> : null}
      {list.error ? <Notice tone="error">{list.error}</Notice> : null}

      {!list.loading && !list.error ? (
        <Card title="Sent notifications" subtitle={`${list.data?.total ?? 0} records.`}>
          {rows.length === 0 ? (
            <Empty>No notifications have been sent.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Audience</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((notification) => (
                  <tr key={String(notification.id)}>
                    <td>{String(notification.title ?? "")}</td>
                    <td>
                      {notification.audience === "account_types"
                        ? `Account types: ${Array.isArray(notification.audience_account_types) ? notification.audience_account_types.join(", ") : ""}`
                        : String(notification.audience ?? "all") === "all"
                          ? "All accounts"
                          : String(notification.audience ?? "")}
                    </td>
                    <td>{String(notification.recipient_count ?? 0)}</td>
                    <td>
                      {notification.sent_at
                        ? formatDate(notification.sent_at as string)
                        : "Not sent"}
                    </td>
                    <td>
                      <Pill tone={notification.sent_at ? "ok" : "warn"}>
                        {notification.sent_at ? "delivered" : "queued"}
                      </Pill>
                    </td>
                    <td>
                      <Button type="button" onClick={() => setDeleting(notification)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pager page={1} perPage={PER_PAGE} total={list.data?.total} onPage={() => undefined} />
        </Card>
      ) : null}

      {composing ? (
        <NotificationComposer
          busy={busy}
          onClose={() => setComposing(false)}
          onSave={async (payload) => {
            setActionError(null);
            setActionSuccess(null);
            await guarded(async () => {
              const result = await adminCreateNotification(payload);
              setComposing(false);
              setActionSuccess(
                `Notification delivered to ${result.recipientCount} account${result.recipientCount === 1 ? "" : "s"}.`,
              );
              list.reload();
            }).catch((error: unknown) => {
              setActionError(
                error instanceof Error ? error.message : "The notification could not be delivered.",
              );
            });
          }}
        />
      ) : null}

      {deleting ? (
        <ReasonDialog
          title="Delete this notification?"
          description="It is removed from every recipient's feed."
          confirmLabel="Delete"
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={async (reason) => {
            await guarded(async () => {
              await adminDeleteNotification(String(deleting.id), reason);
              setDeleting(null);
              list.reload();
            }).catch(() => undefined);
          }}
        />
      ) : null}
    </>
  );
}

function NotificationComposer({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [accountTypes, setAccountTypes] = useState<string[]>([]);

  return (
    <Dialog
      title="Compose a notification"
      description="Immediate notifications appear in each eligible account’s notification timeline."
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            className="admin-primary"
            disabled={
              busy ||
              title.trim().length === 0 ||
              message.trim().length === 0 ||
              (audience === "account_types" && accountTypes.length === 0)
            }
            onClick={() =>
              void onSave({
                title: title.trim(),
                message: message.trim(),
                audience,
                account_types: accountTypes,
              })
            }
          >
            {busy ? "Sending…" : "Send"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <TextField label="Title" value={title} onChange={setTitle} />
      <AreaField label="Message" value={message} onChange={setMessage} />
      <SelectField
        label="Audience"
        value={audience}
        options={[
          { value: "all", label: "All accounts" },
          { value: "account_types", label: "Selected account types" },
        ]}
        onChange={setAudience}
      />
      {audience === "account_types" ? (
        <div>
          <p className="admin-muted">Account types</p>
          {(["personal", "creator", "business"] as const).map((accountType) => (
            <ToggleField
              key={accountType}
              label={accountType}
              checked={accountTypes.includes(accountType)}
              onChange={(checked) =>
                setAccountTypes((current) =>
                  checked
                    ? [...new Set([...current, accountType])]
                    : current.filter((value) => value !== accountType),
                )
              }
            />
          ))}
        </div>
      ) : null}
      <Notice>
        Recipients who turned off system notifications are skipped. Future scheduled sends are not
        available yet.
      </Notice>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Advertisements
// ---------------------------------------------------------------------------

function AdsBody() {
  const deliveryEnabled = useFeatureFlag("ads_enabled", false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const list = useResource(
    () =>
      adminAds({
        page,
        perPage: 25,
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
        q: search,
      }),
    [page, statusFilter, search],
  );
  const canEdit = usePermission("ads.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const rows = (list.data?.advertisements ?? []) as Record<string, unknown>[];
  useEffect(() => {
    if (new URLSearchParams(location.search).get("create") !== "1") return;
    navigate(location.pathname, { replace: true });
    if (canEdit) setCreating(true);
  }, [canEdit, location.pathname, location.search, navigate]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const now = Date.now();
  const statusOf = (ad: Record<string, unknown>) => {
    if (
      ad.status === "ended" ||
      (ad.status !== "draft" &&
        ad.status !== "paused" &&
        ad.ends_at &&
        new Date(String(ad.ends_at)).getTime() <= now)
    )
      return "expired";
    if (ad.status === "active" && ad.starts_at && new Date(String(ad.starts_at)).getTime() > now)
      return "scheduled";
    return String(ad.status ?? "draft");
  };
  const visibleRows = rows;

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Advertisements</Heading1>
          <p>Create and manage sponsored content shown across VELORI.</p>
        </div>
        <div className="admin-row-actions">
          {canEdit ? (
            <Button type="button" className="admin-primary" onClick={() => setCreating(true)}>
              + Create advertisement
            </Button>
          ) : null}
          <Button type="button" onClick={list.reload}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="cp-campaign-hero">
        <span aria-hidden="true">↗</span>
        <div>
          <strong>Good campaigns feel at home.</strong>
          <p>Create feed posts and sponsored reels with a consistent live preview.</p>
        </div>
      </div>
      {!deliveryEnabled && (
        <Notice tone="info">
          Ad delivery is switched off. Your drafts and previews work normally. Enable ads in{" "}
          <Link to="/admin/feature-flags">Feature flags</Link> when you are ready to deliver
          campaigns.
        </Notice>
      )}
      {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      {actionSuccess ? <Notice tone="success">{actionSuccess}</Notice> : null}
      {list.loading ? <Loading label="Loading advertisements" /> : null}
      {list.error ? <Notice tone="error">{list.error}</Notice> : null}

      {!list.loading && !list.error ? (
        <>
          <div className="admin-metrics-grid">
            {(["all", "active", "scheduled", "draft", "paused", "expired"] as const).map(
              (status) => (
                <Metric
                  key={status}
                  label={status === "all" ? "ALL" : status.toUpperCase()}
                  value={
                    status === "all"
                      ? (list.data?.counts?.total ?? list.data?.total ?? 0)
                      : status === "expired"
                        ? (list.data?.counts?.expired ?? 0)
                        : (list.data?.counts?.[status] ?? 0)
                  }
                  onClick={() => {
                    setPage(1);
                    setStatusFilter(status);
                  }}
                  pressed={statusFilter === status}
                />
              ),
            )}
          </div>
          <div className="admin-row-actions admin-toolbar" style={{ margin: "16px 0" }}>
            <TextField
              label="Search advertisements"
              value={searchInput}
              onChange={setSearchInput}
            />
            <SelectField
              label="Status"
              value={statusFilter}
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "scheduled", label: "Scheduled" },
                { value: "draft", label: "Draft" },
                { value: "paused", label: "Paused" },
                { value: "expired", label: "Expired" },
              ]}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            />
          </div>
          <Card title="Advertisements" subtitle={`${list.data?.total ?? 0} results.`}>
            {visibleRows.length === 0 ? (
              <Empty>
                {rows.length
                  ? "No advertisements match that filter."
                  : "No advertisements yet. Create a sponsored message to reach people across VELORI."}
              </Empty>
            ) : (
              <div className="admin-resource-grid">
                {visibleRows.map((ad) => {
                  const state = statusOf(ad);
                  const adBody = String(ad.body ?? "");
                  const preview =
                    adBody.length > 100
                      ? `${adBody.slice(0, 97).trim()}…`
                      : adBody || "No copy yet.";

                  return (
                    <article key={String(ad.id)} className="admin-resource-card">
                      <div className="admin-resource-top">
                        <span className={`admin-status-pill tone-${state}`}>
                          {state.charAt(0).toUpperCase() + state.slice(1)}
                        </span>
                        <span className="admin-resource-date">
                          {state === "scheduled"
                            ? `Starts ${formatDate(ad.starts_at as string)}`
                            : ad.ends_at
                              ? `Ends ${formatDate(ad.ends_at as string)}`
                              : "No end date"}
                        </span>
                      </div>
                      <h3>{String(ad.title || "Untitled campaign")}</h3>
                      <p>{preview}</p>
                      <div className="admin-resource-meta">
                        <span>{String(ad.placement ?? "feed")}</span>
                        <span>{String(ad.advertiser_name ?? "VELORI")}</span>
                      </div>

                      {canEdit ? (
                        <div className="admin-resource-actions">
                          <Button type="button" disabled={busy} onClick={() => setEditing(ad)}>
                            Edit
                          </Button>
                          {state === "active" ||
                          state === "scheduled" ||
                          state === "paused" ||
                          state === "draft" ? (
                            <Button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void guarded(async () => {
                                  setActionError(null);
                                  setActionSuccess(null);
                                  await adminPatchAd(String(ad.id), {
                                    status: ad.status === "active" ? "paused" : "active",
                                  });
                                  list.reload();
                                  setActionSuccess(
                                    ad.status === "active"
                                      ? "Advertisement paused."
                                      : "Advertisement activated.",
                                  );
                                }).catch((caught: unknown) =>
                                  setActionError(
                                    caught instanceof Error ? caught.message : String(caught),
                                  ),
                                )
                              }
                            >
                              {state === "active" || state === "scheduled" ? "Pause" : "Activate"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void guarded(async () => {
                                await adminCreateAd({
                                  title: `${String(ad.title || "Advertisement")} copy`.slice(
                                    0,
                                    120,
                                  ),
                                  campaign_name:
                                    `${String(ad.campaign_name || ad.title || "Campaign")} copy`.slice(
                                      0,
                                      120,
                                    ),
                                  advertiser_name: ad.advertiser_name ?? "VELORI",
                                  body: ad.body ?? "",
                                  image_url: ad.image_url ?? "",
                                  target_url: ad.target_url ?? "",
                                  placement: ad.placement ?? "feed",
                                  priority: ad.priority ?? 0,
                                  cta_label: ad.cta_label ?? "Learn more",
                                  creative_type: ad.creative_type ?? "image",
                                  custom_html: ad.custom_html ?? "",
                                  custom_css: ad.custom_css ?? "",
                                  starts_at: null,
                                  ends_at: null,
                                  status: "draft",
                                });
                                setActionSuccess("A copy was saved as a draft.");
                                list.reload();
                              }).catch((caught: unknown) =>
                                setActionError(
                                  caught instanceof Error ? caught.message : String(caught),
                                ),
                              )
                            }
                          >
                            Duplicate
                          </Button>
                          <Button type="button" onClick={() => setDeleting(ad)}>
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
          <Pager page={page} perPage={25} total={list.data?.total} onPage={setPage} />
        </>
      ) : null}

      {creating ? (
        <AdEditor
          busy={busy}
          error={actionError}
          onClose={() => setCreating(false)}
          onSave={async (payload, publish) => {
            setActionError(null);
            await guarded(async () => {
              const result = await adminCreateAd(payload);
              if (publish) {
                const advertisement = result.advertisement as Record<string, unknown>;
                await adminPublishAd(String(advertisement.id), Number(advertisement.version ?? 1));
              }
              setCreating(false);
              setActionSuccess(publish ? "Advertisement published." : "Draft advertisement saved.");
              list.reload();
            }).catch((caught: unknown) =>
              setActionError(caught instanceof Error ? caught.message : String(caught)),
            );
          }}
        />
      ) : null}

      {editing ? (
        <AdEditor
          key={String(editing.id)}
          initial={editing}
          busy={busy}
          error={actionError}
          onClose={() => setEditing(null)}
          onSave={async (payload, publish) => {
            setActionError(null);
            await guarded(async () => {
              await adminPatchAd(String(editing.id), payload);
              if (publish) {
                await adminPublishAd(String(editing.id), Number(editing.version ?? 1));
              }
              setEditing(null);
              setActionSuccess(publish ? "Advertisement published." : "Advertisement updated.");
              list.reload();
            }).catch((caught: unknown) =>
              setActionError(caught instanceof Error ? caught.message : String(caught)),
            );
          }}
        />
      ) : null}

      {deleting ? (
        <ReasonDialog
          title="Delete this advertisement?"
          description="This advertisement will be permanently removed. Explain why this action is needed."
          confirmLabel="Delete"
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={async (reason) => {
            await guarded(async () => {
              await adminDeleteAd(String(deleting.id), reason);
              setDeleting(null);
              setActionError(null);
              setActionSuccess("Advertisement deleted.");
              list.reload();
            }).catch((caught: unknown) => {
              setActionError(caught instanceof Error ? caught.message : String(caught));
              throw caught;
            });
          }}
        />
      ) : null}
    </>
  );
}

export function AdEditor({
  initial,
  busy,
  error,
  onClose,
  onSave,
}: {
  initial?: Record<string, unknown>;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>, activate?: boolean) => void | Promise<void>;
}) {
  initial =
    initial?.draft_payload && typeof initial.draft_payload === "object"
      ? { ...initial, ...initial.draft_payload }
      : initial;
  const [title, setTitle] = useState(String(initial?.title ?? ""));
  const [campaignName, setCampaignName] = useState(String(initial?.campaign_name ?? ""));
  const [advertiserName, setAdvertiserName] = useState(
    String(initial?.advertiser_name ?? "VELORI"),
  );
  const [body, setBody] = useState(String(initial?.body ?? ""));
  const [customHtml, setCustomHtml] = useState(String(initial?.custom_html ?? ""));
  const [customCss, setCustomCss] = useState(String(initial?.custom_css ?? ""));
  const [imageUrl, setImageUrl] = useState(String(initial?.image_url ?? ""));
  const [targetUrl, setTargetUrl] = useState(String(initial?.target_url ?? ""));
  const [destinationType, setDestinationType] = useState<"none" | "internal" | "external">(
    !initial?.target_url
      ? "none"
      : String(initial.target_url).startsWith("/")
        ? "internal"
        : "external",
  );
  const [placement, setPlacement] = useState(String(initial?.placement ?? "feed"));
  const [priority, setPriority] = useState(String(initial?.priority ?? "0"));
  const [ctaLabel, setCtaLabel] = useState(String(initial?.cta_label ?? "Learn more"));
  const [creativeType, setCreativeType] = useState(String(initial?.creative_type ?? "image"));
  const [startsAt, setStartsAt] = useState(localDateTimeInput(initial?.starts_at));
  const [endsAt, setEndsAt] = useState(localDateTimeInput(initial?.ends_at));
  const [scheduleLater, setScheduleLater] = useState(
    Boolean(initial?.starts_at && new Date(String(initial.starts_at)).getTime() > Date.now()),
  );
  const [uploading, setUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [previewPlacement, setPreviewPlacement] = useState(String(initial?.placement ?? "feed"));
  const validDestination = !targetUrl || Boolean(safeCampaignUrl(targetUrl));

  const scheduledDatesValid =
    !scheduleLater ||
    (Boolean(startsAt) &&
      Number.isFinite(Date.parse(startsAt)) &&
      (!endsAt || (Number.isFinite(Date.parse(endsAt)) && new Date(endsAt) > new Date(startsAt))));
  const adDraftBlockReason = busy
    ? "Saving your advertisement…"
    : uploading
      ? "Wait for the creative upload to finish."
      : !title.trim()
        ? "Add a headline before saving."
        : !advertiserName.trim()
          ? "Add an advertiser name before saving."
          : destinationType !== "none" && !ctaLabel.trim()
            ? "Add a call to action label before saving."
            : !validDestination
              ? "Use a secure https:// address or a VELORI page for the destination."
              : !["feed", "search", "reels"].includes(placement)
                ? "Choose Feed, Reels or Search placement."
                : !scheduledDatesValid
                  ? "Choose a valid start time and an end time after it."
                  : "";
  const adPublishBlockReason =
    adDraftBlockReason ||
    (creativeType !== "link" && creativeType !== "html" && !imageUrl
      ? "Upload a creative before publishing, or save this as a draft."
      : creativeType === "html" && !customHtml.trim()
        ? "Add custom HTML before publishing, or save this as a draft."
        : creativeType === "link" && !targetUrl
          ? "Add a destination before publishing, or save this as a draft."
          : "");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const makePayload = (forPublish: boolean) => ({
    title: title.trim(),
    campaign_name: campaignName.trim(),
    advertiser_name: advertiserName.trim(),
    body: body.trim(),
    image_url: creativeType === "link" || creativeType === "html" ? "" : imageUrl.trim(),
    target_url: targetUrl.trim(),
    placement,
    priority: Number(priority) || 0,
    cta_label: ctaLabel.trim() || "Learn more",
    creative_type: creativeType,
    custom_html: creativeType === "html" ? customHtml : "",
    custom_css: creativeType === "html" ? customCss : "",
    starts_at: scheduleLater && startsAt ? new Date(startsAt).toISOString() : null,
    ends_at: scheduleLater && endsAt ? new Date(endsAt).toISOString() : null,
    ...(forPublish
      ? {}
      : {
          draft_payload: {
            title: title.trim(),
            campaign_name: campaignName.trim(),
            advertiser_name: advertiserName.trim(),
            body: body.trim(),
            image_url: creativeType === "link" || creativeType === "html" ? "" : imageUrl.trim(),
            target_url: targetUrl.trim(),
            placement,
            priority: Number(priority) || 0,
            cta_label: ctaLabel.trim() || "Learn more",
            creative_type: creativeType,
            custom_html: creativeType === "html" ? customHtml : "",
            custom_css: creativeType === "html" ? customCss : "",
            starts_at: scheduleLater && startsAt ? new Date(startsAt).toISOString() : null,
            ends_at: scheduleLater && endsAt ? new Date(endsAt).toISOString() : null,
          },
        }),
  });

  return (
    <Dialog
      title={initial ? "Edit advertisement" : "Create advertisement"}
      description={
        initial
          ? "Review the creative and save your campaign changes."
          : "Create your sponsored message. Save it as a draft or activate it when you're ready."
      }
      onClose={onClose}
      className="admin-resource-editor-dialog admin-campaign-editor cp-ad-editor"
      dismissOnBackdrop={false}
      actions={
        <>
          <Button
            type="button"
            disabled={Boolean(adDraftBlockReason)}
            onClick={() => void onSave(makePayload(false), false)}
          >
            {initial ? "Save changes" : "Save draft"}
          </Button>
          <Button
            type="button"
            className="admin-primary"
            disabled={Boolean(adPublishBlockReason)}
            onClick={() => setConfirmPublish(true)}
          >
            {scheduleLater ? "Schedule advertisement" : "Publish advertisement"}
          </Button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {mediaError ? <Notice tone="error">{mediaError}</Notice> : null}
      {adPublishBlockReason ? (
        <p className="admin-inline-warning" role="status">
          {adPublishBlockReason}
        </p>
      ) : null}
      <div className="admin-editor-grid">
        <div className="admin-editor-column">
          <section className="admin-field-section">
            <h3>Campaign</h3>
            <TextField
              label="Campaign name"
              value={campaignName}
              onChange={setCampaignName}
              hint="Only administrators see this name. Use it to find the campaign later."
            />
            <TextField
              label="Advertiser name"
              value={advertiserName}
              onChange={setAdvertiserName}
              hint="This name appears beside the sponsored label."
            />
            <TextField label="Headline" value={title} onChange={setTitle} />
            <AreaField label="Message" value={body} onChange={setBody} rows={3} />
          </section>
          <section className="admin-field-section">
            <h3>Creative</h3>
            <fieldset className="admin-choice-fieldset">
              <legend>What are you creating?</legend>
              <div className="admin-choice-grid">
                {[
                  { id: "image", label: "Image" },
                  { id: "video", label: "Video" },
                  { id: "link", label: "Link" },
                  { id: "html", label: "HTML + CSS" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={creativeType === option.id}
                    className={`admin-choice-card${creativeType === option.id ? " is-selected" : ""}`}
                    onClick={() => setCreativeType(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>
                      {option.id === "link"
                        ? "A destination-focused sponsored card."
                        : option.id === "html"
                          ? "Build a custom sponsored creative with safe HTML and CSS."
                          : `Upload a ${option.id === "image" ? "PNG, JPEG, or WebP image" : "MP4 video"}.`}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            {creativeType !== "link" && creativeType !== "html" ? (
              <>
                <label className="admin-upload-card">
                  <span>{imageUrl ? "Replace creative" : "Upload creative"}</span>
                  <input
                    aria-label="Upload advertisement creative"
                    type="file"
                    accept={
                      creativeType === "image" ? "image/png,image/jpeg,image/webp" : "video/mp4"
                    }
                    disabled={uploading || busy}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      setUploading(true);
                      setMediaError(null);
                      void adminUploadAdMedia(file)
                        .then((result) => {
                          setImageUrl(result.url);
                          setCreativeType(result.type === "video/mp4" ? "video" : "image");
                        })
                        .catch((caught: unknown) =>
                          setMediaError(
                            caught instanceof Error
                              ? caught.message
                              : "Upload failed. Please try again.",
                          ),
                        )
                        .finally(() => setUploading(false));
                    }}
                  />
                  <small>
                    {uploading ? "Uploading…" : "PNG, JPEG, WebP, or MP4 · up to 10 MB"}
                  </small>
                </label>
                {imageUrl ? (
                  <Button type="button" onClick={() => setImageUrl("")}>
                    Remove creative
                  </Button>
                ) : null}
              </>
            ) : null}
            {creativeType === "html" ? (
              <div className="admin-custom-code-fields">
                <p className="admin-muted">
                  Scripts are removed on save. The preview is sandboxed. CSS cannot load remote
                  resources.
                </p>
                <AreaField
                  label="Custom HTML"
                  value={customHtml}
                  onChange={setCustomHtml}
                  rows={10}
                  hint="Markup only. Script tags are removed."
                />
                <AreaField
                  label="Custom CSS"
                  value={customCss}
                  onChange={setCustomCss}
                  rows={8}
                  hint="CSS only. HTTPS imports and resource URLs are allowed; the preview sandbox blocks scripts and connections."
                />
              </div>
            ) : null}
            <SelectField
              label="Button destination"
              value={destinationType}
              options={[
                { value: "none", label: "No button" },
                { value: "internal", label: "Open a VELORI page" },
                { value: "external", label: "Open an external website" },
              ]}
              onChange={(value) => {
                const next = value as "none" | "internal" | "external";
                setDestinationType(next);
                if (next === "none") setTargetUrl("");
                else if (next === "internal" && !targetUrl.startsWith("/")) setTargetUrl("/home");
                else if (next === "external" && targetUrl.startsWith("/")) setTargetUrl("");
              }}
            />
            {destinationType === "internal" ? (
              <SelectField
                label="VELORI page"
                value={targetUrl}
                options={[
                  { value: "/home", label: "Home" },
                  { value: "/explore", label: "Explore" },
                  { value: "/people", label: "Discover people" },
                  { value: "/reels", label: "Reels" },
                  { value: "/stories", label: "Stories" },
                  { value: "/groups", label: "Groups" },
                  ...(![
                    "/home",
                    "/explore",
                    "/discover-people",
                    "/reels",
                    "/stories",
                    "/groups",
                  ].includes(targetUrl)
                    ? [{ value: targetUrl, label: "Current saved page" }]
                    : []),
                ]}
                onChange={setTargetUrl}
              />
            ) : null}
            {destinationType === "external" ? (
              <TextField
                label="Website address"
                type="url"
                value={targetUrl}
                onChange={setTargetUrl}
                hint="Enter a secure https:// address."
              />
            ) : null}
            {!validDestination ? (
              <p className="admin-inline-warning" role="alert">
                Enter a secure https:// website or a local VELORI path that begins with one /.
              </p>
            ) : null}
            {destinationType !== "none" ? (
              <TextField
                label="Button label"
                value={ctaLabel}
                onChange={setCtaLabel}
                hint="For example: Learn more, Visit, or Shop."
              />
            ) : null}
          </section>
          <section className="admin-field-section">
            <h3>Placement</h3>
            <div className="admin-choice-grid">
              {[
                {
                  value: "feed",
                  label: "Feed",
                  description: "A clean sponsored post in the home feed.",
                },
                {
                  value: "reels",
                  label: "Reels",
                  description: "A full-height sponsored moment between reels.",
                },
                {
                  value: "search",
                  label: "Search",
                  description: "Alongside people and content results.",
                },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={placement === item.value}
                  className={`admin-choice-card${placement === item.value ? " is-selected" : ""}`}
                  onClick={() => {
                    setPlacement(item.value);
                    setPreviewPlacement(item.value);
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
            {!["feed", "search", "reels"].includes(placement) ? (
              <p className="admin-inline-warning">
                This saved placement is not currently shown to visitors. Choose Feed, Reels or
                Search before saving.
              </p>
            ) : null}
          </section>
          <section className="admin-field-section">
            <h3>Schedule</h3>
            <div className="admin-choice-grid">
              {[
                { value: false, label: "Start now" },
                { value: true, label: "Schedule for later" },
              ].map((item) => (
                <button
                  key={String(item.value)}
                  type="button"
                  aria-pressed={scheduleLater === item.value}
                  className={`admin-choice-card${scheduleLater === item.value ? " is-selected" : ""}`}
                  onClick={() => setScheduleLater(item.value)}
                >
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
            {scheduleLater ? (
              <>
                <TextField
                  label="Start date and time"
                  type="datetime-local"
                  value={startsAt}
                  onChange={setStartsAt}
                />
                <TextField
                  label="End date and time (optional)"
                  type="datetime-local"
                  value={endsAt}
                  onChange={setEndsAt}
                />
                {!scheduledDatesValid ? (
                  <p className="admin-inline-warning" role="status">
                    Choose a valid start time. If you set an end time, it must be after the start.
                  </p>
                ) : null}
              </>
            ) : null}
            <p className="admin-muted">
              Times use your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
            </p>
          </section>
          <details className="admin-field-section admin-advanced-settings">
            <summary>Advanced settings</summary>
            <TextField
              label="Delivery priority"
              type="number"
              value={priority}
              onChange={setPriority}
              hint="Used when eligible ads compete for the same placement."
            />
            <TextField
              label="Creative URL (advanced)"
              value={imageUrl}
              onChange={setImageUrl}
              hint="Use when the creative is already hosted."
            />
          </details>
        </div>
        <aside className="admin-preview-column cp-campaign-preview">
          <header>
            <span>02 / CAMPAIGN PREVIEW</span>
            <span>PRIVATE PREVIEW</span>
          </header>
          <div
            className="admin-preview-size"
            role="group"
            aria-label="Advertisement preview placement"
          >
            {["feed", "reels", "search"].map((size) => (
              <button
                key={size}
                aria-pressed={previewPlacement === size}
                onClick={() => setPreviewPlacement(size)}
              >
                {size}
              </button>
            ))}
          </div>
          <div className={"cp-ad-preview-stage preview-" + previewPlacement}>
            <SponsoredCard
              preview
              reel={previewPlacement === "reels"}
              ad={{
                title: title || "Your campaign headline",
                body: body || "A message worth sharing with your community.",
                advertiser_name: advertiserName,
                creative_type: creativeType,
                image_url: imageUrl,
                custom_html: customHtml,
                custom_css: customCss,
                target_url: targetUrl,
                cta_label: ctaLabel,
              }}
            />
          </div>
          <p>Clearly labeled sponsored content. No simulated likes or engagement.</p>
        </aside>
      </div>
      {confirmPublish ? (
        <Dialog
          title={scheduleLater ? "Schedule advertisement?" : "Publish advertisement?"}
          description={
            scheduleLater
              ? "This ad becomes eligible for delivery when its schedule begins."
              : "This ad will become eligible for delivery as soon as it is published."
          }
          onClose={() => setConfirmPublish(false)}
          actions={
            <Button
              type="button"
              className="admin-primary"
              disabled={busy}
              onClick={() => {
                setConfirmPublish(false);
                void onSave(makePayload(true), true);
              }}
            >
              {scheduleLater ? "Schedule advertisement" : "Publish advertisement"}
            </Button>
          }
        />
      ) : null}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function EmailsBody() {
  const templates = useResource(() => adminEmails(), []);
  const canEdit = usePermission("emails.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [target, setTarget] = useState<Record<string, unknown> | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = (templates.data?.templates ?? []) as Record<string, unknown>[];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Email templates</Heading1>
          <p>
            Copy the console shows for transactional email. Delivery itself is handled by Supabase
            through your SMTP provider, so sending a test from here is not possible and the screen
            says so rather than pretending.
          </p>
        </div>
      </div>

      {notice ? <Notice>{notice}</Notice> : null}
      {templates.loading ? <Loading label="Loading templates" /> : null}
      {templates.error ? <Notice tone="error">{templates.error}</Notice> : null}

      {!templates.loading && !templates.error ? (
        <Card title="Templates" subtitle={`${rows.length} templates.`}>
          {rows.length === 0 ? (
            <Empty>No email templates are configured.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Subject</th>
                  <th>State</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((template) => (
                  <tr key={String(template.key)}>
                    <td>{String(template.key)}</td>
                    <td>{String(template.subject ?? "—")}</td>
                    <td>
                      <Pill tone={template.enabled === false ? "warn" : "ok"}>
                        {template.enabled === false ? "off" : "on"}
                      </Pill>
                    </td>
                    <td>{formatDate(template.updated_at as string)}</td>
                    <td>
                      <div className="admin-row-actions">
                        {canEdit ? (
                          <Button type="button" onClick={() => setTarget(template)}>
                            Edit
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          onClick={() =>
                            void (async () => {
                              setTesting(String(template.key));
                              setNotice(null);
                              try {
                                const result = await adminTestEmail(String(template.key), "");
                                setNotice(result?.howToVerify ?? null);
                              } catch (caught) {
                                setNotice(
                                  caught instanceof Error ? caught.message : String(caught),
                                );
                              } finally {
                                setTesting(null);
                              }
                            })()
                          }
                        >
                          {testing === String(template.key) ? "Checking…" : "How to verify"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {target ? (
        <EmailEditor
          template={target}
          busy={busy}
          onClose={() => setTarget(null)}
          onSave={async (payload) => {
            await guarded(async () => {
              await adminPatchEmail(String(target.key), payload);
              setTarget(null);
              templates.reload();
            }).catch(() => undefined);
          }}
        />
      ) : null}
    </>
  );
}

function EmailEditor({
  template,
  busy,
  onClose,
  onSave,
}: {
  template: Record<string, unknown>;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void | Promise<void>;
}) {
  const [subject, setSubject] = useState(String(template.subject ?? ""));
  const [heading, setHeading] = useState(String(template.heading ?? ""));
  const [body, setBody] = useState(String(template.body ?? ""));
  const [enabled, setEnabled] = useState(template.enabled !== false);

  return (
    <Dialog
      title={`Edit ${String(template.key)}`}
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            className="admin-primary"
            disabled={busy}
            onClick={() =>
              void onSave({ subject: subject.trim(), heading: heading.trim(), body, enabled })
            }
          >
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <TextField label="Subject" value={subject} onChange={setSubject} />
      <TextField label="Heading" value={heading} onChange={setHeading} />
      <AreaField label="Body" value={body} onChange={setBody} rows={10} />
      <ToggleField label="Enabled" checked={enabled} onChange={setEnabled} />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Exports
//
// Each screen below wraps its body in `ConsoleScreen`, which is what supplies the
// screen reauth handle these bodies read through `useScreenReauth()`. A body
// rendered outside that wrapper throws instead of prompting for a password.
// ---------------------------------------------------------------------------

export function SiteSettingsScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view"]}>
      <SiteSettingsBody />
    </ConsoleScreen>
  );
}

export function PlatformScreen() {
  return (
    <ConsoleScreen anyOf={["settings.view"]}>
      <PlatformBody />
    </ConsoleScreen>
  );
}

export function FeatureFlagsScreen() {
  return (
    <ConsoleScreen anyOf={["flags.view"]}>
      <FeatureFlagsBody />
    </ConsoleScreen>
  );
}

export function AnnouncementsScreen() {
  return (
    <ConsoleScreen anyOf={["notifications.view"]}>
      <AnnouncementsBody />
    </ConsoleScreen>
  );
}

export function NotificationsScreen() {
  return (
    <ConsoleScreen anyOf={["notifications.view"]}>
      <NotificationsBody />
    </ConsoleScreen>
  );
}

export function AdsScreen() {
  return (
    <ConsoleScreen anyOf={["ads.view"]}>
      <AdsBody />
    </ConsoleScreen>
  );
}

export function EmailsScreen() {
  return (
    <ConsoleScreen anyOf={["emails.view"]}>
      <EmailsBody />
    </ConsoleScreen>
  );
}
