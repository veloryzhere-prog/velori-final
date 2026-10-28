export const MIN_ACCOUNT_PASSWORD_LENGTH = 12;

export function normalizeEmail(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isValidAccountEmail(value) {
  const email = normalizeEmail(value);
  if (email.length > 254 || /\s/.test(email)) return false;
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return (
    local.length <= 64 &&
    !local.startsWith(".") &&
    !local.endsWith(".") &&
    !local.includes("..") &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) &&
    domain.includes(".") &&
    domain.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  );
}

export function passwordPolicy(password) {
  const value = String(password ?? "");
  return {
    longEnough: value.length >= MIN_ACCOUNT_PASSWORD_LENGTH,
    hasLetter: /[a-z]/i.test(value),
    hasNumberOrSymbol: /[^a-z]/i.test(value),
  };
}

export function isStrongAccountPassword(password) {
  const policy = passwordPolicy(password);
  return policy.longEnough && policy.hasLetter && policy.hasNumberOrSymbol;
}
