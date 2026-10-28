/** srcdoc navigation must use the owning app's URL, not about:srcdoc. */
export function cmsNavigationTarget(value, ownerUrl) {
  if (typeof value !== "string" || value.startsWith("#")) return null;
  try {
    const owner = new URL(ownerUrl);
    const target = new URL(value, owner);
    if (
      target.origin !== owner.origin ||
      !["https:", "http:"].includes(target.protocol) ||
      target.username ||
      target.password
    )
      return null;
    return target.pathname + target.search + target.hash;
  } catch {
    return null;
  }
}
