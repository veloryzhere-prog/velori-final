export type ManagementDiagnostic = {
  code: string;
  error: string;
  hint: string;
};
export function managementDiagnostic(
  status?: number,
  operation?: "read" | "write",
): ManagementDiagnostic;
