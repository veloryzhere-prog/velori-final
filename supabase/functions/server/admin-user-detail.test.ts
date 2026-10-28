import { scopeAdminUserDetail } from "./admin-user-detail.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("user detail omits reports, audit, notes, and admin role without their permissions", () => {
  const result = scopeAdminUserDetail(
    {
      profile: { username: "member", moderation_notes: "internal note" },
      reports: [{ id: "report-1" }],
      moderationHistory: [{ id: "audit-1" }],
      adminAccess: { role_key: "moderator" },
      postCount: 3,
      email: "member@example.test",
    },
    new Set(["users.view"]),
  );

  const profile = result.profile as Record<string, unknown>;
  assert(!("moderation_notes" in profile), "moderation notes must be omitted");
  assert((result.reports as unknown[]).length === 0, "report rows must be omitted");
  assert((result.moderationHistory as unknown[]).length === 0, "audit rows must be omitted");
  assert(result.adminAccess === null, "admin role data must be omitted");
  assert(result.postCount === 3, "ordinary account counts remain available");
  assert(result.email === "member@example.test", "the users.view email behavior is preserved");
});

Deno.test("user detail keeps each restricted field when its permission is granted", () => {
  const result = scopeAdminUserDetail(
    {
      profile: { username: "member", moderation_notes: "internal note" },
      reports: [{ id: "report-1" }],
      moderationHistory: [{ id: "audit-1" }],
      adminAccess: { role_key: "moderator" },
    },
    new Set(["users.notes", "reports.view", "audit.view", "admins.view"]),
  );

  assert(
    (result.profile as Record<string, unknown>).moderation_notes === "internal note",
    "moderation notes are retained for users.notes",
  );
  assert((result.reports as unknown[]).length === 1, "reports.view retains report rows");
  assert((result.moderationHistory as unknown[]).length === 1, "audit.view retains audit rows");
  assert(
    (result.adminAccess as Record<string, unknown>).role_key === "moderator",
    "admins.view retains administrator role data",
  );
});
