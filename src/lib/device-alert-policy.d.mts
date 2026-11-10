export function messageAlertTarget(
  notification: Record<string, unknown>,
  userId: string,
  currentUrl: string,
  now?: number,
): { url: string; conversation: string | null } | null;
