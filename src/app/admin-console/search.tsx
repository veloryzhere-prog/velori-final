import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Search, X, ArrowUpRight } from "lucide-react";
import { adminSearch, type AdminSearchResult } from "../../lib/admin-api";
import { ADMIN_ENTRIES, ADMIN_PATHS } from "./navigation";
import { usePermissions } from "./session";
import { useAdminPreferences } from "./preferences";
import { canOpenEntry, matchesLoadedRow } from "./tools.mjs";
import { ensureAdminOverlayRoot } from "./widgets";
const LABELS: Record<AdminSearchResult["kind"], string> = {
  user: "People",
  post: "Posts",
  comment: "Comments",
  report: "Reports",
  page: "Pages",
  group: "Groups",
  flag: "Features",
  audit: "Activity",
  reel: "Reels",
  story: "Stories",
  advertisement: "Advertisements",
  announcement: "Announcements",
};
type SearchItem = { id: string; title: string; subtitle: string; href: string; group: string };
export function ConsoleSearch({ canSearchRecords = false }: { canSearchRecords?: boolean }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const permissions = usePermissions();
  const { pins } = useAdminPreferences(ADMIN_PATHS);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const ticket = useRef(0);
  const grouped = useMemo(() => {
    const groups = new Map<string, SearchItem[]>();
    const sections = ADMIN_ENTRIES.filter(
      (entry) => canOpenEntry(entry, permissions) && matchesLoadedRow(entry.label, term),
    );
    for (const entry of sections) {
      const group = pins.includes(entry.to) && !term.trim() ? "Pinned workspaces" : "Workspaces";
      groups.set(group, [
        ...(groups.get(group) ?? []),
        { id: entry.to, title: entry.label, subtitle: "Open workspace", href: entry.to, group },
      ]);
    }
    for (const result of results) {
      if (!result.href?.startsWith("/admin/")) continue;
      const group = LABELS[result.kind] ?? "Results";
      groups.set(group, [
        ...(groups.get(group) ?? []),
        {
          id: result.kind + result.id,
          title: result.title,
          subtitle: result.subtitle ?? "",
          href: result.href,
          group,
        },
      ]);
    }
    return [...groups.entries()];
  }, [permissions, results, term, pins.join("|")]);
  const items = grouped.flatMap(([, entries]) => entries);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus();
    };
  }, [open]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        if (!open && document.querySelector(".admin-dialog-scrim, .admin-mobile-nav-scrim")) return;
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input, [href]") ??
          [],
      ).filter((element) => element.getClientRects().length);
      const first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [open]);
  useEffect(() => {
    const current = ++ticket.current;
    setResults([]);
    setError(null);
    setActiveIndex(0);
    if (!open || !canSearchRecords || term.trim().length < 2) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      void adminSearch(term.trim())
        .then((response) => {
          if (ticket.current === current) setResults(response.results ?? []);
        })
        .catch((caught: unknown) => {
          if (ticket.current === current)
            setError(
              caught instanceof Error
                ? caught.message
                : "Record search is unavailable. Workspace search still works.",
            );
        })
        .finally(() => {
          if (ticket.current === current) setLoading(false);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      if (ticket.current === current) ticket.current += 1;
    };
  }, [open, term, canSearchRecords]);
  useEffect(() => {
    dialog.current
      ?.querySelector('[data-search-index="' + activeIndex + '"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);
  const go = (item: SearchItem) => {
    setOpen(false);
    setTerm("");
    navigate(item.href);
  };
  const handleKeys = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        Math.max(0, Math.min(items.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))),
      );
    }
    if (event.key === "Enter" && items[activeIndex]) {
      event.preventDefault();
      go(items[activeIndex]);
    }
  };
  let index = 0;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="admin-search-trigger"
        onClick={() => setOpen(true)}
        aria-label="Search admin workspaces"
        aria-keyshortcuts="Control+k Meta+k"
      >
        <Search aria-hidden="true" />
        <span>Find a workspace{canSearchRecords ? " or record" : ""}…</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open
        ? createPortal(
            <div
              className="admin-command-scrim"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <section
                ref={dialog}
                className="admin-command-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-command-title"
              >
                <h2 id="admin-command-title" className="admin-visually-hidden">
                  Search administration
                </h2>
                <div className="admin-command-input-wrap">
                  <Search aria-hidden="true" />
                  <input
                    ref={input}
                    type="search"
                    role="combobox"
                    aria-label="Search workspaces and permitted records"
                    aria-expanded="true"
                    aria-controls="admin-search-results"
                    aria-activedescendant={
                      items[activeIndex] ? "admin-search-result-" + activeIndex : undefined
                    }
                    value={term}
                    placeholder="Where would you like to go?"
                    autoComplete="off"
                    onKeyDown={handleKeys}
                    onChange={(event) => setTerm(event.target.value)}
                  />
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close search">
                    <X aria-hidden="true" />
                  </button>
                </div>
                <div
                  className="admin-command-results"
                  id="admin-search-results"
                  role="listbox"
                  aria-label="Search results"
                >
                  {grouped.map(([group, entries]) => (
                    <section
                      className="admin-command-result-group"
                      key={group}
                      role="group"
                      aria-label={group}
                    >
                      <h3>{group}</h3>
                      <ul role="presentation">
                        {entries.map((item) => {
                          const itemIndex = index++;
                          return (
                            <li key={item.id} role="presentation">
                              <button
                                type="button"
                                role="option"
                                aria-selected={activeIndex === itemIndex}
                                id={"admin-search-result-" + itemIndex}
                                data-search-index={itemIndex}
                                className={activeIndex === itemIndex ? "is-active" : ""}
                                onMouseEnter={() => setActiveIndex(itemIndex)}
                                onClick={() => go(item)}
                              >
                                <span>
                                  <strong>{item.title}</strong>
                                  <small>{item.subtitle}</small>
                                </span>
                                <ArrowUpRight size={16} aria-hidden="true" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
                <div className="admin-search-status" role="status">
                  {loading
                    ? "Searching permitted records…"
                    : !items.length
                      ? "No matches. Try another name or section."
                      : !term.trim()
                        ? "Your available workspaces. Type to narrow the list."
                        : items.length + " results"}
                </div>
                {error ? (
                  <p className="admin-command-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <footer className="admin-command-footer">
                  <span>↑↓ Navigate</span>
                  <span>Enter Open</span>
                  <span>Esc Close</span>
                </footer>
              </section>
            </div>,
            ensureAdminOverlayRoot(),
          )
        : null}
    </>
  );
}
