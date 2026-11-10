export const DEFAULT_PASSWORD_ITERATIONS: number;
export const MIN_ADMIN_PASSWORD_LENGTH: number;
export const MAX_ADMIN_PASSWORD_LENGTH: number;
export const MIN_ADMIN_USERNAME_LENGTH: number;
export const MAX_ADMIN_USERNAME_LENGTH: number;
export const USERNAME_PATTERN: RegExp;

export function normalizeUsername(username: string): string;
export function isValidUsername(username: unknown): boolean;
export function isValidNewPassword(password: unknown): boolean;
export function hashPassword(password: string, iterations?: number): Promise<string>;
export function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean>;
export function adminIdentityEmail(username: string): string;
