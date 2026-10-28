/* Copyright © 2026 VELORYZ. All rights reserved. */
export function createUuid(
  source?: {
    randomUUID?: () => string;
    getRandomValues?: (bytes: Uint8Array) => Uint8Array;
  } | null,
): string;
