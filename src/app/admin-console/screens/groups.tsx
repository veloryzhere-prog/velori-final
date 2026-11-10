import { useState } from "react";
import { adminGroupModerate, adminGroups, type AdminGroupRow } from "../../../lib/admin-api";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen, useScreenReauth } from "../frame";
import { usePermission } from "../session";
import {
  Card,
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

const PAGE_SIZE = 25;
const LOCK_FILTERS = [
  { value: "", label: "All groups" },
  { value: "false", label: "Accepting members" },
  { value: "true", label: "Locked" },
];

function ownerName(group: AdminGroupRow): string {
  const owner = Array.isArray(group.profiles) ? group.profiles[0] : group.profiles;
  return owner?.username ? `@${owner.username}` : "Unknown owner";
}

function GroupsBody() {
  const [page, setPage] = useState(1);
  const [locked, setLocked] = useState("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<AdminGroupRow | null>(null);
  const canLock = usePermission("groups.lock");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const offset = (page - 1) * PAGE_SIZE;
  const groups = useResource(
    () => adminGroups({ query: search, locked, limit: PAGE_SIZE, offset }),
    [search, locked, offset],
  );
  const rows = groups.data?.items ?? [];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Groups</Heading1>
          <p>
            Review group metadata and membership counts. Group posts and private conversations are
            not included here.
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
            label="Search groups"
            value={term}
            onChange={setTerm}
            placeholder="Group name or slug"
          />
          <Button type="submit" className="admin-primary">
            Search
          </Button>
        </form>
        <SelectField
          label="Status"
          value={locked}
          options={LOCK_FILTERS}
          onChange={(value) => {
            setLocked(value);
            setPage(1);
          }}
        />
        <Button type="button" onClick={groups.reload}>
          Refresh
        </Button>
      </div>

      {groups.loading ? <Loading label="Loading groups" /> : null}
      {groups.error ? <Notice tone="error">{groups.error}</Notice> : null}

      {!groups.loading && !groups.error ? (
        <Card title="Platform groups" subtitle={`${groups.data?.count ?? 0} groups.`}>
          {rows.length === 0 ? (
            <Empty>No groups match this view.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Owner</th>
                  <th>Privacy</th>
                  <th>Members</th>
                  <th>Posts</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <strong>{group.name}</strong>
                      <br />
                      <span className="admin-muted">/{group.slug}</span>
                    </td>
                    <td>{ownerName(group)}</td>
                    <td>{group.privacy}</td>
                    <td>{group.member_count}</td>
                    <td>{group.post_count}</td>
                    <td>
                      <Pill tone={group.is_locked ? "warn" : "ok"}>
                        {group.is_locked ? "Locked" : "Open"}
                      </Pill>
                    </td>
                    <td>{formatDate(group.created_at)}</td>
                    <td>
                      {canLock ? (
                        <Button type="button" onClick={() => setTarget(group)}>
                          {group.is_locked ? "Unlock" : "Lock"}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pager page={page} perPage={PAGE_SIZE} total={groups.data?.count} onPage={setPage} />
        </Card>
      ) : null}

      {target ? (
        <ReasonDialog
          title={target.is_locked ? `Unlock ${target.name}?` : `Lock ${target.name}?`}
          description={
            target.is_locked
              ? "New members will be able to join this group again. The action and reason are recorded."
              : "This group will stop accepting new members and disappear from public group lists. The action and reason are recorded."
          }
          confirmLabel={target.is_locked ? "Unlock group" : "Lock group"}
          busy={busy}
          minimumLength={4}
          onClose={() => setTarget(null)}
          onConfirm={async (reason) => {
            await guarded(async () => {
              await adminGroupModerate(target.id, { locked: !target.is_locked, reason });
              setTarget(null);
              groups.reload();
            }).catch(() => undefined);
          }}
        />
      ) : null}
    </>
  );
}

export function GroupsScreen() {
  return (
    <ConsoleScreen anyOf={["groups.view"]}>
      <GroupsBody />
    </ConsoleScreen>
  );
}
