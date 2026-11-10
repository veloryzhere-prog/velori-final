export async function probeCandidate(
  name: string,
  value: string,
  env: (key: string) => string,
  fetcher: typeof fetch = fetch,
) {
  if (!value || value.length > 8192 || value.includes("\0"))
    throw Error("Invalid candidate value.");
  if (name === "GEMINI_API_KEY") {
    const model = env("VELORI_GEMINI_MODEL");
    if (!/^[a-z0-9._-]{3,80}$/i.test(model)) throw Error("Configure a valid Gemini model first.");
    const r = await fetcher(
      "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model),
      {
        headers: { "x-goog-api-key": value },
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      },
    );
    await r.body?.cancel();
    if (!r.ok) throw Error("The candidate cannot access the configured Gemini model.");
    return "Model access verified. Inference quota still needs a real generation check.";
  }
  if (name === "STRIPE_SECRET_KEY") {
    if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(value))
      throw Error("Use a server-side Stripe secret or restricted key.");
    async function account(key: string) {
      const r = await fetcher("https://api.stripe.com/v1/account", {
        headers: { authorization: "Bearer " + key },
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) {
        await r.body?.cancel();
        throw Error("Stripe account access could not be verified.");
      }
      const a = await r.json();
      if (!/^acct_[A-Za-z0-9]+$/.test(a.id)) throw Error("Invalid provider account.");
      return a.id as string;
    }
    const next = await account(value),
      current = env(name);
    if (current) {
      if (
        current.includes("_live_") !== value.includes("_live_") ||
        (await account(current)) !== next
      )
        throw Error(
          "Keep the same Stripe account and test/live mode. Changing merchants requires a billing migration.",
        );
    }
    return "Stripe account matches. Existing orders remain bound to their recorded prices and amounts.";
  }
  if (name === "STRIPE_WEBHOOK_SECRET") {
    if (!/^whsec_[A-Za-z0-9]{16,}$/.test(value)) throw Error("Use a valid webhook signing secret.");
    return "Format checked only. A real signed provider delivery must verify this secret after activation. Previous signatures remain accepted.";
  }
  throw Error("This value is not supported by the rotation workflow.");
}
