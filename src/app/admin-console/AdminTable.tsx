import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Download, Search, X } from "lucide-react";
import { encodeCsv, matchesLoadedRow } from "./tools.mjs";
type NodeProps = { children?: ReactNode; hidden?: boolean };
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((item) =>
      typeof item === "string" || typeof item === "number"
        ? String(item)
        : isValidElement<NodeProps>(item)
          ? textOf(item.props.children)
          : "",
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
function elements(node: ReactNode) {
  return Children.toArray(node).filter(isValidElement<NodeProps>);
}
/** Tools apply to the loaded page only; server filters and pagination remain authoritative. */
export function Table({
  children,
  filterable = true,
  showCount = true,
}: {
  children: ReactNode;
  filterable?: boolean;
  showCount?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [exported, setExported] = useState(false);
  const id = useId();
  const parts = elements(children);
  const head = parts.find((part) => part.type === "thead");
  const body = parts.find((part) => part.type === "tbody");
  const headings = elements(elements(head?.props.children)[0]?.props.children).map((cell) =>
    textOf(cell.props.children),
  );
  const columns = headings
    .map((label, index) => ({ label, index }))
    .filter(({ label }) => label && !/^(actions?|manage|controls?|options?)$/i.test(label));
  const rows = elements(body?.props.children).filter((row) => row.type === "tr");
  const rowText = (row: ReactElement<NodeProps>) => {
    const cells = elements(row.props.children);
    return columns.map(({ index }) => textOf(cells[index]?.props.children));
  };
  const visible = useMemo(
    () =>
      rows.filter((row) => !row.props.hidden && matchesLoadedRow(rowText(row).join(" "), query)),
    [children, query],
  );
  const shown = new Set(visible.map((row) => row.key));
  const exportRows = () => {
    const csv = encodeCsv([columns.map(({ label }) => label), ...visible.map(rowText)]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "velori-" +
      (location.pathname.split("/").filter(Boolean).at(-1) ?? "admin") +
      "-" +
      new Date().toISOString().slice(0, 10) +
      ".csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  };
  return (
    <div className="admin-data-table">
      <div className="admin-table-tools">
        {filterable ? (
          <label className="admin-table-filter">
            <Search size={16} aria-hidden="true" />
            <span className="admin-visually-hidden">Filter loaded rows</span>
            <input
              type="search"
              value={query}
              placeholder="Filter this page…"
              aria-controls={id}
              onChange={(event) => {
                setQuery(event.target.value);
                setExported(false);
              }}
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear row filter">
                <X size={15} aria-hidden="true" />
              </button>
            ) : null}
          </label>
        ) : null}
        {showCount ? (
          <span className="admin-table-count" role="status">
            {visible.length} of {rows.length} loaded rows
          </span>
        ) : null}
        <button
          type="button"
          className="admin-table-export"
          disabled={!visible.length || !columns.length}
          onClick={exportRows}
        >
          <Download size={15} aria-hidden="true" />
          Export CSV
        </button>
      </div>
      <div
        className="admin-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Data table, scroll horizontally for more columns"
      >
        <table id={id}>
          {parts.map((part, index) =>
            part.type === "tbody"
              ? cloneElement(
                  part,
                  { key: part.key ?? index },
                  elements(part.props.children).map((row) =>
                    row.type === "tr" ? cloneElement(row, { hidden: !shown.has(row.key) }) : row,
                  ),
                )
              : part,
          )}
        </table>
      </div>
      {query && !visible.length ? (
        <p className="admin-table-no-results">
          No loaded rows match “{query}”.{" "}
          <button type="button" onClick={() => setQuery("")}>
            Clear filter
          </button>
        </p>
      ) : null}
      {exported ? (
        <p className="admin-table-export-note" role="status">
          CSV downloaded with {visible.length} visible rows from this page.
        </p>
      ) : null}
    </div>
  );
}
