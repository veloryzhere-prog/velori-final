import { createUuid } from "../../../lib/uuid.mjs";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  adminAnimations,
  adminMotionCms,
  adminPublishMotion,
  adminAppearance,
  adminBranding,
  adminErrorPages,
  adminPatchAnimation,
  adminRestoreMotionVersion,
  adminSaveMotionDraft,
  adminPatchBranding,
  adminPatchErrorPage,
  adminRestoreBrandingVersion,
  adminSaveAppearance,
  adminUploadBranding,
  adminUploadErrorIllustration,
  adminUploadMotion,
} from "../../../lib/admin-api";
import {
  DEFAULT_MOTION_CONFIG,
  ERROR_TYPES,
  MOTION_PRESETS,
  PAGE_TYPES,
  normalizeMotionConfig,
  pageTypeForPath,
  resolveErrorMotion,
  resolvePageMotion,
  type MotionConfig,
  type MotionPreset,
  type MotionRule,
} from "../../../../supabase/functions/_shared/motion-config.mjs";
import { ErrorPage, Maintenance, NotFound } from "../../shell";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen, useScreenReauth } from "../frame";
import { usePermission } from "../session";
import {
  AreaField,
  Card,
  Dialog,
  Empty,
  Loading,
  Notice,
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

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

function BrandingBody() {
  const branding = useResource(() => adminBranding(), []);
  const canEdit = usePermission("branding.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [uploading, setUploading] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [restoring, setRestoring] = useState<{ id: string; version: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState("");

  const assets = (branding.data?.assets ?? []) as Record<string, unknown>[];
  const slots = (branding.data?.slots ?? []) as string[];

  const pick = (next: string) => {
    setSlot(next);
    fileInput.current?.click();
  };

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Branding</Heading1>
          <p>
            Images are checked against their declared type before they are stored, and every
            replacement keeps the previous version so it can be restored.
          </p>
        </div>
        <div className="admin-row-actions">
          <Button type="button" onClick={branding.reload}>
            Refresh
          </Button>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          event.target.value = "";
          if (!file || !slot) return;
          setUploading(slot);
          void guarded(async () => {
            setError(null);
            await adminUploadBranding(slot, file);
            branding.reload();
          })
            .catch((caught: unknown) =>
              setError(caught instanceof Error ? caught.message : String(caught)),
            )
            .finally(() => setUploading(null));
        }}
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {branding.loading ? <Loading label="Loading branding" /> : null}
      {branding.error ? <Notice tone="error">{branding.error}</Notice> : null}

      {!branding.loading && !branding.error ? (
        <>
          <Card title="Assets" subtitle={`${assets.length} slots configured.`}>
            {assets.length === 0 ? (
              <Empty>No branding assets have been uploaded.</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Slot</th>
                    <th>Preview</th>
                    <th>Version</th>
                    <th>State</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={String(asset.id)}>
                      <td>
                        <strong>{String(asset.slot)}</strong>
                        <br />
                        <small className="admin-muted">{String(asset.label ?? "")}</small>
                      </td>
                      <td>
                        {asset.public_url ? (
                          <img
                            className="admin-logo-preview"
                            src={String(asset.public_url)}
                            alt={String(asset.label ?? asset.slot)}
                          />
                        ) : (
                          <Empty>None</Empty>
                        )}
                      </td>
                      <td>{String(asset.version ?? 1)}</td>
                      <td>
                        <Pill tone={asset.is_active === false ? "warn" : "ok"}>
                          {asset.is_active === false ? "retired" : "active"}
                        </Pill>
                      </td>
                      <td>{formatDate(asset.updated_at as string)}</td>
                      <td>
                        <div className="admin-row-actions">
                          {canEdit ? (
                            <>
                              <Button type="button" onClick={() => setEditing(asset)}>
                                Edit
                              </Button>
                              {Number(asset.version ?? 1) > 1 ? (
                                <Button
                                  type="button"
                                  onClick={() =>
                                    setRestoring({
                                      id: String(asset.id),
                                      version: Number(asset.version ?? 1) - 1,
                                    })
                                  }
                                >
                                  Restore previous
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {canEdit ? (
            <Card title="Upload" subtitle="PNG, JPEG or WebP up to 2 MB.">
              <div className="admin-row-actions">
                {slots.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    disabled={uploading === option}
                    onClick={() => pick(option)}
                  >
                    {uploading === option ? "Uploading…" : option}
                  </Button>
                ))}
              </div>
            </Card>
          ) : null}

          <Card title="Live values" subtitle="What the public shell is actually rendering.">
            <dl className="admin-info-list">
              {Object.entries(branding.data?.live ?? {}).map(([key, value]) => (
                <div key={key} style={{ display: "contents" }}>
                  <dt>{key}</dt>
                  <dd>{String(value ?? "—")}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </>
      ) : null}

      {editing ? (
        <BrandingEditor
          asset={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            await guarded(async () => {
              await adminPatchBranding(String(editing.id), payload);
              setEditing(null);
              branding.reload();
            }).catch(() => undefined);
          }}
        />
      ) : null}

      {restoring ? (
        <ReasonDialog
          title="Restore the previous version?"
          description="The current asset is archived first, so this restore can itself be undone."
          confirmLabel="Restore version"
          busy={busy}
          minimumLength={4}
          onClose={() => setRestoring(null)}
          onConfirm={async () => {
            await guarded(async () => {
              await adminRestoreBrandingVersion(restoring.id, restoring.version);
              setRestoring(null);
              branding.reload();
            }).catch(() => undefined);
          }}
        />
      ) : null}
    </>
  );
}

function BrandingEditor({
  asset,
  busy,
  onClose,
  onSave,
}: {
  asset: Record<string, unknown>;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void | Promise<void>;
}) {
  const [label, setLabel] = useState(String(asset.label ?? ""));
  const [isActive, setIsActive] = useState(asset.is_active !== false);
  return (
    <Dialog
      title={`Edit ${String(asset.slot)}`}
      description="Retiring an asset keeps its history but stops the shell using it."
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            className="admin-primary"
            disabled={busy}
            onClick={() => void onSave({ label: label.trim(), is_active: isActive })}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <TextField label="Label" value={label} onChange={setLabel} />
      <ToggleField label="Active" checked={isActive} onChange={setIsActive} />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

function MotionCmsEditor({ focusErrors = false }: { focusErrors?: boolean } = {}) {
  const resource = useResource(() => adminMotionCms(), []);
  const canWrite = usePermission("motion.write");
  const canPublish = usePermission("motion.publish");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [config, setConfig] = useState<MotionConfig>(DEFAULT_MOTION_CONFIG);
  const [dirty, setDirty] = useState(false);
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [previewConfig, setPreviewConfig] = useState<MotionConfig | null>(null);
  const [uploadingErrorCode, setUploadingErrorCode] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<(typeof ERROR_TYPES)[number]>("NOT_FOUND");
  const [previewMode, setPreviewMode] = useState<"normal" | "error">("error");
  const [previewPath, setPreviewPath] = useState("/unknown-page");
  const [device, setDevice] = useState("desktop");
  const [previewTick, setPreviewTick] = useState(0);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [uploadingErrorAsset, setUploadingErrorAsset] = useState<string | null>(null);
  const [errorAssetUploadError, setErrorAssetUploadError] = useState("");
  const [pagePreview, setPagePreview] = useState<
    "startup" | "loading" | "error" | "maintenance" | null
  >(null);

  useEffect(() => {
    if (resource.data && !dirty) {
      try {
        setConfig(normalizeMotionConfig(resource.data.draft));
      } catch {
        setConfig(DEFAULT_MOTION_CONFIG);
      }
    }
  }, [resource.data, dirty]);

  useEffect(() => {
    const first = resource.data?.routes?.[0]?.path;
    if (!selectedRoute && typeof first === "string") setSelectedRoute(first);
  }, [resource.data, selectedRoute]);

  useEffect(() => {
    if (!focusErrors || resource.loading) return;
    requestAnimationFrame(() => document.getElementById("motion-errors")?.scrollIntoView());
  }, [focusErrors, resource.loading]);

  const change = (update: (current: MotionConfig) => MotionConfig) => {
    setConfig((current) => update(current));
    setDirty(true);
    setStatus("");
    setError("");
  };
  const updateGlobal = (key: string, value: unknown) =>
    change((current) => ({ ...current, global: { ...current.global, [key]: value } }));
  const updateTheme = (key: string, value: string) =>
    change((current) => ({ ...current, theme: { ...current.theme, [key]: value } }));
  const updateErrorPage = (code: string, key: string, value: unknown) =>
    change((current) => ({
      ...current,
      errorPages: {
        ...current.errorPages,
        [code]: { ...current.errorPages[code], [key]: value, enabled: true },
      },
    }));
  const updateComponentRule = (componentId: string, key: string, value: unknown) =>
    change((current) => ({
      ...current,
      componentRules: current.componentRules.map((rule) =>
        rule.componentId === componentId ? { ...rule, [key]: value } : rule,
      ),
    }));

  async function saveDraft() {
    try {
      const safe = normalizeMotionConfig(config);
      await guarded(async () => {
        await adminSaveMotionDraft({
          config: safe as unknown as Record<string, unknown>,
          summary: summary.trim(),
        });
      });
      setConfig(safe);
      setDirty(false);
      setStatus("Draft saved. Public pages are unchanged until you publish.");
      resource.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function publish() {
    if (!summary.trim()) {
      setError("Add a change summary before publishing.");
      return;
    }
    try {
      const safe = normalizeMotionConfig(config);
      await guarded(async () => {
        if (dirty) {
          await adminSaveMotionDraft({
            config: safe as unknown as Record<string, unknown>,
            summary: summary.trim(),
          });
        }
        await adminPublishMotion(summary.trim());
      });
      setConfig(safe);
      setDirty(false);
      setStatus("Published motion configuration. Public pages will refresh within two minutes.");
      resource.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function restore(version: number) {
    try {
      await guarded(async () => {
        await adminRestoreMotionVersion(version);
      });
      setRestoreVersion(null);
      setDirty(false);
      setStatus(`Version ${version} restored as a new published version.`);
      resource.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function addRule(kind: "pageRules" | "errorRules") {
    const id = createUuid();
    change((current) => ({
      ...current,
      [kind]: [
        ...current[kind],
        {
          id,
          ruleType: "pattern",
          routePattern: "/profile/*",
          pageType: "profile",
          ...(kind === "errorRules" ? { errorType: "NOT_FOUND" } : {}),
          ...(kind === "errorRules"
            ? {
                title: "",
                subtitle: "",
                assetUrl: "",
                primaryLabel: "",
                primaryUrl: "",
                secondaryLabel: "",
                secondaryUrl: "",
                layout: "centered",
                alignment: "center",
              }
            : {}),
          preset: "fade-up",
          enabled: true,
          priority: 0,
          deviceScope: "all",
          reducedMotion: "static",
          durationMs: 260,
          delayMs: 0,
          easing: "ease-out",
          intensity: "standard",
          repeat: "once",
          trigger: "on-mount",
          direction: "up",
          distance: 12,
          scale: 0.98,
          opacity: 0,
          blur: 0,
          staggerMs: 0,
          viewportThreshold: 0.15,
          startsAt: "",
          endsAt: "",
        },
      ] as MotionRule[],
    }));
  }

  function editRule(kind: "pageRules" | "errorRules", id: string, key: string, value: unknown) {
    change((current) => ({
      ...current,
      [kind]: current[kind].map((rule) => (rule.id === id ? { ...rule, [key]: value } : rule)),
    }));
  }

  function updatePageExperience(
    group: "startup" | "loading" | "error" | "maintenance",
    key: string,
    value: unknown,
  ) {
    if (!selectedRoute) return;
    change((current) => {
      const existing = current.pageExperiences.find((item) => item.route === selectedRoute);
      const base = (existing ?? {
        route: selectedRoute,
        enabled: true,
        startup: {
          enabled: false,
          preset: "fade" as const,
          assetUrl: "",
          durationMs: 1200,
          delayMs: 0,
          minimumDisplayMs: 0,
          loop: false,
          showOncePerSession: true,
        },
        loading: {
          enabled: false,
          preset: "shimmer" as const,
          assetUrl: "",
          durationMs: 900,
          message: "",
        },
        error: {
          enabled: false,
          preset: "error-reveal" as const,
          assetUrl: "",
          title: "",
          message: "",
          backgroundColor: "",
          actionLabel: "",
          actionUrl: "",
        },
        maintenance: {
          enabled: false,
          preset: "error-reveal" as const,
          assetUrl: "",
          title: "",
          message: "",
          backgroundColor: "",
          actionLabel: "",
          actionUrl: "",
        },
      }) as MotionConfig["pageExperiences"][number];
      const updated = {
        ...base,
        enabled: true,
        [group]: { ...base[group], [key]: value },
      } as MotionConfig["pageExperiences"][number];
      return {
        ...current,
        pageExperiences: existing
          ? current.pageExperiences.map((item) => (item.route === selectedRoute ? updated : item))
          : [...current.pageExperiences, updated],
      };
    });
  }

  function removePageExperience() {
    if (!selectedRoute) return;
    change((current) => ({
      ...current,
      pageExperiences: current.pageExperiences.filter((item) => item.route !== selectedRoute),
    }));
    setPagePreview(null);
  }

  function copyPublished() {
    try {
      if (resource.data) setConfig(normalizeMotionConfig(resource.data.published));
      setDirty(true);
      setStatus(
        "Draft reset to the currently published version. Save or publish to keep this change.",
      );
      setError("");
    } catch {
      setError("The published configuration could not be loaded.");
    }
  }

  function preview() {
    try {
      setPreviewConfig(normalizeMotionConfig(config));
      setPreviewTick((current) => current + 1);
      setError("");
    } catch (caught) {
      setPreviewConfig(null);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  const versions = resource.data?.versions ?? [];
  const versionA = versions.find((version) => String(version.version) === compareA) ?? versions[0];
  const versionB = versions.find((version) => String(version.version) === compareB) ?? versions[1];
  const experience = config.pageExperiences.find((item) => item.route === selectedRoute);
  const routeOptions = (resource.data?.routes ?? []).map((route) => ({
    value: String(route.path),
    label: `${String(route.label)} · ${String(route.path)}`,
  }));
  const assetOptions = [
    { value: "", label: "Built-in motion" },
    ...(resource.data?.animations ?? [])
      .filter(
        (animation) =>
          animation.enabled !== false &&
          typeof animation.media_url === "string" &&
          animation.media_url,
      )
      .map((animation) => ({
        value: String(animation.media_url),
        label: `${String(animation.label ?? animation.key)} · MP4`,
      })),
  ];
  const previewDark = document.documentElement.dataset.theme === "dark";
  const errorStatuses: Record<string, number> = {
    NOT_FOUND: 404,
    FORBIDDEN: 403,
    RATE_LIMITED: 429,
    SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    MAINTENANCE: 503,
    OFFLINE: 503,
    AUTH_FAILURE: 401,
    CONTENT_UNAVAILABLE: 404,
    MEDIA_UNAVAILABLE: 503,
    SERVICE_UNAVAILABLE: 503,
    APPLICATION_ERROR: 500,
  };
  const resolvedPreview = previewConfig
    ? resolveErrorMotion(previewConfig, {
        pathname: previewPath || "/unknown-page",
        pageType: pageTypeForPath(previewPath || "/unknown-page"),
        errorType: previewType,
        device,
      })
    : null;
  const resolvedPagePreview = previewConfig
    ? resolvePageMotion(previewConfig, {
        pathname: previewPath || "/home",
        pageType: pageTypeForPath(previewPath || "/home"),
        device,
      })
    : null;

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Motion studio</Heading1>
          <p>
            The motion and experience document: one global setting, per-theme overrides, per-error
            screens and per-component rules. Edits are a draft until you publish, and publishing
            snapshots the previous version so it can be restored.
          </p>
        </div>
      </div>

      <div className="motion-cms-editor">
        {resource.loading ? <Loading label="Loading published motion configuration" /> : null}
        {resource.error ? <Notice tone="error">{resource.error}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        {status ? <Notice tone="success">{status}</Notice> : null}

        <nav className="motion-quick-links" aria-label="Motion studio sections">
          <span>Jump to</span>
          <a href="#motion-global">Basics</a>
          <a href="#motion-page-experience">Page experience</a>
          <a href="#motion-page-rules">Route rules</a>
          <a href="#motion-error-rules">Error rules</a>
          <a href="#motion-preview">Preview</a>
          <a href="#motion-publish">Publish</a>
          <a href="#motion-history">History</a>
        </nav>

        <Card
          id="motion-global"
          title="Global motion"
          subtitle={`Published version ${resource.data?.publishedVersion ?? "—"}${resource.data?.publishedAt ? ` · ${formatDate(resource.data.publishedAt)}` : ""}. Rules affect the public site only after publishing.`}
        >
          <div className="admin-form-grid">
            <ToggleField
              label="Enable non-essential motion"
              checked={config.global.enabled}
              disabled={!canWrite}
              onChange={(value) => updateGlobal("enabled", value)}
            />
            <SelectField
              label="Intensity"
              value={config.global.intensity}
              options={["off", "subtle", "standard", "expressive", "cinematic"]}
              disabled={!canWrite}
              onChange={(value) => updateGlobal("intensity", value)}
            />
            <SelectField
              label="Speed"
              value={config.global.speed}
              options={["slow", "normal", "fast"]}
              disabled={!canWrite}
              onChange={(value) => updateGlobal("speed", value)}
            />
            <SelectField
              label="Page transition"
              value={config.global.transitionPreset}
              options={MOTION_PRESETS.filter((preset) =>
                ["none", "fade", "page-crossfade", "page-slide", "scale-soft", "blur-in"].includes(
                  preset,
                ),
              )}
              disabled={!canWrite}
              onChange={(value) => updateGlobal("transitionPreset", value)}
            />
            <TextField
              label="Transition duration (ms)"
              value={String(config.global.transitionDurationMs)}
              disabled={!canWrite}
              onChange={(value) =>
                updateGlobal("transitionDurationMs", Number.parseInt(value, 10) || 0)
              }
            />
          </div>
          <p className="admin-security-note">
            Reduced motion always respects the visitor's operating-system preference. Motion can be
            disabled globally, but that accessibility choice cannot be overridden.
          </p>
        </Card>

        <Card
          id="motion-page-experience"
          title="VELORI visual tokens"
          subtitle="Published theme values are applied as CSS tokens and preserve the visitor's light/dark mode choice."
        >
          <div className="admin-form-grid">
            {Object.entries(config.theme).map(([key, value]) => (
              <label className="admin-color-field" key={key}>
                <span>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</span>
                <input
                  type="color"
                  value={value}
                  disabled={!canWrite}
                  onChange={(event) => updateTheme(key, event.target.value)}
                />
                <code>{value}</code>
              </label>
            ))}
          </div>
        </Card>

        <Card
          id="motion-page-rules"
          title="Component motion"
          subtitle="These approved settings control shared button, feed card, loading skeleton, and empty-state motion."
        >
          <div className="admin-form-grid">
            {config.componentRules.map((rule) => {
              const presets =
                rule.componentId === "button-hover"
                  ? ["none", "fade", "scale-soft"]
                  : rule.componentId === "card-hover"
                    ? ["none", "fade-up", "scale-soft"]
                    : rule.componentId === "loading"
                      ? ["none", "fade", "pulse", "shimmer"]
                      : ["none", "fade", "fade-up"];
              return (
                <div className="motion-component-rule" key={rule.componentId}>
                  <strong>{rule.componentId.replace(/-/g, " ")}</strong>
                  <SelectField
                    label="Preset"
                    value={rule.preset}
                    options={presets}
                    disabled={!canWrite}
                    onChange={(value) => updateComponentRule(rule.componentId, "preset", value)}
                  />
                  <TextField
                    label="Duration (ms)"
                    value={String(rule.durationMs)}
                    disabled={!canWrite}
                    onChange={(value) =>
                      updateComponentRule(
                        rule.componentId,
                        "durationMs",
                        Number.parseInt(value, 10) || 0,
                      )
                    }
                  />
                  <SelectField
                    label="Intensity"
                    value={rule.intensity}
                    options={["off", "subtle", "standard", "expressive", "cinematic"]}
                    disabled={!canWrite}
                    onChange={(value) => updateComponentRule(rule.componentId, "intensity", value)}
                  />
                  <ToggleField
                    label="Enabled"
                    checked={rule.enabled}
                    disabled={!canWrite}
                    onChange={(value) => updateComponentRule(rule.componentId, "enabled", value)}
                  />
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          id="motion-error-rules"
          title="Page experience settings"
          subtitle="Published settings are resolved per registered route. A page override wins over the built-in global loading and error presentation."
        >
          {routeOptions.length ? (
            <div className="admin-form-grid">
              <SelectField
                label="Registered page"
                value={selectedRoute}
                options={routeOptions}
                disabled={!canWrite}
                onChange={(value) => {
                  setSelectedRoute(value);
                  setPagePreview(null);
                }}
              />
              <ToggleField
                label="Enable page overrides"
                checked={experience?.enabled === true}
                disabled={!canWrite}
                onChange={(value) => {
                  if (!selectedRoute) return;
                  if (experience) {
                    change((current) => ({
                      ...current,
                      pageExperiences: current.pageExperiences.map((item) =>
                        item.route === selectedRoute ? { ...item, enabled: value } : item,
                      ),
                    }));
                  } else if (value) {
                    updatePageExperience("loading", "enabled", false);
                  }
                }}
              />
            </div>
          ) : (
            <Notice tone="error">
              The registered page list is unavailable, so page settings are read-only.
            </Notice>
          )}

          {experience?.enabled ? (
            <div className="motion-page-experience">
              <section className="motion-experience-section">
                <ToggleField
                  label="Startup experience"
                  checked={experience.startup.enabled}
                  disabled={!canWrite}
                  onChange={(value) => updatePageExperience("startup", "enabled", value)}
                />
                <SelectField
                  label="Startup motion"
                  value={experience.startup.preset}
                  options={MOTION_PRESETS as readonly MotionPreset[]}
                  disabled={!canWrite || !experience.startup.enabled}
                  onChange={(value) => updatePageExperience("startup", "preset", value)}
                />
                <SelectField
                  label="Startup video"
                  value={experience.startup.assetUrl}
                  options={assetOptions}
                  disabled={!canWrite || !experience.startup.enabled}
                  onChange={(value) => updatePageExperience("startup", "assetUrl", value)}
                />
                <TextField
                  label="Duration (ms)"
                  value={String(experience.startup.durationMs)}
                  disabled={!canWrite || !experience.startup.enabled}
                  onChange={(value) =>
                    updatePageExperience("startup", "durationMs", Number.parseInt(value, 10) || 0)
                  }
                />
                <TextField
                  label="Delay (ms)"
                  value={String(experience.startup.delayMs)}
                  disabled={!canWrite || !experience.startup.enabled}
                  onChange={(value) =>
                    updatePageExperience("startup", "delayMs", Number.parseInt(value, 10) || 0)
                  }
                />
                <TextField
                  label="Minimum display (ms)"
                  value={String(experience.startup.minimumDisplayMs)}
                  disabled={!canWrite || !experience.startup.enabled}
                  onChange={(value) =>
                    updatePageExperience(
                      "startup",
                      "minimumDisplayMs",
                      Number.parseInt(value, 10) || 0,
                    )
                  }
                />
                <ToggleField
                  label="Loop video"
                  checked={experience.startup.loop}
                  disabled={!canWrite || !experience.startup.enabled}
                  onChange={(value) => updatePageExperience("startup", "loop", value)}
                />
                <ToggleField
                  label="Show once per session"
                  checked={experience.startup.showOncePerSession}
                  disabled={!canWrite || !experience.startup.enabled}
                  onChange={(value) => updatePageExperience("startup", "showOncePerSession", value)}
                />
              </section>

              <section className="motion-experience-section">
                <ToggleField
                  label="Page loader"
                  checked={experience.loading.enabled}
                  disabled={!canWrite}
                  onChange={(value) => updatePageExperience("loading", "enabled", value)}
                />
                <SelectField
                  label="Loading motion"
                  value={experience.loading.preset}
                  options={["none", "fade", "pulse", "shimmer"]}
                  disabled={!canWrite || !experience.loading.enabled}
                  onChange={(value) => updatePageExperience("loading", "preset", value)}
                />
                <SelectField
                  label="Loading video"
                  value={experience.loading.assetUrl}
                  options={assetOptions}
                  disabled={!canWrite || !experience.loading.enabled}
                  onChange={(value) => updatePageExperience("loading", "assetUrl", value)}
                />
                <TextField
                  label="Loading message"
                  value={experience.loading.message}
                  disabled={!canWrite || !experience.loading.enabled}
                  onChange={(value) => updatePageExperience("loading", "message", value)}
                />
              </section>

              <section className="motion-experience-section">
                <ToggleField
                  label="Page error experience"
                  checked={experience.error.enabled}
                  disabled={!canWrite}
                  onChange={(value) => updatePageExperience("error", "enabled", value)}
                />
                <SelectField
                  label="Error motion"
                  value={experience.error.preset}
                  options={MOTION_PRESETS as readonly MotionPreset[]}
                  disabled={!canWrite || !experience.error.enabled}
                  onChange={(value) => updatePageExperience("error", "preset", value)}
                />
                <SelectField
                  label="Error video"
                  value={experience.error.assetUrl}
                  options={assetOptions}
                  disabled={!canWrite || !experience.error.enabled}
                  onChange={(value) => updatePageExperience("error", "assetUrl", value)}
                />
                <TextField
                  label="Error title"
                  value={experience.error.title}
                  disabled={!canWrite || !experience.error.enabled}
                  onChange={(value) => updatePageExperience("error", "title", value)}
                />
                <TextField
                  label="Error message"
                  value={experience.error.message}
                  disabled={!canWrite || !experience.error.enabled}
                  onChange={(value) => updatePageExperience("error", "message", value)}
                />
                <TextField
                  label="Recovery button"
                  value={experience.error.actionLabel}
                  disabled={!canWrite || !experience.error.enabled}
                  onChange={(value) => updatePageExperience("error", "actionLabel", value)}
                />
                <TextField
                  label="Recovery destination"
                  value={experience.error.actionUrl}
                  disabled={!canWrite || !experience.error.enabled}
                  onChange={(value) => updatePageExperience("error", "actionUrl", value)}
                />
              </section>

              <section className="motion-experience-section">
                <ToggleField
                  label="Page maintenance"
                  checked={experience.maintenance.enabled}
                  disabled={!canWrite}
                  onChange={(value) => updatePageExperience("maintenance", "enabled", value)}
                />
                <SelectField
                  label="Maintenance motion"
                  value={experience.maintenance.preset}
                  options={MOTION_PRESETS as readonly MotionPreset[]}
                  disabled={!canWrite || !experience.maintenance.enabled}
                  onChange={(value) => updatePageExperience("maintenance", "preset", value)}
                />
                <SelectField
                  label="Maintenance video"
                  value={experience.maintenance.assetUrl}
                  options={assetOptions}
                  disabled={!canWrite || !experience.maintenance.enabled}
                  onChange={(value) => updatePageExperience("maintenance", "assetUrl", value)}
                />
                <TextField
                  label="Maintenance title"
                  value={experience.maintenance.title}
                  disabled={!canWrite || !experience.maintenance.enabled}
                  onChange={(value) => updatePageExperience("maintenance", "title", value)}
                />
                <TextField
                  label="Maintenance message"
                  value={experience.maintenance.message}
                  disabled={!canWrite || !experience.maintenance.enabled}
                  onChange={(value) => updatePageExperience("maintenance", "message", value)}
                />
                <TextField
                  label="Recovery button"
                  value={experience.maintenance.actionLabel}
                  disabled={!canWrite || !experience.maintenance.enabled}
                  onChange={(value) => updatePageExperience("maintenance", "actionLabel", value)}
                />
                <TextField
                  label="Recovery destination"
                  value={experience.maintenance.actionUrl}
                  disabled={!canWrite || !experience.maintenance.enabled}
                  onChange={(value) => updatePageExperience("maintenance", "actionUrl", value)}
                />
              </section>

              <div className="admin-row-actions">
                <Button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => setPagePreview("startup")}
                >
                  Preview startup
                </Button>
                <Button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => setPagePreview("loading")}
                >
                  Preview loader
                </Button>
                <Button type="button" disabled={!canWrite} onClick={() => setPagePreview("error")}>
                  Preview error
                </Button>
                <Button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => setPagePreview("maintenance")}
                >
                  Preview maintenance
                </Button>
                <Button type="button" disabled={!canWrite} onClick={removePageExperience}>
                  Clear page overrides
                </Button>
              </div>
              {pagePreview === "loading" ? (
                <div className="motion-experience-preview" role="status">
                  {experience.loading.assetUrl ? (
                    <video src={experience.loading.assetUrl} autoPlay muted loop playsInline />
                  ) : (
                    <span
                      className={`motion-loader-mark motion-loader-${experience.loading.preset}`}
                    />
                  )}
                  <p>
                    {experience.loading.message ||
                      `Loading ${String(routeOptions.find((option) => option.value === selectedRoute)?.label ?? selectedRoute)}…`}
                  </p>
                </div>
              ) : null}
              {pagePreview === "startup" ? (
                <div className="motion-experience-preview" role="status">
                  {experience.startup.assetUrl ? (
                    <video
                      src={experience.startup.assetUrl}
                      controls
                      autoPlay
                      muted
                      loop={experience.startup.loop}
                      playsInline
                    />
                  ) : (
                    <span
                      className={`motion-loader-mark motion-loader-${experience.startup.preset}`}
                      data-motion-preset={experience.startup.preset}
                      style={
                        {
                          "--motion-duration": `${experience.startup.durationMs}ms`,
                        } as React.CSSProperties
                      }
                    />
                  )}
                  <p>Startup preview for {selectedRoute}</p>
                </div>
              ) : null}
              {pagePreview === "error" ? (
                <ErrorPage
                  status={500}
                  title={experience.error.title || "VELORI is having trouble."}
                  message={experience.error.message || "This is the configured page error preview."}
                  animated
                  preview
                  errorTypeOverride="SERVER_ERROR"
                  previewConfig={config}
                  previewPathname={selectedRoute}
                />
              ) : null}
              {pagePreview === "maintenance" ? (
                <Maintenance preview previewConfig={config} previewPathname={selectedRoute} />
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card
          title="Page and route rules"
          subtitle="Exact routes take priority over the most specific wildcard, then page type, then the global transition."
        >
          {config.pageRules.map((rule) => (
            <MotionRuleEditor
              key={rule.id}
              rule={rule}
              errorRule={false}
              assetOptions={assetOptions}
              disabled={!canWrite}
              onChange={(key, value) => editRule("pageRules", rule.id, key, value)}
              onDuplicate={() =>
                change((current) => ({
                  ...current,
                  pageRules: [...current.pageRules, { ...rule, id: createUuid(), enabled: false }],
                }))
              }
              onRemove={() =>
                change((current) => ({
                  ...current,
                  pageRules: current.pageRules.filter((item) => item.id !== rule.id),
                }))
              }
            />
          ))}
          <Button
            type="button"
            disabled={!canWrite || config.pageRules.length >= 200}
            onClick={() => addRule("pageRules")}
          >
            Add page rule
          </Button>
        </Card>

        <Card
          id="motion-errors"
          title="Error-page rules"
          subtitle="Error rules resolve by route specificity, then exact error type, then priority. Unmatched failures use the built-in safe fallback."
        >
          {config.errorRules.map((rule) => (
            <MotionRuleEditor
              key={rule.id}
              rule={rule}
              errorRule
              assetOptions={assetOptions}
              disabled={!canWrite}
              onChange={(key, value) => editRule("errorRules", rule.id, key, value)}
              onUpload={async (file) => {
                let url = "";
                const uploadCode: Record<string, string> = {
                  NOT_FOUND: "404",
                  FORBIDDEN: "403",
                  RATE_LIMITED: "429",
                  SERVER_ERROR: "500",
                  MAINTENANCE: "maintenance",
                  OFFLINE: "network",
                  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
                  APPLICATION_ERROR: "APPLICATION_ERROR",
                };
                await guarded(async () => {
                  const result = await adminUploadErrorIllustration(
                    uploadCode[rule.errorType ?? ""] ?? "generic",
                    file,
                  );
                  url = result.url;
                });
                if (!url) throw new Error("The upload did not return a media URL.");
                return url;
              }}
              onDuplicate={() =>
                change((current) => ({
                  ...current,
                  errorRules: [
                    ...current.errorRules,
                    { ...rule, id: createUuid(), enabled: false },
                  ],
                }))
              }
              onRemove={() =>
                change((current) => ({
                  ...current,
                  errorRules: current.errorRules.filter((item) => item.id !== rule.id),
                }))
              }
            />
          ))}
          <Button
            type="button"
            disabled={!canWrite || config.errorRules.length >= 200}
            onClick={() => addRule("errorRules")}
          >
            Add error rule
          </Button>
          <div className="admin-form-grid motion-error-content">
            {ERROR_TYPES.map((code) => (
              <div className="motion-error-row" key={code}>
                <strong>{code.replace(/_/g, " ")}</strong>
                <TextField
                  label="Heading"
                  value={config.errorPages[code]?.title ?? ""}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "title", value)}
                />
                <TextField
                  label="Message"
                  value={config.errorPages[code]?.subtitle ?? ""}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "subtitle", value)}
                />
                <SelectField
                  label="Animation"
                  value={config.errorPages[code]?.preset ?? "error-reveal"}
                  options={MOTION_PRESETS as readonly MotionPreset[]}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "preset", value)}
                />
                <TextField
                  label="Animation duration (ms)"
                  value={String(config.errorPages[code]?.durationMs ?? 260)}
                  disabled={!canWrite}
                  onChange={(value) =>
                    updateErrorPage(code, "durationMs", Number.parseInt(value, 10) || 0)
                  }
                />
                <SelectField
                  label="Intensity"
                  value={config.errorPages[code]?.intensity ?? "standard"}
                  options={["off", "subtle", "standard", "expressive", "cinematic"]}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "intensity", value)}
                />
                <SelectField
                  label="Layout"
                  value={config.errorPages[code]?.layout ?? "centered"}
                  options={["centered", "split", "illustration-top"]}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "layout", value)}
                />
                <SelectField
                  label="Alignment"
                  value={config.errorPages[code]?.alignment ?? "center"}
                  options={["left", "center", "right"]}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "alignment", value)}
                />
                <TextField
                  label="Illustration asset URL"
                  value={config.errorPages[code]?.illustrationUrl ?? ""}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "illustrationUrl", value)}
                  placeholder="/storage/v1/object/public/site-assets/..."
                />
                <input
                  aria-label={`Upload ${code.replace(/_/g, " ")} SVG`}
                  type="file"
                  accept="image/svg+xml,.svg"
                  disabled={!canWrite || uploadingErrorAsset === code}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (!file) return;
                    const uploadCode: Record<string, string> = {
                      NOT_FOUND: "404",
                      FORBIDDEN: "403",
                      RATE_LIMITED: "429",
                      SERVER_ERROR: "500",
                      MAINTENANCE: "maintenance",
                      OFFLINE: "network",
                      SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
                      APPLICATION_ERROR: "APPLICATION_ERROR",
                    };
                    setUploadingErrorAsset(code);
                    setErrorAssetUploadError("");
                    void guarded(async () => {
                      const result = await adminUploadErrorIllustration(
                        uploadCode[code] ?? "generic",
                        file,
                      );
                      updateErrorPage(code, "illustrationUrl", result.url);
                    })
                      .catch((caught: unknown) =>
                        setErrorAssetUploadError(
                          caught instanceof Error ? caught.message : String(caught),
                        ),
                      )
                      .finally(() => setUploadingErrorAsset(null));
                  }}
                />
                {uploadingErrorAsset === code ? <span>Uploading SVG…</span> : null}
                {errorAssetUploadError && uploadingErrorAsset === null ? (
                  <Notice tone="error">{errorAssetUploadError}</Notice>
                ) : null}
                <SelectField
                  label="Uploaded MP4 illustration"
                  value={config.errorPages[code]?.illustrationUrl ?? ""}
                  options={[
                    ...assetOptions,
                    ...(config.errorPages[code]?.illustrationUrl &&
                    !assetOptions.some(
                      (option) => option.value === config.errorPages[code]?.illustrationUrl,
                    )
                      ? [
                          {
                            value: config.errorPages[code]?.illustrationUrl ?? "",
                            label: "Current illustration",
                          },
                        ]
                      : []),
                  ]}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "illustrationUrl", value)}
                />
                <div className="admin-row-actions">
                  <label className="admin-muted" htmlFor={`error-illustration-${code}`}>
                    SVG illustration (512 KB maximum)
                  </label>
                  <input
                    id={`error-illustration-${code}`}
                    type="file"
                    accept="image/svg+xml,.svg"
                    disabled={!canWrite || uploadingErrorCode === code}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      setUploadingErrorCode(code);
                      void (async () => {
                        let url = "";
                        await guarded(async () => {
                          const uploaded = await adminUploadErrorIllustration(code, file);
                          url = uploaded.url;
                        });
                        if (!url) throw new Error("The illustration upload returned no URL.");
                        updateErrorPage(code, "illustrationUrl", url);
                      })()
                        .catch((caught: unknown) =>
                          setError(caught instanceof Error ? caught.message : String(caught)),
                        )
                        .finally(() => setUploadingErrorCode(null));
                    }}
                  />
                  {uploadingErrorCode === code ? <span>Uploading SVG…</span> : null}
                </div>
                <TextField
                  label="Logo asset URL"
                  value={config.errorPages[code]?.logoUrl ?? ""}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "logoUrl", value)}
                  placeholder="/storage/v1/object/public/site-assets/..."
                />
                <TextField
                  label="Background color"
                  value={config.errorPages[code]?.backgroundColor ?? ""}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "backgroundColor", value)}
                  placeholder="#ffffff"
                />
                <TextField
                  label="Primary button label"
                  value={config.errorPages[code]?.primaryLabel ?? ""}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "primaryLabel", value)}
                />
                <TextField
                  label="Primary button URL"
                  value={config.errorPages[code]?.primaryUrl ?? ""}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "primaryUrl", value)}
                  placeholder="/home"
                />
                <TextField
                  label="Secondary button label"
                  value={config.errorPages[code]?.secondaryLabel ?? ""}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "secondaryLabel", value)}
                />
                <TextField
                  label="Secondary button URL"
                  value={config.errorPages[code]?.secondaryUrl ?? ""}
                  disabled={!canWrite}
                  onChange={(value) => updateErrorPage(code, "secondaryUrl", value)}
                  placeholder="/help"
                />
                <ToggleField
                  label="Use custom error design"
                  checked={config.errorPages[code]?.enabled ?? true}
                  disabled={!canWrite}
                  onChange={(value) =>
                    change((current) => ({
                      ...current,
                      errorPages: {
                        ...current.errorPages,
                        [code]: { ...current.errorPages[code], enabled: value },
                      },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </Card>

        <Card
          id="motion-preview"
          title="Production renderer preview"
          subtitle="This uses the same ErrorPage renderer as the public app. Drafts stay private to this admin session."
        >
          <div className="admin-form-grid">
            <SelectField
              label="Preview state"
              value={previewMode}
              options={["normal", "error"]}
              onChange={(value) => setPreviewMode(value as "normal" | "error")}
            />
            {previewMode === "error" ? (
              <SelectField
                label="Error state"
                value={previewType}
                options={ERROR_TYPES}
                onChange={(value) => setPreviewType(value)}
              />
            ) : null}
            <TextField
              label="Route"
              value={previewPath}
              onChange={setPreviewPath}
              placeholder="/profile/unknown-user"
            />
            <SelectField
              label="Preview device"
              value={device}
              options={["desktop", "tablet", "mobile"]}
              onChange={setDevice}
            />
          </div>
          <Button type="button" disabled={!canWrite} onClick={preview}>
            Preview draft
          </Button>
          {previewMode === "error" && resolvedPreview ? (
            <p className="admin-security-note">
              Resolved: {String(resolvedPreview.source)} · {String(resolvedPreview.preset)}.
            </p>
          ) : null}
          {previewMode === "normal" && resolvedPagePreview ? (
            <p className="admin-security-note">
              Resolved page: {String(resolvedPagePreview.source)} ·{" "}
              {String(resolvedPagePreview.preset)}.
            </p>
          ) : null}
          {previewConfig ? (
            <div
              className={`motion-preview-frame preview-device-${device}`}
              key={previewTick}
              data-motion-button-hover={
                previewConfig.componentRules.find((rule) => rule.componentId === "button-hover")
                  ?.preset ?? "none"
              }
              data-motion-card-hover={
                previewConfig.componentRules.find((rule) => rule.componentId === "card-hover")
                  ?.preset ?? "none"
              }
              data-motion-loading={
                previewConfig.componentRules.find((rule) => rule.componentId === "loading")
                  ?.preset ?? "none"
              }
              data-motion-empty-state={
                previewConfig.componentRules.find((rule) => rule.componentId === "empty-state")
                  ?.preset ?? "none"
              }
              style={
                {
                  "--motion-brand-pink": previewConfig.theme.brandPink,
                  "--motion-brand-blue": previewConfig.theme.brandBlue,
                  "--motion-surface": previewDark
                    ? previewConfig.theme.darkSurface
                    : previewConfig.theme.surface,
                  "--motion-background": previewDark
                    ? previewConfig.theme.darkBackground
                    : previewConfig.theme.background,
                  "--motion-text": previewDark
                    ? previewConfig.theme.darkText
                    : previewConfig.theme.text,
                  "--background-primary": previewDark
                    ? previewConfig.theme.darkBackground
                    : previewConfig.theme.background,
                  "--surface-primary": previewDark
                    ? previewConfig.theme.darkSurface
                    : previewConfig.theme.surface,
                  "--text-primary": previewDark
                    ? previewConfig.theme.darkText
                    : previewConfig.theme.text,
                  "--brand-pink": previewConfig.theme.brandPink,
                  "--brand-blue": previewConfig.theme.brandBlue,
                  "--motion-button-hover-duration": `${previewConfig.componentRules.find((rule) => rule.componentId === "button-hover")?.durationMs ?? 160}ms`,
                  "--motion-card-hover-duration": `${previewConfig.componentRules.find((rule) => rule.componentId === "card-hover")?.durationMs ?? 220}ms`,
                  "--motion-loading-duration": `${previewConfig.componentRules.find((rule) => rule.componentId === "loading")?.durationMs ?? 1200}ms`,
                  "--motion-empty-state-duration": `${previewConfig.componentRules.find((rule) => rule.componentId === "empty-state")?.durationMs ?? 240}ms`,
                  "--motion-button-hover-scale": previewComponentScale(
                    previewConfig.componentRules.find((rule) => rule.componentId === "button-hover")
                      ?.intensity,
                  ),
                  "--motion-card-hover-scale": previewComponentScale(
                    previewConfig.componentRules.find((rule) => rule.componentId === "card-hover")
                      ?.intensity,
                  ),
                } as React.CSSProperties
              }
            >
              {previewMode === "normal" ? (
                <section
                  className="motion-page motion-preview-sample"
                  data-motion-preset={resolvedPagePreview?.preset ?? "none"}
                  style={
                    {
                      "--motion-duration": `${resolvedPagePreview?.durationMs ?? 0}ms`,
                      "--motion-delay": `${resolvedPagePreview?.delayMs ?? 0}ms`,
                      "--motion-distance": `${resolvedPagePreview?.distance ?? 12}px`,
                      "--motion-easing": String(resolvedPagePreview?.easing ?? "ease-out"),
                      ...(resolvedPagePreview?.backgroundColor
                        ? { backgroundColor: resolvedPagePreview.backgroundColor }
                        : {}),
                      ...(resolvedPagePreview?.surfaceColor
                        ? { "--surface-primary": resolvedPagePreview.surfaceColor }
                        : {}),
                    } as React.CSSProperties
                  }
                >
                  <span className="eyebrow">VELORI PAGE PREVIEW</span>
                  <h2>{previewPath || "/home"}</h2>
                  <p>
                    {pageTypeForPath(previewPath || "/home")} route ·{" "}
                    {String(resolvedPagePreview?.source ?? "safe fallback")}
                  </p>
                  <article className="post-card">
                    <strong>A sample feed card</strong>
                    <p>Route motion is resolved from the current draft configuration.</p>
                    <button className="button button-primary" type="button">
                      Like
                    </button>
                  </article>
                </section>
              ) : previewType === "NOT_FOUND" ? (
                <NotFound
                  preview
                  previewConfig={previewConfig}
                  previewPathname={previewPath || "/unknown-page"}
                  previewDevice={device as "desktop" | "tablet" | "mobile"}
                />
              ) : previewType === "MAINTENANCE" ? (
                <Maintenance
                  preview
                  previewConfig={previewConfig}
                  previewPathname={previewPath || "/maintenance"}
                  previewDevice={device as "desktop" | "tablet" | "mobile"}
                />
              ) : (
                <ErrorPage
                  status={errorStatuses[previewType]}
                  errorTypeOverride={previewType}
                  title={
                    previewConfig.errorPages[previewType]?.title || previewType.replace(/_/g, " ")
                  }
                  message={
                    previewConfig.errorPages[previewType]?.subtitle ||
                    "This is the selected public error state."
                  }
                  animated
                  preview
                  previewConfig={previewConfig}
                  previewPathname={previewPath || "/unknown-page"}
                  previewDevice={device as "desktop" | "tablet" | "mobile"}
                />
              )}
            </div>
          ) : null}
        </Card>

        <Card
          id="motion-publish"
          title="Draft and publish"
          subtitle="Draft changes are private. Publish creates an immutable version; rollback publishes a new version from a historical snapshot."
        >
          <TextField
            label="Change summary"
            value={summary}
            onChange={setSummary}
            maxLength={500}
            disabled={!canWrite}
            placeholder="Describe the visual change"
          />
          <div className="admin-row-actions">
            <Button
              type="button"
              disabled={!canWrite || busy || !dirty}
              onClick={() => void saveDraft()}
            >
              {busy ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="button"
              disabled={!canPublish || busy || !summary.trim()}
              className="admin-primary"
              onClick={() => void publish()}
            >
              {busy ? "Publishing…" : "Publish"}
            </Button>
            <Button type="button" disabled={!canWrite || busy} onClick={copyPublished}>
              Revert draft
            </Button>
          </div>
        </Card>

        <Card
          id="motion-history"
          title="Version history"
          subtitle="Published and rollback snapshots are preserved for audit and recovery."
        >
          {versions.length ? (
            versions.map((version) => (
              <div className="admin-row motion-version-row" key={String(version.version)}>
                <div>
                  <strong>Version {String(version.version)}</strong>
                  <small>
                    {String(version.event)} · {formatDate(String(version.created_at))} ·{" "}
                    {String(version.change_summary || "No summary")}
                  </small>
                </div>
                <Button
                  type="button"
                  disabled={!canPublish || busy}
                  onClick={() => setRestoreVersion(Number(version.version))}
                >
                  Restore
                </Button>
              </div>
            ))
          ) : (
            <Empty>No published motion versions are recorded yet.</Empty>
          )}
          {versions.length > 1 ? (
            <div className="motion-version-compare">
              <div className="admin-form-grid">
                <SelectField
                  label="Compare version A"
                  value={compareA || String(versionA?.version ?? "")}
                  options={versions.map((version) => String(version.version))}
                  onChange={setCompareA}
                />
                <SelectField
                  label="Compare version B"
                  value={compareB || String(versionB?.version ?? "")}
                  options={versions.map((version) => String(version.version))}
                  onChange={setCompareB}
                />
              </div>
              {versionA && versionB ? (
                <div className="motion-version-diff">
                  <pre>
                    <strong>Version {String(versionA.version)}</strong>
                    {"\n"}
                    {formatMotionSnapshot(versionA.snapshot)}
                  </pre>
                  <pre>
                    <strong>Version {String(versionB.version)}</strong>
                    {"\n"}
                    {formatMotionSnapshot(versionB.snapshot)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>

        {restoreVersion !== null ? (
          <Dialog
            title="Restore motion version?"
            description={`Version ${restoreVersion} will be published as a new version. Existing history will remain.`}
            onClose={() => setRestoreVersion(null)}
            actions={
              <Button
                type="button"
                className="admin-primary"
                disabled={busy}
                onClick={() => void restore(restoreVersion)}
              >
                Restore and publish
              </Button>
            }
          />
        ) : null}
      </div>
    </>
  );
}

function formatMotionSnapshot(snapshot: unknown): string {
  try {
    return JSON.stringify(normalizeMotionConfig(snapshot), null, 2);
  } catch {
    return JSON.stringify(snapshot, null, 2) ?? "Unable to display this snapshot.";
  }
}

function previewComponentScale(intensity: string | undefined): string {
  const factors: Record<string, number> = {
    off: 1,
    subtle: 0.5,
    standard: 1,
    expressive: 1.5,
    cinematic: 2,
  };
  return String(1 + 0.02 * (factors[intensity ?? "subtle"] ?? 0.5));
}

function MotionRuleEditor({
  rule,
  errorRule,
  assetOptions,
  disabled,
  onChange,
  onUpload,
  onDuplicate,
  onRemove,
}: {
  rule: MotionRule;
  errorRule: boolean;
  assetOptions: { value: string; label: string }[];
  disabled: boolean;
  onChange: (key: string, value: unknown) => void;
  onUpload?: (file: File) => Promise<string>;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const uploadInput = useRef<HTMLInputElement>(null);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [uploadError, setUploadError] = useState("");
  return (
    <div className="motion-rule-editor">
      <div className="admin-form-grid">
        <SelectField
          label="Rule type"
          value={rule.ruleType}
          options={["exact", "pattern", "page_type"]}
          disabled={disabled}
          onChange={(value) => onChange("ruleType", value)}
        />
        {rule.ruleType === "page_type" ? (
          <SelectField
            label="Page type"
            value={rule.pageType || "feed"}
            options={PAGE_TYPES}
            disabled={disabled}
            onChange={(value) => onChange("pageType", value)}
          />
        ) : (
          <TextField
            label={rule.ruleType === "exact" ? "Exact route" : "Route pattern"}
            value={rule.routePattern}
            disabled={disabled}
            onChange={(value) => onChange("routePattern", value)}
            placeholder={rule.ruleType === "exact" ? "/explore" : "/profile/*"}
          />
        )}
        {errorRule ? (
          <SelectField
            label="Error type"
            value={rule.errorType ?? "NOT_FOUND"}
            options={[...ERROR_TYPES, "*"]}
            disabled={disabled}
            onChange={(value) => onChange("errorType", value)}
          />
        ) : null}
        <SelectField
          label="Approved preset"
          value={rule.preset}
          options={MOTION_PRESETS as readonly MotionPreset[]}
          disabled={disabled}
          onChange={(value) => onChange("preset", value)}
        />
        <SelectField
          label="Device"
          value={rule.deviceScope}
          options={["all", "desktop", "tablet", "mobile"]}
          disabled={disabled}
          onChange={(value) => onChange("deviceScope", value)}
        />
        <SelectField
          label="Easing"
          value={rule.easing}
          options={["linear", "ease", "ease-in", "ease-out", "ease-in-out", "spring"]}
          disabled={disabled}
          onChange={(value) => onChange("easing", value)}
        />
        <TextField
          label="Duration (ms)"
          value={String(rule.durationMs)}
          disabled={disabled}
          onChange={(value) => onChange("durationMs", Number.parseInt(value, 10) || 0)}
        />
        <TextField
          label="Delay (ms)"
          value={String(rule.delayMs)}
          disabled={disabled}
          onChange={(value) => onChange("delayMs", Number.parseInt(value, 10) || 0)}
        />
        <TextField
          label="Priority"
          value={String(rule.priority)}
          disabled={disabled}
          onChange={(value) => onChange("priority", Number.parseInt(value, 10) || 0)}
        />
        <TextField
          label="Starts at (optional ISO date)"
          value={rule.startsAt}
          disabled={disabled}
          onChange={(value) => onChange("startsAt", value)}
          placeholder="2026-10-18T09:00:00Z"
        />
        <TextField
          label="Ends at (optional ISO date)"
          value={rule.endsAt}
          disabled={disabled}
          onChange={(value) => onChange("endsAt", value)}
          placeholder="2026-10-31T18:00:00Z"
        />
        {!errorRule ? (
          <>
            <TextField
              label="Page background color"
              value={rule.backgroundColor}
              disabled={disabled}
              onChange={(value) => onChange("backgroundColor", value)}
              placeholder="Inherit global background or use #hex"
            />
            <TextField
              label="Page surface color"
              value={rule.surfaceColor}
              disabled={disabled}
              onChange={(value) => onChange("surfaceColor", value)}
              placeholder="Inherit global surface or use #hex"
            />
          </>
        ) : null}
        {errorRule ? (
          <>
            <TextField
              label="Custom heading"
              value={rule.title ?? ""}
              disabled={disabled}
              onChange={(value) => onChange("title", value)}
            />
            <TextField
              label="Custom message"
              value={rule.subtitle ?? ""}
              disabled={disabled}
              onChange={(value) => onChange("subtitle", value)}
            />
            <TextField
              label="Animation asset URL"
              value={rule.assetUrl ?? ""}
              disabled={disabled}
              onChange={(value) => onChange("assetUrl", value)}
              placeholder="Uploaded public site-assets URL"
            />
            <SelectField
              label="Select an uploaded MP4"
              value={rule.assetUrl ?? ""}
              options={assetOptions}
              disabled={disabled}
              onChange={(value) => onChange("assetUrl", value)}
            />
            <div className="admin-row-actions">
              <input
                ref={uploadInput}
                type="file"
                accept="image/svg+xml,.svg"
                hidden
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (!file || !onUpload) return;
                  setUploadingAsset(true);
                  setUploadError("");
                  void onUpload(file)
                    .then((url) => onChange("assetUrl", url))
                    .catch((caught: unknown) =>
                      setUploadError(caught instanceof Error ? caught.message : String(caught)),
                    )
                    .finally(() => setUploadingAsset(false));
                }}
              />
              <Button
                type="button"
                disabled={disabled || uploadingAsset || !onUpload}
                onClick={() => uploadInput.current?.click()}
              >
                {uploadingAsset ? "Uploading SVG…" : "Upload SVG to draft"}
              </Button>
              {uploadError ? <Notice tone="error">{uploadError}</Notice> : null}
            </div>
            <TextField
              label="Primary action label"
              value={rule.primaryLabel ?? ""}
              disabled={disabled}
              onChange={(value) => onChange("primaryLabel", value)}
            />
            <TextField
              label="Primary action URL"
              value={rule.primaryUrl ?? ""}
              disabled={disabled}
              onChange={(value) => onChange("primaryUrl", value)}
              placeholder="/home"
            />
            <TextField
              label="Secondary action label"
              value={rule.secondaryLabel ?? ""}
              disabled={disabled}
              onChange={(value) => onChange("secondaryLabel", value)}
            />
            <TextField
              label="Secondary action URL"
              value={rule.secondaryUrl ?? ""}
              disabled={disabled}
              onChange={(value) => onChange("secondaryUrl", value)}
              placeholder="/help"
            />
            <SelectField
              label="Layout"
              value={rule.layout ?? "centered"}
              options={["centered", "split", "illustration-top"]}
              disabled={disabled}
              onChange={(value) => onChange("layout", value)}
            />
            <SelectField
              label="Text alignment"
              value={rule.alignment ?? "center"}
              options={["left", "center", "right"]}
              disabled={disabled}
              onChange={(value) => onChange("alignment", value)}
            />
          </>
        ) : null}
      </div>
      <div className="admin-row-actions">
        <ToggleField
          label="Enabled"
          checked={rule.enabled}
          disabled={disabled}
          onChange={(value) => onChange("enabled", value)}
        />
        <SelectField
          label="Reduced motion"
          value={rule.reducedMotion}
          options={["static", "fade"]}
          disabled={disabled}
          onChange={(value) => onChange("reducedMotion", value)}
        />
        <Button type="button" disabled={disabled} onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button type="button" disabled={disabled} onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function AnimationsBody() {
  const animations = useResource(() => adminAnimations(), []);
  const canEdit = usePermission("animations.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [target, setTarget] = useState<Record<string, unknown> | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [libraryTarget, setLibraryTarget] = useState("");

  const rows = (animations.data?.animations ?? []) as Record<string, unknown>[];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Animations</Heading1>
          <p>
            Motion graphics are MP4 up to 10 MB.{" "}
            {animations.data?.reduceMotionSafeMode
              ? "Reduce-motion safe mode is on, so visitors who ask for less motion see a static screen."
              : "Reduce-motion safe mode is off."}
          </p>
        </div>
        <div className="admin-row-actions">
          <Button type="button" onClick={animations.reload}>
            Refresh
          </Button>
        </div>
      </div>

      <input
        ref={libraryInput}
        type="file"
        accept="video/mp4"
        hidden
        onChange={(event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          event.target.value = "";
          if (!file || !libraryTarget) return;
          const key = libraryTarget;
          setUploading(key);
          void guarded(async () => {
            setError(null);
            await adminUploadMotion("library", file, key);
            animations.reload();
          })
            .catch((caught: unknown) =>
              setError(caught instanceof Error ? caught.message : String(caught)),
            )
            .finally(() => setUploading(null));
        }}
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {animations.loading ? <Loading label="Loading motion settings" /> : null}
      {animations.error ? <Notice tone="error">{animations.error}</Notice> : null}

      {!animations.loading && !animations.error ? (
        <Card title="Animations" subtitle={`${rows.length} configurable animations.`}>
          {rows.length === 0 ? (
            <Empty>No motion configurations are present.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Animation</th>
                  <th>Type</th>
                  <th>State</th>
                  <th>Uploaded media</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.key)}>
                    <td>
                      <strong>{String(row.label ?? row.key)}</strong>
                      <div className="admin-muted">{String(row.key)}</div>
                    </td>
                    <td>{String(row.animation_type ?? "—")}</td>
                    <td>
                      <Pill tone={row.enabled === false ? "warn" : "ok"}>
                        {row.enabled === false ? "off" : "on"}
                      </Pill>
                    </td>
                    <td>
                      {row.media_url ? (
                        <video
                          className="motion-library-preview"
                          src={String(row.media_url)}
                          controls
                          muted
                          playsInline
                          preload="metadata"
                          aria-label={`${String(row.label ?? row.key)} animation preview`}
                        />
                      ) : (
                        <span className="admin-muted">Built-in motion</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        {canEdit ? (
                          <>
                            <Button type="button" onClick={() => setTarget(row)}>
                              Edit
                            </Button>
                            <Button
                              type="button"
                              disabled={uploading === String(row.key)}
                              onClick={() => {
                                setLibraryTarget(String(row.key));
                                libraryInput.current?.click();
                              }}
                            >
                              {uploading === String(row.key)
                                ? "Uploading…"
                                : row.media_url
                                  ? "Replace MP4"
                                  : "Add MP4"}
                            </Button>
                          </>
                        ) : null}
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
        <AnimationEditor
          animation={target}
          types={(animations.data?.availableTypes ?? []) as string[]}
          busy={busy}
          onClose={() => setTarget(null)}
          onSave={async (payload) => {
            await guarded(async () => {
              await adminPatchAnimation(String(target.key), payload);
              setTarget(null);
              animations.reload();
            }).catch(() => undefined);
          }}
        />
      ) : null}
    </>
  );
}

function AnimationEditor({
  animation,
  types,
  busy,
  onClose,
  onSave,
}: {
  animation: Record<string, unknown>;
  types: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void | Promise<void>;
}) {
  const [enabled, setEnabled] = useState(animation.enabled !== false);
  const [animationType, setAnimationType] = useState(
    String(animation.animation_type ?? types[0] ?? ""),
  );
  const [duration, setDuration] = useState(String(animation.duration_ms ?? "0"));
  const [delay, setDelay] = useState(String(animation.delay_ms ?? "0"));
  const [intensity, setIntensity] = useState(String(animation.intensity ?? "0"));

  return (
    <Dialog
      title={`Edit ${String(animation.key)}`}
      description="Timing values are clamped by the server, so an extreme value is trimmed rather than rejected."
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            className="admin-primary"
            disabled={busy}
            onClick={() =>
              void onSave({
                enabled,
                animation_type: animationType,
                duration_ms: Number(duration) || 0,
                delay_ms: Number(delay) || 0,
                intensity: Number(intensity) || 0,
              })
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
      <ToggleField label="Enabled" checked={enabled} onChange={setEnabled} />
      {types.length ? (
        <SelectField
          label="Animation type"
          value={animationType}
          options={types.map((value) => ({ value, label: value }))}
          onChange={setAnimationType}
        />
      ) : null}
      <TextField label="Duration (ms)" value={duration} onChange={setDuration} />
      <TextField label="Delay (ms)" value={delay} onChange={setDelay} />
      <TextField label="Intensity" value={intensity} onChange={setIntensity} />
      <p className="admin-muted">
        Uploaded MP4 files are managed from the animation library row and selected by name in Page
        experience settings.
      </p>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Error pages
// ---------------------------------------------------------------------------

function ErrorPagesBody() {
  const pages = useResource(() => adminErrorPages(), []);
  const canEdit = usePermission("errorpages.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [target, setTarget] = useState<Record<string, unknown> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const rows = (pages.data?.pages ?? []) as Record<string, unknown>[];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Error pages</Heading1>
          <p>
            Copy, illustration and destination for each error screen. Upload an SVG illustration or
            paste a site-assets URL; button destinations must be a site path or an absolute URL.
          </p>
        </div>
      </div>

      {saveError ? <Notice tone="error">{saveError}</Notice> : null}
      {saved ? <Notice tone="success">Error page saved.</Notice> : null}
      {pages.loading ? <Loading label="Loading error pages" /> : null}
      {pages.error ? <Notice tone="error">{pages.error}</Notice> : null}

      {!pages.loading && !pages.error ? (
        <Card title="Screens" subtitle={`${rows.length} error screens.`}>
          {rows.length === 0 ? (
            <Empty>No error pages are configured.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Button</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.code)}>
                    <td>{String(row.code)}</td>
                    <td>{String(row.title ?? "—")}</td>
                    <td>{String(row.button_label ?? "—")}</td>
                    <td>
                      {canEdit ? (
                        <Button type="button" onClick={() => setTarget(row)}>
                          Edit
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {target ? (
        <ErrorPageEditor
          page={target}
          busy={busy}
          error={saveError}
          onClose={() => {
            setTarget(null);
            setSaveError(null);
          }}
          onUpload={async (file) => {
            let url = "";
            await guarded(async () => {
              const result = await adminUploadErrorIllustration(String(target.code), file);
              url = result.url;
            });
            if (!url) throw new Error("The upload was cancelled.");
            return url;
          }}
          onSave={async (payload) => {
            setSaveError(null);
            setSaved(false);
            await guarded(async () => {
              await adminPatchErrorPage(String(target.code), payload);
              setTarget(null);
              setSaved(true);
              pages.reload();
            }).catch((caught: unknown) => {
              const message = caught instanceof Error ? caught.message : String(caught);
              setSaveError(message);
              throw caught;
            });
          }}
        />
      ) : null}
    </>
  );
}

function ErrorPageEditor({
  page,
  busy,
  error,
  onClose,
  onUpload,
  onSave,
}: {
  page: Record<string, unknown>;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onUpload: (file: File) => Promise<string>;
  onSave: (payload: Record<string, unknown>) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(String(page.title ?? ""));
  const [body, setBody] = useState(String(page.description ?? ""));
  const [buttonLabel, setButtonLabel] = useState(String(page.button_label ?? ""));
  const [buttonUrl, setButtonUrl] = useState(String(page.button_url ?? ""));
  const [illustrationUrl, setIllustrationUrl] = useState(String(page.image_url ?? ""));
  const [enabled, setEnabled] = useState(page.enabled !== false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      title={`Edit ${String(page.code)}`}
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            className="admin-primary"
            disabled={busy || uploading}
            onClick={() =>
              void onSave({
                title: title.trim(),
                description: body,
                button_label: buttonLabel.trim(),
                button_url: buttonUrl.trim(),
                image_url: illustrationUrl.trim(),
                enabled,
              })
            }
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {uploadError ? <Notice tone="error">{uploadError}</Notice> : null}
      <TextField label="Title" value={title} onChange={setTitle} />
      <AreaField label="Body" value={body} onChange={setBody} />
      <TextField label="Button label" value={buttonLabel} onChange={setButtonLabel} />
      <TextField
        label="Button URL"
        value={buttonUrl}
        onChange={setButtonUrl}
        hint="A site path or an absolute URL."
      />
      <TextField
        label="Illustration URL"
        value={illustrationUrl}
        onChange={setIllustrationUrl}
        hint="Upload an SVG, or paste a public site-assets URL."
      />
      <div className="admin-row-actions">
        <Button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? "Uploading…" : "Upload SVG"}
        </Button>
        {illustrationUrl ? (
          <Button type="button" disabled={uploading} onClick={() => setIllustrationUrl("")}>
            Clear illustration
          </Button>
        ) : null}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/svg+xml,.svg"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setUploading(true);
          setUploadError(null);
          void onUpload(file)
            .then((url) => setIllustrationUrl(url))
            .catch((caught: unknown) =>
              setUploadError(caught instanceof Error ? caught.message : String(caught)),
            )
            .finally(() => setUploading(false));
        }}
      />
      <ToggleField label="Enabled" checked={enabled} onChange={setEnabled} />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const COLOR_FIELDS = [
  { key: "primary_color", label: "Primary" },
  { key: "secondary_color", label: "Secondary" },
  { key: "accent_color", label: "Accent" },
  { key: "background_color", label: "Background" },
  { key: "surface_color", label: "Surface" },
  { key: "text_color", label: "Text" },
  { key: "muted_text_color", label: "Muted text" },
] as const;

type ThemeDraft = Record<string, string | boolean>;

function ThemeBody() {
  const appearance = useResource(() => adminAppearance(), []);
  const canEdit = usePermission("theme.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [draft, setDraft] = useState<ThemeDraft>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const theme = (appearance.data?.theme ?? {}) as Record<string, unknown>;

  const value = (key: string): string => {
    const stored = draft[key];
    return stored === undefined ? String(theme[key] ?? "") : String(stored);
  };

  const save = () =>
    void guarded(async () => {
      setError(null);
      setSaved(false);
      const payload: Record<string, unknown> = {
        border_radius: Number(value("border_radius")) || 0,
        shadow_level: value("shadow_level") || "soft",
        button_style: value("button_style") || "rounded",
        card_style: value("card_style") || "flat",
        navigation_style: value("navigation_style") || "sidebar",
        glass_effects: value("glass_effects") === "true",
        heading_font: value("heading_font"),
        body_font: value("body_font"),
      };
      for (const field of COLOR_FIELDS) payload[field.key] = value(field.key);
      await adminSaveAppearance(payload);
      setDraft({});
      setSaved(true);
      appearance.reload();
    }).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Theme</Heading1>
          <p>
            The palette the public shell renders with. The server refuses a palette whose body text
            does not clear WCAG AA contrast against the surface.
          </p>
        </div>
        <div className="admin-row-actions">
          <Button type="button" onClick={appearance.reload}>
            Reset changes
          </Button>
          {canEdit ? (
            <Button
              type="button"
              className="admin-primary"
              disabled={busy || Object.keys(draft).length === 0}
              onClick={save}
            >
              {busy ? "Saving…" : "Save palette"}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice tone="success">Palette saved.</Notice> : null}
      {appearance.loading ? <Loading label="Loading the theme" /> : null}
      {appearance.error ? <Notice tone="error">{appearance.error}</Notice> : null}

      {!appearance.loading && !appearance.error ? (
        <>
          {appearance.data?.contrast ? (
            <Notice
              tone={
                Number((appearance.data.contrast as Record<string, number>).textOnSurface) >= 4.5
                  ? "success"
                  : "error"
              }
            >
              Body text contrast against the surface is{" "}
              {String((appearance.data.contrast as Record<string, number>).textOnSurface)}:1 (WCAG
              AA needs 4.5:1). Muted text is{" "}
              {String((appearance.data.contrast as Record<string, number>).mutedOnSurface)}:1.
            </Notice>
          ) : null}

          <Card
            title="Live preview"
            subtitle="Preview-only state. Publish to push the palette to the public site."
          >
            <div
              className="admin-theme-live-preview"
              style={
                {
                  "--velori-primary": value("primary_color") || "#d94c8d",
                  "--velori-secondary": value("secondary_color") || "#7aa5ff",
                  "--velori-surface": value("surface_color") || "#f5f7ff",
                  "--velori-elevated": value("elevated_surface_color") || "#ffffff",
                  "--velori-border": value("border_color") || "#eaeaf6",
                  "--velori-text": value("text_color") || "#111827",
                  "--velori-muted": value("muted_text_color") || "#5d6471",
                } as CSSProperties
              }
            >
              <div className="admin-theme-preview-header">
                <div className="admin-theme-preview-brand">VELORI</div>
                <div className="admin-theme-preview-actions">
                  <span>Explore</span>
                  <span>Posts</span>
                  <span>Settings</span>
                </div>
              </div>
              <div className="admin-theme-preview-body">
                <div className="admin-theme-preview-sidebar" />
                <div className="admin-theme-preview-main">
                  <button type="button" className="admin-theme-preview-button">
                    Primary action
                  </button>
                  <div className="admin-theme-preview-card">
                    <div className="admin-theme-preview-card-top">
                      <span className="admin-theme-preview-pill">Live</span>
                    </div>
                    <h3>Premium editorial layout</h3>
                    <p>
                      Preview updates immediately while the public site remains unchanged until
                      publish.
                    </p>
                    <div className="admin-theme-preview-fields">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                  <div className="admin-theme-preview-row">
                    <div className="admin-theme-preview-mini" />
                    <div className="admin-theme-preview-mini" />
                    <div className="admin-theme-preview-mini" />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Colours" subtitle="Hex values such as #3ba7ff.">
            <div className="admin-settings-grid">
              {COLOR_FIELDS.map((field) => (
                <label key={field.key} className="admin-form-row">
                  <span>{field.label}</span>
                  <input
                    type="text"
                    value={value(field.key)}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [field.key]: (event.target as HTMLInputElement).value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </Card>

          <Card title="Shape and depth">
            <div className="admin-settings-grid">
              <SelectField
                label="Border radius"
                value={value("border_radius")}
                options={["0", "8", "12", "16", "24", "32", "48"]}
                onChange={(next) => setDraft((current) => ({ ...current, border_radius: next }))}
                disabled={!canEdit}
              />
              <SelectField
                label="Shadow"
                value={value("shadow_level")}
                options={["none", "soft", "medium", "bold"]}
                onChange={(next) => setDraft((current) => ({ ...current, shadow_level: next }))}
                disabled={!canEdit}
              />
              <SelectField
                label="Buttons"
                value={value("button_style")}
                options={["rounded", "pill", "square", "soft"]}
                onChange={(next) => setDraft((current) => ({ ...current, button_style: next }))}
                disabled={!canEdit}
              />
              <SelectField
                label="Cards"
                value={value("card_style")}
                options={["flat", "outlined", "elevated", "glass"]}
                onChange={(next) => setDraft((current) => ({ ...current, card_style: next }))}
                disabled={!canEdit}
              />
              <SelectField
                label="Navigation"
                value={value("navigation_style")}
                options={["sidebar", "topbar", "minimal"]}
                onChange={(next) => setDraft((current) => ({ ...current, navigation_style: next }))}
                disabled={!canEdit}
              />
              <ToggleField
                label="Glass effects"
                checked={theme.glass_effects === true}
                onChange={(next) => setDraft((current) => ({ ...current, glass_effects: next }))}
                disabled={!canEdit}
              />
            </div>
          </Card>
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function BrandingScreen() {
  return (
    <ConsoleScreen anyOf={["branding.view"]}>
      <BrandingBody />
    </ConsoleScreen>
  );
}

export function AnimationsScreen() {
  return (
    <ConsoleScreen anyOf={["animations.view"]}>
      <AnimationsBody />
    </ConsoleScreen>
  );
}

/** The Motion & Experience CMS. It is a screen of its own rather than a panel
 * inside Animations, because it is gated by `motion.*` and a role can hold the
 * animation permissions without holding the design ones. */
export function MotionScreen() {
  return (
    <ConsoleScreen anyOf={["motion.read"]}>
      <MotionCmsEditor />
    </ConsoleScreen>
  );
}

export function ThemeScreen() {
  return (
    <ConsoleScreen anyOf={["theme.view"]}>
      <ThemeBody />
    </ConsoleScreen>
  );
}

export function ErrorPagesScreen() {
  return (
    <ConsoleScreen anyOf={["motion.read"]}>
      <MotionCmsEditor focusErrors />
    </ConsoleScreen>
  );
}
