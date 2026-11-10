// Copyright © 2026 VELORYZ. All rights reserved.
export const managementKey = "VELORI_ENVIRONMENT_MANAGEMENT_TOKEN";
export function validateSetup(body: Record<string, unknown>) {
  if (body.operation !== "setup" || body.confirm !== managementKey)
    throw Error("Confirm the exact management variable name.");
  if (typeof body.value !== "string" || !/^sbp_[A-Za-z0-9_-]{20,4092}$/.test(body.value))
    throw Error("Enter a Supabase personal access token, scoped to this project's Edge secrets.");
  return body.value;
}

/** Called only after server-side super-admin, permission and recent-reauth gates.
 * The candidate is never returned, logged or placed in browser storage. */
export async function installManagementToken(
  project: string,
  candidate: string,
  audit: (action: string) => Promise<void>,
  fetcher: typeof fetch = fetch,
) {
  if (!/^[a-z]{20}$/.test(project)) throw Error("The server project could not be resolved.");
  const target = `https://api.supabase.com/v1/projects/${project}/secrets`;
  const headers = { authorization: `Bearer ${candidate}`, "content-type": "application/json" };
  try {
    const readable = await fetcher(target, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    await readable.body?.cancel();
    if (!readable.ok) throw Error();
  } catch {
    throw Error(
      "The token cannot read this project's Edge secrets. Check its project, permissions and expiry.",
    );
  }
  // No write is allowed when the audit service is unavailable.
  await audit("environment.setup.requested");
  try {
    const saved = await fetcher(target, {
      method: "POST",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify([{ name: managementKey, value: candidate }]),
    });
    await saved.body?.cancel();
    if (!saved.ok) throw Error();
  } catch {
    throw Error(
      "Setup was not confirmed. The token needs Edge secrets write permission. Refresh status before retrying.",
    );
  }
  let auditPending = false;
  try {
    await audit("environment.setup.confirmed");
  } catch {
    auditPending = true;
  }
  return { saved: true, restartPending: true, auditPending };
}
