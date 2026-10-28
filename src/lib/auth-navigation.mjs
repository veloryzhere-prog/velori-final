const AUTH_ONLY_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/check-email",
  "/auth/confirm",
  "/auth/confirmed",
  "/onboarding",
]);

export function safeReturnPath(state, origin) {
  if (!state || typeof state !== "object" || !("from" in state)) return null;
  const candidate = state.from;
  if (
    typeof candidate !== "string" ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/\\")
  ) {
    return null;
  }

  try {
    const url = new URL(candidate, origin);
    if (url.origin !== origin || AUTH_ONLY_PATHS.has(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
