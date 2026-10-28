/** Removes user-detail fields the current administrator is not allowed to see. */
export function scopeAdminUserDetail(
  payload: Record<string, unknown>,
  permissions: ReadonlySet<string>,
): Record<string, unknown> {
  const profile = payload.profile && typeof payload.profile === "object" &&
      !Array.isArray(payload.profile)
    ? { ...(payload.profile as Record<string, unknown>) }
    : {};

  if (!permissions.has("users.notes")) {
    Reflect.deleteProperty(profile, "moderation_notes");
  }

  return {
    ...payload,
    profile,
    reports: permissions.has("reports.view") ? payload.reports : [],
    moderationHistory: permissions.has("audit.view")
      ? payload.moderationHistory
      : [],
    adminAccess: permissions.has("admins.view") ? payload.adminAccess : null,
  };
}
