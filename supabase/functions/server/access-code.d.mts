export const DEFAULT_ACCESS_CODE_ITERATIONS: number;

export function timingSafeEqualString(leftValue: string, rightValue: string): boolean;

export function hashAccessCode(code: string, iterations?: number): Promise<string>;

export function verifyAccessCode(code: string, stored: string): Promise<boolean>;

export function verifyBootstrapCode(
  code: string,
  setupSecret: string,
  storedCode: { code_hash: string; enabled: boolean } | null,
): Promise<{ matchesSecret: boolean; matchesStored: boolean }>;
