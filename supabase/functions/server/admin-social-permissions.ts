export type ModerationKind = "reel" | "story";

function permissionStem(kind: ModerationKind): "reels" | "stories" {
  return kind === "reel" ? "reels" : "stories";
}

export function moderationViewPermissionFor(kind: ModerationKind): string {
  return `${permissionStem(kind)}.view`;
}

export function moderationPermissionFor(kind: ModerationKind, state: string): string | null {
  const stem = permissionStem(kind);
  if (state === "hidden") return `${stem}.hide`;
  if (state === "removed") return `${stem}.delete`;
  if (state === "clean") {
    // The permission registry has `reels.restore` but no `stories.restore`, so a
    // story restore has to be authorised by the permission the registry does
    // grant it. Checking for a key no role can ever hold would make the action
    // permanently unavailable to every administrator instead of merely gated.
    return kind === "reel" ? "reels.restore" : "stories.hide";
  }
  // "restricted" is a softer action than removal and shares the hide permission.
  return `${stem}.hide`;
}
