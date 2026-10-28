export function safeCampaignUrl(value) {
  if (typeof value !== "string" || !value || /[\u0000-\u0020\\]/.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? value : null;
  } catch {
    return null;
  }
}
export function announcementTargetsRoute(item, pathname) {
  const routes = [item?.target_route, ...(item?.target_routes ?? [])].filter(
    (route) => typeof route === "string" && route,
  );
  return (
    !routes.length ||
    routes.includes(pathname) ||
    (pathname === "/forge/projects/new" && routes.includes("/forge"))
  );
}
export function isForgeAnnouncementEntryRoute(pathname) {
  return pathname === "/forge" || pathname === "/artifacts" || pathname === "/forge/projects/new";
}
export function announcementEligible(item, state = {}, sessionSeen = false, now = Date.now()) {
  const count = Number(state.show_count ?? state.count ?? 0),
    last = state.last_seen_at ? Date.parse(state.last_seen_at) : Number(state.last || 0);
  if (state.dismissed_at || state.dismissed === true) return false;
  if (
    (item.starts_at &&
      (!Number.isFinite(Date.parse(item.starts_at)) || Date.parse(item.starts_at) > now)) ||
    (item.ends_at &&
      (!Number.isFinite(Date.parse(item.ends_at)) || Date.parse(item.ends_at) <= now))
  )
    return false;
  if (Number(item.max_show_count) > 1 && count >= Number(item.max_show_count)) return false;
  if (item.frequency_mode === "every_refresh") return true;
  if (item.frequency_mode === "once_per_session") return !sessionSeen;
  if (item.frequency_mode === "once_per_day") return !last || now - last >= 86400000;
  if (item.frequency_mode === "once_total") return count === 0;
  return count < Math.max(1, Number(item.max_show_count) || 1);
}
