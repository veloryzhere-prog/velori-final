import test from "node:test";
import assert from "node:assert/strict";
import {
  areaDestination,
  areaEntries,
  normalizePins,
  encodeCsv,
  matchesLoadedRow,
} from "./tools.mjs";
const groups = [
  {
    label: "Publishing",
    entries: [
      { to: "/admin/cms", permissions: ["cms.view"] },
      { to: "/admin/announcements", permissions: ["notifications.view"] },
      { to: "/admin/ads", permissions: ["ads.view"] },
    ],
  },
  {
    label: "Social",
    entries: [
      { to: "/admin/users", permissions: ["users.view"] },
      { to: "/admin/reports", permissions: ["reports.view"] },
    ],
  },
];
test("limited roles open an accessible area destination and never see unrelated publishing areas", () => {
  const permissions = new Set(["ads.view", "reports.view"]);
  assert.equal(
    areaDestination({ to: "/admin/users", groups: ["Social"] }, groups, permissions),
    "/admin/reports",
  );
  assert.equal(
    areaDestination(
      { to: "/admin/cms", groups: ["Publishing"], paths: ["/admin/cms", "/admin/pages"] },
      groups,
      permissions,
    ),
    null,
  );
  assert.deepEqual(
    areaEntries(
      { to: "/admin/announcements", groups: ["Publishing"], paths: ["/admin/announcements"] },
      groups,
      permissions,
    ),
    [],
  );
  assert.equal(
    areaDestination(
      { to: "/admin/ads", groups: ["Publishing"], paths: ["/admin/ads"] },
      groups,
      permissions,
    ),
    "/admin/ads",
  );
});
test("pins accept only unique known workspaces, drop external or record URLs and cap six", () => {
  const paths = Array.from({ length: 8 }, (_, i) => "/admin/area" + i);
  assert.deepEqual(
    normalizePins(
      [paths[0], paths[0], "https://invalid.test", "/admin/users?user=private", ...paths],
      paths,
    ),
    paths.slice(0, 6),
  );
  for (const value of [null, {}, "[]", 1]) assert.deepEqual(normalizePins(value, paths), []);
});
test("CSV retains commas, quotes, Unicode and multiline content without executing formulas", () => {
  const csv = encodeCsv([
    ["Name", "Note"],
    ["Zoë, Lee", 'Said "hello"\nNext line'],
    [" =HYPERLINK(1)", "\t@SUM(1)"],
    ["+1", "-2"],
    [null, undefined],
  ]);
  assert.equal(
    csv,
    '﻿"Name","Note"\r\n"Zoë, Lee","Said ""hello""\nNext line"\r\n"\' =HYPERLINK(1)","\'\t@SUM(1)"\r\n"\'+1","\'-2"\r\n"",""',
  );
});
test("loaded row filtering matches all words, normalized characters and empty queries", () => {
  assert.equal(matchesLoadedRow("Alice Published October", "published alice"), true);
  assert.equal(matchesLoadedRow("Ａlice", "alice"), true);
  assert.equal(matchesLoadedRow("Alice Published", "alice pending"), false);
  assert.equal(matchesLoadedRow("anything", "  "), true);
});
