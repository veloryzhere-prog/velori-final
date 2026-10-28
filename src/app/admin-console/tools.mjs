/** Resolve navigation only from entries the current role can open. */
export function canOpenEntry(entry, permissions) {
  return (
    entry.permissions.length === 0 ||
    entry.permissions.some((permission) => permissions.has(permission))
  );
}
export function areaEntries(area, groups, permissions) {
  return groups
    .filter((group) => area.groups.includes(group.label))
    .flatMap((group) => group.entries)
    .filter(
      (entry) =>
        canOpenEntry(entry, permissions) &&
        (!area.paths ||
          area.paths.some((path) => entry.to === path || entry.to.startsWith(path + "/"))),
    );
}
export function areaDestination(area, groups, permissions) {
  const entries = areaEntries(area, groups, permissions);
  return entries.find((entry) => entry.to === area.to)?.to ?? entries[0]?.to ?? null;
}
export function normalizePins(value, allowedPaths) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((item) => typeof item === "string" && allowedPaths.includes(item))),
  ].slice(0, 6);
}
export function matchesLoadedRow(text, query) {
  const haystack = text.normalize("NFKC").toLocaleLowerCase();
  return query
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/u)
    .every((word) => haystack.includes(word));
}
/** Export text, never spreadsheet formulas. Quote every cell for RFC 4180 CSV. */
export function encodeCsv(rows) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text)) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
