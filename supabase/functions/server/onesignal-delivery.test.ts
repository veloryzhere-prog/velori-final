import { sendOneSignalPush, validOneSignalConfiguration } from "./onesignal-delivery.ts";

const appId = "86e2e54e-2c25-49cb-97e5-f64030ac74b9";
const apiKey = "a".repeat(32);
const externalId = "123e4567-e89b-42d3-a456-426614174000";
const input = {
  externalIds: [externalId],
  title: "VELORI update",
  message: "An update is available.",
  route: "/notifications",
  campaignId: "123e4567-e89b-42d3-a456-426614174001",
  priority: "normal",
};

Deno.test("OneSignal push payload targets verified external IDs and reports provider acceptance", async () => {
  const requestBodies: Record<string, unknown>[] = [];
  const result = await sendOneSignalPush(input, {
    appId,
    apiKey,
    fetcher: async (_url, init) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Response.json({ id: "provider-id", recipients: 1 });
    },
  });
  const requestBody = requestBodies[0];
  if (!requestBody) throw new Error("OneSignal must receive a request for eligible accounts.");
  const aliases = requestBody.include_aliases as { external_id?: string[] } | undefined;

  if (result.status !== "accepted" || result.providerRecipientCount !== 1) {
    throw new Error("A successful provider response must be recorded as accepted.");
  }
  if (aliases?.external_id?.[0] !== externalId || requestBody.target_channel !== "push") {
    throw new Error("Push must target only the supplied authenticated account aliases.");
  }
  if (result.providerNotificationIds[0] !== "provider-id") {
    throw new Error("The provider notification id must be retained.");
  }
});

Deno.test("OneSignal push rejects missing configuration and malformed recipients", async () => {
  if (validOneSignalConfiguration(appId, "")) {
    throw new Error("A missing REST API key must be treated as unconfigured.");
  }
  const unconfigured = await sendOneSignalPush(input, { appId, apiKey: "" });
  if (unconfigured.status !== "not_configured") {
    throw new Error("Missing credentials must not be reported as a successful push.");
  }
  const noRecipients = await sendOneSignalPush(
    { ...input, externalIds: ["not-a-uuid"] },
    { appId, apiKey },
  );
  if (noRecipients.status !== "no_recipients") {
    throw new Error("Malformed account ids must not be sent to OneSignal.");
  }
});

Deno.test("OneSignal errors do not expose provider response bodies", async () => {
  const result = await sendOneSignalPush(input, {
    appId,
    apiKey,
    fetcher: async () => new Response("private provider error", { status: 401 }),
  });
  if (result.status !== "failed" || result.errorCode !== "provider_http_401") {
    throw new Error("Provider failures must return a safe machine-readable status.");
  }
  if (JSON.stringify(result).includes("private provider error")) {
    throw new Error("Provider response bodies must not be returned or logged.");
  }
});
