import { Search, ShieldCheck, Users, UserRoundCheck } from "lucide-react";
import { Button } from "../primitives";
import { Card, Empty, Pill, SelectField, Table, formatDate } from "../widgets";
import "./administrators.css";

type AdminRow = Record<string, unknown>;
export function AdminAccessList({
  rows,
  filtered,
  currentUserId,
  activeCount,
  owners,
  search,
  setSearch,
  filter,
  setFilter,
  canEdit,
  canDisable,
  canDelete,
  busy,
  onEdit,
  onToggle,
  onRemove,
}: {
  rows: AdminRow[];
  filtered: AdminRow[];
  currentUserId?: string;
  activeCount: number;
  owners: number;
  search: string;
  setSearch: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  canEdit: boolean;
  canDisable: boolean;
  canDelete: boolean;
  busy: boolean;
  onEdit: (admin: AdminRow) => void;
  onToggle: (admin: AdminRow) => void;
  onRemove: (admin: AdminRow) => void;
}) {
  return (
    <Card
      title="Console access"
      subtitle="Search your team, review access, and manage each account."
    >
      <div className="admin-access-summary" aria-label="Administrator summary">
        <div>
          <Users size={20} />
          <strong>{rows.length}</strong>
          <span>Administrators</span>
        </div>
        <div>
          <UserRoundCheck size={20} />
          <strong>{activeCount}</strong>
          <span>Active accounts</span>
        </div>
        <div>
          <ShieldCheck size={20} />
          <strong>{owners}</strong>
          <span>Active super admins</span>
        </div>
      </div>
      <div className="admin-access-filters">
        <label className="admin-access-search">
          <Search size={18} />
          <span className="sr-only">Search administrators</span>
          <input
            type="search"
            placeholder="Search name, username or role"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <SelectField
          label="Account status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All accounts" },
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
          ]}
        />
      </div>
      <p className="admin-muted" role="status">
        {filtered.length} of {rows.length} administrators
      </p>
      {filtered.length === 0 ? (
        <Empty>
          {rows.length ? "No administrators match this search." : "No administrators exist."}
        </Empty>
      ) : (
        <div className="admin-access-table">
          <Table filterable={false} showCount={false}>
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Role</th>
                <th>State</th>
                <th>Sessions</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((admin) => {
                const disabled = admin.is_active === false || admin.enabled === false;
                const current = admin.isCurrent === true || admin.user_id === currentUserId;
                const lastOwner = !disabled && admin.role_key === "super_admin" && owners <= 1;
                return (
                  <tr key={String(admin.user_id)}>
                    <td data-label="Administrator">
                      <strong>{String(admin.username ?? admin.user_id)}</strong>
                      {current ? <Pill tone="info">You</Pill> : null}
                      {admin.display_name ? (
                        <small className="admin-muted"> {String(admin.display_name)}</small>
                      ) : null}
                    </td>
                    <td data-label="Role">
                      {String(admin.role_key ?? admin.role ?? "—").replace(/_/g, " ")}
                    </td>
                    <td data-label="Status">
                      <Pill tone={disabled ? "warn" : "ok"}>
                        {disabled ? "disabled" : "active"}
                      </Pill>
                      {admin.must_change_password === true ? (
                        <Pill tone="info">must change password</Pill>
                      ) : null}
                    </td>
                    <td data-label="Sessions">{String(admin.activeSessions ?? 0)}</td>
                    <td data-label="Added">{formatDate(admin.created_at as string)}</td>
                    <td data-label="Actions">
                      <div className="admin-row-actions">
                        {canEdit ? (
                          <Button
                            type="button"
                            disabled={busy || current}
                            onClick={() => {
                              onEdit(admin);
                            }}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {canDisable ? (
                          <Button
                            type="button"
                            disabled={busy || current || lastOwner}
                            title={
                              lastOwner ? "Keep at least one active super administrator" : undefined
                            }
                            onClick={() => onToggle(admin)}
                          >
                            {disabled ? "Enable" : "Disable"}
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            type="button"
                            disabled={busy || current || lastOwner}
                            onClick={() => onRemove(admin)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      {current ? (
                        <small className="admin-muted">
                          Use your account menu to edit your own profile.
                        </small>
                      ) : lastOwner ? (
                        <small className="admin-muted">Last active super administrator</small>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </Card>
  );
}
