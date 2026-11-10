export type MotionPreference = "auto" | "full" | "gentle" | "off";
export type InterfaceMotion = "full" | "gentle" | "off";
export const MOTION_PREFERENCE_KEY: string;
export const MOTION_PREFERENCES: MotionPreference[];
export function normalizeMotionPreference(value: unknown): MotionPreference;
export function resolveInterfaceMotion(
  preference: unknown,
  prefersReducedMotion: boolean,
): InterfaceMotion;
