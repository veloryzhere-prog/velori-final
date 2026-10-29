export const APK_PROMOTION_KINDS = ["welcome", "referral", "reward"];

const APK_PROMOTION_NAME_PATTERN = /^APK_ONLY:(welcome|referral|reward):/i;

export function isApkOnlyAnnouncementName(value) {
  return typeof value === "string" && APK_PROMOTION_NAME_PATTERN.test(value.trim());
}

export function apkPromotionKindFromName(value) {
  if (typeof value !== "string") return null;
  return value.trim().match(APK_PROMOTION_NAME_PATTERN)?.[1]?.toLowerCase() ?? null;
}

export function apkPromotionLabelFromName(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(APK_PROMOTION_NAME_PATTERN, "").trim();
}

export function apkPromotionMutationError({ currentName, nextName, nextState, nextActive }) {
  const currentKind = apkPromotionKindFromName(currentName);
  const nextKind = apkPromotionKindFromName(nextName);

  if (!currentKind && nextKind) {
    return "APK-only campaign targeting can only be set when a campaign is created.";
  }
  if (currentKind && nextName !== undefined && nextKind !== currentKind) {
    return "APK-only campaign targeting cannot be removed or changed.";
  }
  if (currentKind && (nextState === "live" || nextState === "scheduled" || nextActive === true)) {
    return "APK-only promotions cannot be activated until trusted Android installation verification is deployed.";
  }
  return null;
}

export function apkOnlyAnnouncementName(kind, label) {
  if (!APK_PROMOTION_KINDS.includes(kind)) {
    throw new TypeError("Choose a supported APK promotion kind.");
  }
  const prefix = `APK_ONLY:${kind}: `;
  const value = apkPromotionLabelFromName(label);
  return `${prefix}${(value || "Untitled promotion").slice(0, 120 - prefix.length)}`;
}
