import { type Ctx, service } from "./admin-core.ts";
import {
  sendOneSignalPush,
  validOneSignalConfiguration,
} from "./onesignal-delivery.ts";

export async function handleOneSignalTest(c: Ctx) {
  const accessToken = c.req.header("authorization")?.match(
    /^Bearer\s+([^\s]+)$/i,
  )?.[1];
  if (!accessToken) {
    return c.json({ error: "Sign in to test OneSignal delivery." }, 401);
  }

  const { data: authData, error: authError } = await service().auth.getUser(
    accessToken,
  );
  if (authError || !authData.user?.id) {
    return c.json({ error: "The sign-in session is invalid or expired." }, 401);
  }

  const appId = Deno.env.get("ONESIGNAL_APP_ID")?.trim() ?? "";
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY")?.trim() ?? "";
  const identityKey =
    Deno.env.get("ONESIGNAL_IDENTITY_VERIFICATION_SECRET_KEY")?.trim() ?? "";
  if (!validOneSignalConfiguration(appId, apiKey) || !identityKey) {
    return c.json({
      error: "The server-side OneSignal credentials are not configured.",
    }, 503);
  }

  const { data: preference, error: preferenceError } = await service()
    .from("notification_preferences")
    .select("push_enabled,push_system")
    .eq("profile_id", authData.user.id)
    .maybeSingle();
  if (preferenceError) {
    return c.json(
      { error: "Notification preferences could not be checked." },
      500,
    );
  }
  if (!preference?.push_enabled || preference.push_system === false) {
    return c.json({
      error: "Enable system push notifications before sending a test.",
    }, 409);
  }

  const result = await sendOneSignalPush(
    {
      externalIds: [authData.user.id],
      title: "VELORI push test",
      message: "This test was sent by VELORI through OneSignal.",
      route: "/settings/notifications",
      campaignId: crypto.randomUUID(),
      priority: "normal",
    },
    { appId, apiKey },
  );

  if (result.status === "not_configured") {
    return c.json({
      error: "The server-side OneSignal credentials are not configured.",
    }, 503);
  }
  if (
    result.status === "no_recipients" || result.providerRecipientCount === 0
  ) {
    return c.json({
      error: "No OneSignal browser subscription is linked to this account.",
    }, 404);
  }
  if (result.status !== "accepted") {
    return c.json(
      { error: "OneSignal did not accept the test notification." },
      502,
    );
  }

  const recipientCount = result.providerRecipientCount;
  return c.json({
    status: "accepted",
    accepted: true,
    message: recipientCount === null
      ? "OneSignal accepted the test request; the target count and device display are not confirmed."
      : `OneSignal accepted the test for ${recipientCount} subscribed device${
        recipientCount === 1 ? "" : "s"
      }; device display is not confirmed.`,
  });
}
