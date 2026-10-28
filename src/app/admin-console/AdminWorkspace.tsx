import { type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { ArrowUpRight, Columns2, ListFilter, PanelTop, Pin } from "lucide-react";
import { ADMIN_ENTRIES, ADMIN_PATHS } from "./navigation";
import { useAdminPreferences } from "./preferences";
import { usePermissions } from "./session";
import { canOpenEntry } from "./tools.mjs";
export function AdminWorkspace({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const permissions = usePermissions();
  const { compact, pins, update } = useAdminPreferences(ADMIN_PATHS);
  const resource = pathname.split("/")[2] || "dashboard";
  const entry = ADMIN_ENTRIES.find(
    (item) => item.to === pathname && canOpenEntry(item, permissions),
  );
  const availablePins = pins.filter((path) =>
    ADMIN_ENTRIES.some((item) => item.to === path && canOpenEntry(item, permissions)),
  );
  const pinned = entry ? availablePins.includes(entry.to) : false;
  return (
    <section
      className="admin-workspace-recreated"
      data-density={compact ? "compact" : "comfortable"}
      data-resource={resource}
    >
      <div className="admin-workspace-toolbar">
        <span>
          <PanelTop size={17} aria-hidden="true" />
          <b>{entry?.label ?? resource.split("-").join(" ")}</b>
          <small>WORKSPACE</small>
        </span>
        <div>
          {entry ? (
            <button
              type="button"
              aria-pressed={pinned}
              disabled={!pinned && availablePins.length >= 6}
              title={
                !pinned && availablePins.length >= 6
                  ? "Unpin a workspace to add another (6 maximum)"
                  : undefined
              }
              onClick={() =>
                update({
                  pins: pinned
                    ? availablePins.filter((path) => path !== entry.to)
                    : [...availablePins, entry.to],
                })
              }
            >
              <Pin size={15} aria-hidden="true" />
              {pinned ? "Unpin" : "Pin workspace"}
            </button>
          ) : null}
          <button
            type="button"
            aria-pressed={compact}
            onClick={() => update({ compact: !compact })}
          >
            {compact ? (
              <Columns2 size={15} aria-hidden="true" />
            ) : (
              <ListFilter size={15} aria-hidden="true" />
            )}
            {compact ? "Comfortable view" : "Compact view"}
          </button>
          <Link to="/home">
            Open VELORI <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="admin-workspace-content">{children}</div>
    </section>
  );
}
