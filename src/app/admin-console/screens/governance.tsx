import { useState } from "react";
import { Link } from "react-router";
import { AdminAccessList } from "./AdminAccessList";
import {
  adminAdmins,
  adminAuditLogs,
  adminConfigExport,
  adminCreateAdmin,
  adminDeleteAdmin,
  adminPatchAdmin,
  adminPatchRole,
  adminProvisioningStatus,
  revokeOtherAdminSessions,
  adminRoles,
  adminSessions,
  adminStorageReport,
  adminSystemHealth,
  adminVersion,
  revokeAdminSession,
  type AdminAuditRow,
  type AdminRoleKey,
} from "../../../lib/admin-api";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen, useScreenReauth } from "../frame";
import { useAdminSession, usePermission } from "../session";
import {
  Card,
  Dialog,
  Empty,
  Loading,
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

const AUDIT_PAGE_SIZE = 50;

function row(value: unknown) {
  return (value ?? {}) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Administrators
// ---------------------------------------------------------------------------

const ROLE_KEYS = ["super_admin", "admin", "moderator", "content_manager", "support"] as const;

function AdminsBody() {
  const admins = useResource(() => adminAdmins(), []);
  const { me } = useAdminSession();
  const canCreate = usePermission("admins.create");
  const canEdit = usePermission("admins.disable");
  const canDisable = usePermission("admins.disable");
  const canDelete = usePermission("admins.delete");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [promoting, setPromoting] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null);
  const [toggling, setToggling] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const rows = (admins.data?.administrators ?? []) as Record<string, unknown>[];
  const active = (admin: Record<string, unknown>) =>
    admin.is_active !== false && admin.enabled !== false;
  const activeCount = rows.filter(active).length;
  const owners = rows.filter((admin) => active(admin) && admin.role_key === "super_admin").length;
  const filtered = rows.filter((admin) => {
    const matches = `${admin.username ?? ""} ${admin.display_name ?? ""} ${admin.role_key ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    return matches && (filter === "all" || (filter === "active" ? active(admin) : !active(admin)));
  });
  async function run(action: () => Promise<void>, message: string, propagate = false) {
    setActionError("");
    setNotice("");
    try {
      await guarded(async () => {
        await action();
        setNotice(message);
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "The change could not be saved. Try again.",
      );
      if (propagate) throw error;
    }
  }

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Manage administrators</Heading1>
          <p>
            Everyone with console access. The last active super administrator cannot be demoted or
            disabled, and nobody can change their own access here.
          </p>
        </div>
        <div className="admin-row-actions">
          {canCreate ? (
            <Button
              type="button"
              className="admin-primary"
              onClick={() => {
                setActionError("");
                setPromoting(true);
              }}
            >
              Add administrator
            </Button>
          ) : null}
          <Button type="button" onClick={admins.reload}>
            Refresh
          </Button>
        </div>
      </div>

      {admins.loading ? <Loading label="Loading administrators" /> : null}
      {admins.error ? <Notice tone="error">{admins.error}</Notice> : null}
      {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      <nav className="admin-access-links" aria-label="Access management">
        <Link to="/admin/roles">Roles & permissions</Link>
        <Link to="/admin/sessions">Active sessions</Link>
        <Link to="/admin/audit">Audit history</Link>
      </nav>

      {!admins.loading && !admins.error ? (
        <AdminAccessList
          rows={rows}
          filtered={filtered}
          currentUserId={me?.userId}
          activeCount={activeCount}
          owners={owners}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
          canEdit={canEdit}
          canDisable={canDisable}
          canDelete={canDelete}
          busy={busy}
          onEdit={(admin) => {
            setActionError("");
            setEditing(admin);
          }}
          onToggle={setToggling}
          onRemove={setDeleting}
        />
      ) : null}

      {promoting ? (
        <PromoteDialog
          error={actionError}
          busy={busy}
          onClose={() => setPromoting(false)}
          onSave={async (payload) => {
            await run(async () => {
              await adminCreateAdmin(payload);
              setPromoting(false);
              admins.reload();
            }, "Administrator created.");
          }}
        />
      ) : null}

      {editing ? (
        <EditAdminDialog
          error={actionError}
          admin={editing}
          canChangeRole={canCreate}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            await run(async () => {
              await adminPatchAdmin(String(editing.user_id), payload);
              setEditing(null);
              admins.reload();
            }, "Administrator updated.");
          }}
        />
      ) : null}

      {deleting ? (
        <ReasonDialog
          title="Remove console access?"
          description="The account keeps its data and its history. Only administrator access is revoked."
          confirmLabel="Remove access"
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={async (reason) => {
            await run(
              async () => {
                await adminDeleteAdmin(String(deleting.user_id), { reason });
                setDeleting(null);
                admins.reload();
              },
              "Administrator access removed.",
              true,
            );
          }}
        />
      ) : null}
      {toggling ? (
        <ReasonDialog
          title={active(toggling) ? "Disable administrator?" : "Enable administrator?"}
          description={
            active(toggling)
              ? "This account will lose console access and its active administrator sessions will be revoked."
              : "This account will be able to sign in with its assigned role again."
          }
          confirmLabel={active(toggling) ? "Disable access" : "Enable access"}
          busy={busy}
          onClose={() => setToggling(null)}
          onConfirm={async (reason) => {
            await run(
              async () => {
                await adminPatchAdmin(String(toggling.user_id), {
                  is_active: !active(toggling),
                  reason,
                });
                setToggling(null);
                admins.reload();
              },
              "Administrator access updated.",
              true,
            );
          }}
        />
      ) : null}
    </>
  );
}

function PromoteDialog({
  error,
  busy,
  onClose,
  onSave,
}: {
  error: string;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void | Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState<string>("admin");
  const [mfaRequired, setMfaRequired] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(true);

  return (
    <Dialog
      title="Create an administrator"
      description="This creates separate administrator credentials that are not tied to a regular VELORI user."
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            className="admin-primary"
            disabled={busy || username.trim().length < 3 || password.length < 12}
            onClick={() =>
              void onSave({
                username: username.trim(),
                password,
                role_key: roleKey,
                mfa_required: mfaRequired,
                must_change_password: mustChangePassword,
              })
            }
          >
            {busy ? "Creating…" : "Create administrator"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <TextField
        label="Username"
        value={username}
        onChange={setUsername}
        maxLength={64}
        placeholder="VELORIMANAGEARYAN"
      />
      <TextField
        label="Temporary password (at least 12 characters)"
        value={password}
        onChange={setPassword}
        type="password"
        maxLength={200}
      />
      <SelectField
        label="Role"
        value={roleKey}
        options={ROLE_KEYS.map((value) => ({ value, label: value }))}
        onChange={setRoleKey}
      />
      <ToggleField
        label="Require multi-factor authentication"
        checked={mfaRequired}
        onChange={setMfaRequired}
      />
      <ToggleField
        label="Require a password change on first sign-in"
        checked={mustChangePassword}
        onChange={setMustChangePassword}
      />
    </Dialog>
  );
}
function EditAdminDialog({
  admin,
  error,
  canChangeRole,
  busy,
  onClose,
  onSave,
}: {
  admin: Record<string, unknown>;
  error: string;
  canChangeRole: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void | Promise<void>;
}) {
  const [roleKey, setRoleKey] = useState(String(admin.role_key ?? "admin"));
  const [sessionTimeout, setSessionTimeout] = useState(String(admin.session_timeout_minutes ?? 60));
  const [displayName, setDisplayName] = useState(String(admin.display_name ?? ""));

  return (
    <Dialog
      title={`Edit ${String(admin.username ?? "administrator")}`}
      description="Role changes take effect on the next request."
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            className="admin-primary"
            disabled={
              busy ||
              !/^\d+$/.test(sessionTimeout) ||
              Number(sessionTimeout) < 5 ||
              Number(sessionTimeout) > 1440
            }
            onClick={() =>
              void onSave({
                ...(canChangeRole ? { role_key: roleKey } : {}),
                session_timeout_minutes: Number(sessionTimeout),
                display_name: displayName.trim(),
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
      {error ? <Notice tone="error">{error}</Notice> : null}
      <SelectField
        label="Role"
        value={roleKey}
        options={ROLE_KEYS.map((value) => ({ value, label: value }))}
        onChange={setRoleKey}
        disabled={!canChangeRole}
        hint={
          !canChangeRole ? "Your role allows profile updates, but not assigning roles." : undefined
        }
      />
      <TextField
        label="Session timeout (5–1,440 minutes)"
        value={sessionTimeout}
        onChange={setSessionTimeout}
      />
      <TextField label="Display name" value={displayName} onChange={setDisplayName} />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

function RolesBody() {
  const roles = useResource(() => adminRoles(), []);
  const canEdit = usePermission("roles.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [target, setTarget] = useState<Record<string, unknown> | null>(null);

  const rows = (roles.data?.roles ?? []) as Record<string, unknown>[];
  const permissions = (roles.data?.permissions ?? []) as Record<string, unknown>[];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Roles</Heading1>
          <p>
            A role is the set of permissions it grants. Replacing a role's permissions takes effect
            on the next request and is recorded on the audit log.
          </p>
        </div>
      </div>

      {roles.loading ? <Loading label="Loading roles" /> : null}
      {roles.error ? <Notice tone="error">{roles.error}</Notice> : null}

      {!roles.loading && !roles.error ? (
        <>
          <Card title="Roles" subtitle={`${rows.length} roles.`}>
            <Table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Description</th>
                  <th>Permissions</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const permissionsForRole = Array.isArray(entry.permissions)
                    ? (entry.permissions as string[])
                    : [];
                  return (
                    <tr key={String(entry.key)}>
                      <td>{String(entry.key)}</td>
                      <td>{String(entry.label ?? entry.description ?? "—")}</td>
                      <td>{permissionsForRole.length}</td>
                      <td>
                        {canEdit ? (
                          <Button type="button" onClick={() => setTarget(entry)}>
                            Edit
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          <Card
            title="Available permissions"
            subtitle="The complete permission vocabulary. A role can only hold these keys."
          >
            <Table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Category</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((permission) => (
                  <tr key={String(permission.key)}>
                    <td>
                      <code>{String(permission.key)}</code>
                    </td>
                    <td>{String(permission.category ?? "—")}</td>
                    <td>{String(permission.description ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      ) : null}

      {target ? (
        <RoleEditor
          role={target}
          permissions={permissions}
          busy={busy}
          onClose={() => setTarget(null)}
          onSave={async (keys) => {
            await guarded(async () => {
              await adminPatchRole(String(target.key) as AdminRoleKey, { permissions: keys });
              setTarget(null);
              roles.reload();
            }).catch(() => undefined);
          }}
        />
      ) : null}
    </>
  );
}

function RoleEditor({
  role,
  permissions,
  busy,
  onClose,
  onSave,
}: {
  role: Record<string, unknown>;
  permissions: Record<string, unknown>[];
  busy: boolean;
  onClose: () => void;
  onSave: (keys: string[]) => void | Promise<void>;
}) {
  const available = permissions.map((permission) => String(permission.key));
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(role.permissions) ? (role.permissions as string[]) : [],
  );

  return (
    <Dialog
      title={`Permissions for ${String(role.key)}`}
      description="The full list replaces the role's permissions. Nothing is merged."
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            className="admin-primary"
            disabled={busy}
            onClick={() => void onSave(selected)}
          >
            {busy ? "Saving…" : "Replace permissions"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="admin-settings-grid">
        {available.map((key) => (
          <ToggleField
            key={key}
            label={key}
            checked={selected.includes(key)}
            onChange={(next) =>
              setSelected((current) =>
                next ? [...new Set([...current, key])] : current.filter((entry) => entry !== key),
              )
            }
          />
        ))}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function SessionsBody() {
  const sessions = useResource(() => adminSessions(), []);
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingOthers, setConfirmingOthers] = useState(false);

  const rows = (sessions.data?.sessions ?? []) as Record<string, unknown>[];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>My sessions</Heading1>
          <p>
            Every browser that holds a console session for you. Revoking one takes effect on its
            next request, not on its current page.
          </p>
        </div>
        <div className="admin-row-actions">
          <Button type="button" onClick={sessions.reload}>
            Refresh
          </Button>
          <Button type="button" onClick={() => setConfirmingOthers(true)}>
            Sign out everywhere else
          </Button>
        </div>
      </div>

      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {sessions.loading ? <Loading label="Loading sessions" /> : null}
      {sessions.error ? <Notice tone="error">{sessions.error}</Notice> : null}

      {!sessions.loading && !sessions.error ? (
        <Card title="Sessions" subtitle={`${rows.length} sessions.`}>
          {rows.length === 0 ? (
            <Empty>No sessions are recorded.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Address</th>
                  <th>Started</th>
                  <th>Last seen</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((session) => (
                  <tr key={String(session.id)}>
                    <td>
                      {String(session.device_label ?? "Unknown device")}
                      {session.revoked_at ? <Pill tone="fail">revoked</Pill> : null}
                    </td>
                    <td>{String(session.ip_address ?? "—")}</td>
                    <td>{formatDate(session.created_at as string)}</td>
                    <td>{formatDate(session.last_seen_at as string)}</td>
                    <td>{formatDate(session.expires_at as string)}</td>
                    <td>
                      {!session.revoked_at ? (
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void guarded(async () => {
                              await revokeAdminSession(String(session.id));
                              setNotice("Session revoked.");
                              sessions.reload();
                            }).catch(() => undefined)
                          }
                        >
                          Revoke
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

      {confirmingOthers ? (
        <ReasonDialog
          title="Sign out every other session?"
          description="This browser stays signed in. Every other device is revoked immediately."
          confirmLabel="Sign out others"
          busy={busy}
          minimumLength={4}
          onClose={() => setConfirmingOthers(false)}
          onConfirm={async (reason) => {
            await guarded(async () => {
              const result = await revokeOtherAdminSessions();
              setNotice(`${result.revoked ?? 0} other sessions were revoked.`);
              setConfirmingOthers(false);
              sessions.reload();
            }).catch(() => undefined);
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

function AuditBody() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState("");
  const [action, setAction] = useState("");
  const [since, setSince] = useState("");

  const audit = useResource(
    () =>
      adminAuditLogs({
        page,
        perPage: AUDIT_PAGE_SIZE,
        result: result || undefined,
        action: action.trim() || undefined,
        since: since || undefined,
      }),
    [page, result, action, since],
  );

  const rows = (audit.data?.logs ?? []) as AdminAuditRow[];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Audit log</Heading1>
          <p>
            Every privileged action, with the reason that was given for it. A denied attempt is
            recorded here too, so a probe shows up in this list.
          </p>
        </div>
        <div className="admin-row-actions">
          <Button type="button" onClick={audit.reload}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="admin-toolbar">
        <SelectField
          label="Result"
          value={result}
          options={[
            { value: "", label: "Any" },
            { value: "success", label: "success" },
            { value: "failure", label: "failure" },
            { value: "denied", label: "denied" },
          ]}
          onChange={(value) => {
            setResult(value);
            setPage(1);
          }}
        />
        <TextField
          label="Action contains"
          value={action}
          onChange={setAction}
          onSubmitKey={() => {
            setPage(1);
            audit.reload();
          }}
        />
        <TextField
          label="Since (ISO date)"
          value={since}
          onChange={setSince}
          placeholder="2026-10-01"
        />
      </div>

      {audit.loading ? <Loading label="Loading audit records" /> : null}
      {audit.error ? <Notice tone="error">{audit.error}</Notice> : null}

      {!audit.loading && !audit.error ? (
        <Card title="Records" subtitle={`${audit.data?.total ?? 0} records.`}>
          {rows.length === 0 ? (
            <Empty>No audit records match those filters.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Administrator</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Reason</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.created_at)}</td>
                    <td>{entry.admin_email ?? entry.admin_user_id ?? "system"}</td>
                    <td>
                      <code>{entry.action}</code>
                    </td>
                    <td>
                      {entry.target_type}
                      {entry.target_id ? (
                        <small className="admin-muted"> {entry.target_id}</small>
                      ) : null}
                    </td>
                    <td>{entry.reason || "—"}</td>
                    <td>
                      <Pill
                        tone={
                          entry.result === "denied"
                            ? "fail"
                            : entry.result === "failure"
                              ? "warn"
                              : "ok"
                        }
                      >
                        {entry.result}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pager page={page} perPage={AUDIT_PAGE_SIZE} total={audit.data?.total} onPage={setPage} />
        </Card>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// System health
// ---------------------------------------------------------------------------

// The health endpoint reports "operational" / "degraded" / "down" / "unknown".
// Administrators get a plain word rather than the raw token.
function healthLabel(status: string): string {
  if (status === "operational") return "Operational";
  if (status === "degraded") return "Warning";
  if (status === "down" || status === "error") return "Error";
  if (status === "unknown") return "Not verifiable";
  return status;
}

function healthTone(status: string): "ok" | "warn" | "fail" | "info" {
  if (status === "operational") return "ok";
  if (status === "degraded") return "warn";
  if (status === "down" || status === "error") return "fail";
  return "info";
}

function SystemBody() {
  const health = useResource(() => adminSystemHealth(), []);
  const storage = useResource(() => adminStorageReport(), []);
  const version = useResource(() => adminVersion(), []);
  const canExport = usePermission("system.export");
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const checks = (health.data?.checks ?? []) as Record<string, unknown>[];

  const exportConfig = () =>
    void (async () => {
      setExporting(true);
      setNotice(null);
      try {
        const payload = await adminConfigExport();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "velori-admin-config.json";
        anchor.click();
        URL.revokeObjectURL(url);
        setNotice("Configuration exported. The file excludes every secret.");
      } catch (caught) {
        setNotice(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setExporting(false);
      }
    })();

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>System health</Heading1>
          <p>
            Each status below comes from a real probe against the dependency it describes. Nothing
            here is a cached guess.
          </p>
        </div>
        <div className="admin-row-actions">
          <Button
            type="button"
            disabled={health.loading || storage.loading || version.loading}
            onClick={() => {
              health.reload();
              storage.reload();
              version.reload();
            }}
          >
            {health.loading || storage.loading || version.loading ? "Checking…" : "Re-run checks"}
          </Button>
          <Button
            type="button"
            disabled={!health.data || health.loading || storage.loading || version.loading}
            onClick={() => {
              const report = {
                exportedAt: new Date().toISOString(),
                health: health.data,
                storage: storage.data,
                version: version.data,
                errors: { health: health.error, storage: storage.error, version: version.error },
              };
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
              );
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download =
                "velori-health-report-" + new Date().toISOString().slice(0, 10) + ".json";
              anchor.click();
              window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              setNotice("Health report downloaded with the checks displayed on this page.");
            }}
          >
            Download health report
          </Button>
          {canExport ? (
            <Button
              type="button"
              className="admin-primary"
              disabled={exporting}
              onClick={exportConfig}
            >
              {exporting ? "Exporting…" : "Export configuration"}
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? <Notice>{notice}</Notice> : null}

      {health.loading ? <Loading label="Running health checks" /> : null}
      {health.error ? <Notice tone="error">{health.error}</Notice> : null}

      {health.data ? (
        <Card
          title="Dependencies"
          subtitle={`Checked ${formatDate(health.data.checkedAt)} in ${health.data.latencyMs} ms. Overall: ${healthLabel(String(health.data.overall ?? "unknown")).toLowerCase()}.`}
        >
          <div className="admin-health-list">
            {checks.map((check, index) => {
              // The endpoint returns { name, status, detail }. Reading `id`,
              // `label` or `diagnosis` here yielded undefined keys, a blank
              // service name and no explanation at all, so every row rendered as
              // an unnamed "fail" pill.
              const name = String(check.name ?? `Check ${index + 1}`);
              const detail = check.detail ? String(check.detail) : "";
              const status = String(check.status ?? "unknown");
              return (
                <div key={name} className="admin-health-row">
                  <span>
                    <strong>{name}</strong>
                    {detail ? <small className="admin-muted"> {detail}</small> : null}
                  </span>
                  <Pill tone={healthTone(status)}>{healthLabel(status)}</Pill>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {storage.loading ? <Loading label="Inspecting storage" /> : null}
      {storage.error ? <Notice tone="error">{storage.error}</Notice> : null}
      {storage.data ? (
        <Card
          title="Storage"
          subtitle="Read from real bucket listings. Nothing here deletes anything."
        >
          <Table>
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Objects</th>
                <th>Diagnosis</th>
              </tr>
            </thead>
            <tbody>
              {storage.data.buckets.map((bucket) => (
                <tr key={bucket.name}>
                  <td>{bucket.name}</td>
                  <td>{bucket.available ? bucket.objects : "—"}</td>
                  <td>{bucket.diagnosis ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Notice>
            {storage.data.cleanup.diagnosis} Referenced media: {storage.data.references.postMedia}{" "}
            post items, {storage.data.references.postDraftMedia} draft items.
          </Notice>
        </Card>
      ) : null}

      {version.loading ? <Loading label="Reading version" /> : null}
      {version.error ? <Notice tone="error">{version.error}</Notice> : null}
      {version.data ? (
        <Card title="Version and migrations" subtitle={version.data.console}>
          <dl className="admin-info-list">
            <dt>Version</dt>
            <dd>{version.data.version}</dd>
            <dt>Settings last changed</dt>
            <dd>{formatDate(version.data.settingsUpdatedAt)}</dd>
            <dt>Migrations applied</dt>
            <dd>
              {version.data.migrations.applied.length} of {version.data.migrations.required.length}
            </dd>
          </dl>
          {version.data.migrations.pending.length ? (
            <Notice tone="error">
              Pending migrations: {version.data.migrations.pending.join(", ")}
            </Notice>
          ) : (
            <Notice tone="success">Every migration this console depends on is applied.</Notice>
          )}
        </Card>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Provisioning
// ---------------------------------------------------------------------------

function ProvisioningBody() {
  const status = useResource(() => adminProvisioningStatus(), []);

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Administrator provisioning</Heading1>
          <p>
            The primary username is initialized once from protected server configuration. Passwords
            are stored as salted PBKDF2 hashes.
          </p>
        </div>
      </div>

      {status.loading ? <Loading label="Reading administrator state" /> : null}
      {status.error ? <Notice tone="error">{status.error}</Notice> : null}

      {status.data ? (
        <>
          <Card title="Primary administrator">
            <dl className="admin-info-list">
              <dt>Username</dt>
              <dd>{status.data.primaryUsername}</dd>
              <dt>Initialized</dt>
              <dd>{status.data.initialized ? "Yes" : "No"}</dd>
              <dt>Initial password configured on server</dt>
              <dd>{status.data.initialPasswordConfigured ? "Yes" : "No"}</dd>
            </dl>
            {!status.data.initialized ? (
              <Notice tone="error">
                Configure the initial password as a protected server secret, then run the one-time
                administrator initialization command.
              </Notice>
            ) : null}
          </Card>

          <Card
            title="Administrators on record"
            subtitle={status.data.administrators.length + " accounts."}
          >
            <Table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>State</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {status.data.administrators.map((admin) => (
                  <tr key={String(row(admin).user_id)}>
                    <td>{String(row(admin).username ?? "No username configured")}</td>
                    <td>{String(row(admin).role_key ?? "—")}</td>
                    <td>
                      <Pill
                        tone={
                          row(admin).is_active === false || row(admin).enabled === false
                            ? "warn"
                            : "ok"
                        }
                      >
                        {row(admin).is_active === false || row(admin).enabled === false
                          ? "disabled"
                          : "active"}
                      </Pill>
                    </td>
                    <td>{formatDate(row(admin).created_at as string)}</td>
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
// Exports
// ---------------------------------------------------------------------------

export function AdminsScreen() {
  return (
    <ConsoleScreen anyOf={["admins.view"]}>
      <AdminsBody />
    </ConsoleScreen>
  );
}

export function RolesScreen() {
  return (
    <ConsoleScreen anyOf={["admins.view"]}>
      <RolesBody />
    </ConsoleScreen>
  );
}

export function SessionsScreen() {
  return (
    <ConsoleScreen anyOf={[]}>
      <SessionsBody />
    </ConsoleScreen>
  );
}

export function AuditScreen() {
  return (
    <ConsoleScreen anyOf={["audit.view"]}>
      <AuditBody />
    </ConsoleScreen>
  );
}

export function SystemScreen() {
  return (
    <ConsoleScreen anyOf={["system.view"]}>
      <SystemBody />
    </ConsoleScreen>
  );
}

export function ProvisioningScreen() {
  return (
    <ConsoleScreen anyOf={["admins.view"]}>
      <ProvisioningBody />
    </ConsoleScreen>
  );
}
