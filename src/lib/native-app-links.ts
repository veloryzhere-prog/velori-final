const APP_SCHEME = "online.veloryz.velori:";
const APP_DOMAIN = "chat.veloryz.online";
const ROUTE_PATTERN =
  /^\/(?:auth\/confirm|reset-password|login|signup|onboarding|home|explore|search|reels|messages|notifications|settings|profile\/[a-zA-Z0-9._-]+|post\/[a-fA-F0-9-]+)\/?$/;

export function resolveNativeAppLink(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  let pathname: string;
  if (url.protocol === APP_SCHEME && url.hostname === "auth") {
    pathname = url.pathname === "/confirm" ? "/auth/confirm" : url.pathname;
  } else if (url.protocol === APP_SCHEME && /^[a-zA-Z][a-zA-Z0-9-]*$/.test(url.hostname)) {
    pathname = `/${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } else if (url.protocol === "https:" && url.hostname === APP_DOMAIN) {
    pathname = url.pathname;
  } else {
    return null;
  }

  if (!ROUTE_PATTERN.test(pathname)) return null;
  return `${pathname}${url.search}${url.hash}`;
}
