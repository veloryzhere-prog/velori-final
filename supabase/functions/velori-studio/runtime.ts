/** Resolve protected Supabase environment keys without returning their values to a client. */
export function runtimeKey(read: (name: string) => string, direct: string[], dictionary: string) {
  for (const name of direct) if (read(name)) return read(name);
  try {
    const values = JSON.parse(read(dictionary));
    return typeof values?.default === "string" ? values.default : "";
  } catch {
    return "";
  }
}
export type Readiness = {
  database: boolean;
  encryption: boolean;
  serverEnabled: boolean;
  provider: boolean;
  generationEnabled: boolean;
  billing: boolean;
};
export function capabilities(checks: Readiness) {
  const cloud = checks.database && checks.encryption && checks.serverEnabled;
  return {
    cloud,
    generation: cloud && checks.provider && checks.generationEnabled,
    billing: cloud && checks.billing,
    checks,
  };
}
export const defaultOrigins = ["https://velori-social-platform.sweetriver32.chatgpt.site"];
