/* Copyright © 2026 VELORYZ. All rights reserved. */

/**
 * Convert Supabase Management API failures into safe, actionable diagnostics.
 * Never include provider response bodies, request headers, or credentials.
 */
export function managementDiagnostic(status = 0, operation = "read") {
  const verb = operation === "write" ? "change" : "read the environment status";
  if (status === 401) {
    return {
      code: "management_token_invalid_or_expired",
      error:
        "Supabase rejected the Management API credential (HTTP 401). It may be expired, revoked, or invalid.",
      hint: "Replace VELORI_ENVIRONMENT_MANAGEMENT_TOKEN in Supabase Dashboard → Edge Functions → Secrets, then refresh this page.",
    };
  }
  if (status === 403) {
    return {
      code: "management_token_permission_denied",
      error: `The Management API credential is not allowed to ${verb} (HTTP 403).`,
      hint: "Check that the token belongs to an account with access to this exact Supabase project and has the required Edge Function Secrets permission. Then refresh this page.",
    };
  }
  if (status === 404) {
    return {
      code: "management_project_or_endpoint_not_found",
      error:
        "Supabase could not find this project or Management API endpoint (HTTP 404).",
      hint: "Verify that SUPABASE_URL points to the intended VELORI project and that the management account can access it. Do not change the project URL unless it is confirmed in the dashboard.",
    };
  }
  if (status === 429) {
    return {
      code: "management_api_rate_limited",
      error: "Supabase is rate-limiting Management API requests (HTTP 429).",
      hint: "Wait briefly, then refresh the environment status. Avoid repeatedly submitting secret changes.",
    };
  }
  if (status >= 500 && status <= 599) {
    return {
      code: "management_api_temporarily_unavailable",
      error: `Supabase Management API is temporarily unavailable (HTTP ${status}).`,
      hint: "Retry later. No secret value was returned to the browser.",
    };
  }
  if (status === 0) {
    return {
      code: "management_api_unreachable",
      error: `VELORI could not reach the Supabase Management API to ${verb}.`,
      hint: "Check Supabase service availability and the Edge Function logs. If this timed out, retry once before changing any credentials.",
    };
  }
  return {
    code: "management_api_request_failed",
    error: `Supabase Management API could not ${verb} (HTTP ${status}).`,
    hint: "Check the Supabase project and Edge Function logs. Secret values are never exposed by this diagnostic.",
  };
}
