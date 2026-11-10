export const MIN_ADMIN_PASSWORD_LENGTH = 12;
export const MAX_ADMIN_PASSWORD_LENGTH = 200;

export function isStrongAdminPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= MIN_ADMIN_PASSWORD_LENGTH &&
    password.length <= MAX_ADMIN_PASSWORD_LENGTH &&
    /[A-Za-z]/.test(password) &&
    (/[0-9]/.test(password) || /[^A-Za-z0-9\s]/.test(password))
  );
}
