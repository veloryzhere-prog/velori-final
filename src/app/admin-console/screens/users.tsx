import { useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import {
  adminUser,
  adminUserAction,
  adminUserProfile,
  adminUsers,
  type AdminUserAction as ModerationAction,
  type AdminUserRow,
} from "../../../lib/admin-api";
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

/** Actions that need a written reason, and the permission each requires. The server
 * enforces both; this only decides which button to draw. */
type ActionEntry = {
  action: ModerationAction;
  label: string;
  permission: string;
  needsReason: boolean;
  needsNote: boolean;
  destructive: boolean;
};

const ACTIONS: ActionEntry[] = [
  {
    action: "verify",
    label: "Verify",
    permission: "users.verify",
    needsReason: true,
    needsNote: false,
    destructive: false,
  },
  {
    action: "unverify",
    label: "Remove verification",
    permission: "users.verify",
    needsReason: true,
    needsNote: false,
    destructive: false,
  },
  {
    action: "restrict",
    label: "Restrict",
    permission: "users.restrict",
    needsReason: true,
    needsNote: false,
    destructive: true,
  },
  {
    action: "unrestrict",
    label: "Remove restriction",
    permission: "users.restrict",
    needsReason: true,
    needsNote: false,
    destructive: false,
  },
  {
    action: "suspend",
    label: "Suspend",
    permission: "users.suspend",
    needsReason: true,
    needsNote: false,
    destructive: true,
  },
  {
    action: "unsuspend",
    label: "Lift suspension",
    permission: "users.suspend",
    needsReason: true,
    needsNote: false,
    destructive: false,
  },
  {
    action: "ban",
    label: "Ban",
    permission: "users.ban",
    needsReason: true,
    needsNote: false,
    destructive: true,
  },
  {
    action: "unban",
    label: "Lift ban",
    permission: "users.ban",
    needsReason: true,
    needsNote: false,
    destructive: false,
  },
  {
    action: "force_logout",
    label: "Force console sign-out",
    permission: "users.sessions",
    needsReason: false,
    needsNote: false,
    destructive: true,
  },
  {
    action: "add_note",
    label: "Add moderation note",
    permission: "users.notes",
    needsReason: false,
    needsNote: true,
    destructive: false,
  },
  {
    action: "remove_note",
    label: "Remove note",
    permission: "users.notes",
    needsReason: false,
    needsNote: true,
    destructive: false,
  },
];

function stateBadges(user: AdminUserRow) {
  const badges: { label: string; tone: string }[] = [];
  if (user.is_verified) badges.push({ label: "verified", tone: "ok" });
  if (user.is_banned) badges.push({ label: "banned", tone: "fail" });
  if (user.is_suspended) badges.push({ label: "suspended", tone: "fail" });
  if (user.is_restricted) badges.push({ label: "restricted", tone: "warn" });
  if (user.is_private) badges.push({ label: "private", tone: "neutral" });
  if (user.admin_active ?? user.adminActive) badges.push({ label: "administrator", tone: "info" });
  return badges;
}

function ActionButton({
  entry,
  disabled,
  onSelect,
}: {
  entry: ActionEntry;
  disabled: boolean;
  onSelect: () => void;
}) {
  const allowed = usePermission(entry.permission);
  if (!allowed) return null;
  return (
    <Button
      type="button"
      disabled={disabled}
      className={entry.destructive ? "admin-secondary" : undefined}
      onClick={onSelect}
    >
      {entry.label}
    </Button>
  );
}

function NoteDialog({
  title,
  description,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      title={title}
      description={description}
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            className="admin-primary"
            disabled={busy || note.trim().length === 0}
            onClick={() => {
              setError(null);
              onConfirm(note.trim());
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <AreaField label="Note text" value={note} onChange={setNote} />
    </Dialog>
  );
}

const ACCOUNT_TYPES = ["personal", "creator", "business"] as const;

const PROFILE_TEXT_FIELDS = [
  { key: "display_name", label: "Display name", maxLength: 80 },
  { key: "bio", label: "Bio", maxLength: 300 },
  { key: "avatar_url", label: "Avatar URL", maxLength: 2048 },
  { key: "website_url", label: "Website URL", maxLength: 2048 },
  { key: "link_title", label: "Link title", maxLength: 80 },
] as const;

/**
 * Administrative profile edit.
 *
 * The server accepts only this fixed field list and refuses anything else, so the
 * form sends exactly these keys and no others — including the ones a member could
 * change themselves. It is an override for support, not a general write path.
 */
function ProfileEditor({
  id,
  profile,
  busy,
  onSaved,
}: {
  id: string;
  profile: Record<string, unknown>;
  busy: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [accountType, setAccountType] = useState<string>(
    String(profile.account_type ?? "personal"),
  );
  const [isPrivate, setIsPrivate] = useState(profile.is_private === true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const value = (key: string) => draft[key] ?? String(profile[key] ?? "");

  const payload = () => {
    const body: Record<string, unknown> = {};
    for (const field of PROFILE_TEXT_FIELDS) {
      if (value(field.key) !== String(profile[field.key] ?? "")) body[field.key] = value(field.key);
    }
    if (accountType !== String(profile.account_type ?? "personal")) body.account_type = accountType;
    if (isPrivate !== (profile.is_private === true)) body.is_private = isPrivate;
    return body;
  };

  const changes = Object.keys(payload()).length;

  return (
    <>
      <h3>Profile override</h3>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice tone="success">Profile updated.</Notice> : null}
      {PROFILE_TEXT_FIELDS.map((field) => (
        <TextField
          key={field.key}
          label={field.label}
          value={value(field.key)}
          maxLength={field.maxLength}
          onChange={(next) => setDraft((current) => ({ ...current, [field.key]: next }))}
        />
      ))}
      <SelectField
        label="Account type"
        value={accountType}
        options={ACCOUNT_TYPES.map((type) => ({ value: type, label: type }))}
        onChange={setAccountType}
      />
      <ToggleField
        label="Private account"
        hint="Hides the profile and its posts from everyone except accepted followers."
        checked={isPrivate}
        onChange={setIsPrivate}
      />
      <div className="admin-row-actions">
        <Button
          type="button"
          className="admin-primary"
          disabled={busy || changes === 0}
          onClick={() => {
            setError(null);
            setSaved(false);
            adminUserProfile(id, payload())
              .then(() => {
                setDraft({});
                setSaved(true);
                onSaved();
              })
              .catch((caught: unknown) =>
                setError(caught instanceof Error ? caught.message : String(caught)),
              );
          }}
        >
          {busy ? "Working…" : `Save ${changes || ""} change${changes === 1 ? "" : "s"}`.trim()}
        </Button>
        {changes > 0 ? (
          <Button
            type="button"
            onClick={() => {
              setDraft({});
              setAccountType(String(profile.account_type ?? "personal"));
              setIsPrivate(profile.is_private === true);
              setSaved(false);
            }}
          >
            Discard
          </Button>
        ) : null}
      </div>
      <p className="admin-muted">
        The server accepts only these fields. A blank value clears the optional ones. The change is
        written to the audit log with the field names.
      </p>
    </>
  );
}

function UserDetailDialog({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const detail = useResource<Record<string, unknown>>(() => adminUser(id), [id]);
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const canEditProfile = usePermission("users.edit");
  const canViewReports = usePermission("reports.view");
  const canViewAudit = usePermission("audit.view");
  const canViewNotes = usePermission("users.notes");
  const canViewAdmins = usePermission("admins.view");
  const [pending, setPending] = useState<ActionEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const apply = async (entry: ActionEntry, reason?: string, note?: string) => {
    await guarded(async () => {
      await adminUserAction(id, { action: entry.action, reason, note });
      setNotice(`Applied: ${entry.label}.`);
      setPending(null);
      detail.reload();
      onChanged();
    }).catch(() => {
      setPending(null);
    });
  };

  const profile = (detail.data?.profile ?? {}) as Record<string, unknown>;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "content", label: "Content" },
    ...(canViewReports ? [{ id: "reports", label: "Reports" }] : []),
    ...(canViewAudit || canViewNotes ? [{ id: "activity", label: "Activity" }] : []),
    { id: "access", label: "Access" },
  ];

  useEffect(() => setActiveTab("overview"), [id]);
  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) setActiveTab("overview");
  }, [activeTab, canViewAudit, canViewNotes, canViewReports]);

  return (
    <>
      <Dialog
        title={String(profile.username ?? "Account")}
        description="Account state, moderation history and the actions your role allows."
        onClose={onClose}
        actions={
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        }
      >
        {detail.loading ? <Loading label="Loading the account" /> : null}
        {detail.error ? <Notice tone="error">{detail.error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {detail.data ? (
          <>
            <div className="admin-detail-tabs" role="tablist" aria-label="Account details">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={"user-detail-tab-" + tab.id}
                  aria-selected={activeTab === tab.id}
                  aria-controls="user-detail-panel"
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => {
                    const currentIndex = tabs.findIndex((item) => item.id === activeTab);
                    const nextIndex =
                      event.key === "ArrowRight"
                        ? (currentIndex + 1) % tabs.length
                        : event.key === "ArrowLeft"
                          ? (currentIndex - 1 + tabs.length) % tabs.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? tabs.length - 1
                              : -1;
                    if (nextIndex < 0) return;
                    event.preventDefault();
                    const nextTab = tabs[nextIndex];
                    setActiveTab(nextTab.id);
                    document.getElementById("user-detail-tab-" + nextTab.id)?.focus();
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div
              id="user-detail-panel"
              className="admin-detail-tab-panel"
              role="tabpanel"
              aria-labelledby={"user-detail-tab-" + activeTab}
              tabIndex={0}
            >
              {activeTab === "overview" ? (
                <>
                  <dl className="admin-info-list">
                    <dt>Display name</dt>
                    <dd>{String(profile.display_name ?? "\u2014")}</dd>
                    <dt>Email</dt>
                    <dd>{String(detail.data.email ?? "\u2014")}</dd>
                    <dt>Email confirmed</dt>
                    <dd>
                      {detail.data.emailConfirmedAt
                        ? formatDate(String(detail.data.emailConfirmedAt))
                        : "No"}
                    </dd>
                    <dt>Joined</dt>
                    <dd>{formatDate(String(profile.created_at ?? ""))}</dd>
                    <dt>Last sign-in</dt>
                    <dd>
                      {detail.data.lastSignInAt
                        ? formatDate(String(detail.data.lastSignInAt))
                        : "Never"}
                    </dd>
                  </dl>
                  {canEditProfile ? (
                    <ProfileEditor id={id} profile={profile} busy={busy} onSaved={detail.reload} />
                  ) : null}
                </>
              ) : null}

              {activeTab === "content" ? (
                <div className="admin-user-content-summary">
                  <div>
                    <strong>{String(detail.data.postCount ?? 0)}</strong>
                    <span>Posts</span>
                  </div>
                  <div>
                    <strong>{String(detail.data.commentCount ?? 0)}</strong>
                    <span>Comments</span>
                  </div>
                  <div>
                    <strong>{String(detail.data.followers ?? 0)}</strong>
                    <span>Followers</span>
                  </div>
                  <div>
                    <strong>{String(detail.data.following ?? 0)}</strong>
                    <span>Following</span>
                  </div>
                  <p className="admin-muted">
                    These totals summarize content and connections associated with this account.
                  </p>
                </div>
              ) : null}

              {activeTab === "reports" && canViewReports ? (
                Array.isArray(detail.data.reports) && detail.data.reports.length ? (
                  <ul className="admin-user-detail-list">
                    {(detail.data.reports as Record<string, unknown>[]).map((item) => (
                      <li key={String(item.id)}>
                        <div>
                          <strong>{String(item.category || "Profile report")}</strong>
                          <small>
                            {String(item.status || "Open")}
                            {" \u00b7 "}
                            {formatDate(String(item.created_at ?? ""))}
                          </small>
                          {item.reason ? <p>{String(item.reason)}</p> : null}
                        </div>
                        <Pill tone={String(item.status || "neutral")}>
                          {String(item.status || "Open")}
                        </Pill>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>No profile reports are recorded for this account.</Empty>
                )
              ) : null}

              {activeTab === "activity" && (canViewAudit || canViewNotes) ? (
                <>
                  {canViewNotes ? (
                    <>
                      <h3>Moderation notes</h3>
                      {String(profile.moderation_notes ?? "") ? (
                        <pre className="admin-table-card">{String(profile.moderation_notes)}</pre>
                      ) : (
                        <Empty>No notes recorded.</Empty>
                      )}
                    </>
                  ) : null}
                  {canViewAudit ? <h3>Recent administrator activity</h3> : null}
                  {canViewAudit &&
                  Array.isArray(detail.data.moderationHistory) &&
                  detail.data.moderationHistory.length ? (
                    <ul className="admin-user-detail-list">
                      {(detail.data.moderationHistory as Record<string, unknown>[]).map((item) => (
                        <li key={String(item.id)}>
                          <div>
                            <strong>
                              {String(item.action || "Administrator action").replace(/\./g, " ")}
                            </strong>
                            <small>
                              {String(item.result || item.target_type || "Account")}
                              {" \u00b7 "}
                              {formatDate(String(item.created_at ?? ""))}
                            </small>
                            {item.reason ? <p>{String(item.reason)}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : canViewAudit ? (
                    <Empty>No administrator activity is recorded for this account.</Empty>
                  ) : null}
                </>
              ) : null}

              {activeTab === "access" ? (
                <>
                  <dl className="admin-info-list">
                    <dt>Account status</dt>
                    <dd>
                      {profile.is_banned
                        ? "Banned"
                        : profile.is_suspended
                          ? "Suspended"
                          : profile.is_restricted
                            ? "Restricted"
                            : "Active"}
                    </dd>
                    <dt>Verification</dt>
                    <dd>{profile.is_verified ? "Verified" : "Not verified"}</dd>
                    <dt>Administrator access</dt>
                    <dd>
                      {!canViewAdmins
                        ? "Not included in your access"
                        : detail.data.adminAccess
                          ? String(
                              (detail.data.adminAccess as Record<string, unknown>).role_key ??
                                "Granted",
                            )
                          : "None"}
                    </dd>
                    {detail.data.bannedUntil ? (
                      <>
                        <dt>Ban expires</dt>
                        <dd>{formatDate(String(detail.data.bannedUntil))}</dd>
                      </>
                    ) : null}
                  </dl>
                  <h3>Available account actions</h3>
                  <div className="admin-row-actions">
                    {ACTIONS.map((entry) => (
                      <ActionButton
                        key={entry.action}
                        entry={entry}
                        disabled={busy}
                        onSelect={() => setPending(entry)}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </Dialog>

      {pending?.needsReason ? (
        <ReasonDialog
          title={pending.label}
          description="This changes the account's access. The reason is stored on the audit log against your name."
          confirmLabel={pending.label}
          busy={busy}
          onClose={() => setPending(null)}
          onConfirm={(reason) => void apply(pending, reason)}
        />
      ) : null}

      {pending && !pending.needsReason && !pending.needsNote ? (
        <Dialog
          title={pending.label}
          description="This ends the account's administrator console sessions. It does not end ordinary app sessions."
          onClose={() => setPending(null)}
          actions={
            <>
              <Button
                type="button"
                className="admin-primary"
                disabled={busy}
                onClick={() => void apply(pending)}
              >
                {busy ? "Working…" : "Confirm"}
              </Button>
              <Button type="button" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </>
          }
        />
      ) : null}

      {pending?.needsNote ? (
        <NoteDialog
          busy={busy}
          title={pending.label}
          confirmLabel={pending.label}
          description={
            pending.action === "remove_note"
              ? "Paste the exact note text to delete. Matching is by whole line."
              : "This text is appended to the account's moderation notes."
          }
          onClose={() => setPending(null)}
          onConfirm={(note) => void apply(pending, undefined, note)}
        />
      ) : null}
    </>
  );
}

function UsersBody() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const detailId = searchParams.get("user");
  const [onlyRestricted, setOnlyRestricted] = useState(false);

  const users = useResource(
    () => adminUsers({ page, perPage: PER_PAGE, query: search }),
    [page, search],
  );

  const rows = (users.data?.users ?? []).filter((row) =>
    onlyRestricted ? row.is_banned || row.is_suspended || row.is_restricted : true,
  );

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Users</Heading1>
          <p>
            Search, inspect and moderate member accounts. Every action here is checked against your
            role on the server and recorded with a reason.
          </p>
        </div>
      </div>

      <div className="admin-toolbar">
        <form
          className="admin-search"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(term.trim());
          }}
        >
          <TextField label="Search" value={term} onChange={setTerm} placeholder="Username or id" />
          <Button type="submit" className="admin-primary">
            Search
          </Button>
          {search ? (
            <Button
              type="button"
              onClick={() => {
                setTerm("");
                setSearch("");
                setPage(1);
              }}
            >
              Clear
            </Button>
          ) : null}
        </form>
        <ToggleField
          label="Only moderated accounts"
          checked={onlyRestricted}
          onChange={setOnlyRestricted}
        />
      </div>

      {users.loading ? <Loading label="Loading members" /> : null}
      {users.error ? <Notice tone="error">{users.error}</Notice> : null}

      {!users.loading && !users.error ? (
        <Card title="Members" subtitle={`${users.data?.total ?? 0} matching accounts.`}>
          {rows.length === 0 ? (
            <Empty>No accounts matched that search.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Joined</th>
                  <th>Posts</th>
                  <th>Reports</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.username || row.email || row.id}</strong>
                      {row.display_name ? (
                        <small className="admin-muted"> {row.display_name}</small>
                      ) : null}
                    </td>
                    <td>{formatDate(row.created_at || row.createdAt)}</td>
                    <td>{row.post_count ?? "—"}</td>
                    <td>{row.report_count ?? "—"}</td>
                    <td>
                      {stateBadges(row).map((badge) => (
                        <Pill key={badge.label} tone={badge.tone}>
                          {badge.label}
                        </Pill>
                      ))}
                    </td>
                    <td>
                      <Button
                        type="button"
                        onClick={() => {
                          const next = new URLSearchParams(searchParams);
                          next.set("user", row.id);
                          setSearchParams(next);
                        }}
                      >
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pager page={page} perPage={PER_PAGE} total={users.data?.total} onPage={setPage} />
        </Card>
      ) : null}

      {detailId ? (
        <UserDetailDialog
          id={detailId}
          onClose={() => {
            const next = new URLSearchParams(searchParams);
            next.delete("user");
            setSearchParams(next, { replace: true });
          }}
          onChanged={users.reload}
        />
      ) : null}
    </>
  );
}

export function UsersScreen() {
  return (
    <ConsoleScreen anyOf={["users.view"]}>
      <UsersBody />
    </ConsoleScreen>
  );
}
