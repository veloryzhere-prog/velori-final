export const APK_PROMOTION_KINDS: readonly ["welcome", "referral", "reward"];

export type ApkPromotionKind = (typeof APK_PROMOTION_KINDS)[number];

export function isApkOnlyAnnouncementName(value: unknown): boolean;
export function apkPromotionKindFromName(value: unknown): ApkPromotionKind | null;
export function apkPromotionLabelFromName(value: unknown): string;
export function apkPromotionMutationError(input: {
  currentName: unknown;
  nextName?: unknown;
  nextState?: unknown;
  nextActive?: unknown;
}): string | null;
export function apkOnlyAnnouncementName(kind: ApkPromotionKind, label: string): string;
