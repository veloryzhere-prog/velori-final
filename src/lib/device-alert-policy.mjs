/** Device alerts never include message text, names, or media on the lock screen. */
export function messageAlertTarget(notification, userId, currentUrl, now = Date.now()) {
  if (
    !notification ||
    notification.recipient_id !== userId ||
    notification.actor_id === userId ||
    notification.read_at
  )
    return null;
  if (notification.kind !== "message") return null;
  const created = Date.parse(notification.created_at);
  if (!Number.isFinite(created) || now - created > 120000 || created - now > 10000) return null;
  let target;
  try {
    target = new URL(notification.link, currentUrl);
    const current = new URL(currentUrl);
    if (target.origin !== current.origin || target.pathname !== "/messages") return null;
    const conversation = target.searchParams.get("conversation");
    if (!conversation) return { url: "/messages", conversation: null };
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(conversation)) return null;
    return { url: `/messages?conversation=${conversation}`, conversation };
  } catch {
    return null;
  }
}
