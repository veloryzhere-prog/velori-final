import { useState } from "react";
import {
  adminComment,
  adminComments,
  adminDeleteComment,
  adminDeletePost,
  adminMessageReports,
  adminPostAction,
  adminPosts,
  adminReportPatch,
  adminReports,
  type AdminCommentRow,
  type AdminPostRow,
  type AdminReportRow,
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
  formatDate,
  useGuardedAction,
  useResource,
} from "../widgets";

const PER_PAGE = 20;

function excerpt(value: unknown, length = 140) {
  const text = typeof value === "string" ? value : "";
  return text.length > length ? `${text.slice(0, length)}…` : text || "—";
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

function PostsBody() {
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<AdminPostRow | null>(null);
  const canHide = usePermission("posts.hide");
  const canRestore = usePermission("posts.restore");
  const canDelete = usePermission("posts.delete");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  const posts = useResource(
    () => adminPosts({ page, perPage: PER_PAGE, query: search }),
    [page, search],
  );

  const rows = posts.data?.posts ?? [];

  const setHidden = (row: AdminPostRow, hidden: boolean) =>
    void guarded(async () => {
      await adminPostAction(row.id, { hidden });
      setTarget(null);
      posts.reload();
    }).catch(() => undefined);

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Posts</Heading1>
          <p>
            Hiding a post keeps it and its media. Deleting it is permanent and always asks for a
            reason.
          </p>
        </div>
      </div>

      <form
        className="admin-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(term.trim());
        }}
      >
        <TextField label="Search post text" value={term} onChange={setTerm} />
        <Button type="submit" className="admin-primary">
          Search
        </Button>
      </form>

      {posts.loading ? <Loading label="Loading posts" /> : null}
      {posts.error ? <Notice tone="error">{posts.error}</Notice> : null}

      {!posts.loading && !posts.error ? (
        <Card title="Posts" subtitle={`${posts.data?.total ?? 0} matching posts.`}>
          {rows.length === 0 ? (
            <Empty>No posts matched that search.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Post</th>
                  <th>Created</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.author?.username ?? "—"}</td>
                    <td>{excerpt(row.body)}</td>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <Pill tone={row.is_hidden ? "warn" : "ok"}>
                        {row.is_hidden ? "hidden" : "visible"}
                      </Pill>
                      {row.report_count ? (
                        <Pill tone="fail">{row.report_count} reports</Pill>
                      ) : null}
                    </td>
                    <td>
                      {(row.is_hidden ? canRestore : canHide) || canDelete ? (
                        <Button type="button" onClick={() => setTarget(row)}>
                          Moderate
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pager page={page} perPage={PER_PAGE} total={posts.data?.total} onPage={setPage} />
        </Card>
      ) : null}

      {target ? (
        <ModerateDialog
          title={target.is_hidden ? "Restore this post" : "Hide this post"}
          description={
            target.is_hidden
              ? "The post returns to the public feed and its author."
              : "The post is hidden from the public app. The row and its media are kept."
          }
          confirmLabel={target.is_hidden ? "Restore" : "Hide"}
          busy={busy}
          onClose={() => setTarget(null)}
          onConfirm={(reason) => setHidden(target, !target.is_hidden)}
          onDelete={
            canDelete
              ? async () => {
                  await adminDeletePost(target.id, "Removed from the moderation queue");
                  setTarget(null);
                  posts.reload();
                }
              : undefined
          }
          deleteLabel="Delete permanently"
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

function CommentsBody() {
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<AdminCommentRow | null>(null);
  const canHide = usePermission("comments.hide");
  const canRestore = usePermission("comments.restore");
  const canDelete = usePermission("comments.delete");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  const comments = useResource(
    () => adminComments({ page, perPage: PER_PAGE, query: search }),
    [page, search],
  );

  const rows = comments.data?.comments ?? [];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Comments</Heading1>
          <p>Hiding and restoring both record who did it and why.</p>
        </div>
      </div>

      <form
        className="admin-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(term.trim());
        }}
      >
        <TextField label="Search comment text" value={term} onChange={setTerm} />
        <Button type="submit" className="admin-primary">
          Search
        </Button>
      </form>

      {comments.loading ? <Loading label="Loading comments" /> : null}
      {comments.error ? <Notice tone="error">{comments.error}</Notice> : null}

      {!comments.loading && !comments.error ? (
        <Card title="Comments" subtitle={`${comments.data?.total ?? 0} matching comments.`}>
          {rows.length === 0 ? (
            <Empty>No comments matched that search.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Comment</th>
                  <th>On post</th>
                  <th>Created</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.author?.username ?? "—"}</td>
                    <td>{excerpt(row.body, 100)}</td>
                    <td>{excerpt(row.post?.body, 60)}</td>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <Pill tone={row.is_hidden ? "warn" : "ok"}>
                        {row.is_hidden ? "hidden" : "visible"}
                      </Pill>
                    </td>
                    <td>
                      {(row.is_hidden ? canRestore : canHide) || canDelete ? (
                        <Button type="button" onClick={() => setTarget(row)}>
                          Moderate
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pager page={page} perPage={PER_PAGE} total={comments.data?.total} onPage={setPage} />
        </Card>
      ) : null}

      {target ? (
        <ModerateDialog
          title={target.is_hidden ? "Restore this comment" : "Hide this comment"}
          description={
            target.is_hidden
              ? "The comment returns to the post."
              : "The comment is hidden from the post. The row is kept."
          }
          confirmLabel={target.is_hidden ? "Restore" : "Hide"}
          busy={busy}
          onClose={() => setTarget(null)}
          onConfirm={async (reason) => {
            await guarded(async () => {
              await adminComment(target.id, { hidden: !target.is_hidden, reason });
              setTarget(null);
              comments.reload();
            }).catch(() => undefined);
          }}
          onDelete={
            canDelete
              ? async () => {
                  await guarded(async () => {
                    await adminDeleteComment(target.id, "Removed from the moderation queue");
                  }).catch(() => undefined);
                  setTarget(null);
                  comments.reload();
                }
              : undefined
          }
          deleteLabel="Delete permanently"
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const REPORT_STATUSES = ["new", "reviewing", "action_taken", "no_violation", "closed"] as const;

const STATUS_FILTERS = [
  { value: "open", label: "Open" },
  { value: "all", label: "All" },
  ...REPORT_STATUSES.map((status) => ({ value: status, label: status })),
];

function ReportsBody({ messagesOnly = false }: { messagesOnly?: boolean }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("open");
  const [target, setTarget] = useState<AdminReportRow | null>(null);
  const canUpdate = usePermission("reports.update");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  const reports = useResource(
    () => (messagesOnly ? adminMessageReports : adminReports)({ page, perPage: PER_PAGE, status }),
    [page, status, messagesOnly],
  );

  const rows = reports.data?.reports ?? [];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>{messagesOnly ? "Message reports" : "Reports"}</Heading1>
          <p>
            {messagesOnly
              ? "Review abuse reports about messages. Conversation contents are not shown; decisions and notes are audited."
              : "Every report is a decision with a name on it. Resolving one stamps you as the resolver and records the notes you write."}
          </p>
        </div>
      </div>

      <div className="admin-toolbar">
        <SelectField
          label="Status"
          value={status}
          options={STATUS_FILTERS}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        <Button type="button" onClick={reports.reload}>
          Refresh
        </Button>
      </div>

      {reports.loading ? <Loading label="Loading reports" /> : null}
      {reports.error ? <Notice tone="error">{reports.error}</Notice> : null}

      {!reports.loading && !reports.error ? (
        <Card
          title={messagesOnly ? "Reported messages" : "Reports"}
          subtitle={`${reports.data?.total ?? 0} reports.`}
        >
          {rows.length === 0 ? (
            <Empty>Nothing is waiting in this view.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Category</th>
                  <th>Reason</th>
                  <th>Filed</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.target_type}</td>
                    <td>{row.category}</td>
                    <td>{excerpt(row.reason, 90)}</td>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <Pill
                        tone={
                          row.status === "closed" || row.status === "no_violation"
                            ? "ok"
                            : row.status === "action_taken"
                              ? "warn"
                              : "info"
                        }
                      >
                        {row.status}
                      </Pill>
                    </td>
                    <td>
                      {canUpdate ? (
                        <Button type="button" onClick={() => setTarget(row)}>
                          Resolve
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pager page={page} perPage={PER_PAGE} total={reports.data?.total} onPage={setPage} />
        </Card>
      ) : null}

      {target ? (
        <ResolveReportDialog
          report={target}
          busy={busy}
          onClose={() => setTarget(null)}
          onConfirm={(nextStatus, notes) =>
            guarded(async () => {
              await adminReportPatch(target.id, { status: nextStatus, notes });
              setTarget(null);
              reports.reload();
            }).catch(() => undefined)
          }
        />
      ) : null}
    </>
  );
}

function ResolveReportDialog({
  report,
  busy,
  onClose,
  onConfirm,
}: {
  report: AdminReportRow;
  busy: boolean;
  onClose: () => void;
  onConfirm: (status: string, notes: string) => void;
}) {
  const [status, setStatus] = useState<string>(
    report.status === "new" ? "reviewing" : report.status,
  );
  const [notes, setNotes] = useState(report.notes ?? "");
  return (
    <Dialog
      title="Resolve this report"
      description="Recorded against your name in the audit log."
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            className="admin-primary"
            disabled={busy}
            onClick={() => onConfirm(status, notes.trim())}
          >
            {busy ? "Working…" : "Save decision"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <AreaField
        label="Reported reason"
        value={report.reason}
        onChange={() => undefined}
        rows={3}
      />
      <SelectField
        label="Decision"
        value={status}
        options={REPORT_STATUSES.map((value) => ({ value, label: value }))}
        onChange={setStatus}
      />
      <AreaField label="Notes" value={notes} onChange={setNotes} hint="Stored with the report." />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Shared moderation dialog
// ---------------------------------------------------------------------------

function ModerateDialog({
  title,
  description,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
  onDelete,
  deleteLabel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  onDelete?: () => void | Promise<void>;
  deleteLabel?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming && onDelete) {
    return (
      <ReasonDialog
        title={`${deleteLabel}?`}
        description="This cannot be undone. The row and its media are removed from the database."
        confirmLabel={deleteLabel ?? "Delete"}
        busy={busy}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          await onDelete();
        }}
      />
    );
  }
  return (
    <ReasonDialog
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

export function PostsScreen() {
  return (
    <ConsoleScreen anyOf={["posts.view"]}>
      <PostsBody />
    </ConsoleScreen>
  );
}

export function CommentsScreen() {
  return (
    <ConsoleScreen anyOf={["comments.view"]}>
      <CommentsBody />
    </ConsoleScreen>
  );
}

export function ReportsScreen() {
  return (
    <ConsoleScreen anyOf={["reports.view"]}>
      <ReportsBody />
    </ConsoleScreen>
  );
}

export function MessagesScreen() {
  return (
    <ConsoleScreen anyOf={["messages.view_reports"]}>
      <ReportsBody messagesOnly />
    </ConsoleScreen>
  );
}
