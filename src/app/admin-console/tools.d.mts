type Entry = { to: string; permissions: readonly string[] };
type Group<T extends Entry> = { label: string; entries: readonly T[] };
type Area = { to: string; groups: readonly string[]; paths?: readonly string[] };
export function canOpenEntry(entry: Entry, permissions: ReadonlySet<string>): boolean;
export function areaEntries<T extends Entry>(
  area: Area,
  groups: readonly Group<T>[],
  permissions: ReadonlySet<string>,
): T[];
export function areaDestination<T extends Entry>(
  area: Area,
  groups: readonly Group<T>[],
  permissions: ReadonlySet<string>,
): string | null;
export function normalizePins(value: unknown, allowedPaths: readonly string[]): string[];
export function matchesLoadedRow(text: string, query: string): boolean;
export function encodeCsv(rows: readonly (readonly unknown[])[]): string;
