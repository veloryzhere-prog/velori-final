export const environmentKeys = [
  "VELORI_STUDIO_ORIGINS",
  "ALLOWED_ORIGINS",
  "GEMINI_API_KEY",
  "VELORI_GEMINI_MODEL",
  "VELORI_GEMINI_PREMIUM_MODEL",
  "VELORI_GEMINI_FALLBACK_MODEL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "VELORI_STUDIO_ENABLED",
  "VELORI_STUDIO_GENERATION_ENABLED",
  "VELORI_STUDIO_DAILY_PROVIDER_CAP",
  "VELORI_APP_URL",
  "VELORI_TRANSCRIPTION_ENABLED",
  "VELORI_TRANSCRIPTION_WORKER_URL",
  "VELORI_TRANSCRIPTION_WORKER_TOKEN",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_PASSWORD",
  "SMTP_FROM_EMAIL",
  "SMTP_SECURE",
  "RESEND_API_KEY",
  "GITHUB_APP_ID",
  "GITHUB_APP_INSTALLATION_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_REPOSITORY",
  "GITHUB_BASE_BRANCH",
  ...["PACK100", "PREMIUM", "PRO_MONTHLY", "TOPUP5000"].flatMap((p) =>
    ["INR", "USD"].map((c) => `VELORI_STRIPE_${p}_${c}_PRICE`),
  ),
];
export function validEnvironmentName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    (environmentKeys.includes(name) || /^VELORI_CUSTOM_[A-Z][A-Z0-9_]{0,63}$/.test(name))
  );
}
export function validateChange(body: Record<string, unknown>) {
  if (!validEnvironmentName(body.name) || body.confirm !== body.name)
    throw Error("Choose a supported key and confirm its exact name.");
  if (String(body.name).startsWith("VELORI_CUSTOM_FORGE_CONFIG"))
    throw Error("Use the Forge configuration publisher for this value.");
  if (["GEMINI_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"].includes(String(body.name)))
    throw Error("Use Manage importants to test and rotate this credential safely.");
  if (body.operation !== "set" && body.operation !== "delete") throw Error("Invalid operation.");
  if (
    body.operation === "set" &&
    ["VELORI_STUDIO_ORIGINS", "ALLOWED_ORIGINS"].includes(body.name)
  ) {
    if (typeof body.value !== "string") throw Error("Enter a comma-separated origin list.");
    const origins = body.value.split(",").map((s) => s.trim());
    if (
      origins.length > 12 ||
      !origins.includes("https://velori-social-platform.sweetriver32.chatgpt.site")
    )
      throw Error("Keep the current VELORI origin to prevent a lockout.");
    for (const raw of origins) {
      const u = new URL(raw);
      if (
        u.origin !== raw ||
        (u.protocol !== "https:" &&
          !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname)))
      )
        throw Error("Use exact HTTPS origins without paths.");
    }
  }
  if (body.operation === "set") {
    if (
      typeof body.value !== "string" ||
      !body.value.trim() ||
      body.value.length > 8192 ||
      body.value.includes("\0")
    )
      throw Error("Enter a value up to 8192 characters.");
    if (/_ENABLED$|SMTP_SECURE/.test(body.name) && !["true", "false"].includes(body.value))
      throw Error("Use true or false.");
    if (body.name.endsWith("_PRICE") && !/^price_[A-Za-z0-9]+$/.test(body.value))
      throw Error("Enter a Stripe price ID.");
    if (body.name === "VELORI_TRANSCRIPTION_WORKER_TOKEN" && body.value.length < 32)
      throw Error("Use a token of at least 32 characters.");
  }
  if (body.operation === "set" && typeof body.value === "string" && body.name.endsWith("_URL")) {
    let url;
    try {
      url = new URL(body.value);
    } catch {
      throw Error("Enter a valid HTTPS URL.");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
      throw Error("Enter a valid HTTPS URL.");
    if (body.name.includes("WORKER") && url.pathname !== "/transcribe")
      throw Error("Use the worker /transcribe endpoint.");
    if (body.name === "VELORI_APP_URL" && url.origin !== body.value)
      throw Error("Use the app origin without a path.");
  }
  return {
    name: body.name,
    operation: body.operation,
    value: body.operation === "set" ? (body.value as string) : undefined,
  };
}
export function safeMetadata(rows: unknown) {
  if (!Array.isArray(rows)) throw Error("Invalid metadata.");
  const names = new Set(
    rows.flatMap((r) =>
      typeof r?.name === "string" && validEnvironmentName(r.name) ? [r.name] : [],
    ),
  );
  return [...new Set([...environmentKeys, ...names])].map((name) => ({
    name,
    configured: names.has(name),
  }));
}
