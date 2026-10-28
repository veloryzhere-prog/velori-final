export declare const MIN_ACCOUNT_PASSWORD_LENGTH: number;
export declare function normalizeEmail(value: unknown): string;
export declare function isValidAccountEmail(value: unknown): boolean;
export declare function passwordPolicy(password: unknown): {
  longEnough: boolean;
  hasLetter: boolean;
  hasNumberOrSymbol: boolean;
};
export declare function isStrongAccountPassword(password: unknown): boolean;
