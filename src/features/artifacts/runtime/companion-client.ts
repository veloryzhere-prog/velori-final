/* Copyright © 2026 VELORYZ. Source is transmitted only after a local companion action. */
import { localEndpoint } from "./local-provider.ts";
export async function companionRequest(
  endpoint: string,
  token: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
) {
  const base = localEndpoint(endpoint);
  if (!token.trim()) throw Error("Enter the temporary pairing token from your local companion.");
  const response = await fetch(`${base}/v1/run`, {
    method: "POST",
    redirect: "error",
    credentials: "omit",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(
      typeof data.error === "string" ? data.error : "The local companion is unavailable.",
    );
  return data as {
    exitCode?: number;
    output?: string;
    rootless?: boolean;
    nodeBuild?: boolean;
    pythonCompile?: boolean;
    preview?: boolean;
    note?: string;
  };
}
