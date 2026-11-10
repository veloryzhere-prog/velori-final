import { useState } from "react";
import {
  adminModerateReel,
  adminModerateStory,
  adminReels,
  adminStories,
  MODERATION_STATES,
  type AdminReelRow,
  type AdminStoryRow,
  type ModerationState,
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
  Table,
  TextField,
  formatDate,
  useGuardedAction,
  useResource,
} from "../widgets";

const PER_PAGE = 25;

const STATE_FILTERS = [
  { value: "", label: "Every state" },
  ...MODERATION_STATES.map((state) => ({ value: state, label: state })),
];

type Author = { username?: string; display_name?: string } | null;

/** The `profiles!…fkey` embed comes back as a list from PostgREST. */
function authorOf(profiles: unknown): Author {
  const first = Array.isArray(profiles) ? profiles[0] : profiles;
  return (first ?? null) as Author;
}

function excerpt(value: unknown, length = 120) {
  const text = typeof value === "string" ? value : "";
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

/**
 * The permission that authorises each decision.
 *
 * `reels.restore` is registered; `stories.restore` is not, so the server
 * authorises a story restore with `stories.hide`. Reading this table is how a
 * screen avoids drawing a button that is guaranteed to be refused.
 */
function permissionFor(kind: "reels" | "stories", state: ModerationState): string {
  if (state === "hidden") return `${kind}.hide`;
  if (state === "removed") return `${kind}.delete`;
  if (state === "clean") return kind === "reels" ? "reels.restore" : "stories.hide";
  return `${kind}.hide`;
}

const STATE_TONE: Record<string, string> = {
  clean: "ok",
  hidden: "warn",
  removed: "fail",
  restricted: "warn",
};

function StateCell({ state, reported }: { state: string; reported?: boolean }) {
  return (
    <>
      <Pill tone={STATE_TONE[state] ?? "neutral"}>{state}</Pill>
      {reported ? <Pill tone="fail">reported</Pill> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Moderation dialog
// ---------------------------------------------------------------------------

function ModerationDialog({
  kind,
  title,
  description,
  current,
  busy,
  onClose,
  onConfirm,
}: {
  kind: "reels" | "stories";
  title: string;
  description: string;
  current: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (state: ModerationState, reason: string) => void;
}) {
  // A decision that reverses the current one is offered first, because it is the
  // reason an administrator opens the dialog on a moderated row.
  const ordered = [current, ...MODERATION_STATES.filter((state) => state !== current)];
  const [state, setState] = useState<ModerationState>(
    MODERATION_STATES.includes(current as ModerationState)
      ? (current as ModerationState)
      : "hidden",
  );
  const [reason, setReason] = useState("");
  const needsReason = state !== "clean";
  const tooShort = needsReason && reason.trim().length < 4;
  const permitted = ordered.includes(state);

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
            disabled={busy || tooShort || !permitted}
            onClick={() => onConfirm(state, reason.trim())}
          >
            {busy ? "Working…" : "Apply decision"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="admin-form-row">
        {ordered.map((option) => (
          <label key={option} className="admin-inline-choice">
            <input
              type="radio"
              name={`${kind}-moderation-state`}
              value={option}
              checked={state === option}
              onChange={() => setState(option as ModerationState)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <p className="admin-muted">
        Authorised by <code>{permissionFor(kind, state)}</code>. Your role must hold it, and the
        decision is written to the audit log.
      </p>
      <AreaField
        label="Reason"
        hint={
          needsReason
            ? "Required by the server for every decision except restoring. Recorded on the audit log."
            : "Optional when restoring. Any text you add is still recorded."
        }
        value={reason}
        onChange={setReason}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Reels
// ---------------------------------------------------------------------------

function ReelsBody() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<AdminReelRow | null>(null);
  const canHide = usePermission("reels.hide");
  const canRestore = usePermission("reels.restore");
  const canRemove = usePermission("reels.delete");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  const offset = (page - 1) * PER_PAGE;
  const reels = useResource(
    () => adminReels({ state, query: search, limit: PER_PAGE, offset }),
    [state, search, offset],
  );

  const rows = reels.data?.items ?? [];
  const actionable = (row: AdminReelRow) =>
    row.moderation_state === "clean" ? canRestore : canHide || canRemove;

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Reels</Heading1>
          <p>
            Hiding a reel takes it off the public surfaces and keeps the row. Removing it is
            permanent for the reel and its media.
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
          <TextField
            label="Search titles and captions"
            value={term}
            onChange={setTerm}
            placeholder="Words in the title or caption"
          />
          <Button type="submit" className="admin-primary">
            Search
          </Button>
        </form>
        <div className="admin-form-row">
          {STATE_FILTERS.map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              className={state === option.value ? "admin-check" : undefined}
              onClick={() => {
                setState(option.value);
                setPage(1);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {reels.loading ? <Loading label="Loading reels" /> : null}
      {reels.error ? <Notice tone="error">{reels.error}</Notice> : null}

      {!reels.loading && !reels.error ? (
        <Card title="Reel queue" subtitle={`${reels.data?.count ?? 0} reels on this page.`}>
          {rows.length === 0 ? (
            <Empty>No reels matched that filter.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Reel</th>
                  <th>Visibility</th>
                  <th>Created</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const author = authorOf(row.profiles);
                  return (
                    <tr key={row.id}>
                      <td>{author?.username ?? "—"}</td>
                      <td>
                        {excerpt(row.title ?? row.caption) || (
                          <span className="admin-muted">—</span>
                        )}
                      </td>
                      <td>{row.visibility ?? "—"}</td>
                      <td>{formatDate(row.created_at)}</td>
                      <td>
                        <StateCell
                          state={String(row.moderation_state)}
                          reported={row.is_reported}
                        />
                      </td>
                      <td>
                        {actionable(row) ? (
                          <Button type="button" onClick={() => setTarget(row)}>
                            Moderate
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          <Pager page={page} perPage={PER_PAGE} total={reels.data?.count} onPage={setPage} />
        </Card>
      ) : null}

      {target ? (
        <ModerationDialog
          kind="reels"
          title={`Moderate this reel`}
          description={
            target.moderation_reason
              ? `Current reason: ${target.moderation_reason}`
              : "No previous decision on this reel."
          }
          current={String(target.moderation_state)}
          busy={busy}
          onClose={() => setTarget(null)}
          onConfirm={(next, reason) =>
            void guarded(async () => {
              await adminModerateReel(target.id, { state: next, reason });
              setTarget(null);
              reels.reload();
            }).catch(() => undefined)
          }
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

function StoriesBody() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<AdminStoryRow | null>(null);
  const canHide = usePermission("stories.hide");
  const canRemove = usePermission("stories.delete");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  const offset = (page - 1) * PER_PAGE;
  const stories = useResource(
    () => adminStories({ state, query: search, limit: PER_PAGE, offset }),
    [state, search, offset],
  );

  const rows = stories.data?.items ?? [];
  // A restore is authorised by `stories.hide`, which is the same permission that
  // hides one, so a moderator who can hide can always undo their own hide.
  const actionable = (row: AdminStoryRow) => canHide || canRemove;

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Stories</Heading1>
          <p>
            Stories expire on their own schedule. Removing one archives it immediately; restoring it
            republishes the row, which does not extend its expiry.
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
          <TextField
            label="Search captions"
            value={term}
            onChange={setTerm}
            placeholder="Words in the caption"
          />
          <Button type="submit" className="admin-primary">
            Search
          </Button>
        </form>
        <div className="admin-form-row">
          {STATE_FILTERS.map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              className={state === option.value ? "admin-check" : undefined}
              onClick={() => {
                setState(option.value);
                setPage(1);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {stories.loading ? <Loading label="Loading stories" /> : null}
      {stories.error ? <Notice tone="error">{stories.error}</Notice> : null}

      {!stories.loading && !stories.error ? (
        <Card title="Story queue" subtitle={`${stories.data?.count ?? 0} stories on this page.`}>
          {rows.length === 0 ? (
            <Empty>No stories matched that filter.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Caption</th>
                  <th>Audience</th>
                  <th>Expires</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const author = authorOf(row.profiles);
                  return (
                    <tr key={row.id}>
                      <td>{author?.username ?? "—"}</td>
                      <td>{excerpt(row.caption, 80) || <span className="admin-muted">—</span>}</td>
                      <td>{row.audience ?? "—"}</td>
                      <td>{formatDate(row.expires_at)}</td>
                      <td>
                        <StateCell state={String(row.moderation_state)} />
                      </td>
                      <td>
                        {actionable(row) ? (
                          <Button type="button" onClick={() => setTarget(row)}>
                            Moderate
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          <Pager page={page} perPage={PER_PAGE} total={stories.data?.count} onPage={setPage} />
        </Card>
      ) : null}

      {target ? (
        <ModerationDialog
          kind="stories"
          title="Moderate this story"
          description={
            target.moderation_reason
              ? `Current reason: ${target.moderation_reason}`
              : "No previous decision on this story."
          }
          current={String(target.moderation_state)}
          busy={busy}
          onClose={() => setTarget(null)}
          onConfirm={(next, reason) =>
            void guarded(async () => {
              await adminModerateStory(target.id, { state: next, reason });
              setTarget(null);
              stories.reload();
            }).catch(() => undefined)
          }
        />
      ) : null}
    </>
  );
}

export function ReelsScreen() {
  return (
    <ConsoleScreen anyOf={["reels.view"]}>
      <ReelsBody />
    </ConsoleScreen>
  );
}

export function StoriesScreen() {
  return (
    <ConsoleScreen anyOf={["stories.view"]}>
      <StoriesBody />
    </ConsoleScreen>
  );
}
