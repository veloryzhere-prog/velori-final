import { readJson, readString, isUuid, service, type Ctx } from "./admin-core.ts";
import { sendOneSignalPush, validOneSignalConfiguration } from "./onesignal-delivery.ts";
import {
  loadWebPushSubscriptions,
  sendWebPushToSubscriptions,
  type WebPushDispatchResult,
} from "./web-push-notifications.ts";
import { validWebPushConfiguration, type WebPushSubscription } from "./web-push.ts";

export async function handleOneSignalChatNotification(c: Ctx) {
  const accessToken = c.req.header("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!accessToken) return c.json({ error: "Sign in to notify conversation participants." }, 401);

  const { data: authData, error: authError } = await service().auth.getUser(accessToken);
  if (authError || !authData.user?.id) {
    return c.json({ error: "The sign-in session is invalid or expired." }, 401);
  }

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const messageId = readString(body.value, "message_id", 37);
  if (!messageId || !isUuid(messageId)) {
    return c.json({ error: "A valid message id is required." }, 400);
  }

  const appId = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
  const oneSignalConfigured = validOneSignalConfiguration(appId, apiKey);
  const webPushOptions = {
    publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
    privateKey: (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").replaceAll("\\n", "\n"),
    subject: Deno.env.get("VAPID_SUBJECT") ?? "",
  };
  const webPushConfigured = validWebPushConfiguration(webPushOptions);
  if (!oneSignalConfigured && !webPushConfigured) {
    return c.json({ error: "OneSignal push delivery is not configured." }, 503);
  }

  const db = service();
  const { data: message, error: messageError } = await db
    .from("messages")
    .select("id,conversation_id,sender_id")
    .eq("id", messageId)
    .maybeSingle();
  if (messageError) return c.json({ error: "The message could not be checked." }, 500);
  if (!message || message.sender_id !== authData.user.id) {
    return c.json({ error: "That message is not available to this account." }, 404);
  }

  const { data: participants, error: participantError } = await db
    .from("conversation_participants")
    .select("user_id,muted_until")
    .eq("conversation_id", message.conversation_id)
    .neq("user_id", authData.user.id);
  if (participantError)
    return c.json({ error: "Conversation recipients could not be checked." }, 500);

  const now = Date.now();
  const recipientIds = (participants ?? [])
    .filter((participant) => {
      if (typeof participant.user_id !== "string") return false;
      if (!participant.muted_until) return true;
      const mutedUntil = Date.parse(participant.muted_until);
      return !Number.isFinite(mutedUntil) || mutedUntil <= now;
    })
    .map((participant) => participant.user_id);
  if (recipientIds.length === 0) {
    return c.json({ status: "no_recipients", targetCount: 0 });
  }

  const { data: preferences, error: preferenceError } = await db
    .from("notification_preferences")
    .select("profile_id")
    .in("profile_id", recipientIds)
    .eq("push_enabled", true)
    .eq("push_messages", true);
  if (preferenceError) return c.json({ error: "Recipient preferences could not be checked." }, 500);
  const eligibleIds = (preferences ?? [])
    .map((preference) => preference.profile_id)
    .filter((id): id is string => typeof id === "string" && isUuid(id));
  if (eligibleIds.length === 0) {
    return c.json({ status: "no_recipients", targetCount: 0 });
  }

  const { data: claimed, error: claimError } = await db
    .from("notification_push_deliveries")
    .upsert(
      eligibleIds.map((recipientId) => ({
        event_type: "chat",
        event_id: message.id,
        recipient_id: recipientId,
        status: "pending",
        attempts: 1,
      })),
      { onConflict: "event_type,event_id,recipient_id", ignoreDuplicates: true },
    )
    .select("recipient_id");
  if (claimError) return c.json({ error: "The push delivery could not be queued." }, 500);

  const claimedIds = (claimed ?? [])
    .map((row) => row.recipient_id)
    .filter((id): id is string => typeof id === "string");
  if (claimedIds.length === 0) {
    return c.json({ status: "already_processed", targetCount: eligibleIds.length });
  }

  const route = `/messages?conversation=${encodeURIComponent(message.conversation_id)}&message=${encodeURIComponent(message.id)}`;
  const oneSignalResult = oneSignalConfigured
    ? await sendOneSignalPush(
        {
          externalIds: claimedIds,
          title: "New message",
          message: "You have a new message in VELORI.",
          route,
          campaignId: message.id,
          priority: "normal",
        },
        { appId, apiKey },
      )
    : {
        status: "not_configured" as const,
        targetCount: 0,
        providerRecipientCount: null,
        providerNotificationIds: [],
        errorCode: "onesignal_not_configured",
      };
  const webSubscriptions = webPushConfigured
    ? await loadWebPushSubscriptions(db, claimedIds)
    : { subscriptions: [] as WebPushSubscription[] };
  let webPushResult: WebPushDispatchResult =
    "error" in webSubscriptions
      ? {
          status: "failed" as const,
          targetCount: 0,
          acceptedCount: 0,
          expiredCount: 0,
          failedCount: 0,
          expiredSubscriptionIds: [],
          errorCode: webSubscriptions.error,
        }
      : await sendWebPushToSubscriptions(webSubscriptions.subscriptions, {
          title: "New message",
          body: "You have a new message in VELORI.",
          url: route,
          tag: `velori-message-${message.id}`,
        });
  if (webPushResult.expiredSubscriptionIds.length > 0) {
    const { error: expiredCleanupError } = await db
      .from("push_subscriptions")
      .delete()
      .in("id", webPushResult.expiredSubscriptionIds);
    if (expiredCleanupError) {
      webPushResult = {
        ...webPushResult,
        status: webPushResult.acceptedCount > 0 ? "partial" : "failed",
        failedCount: webPushResult.failedCount + webPushResult.expiredSubscriptionIds.length,
        errorCode: "expired_subscription_cleanup_failed",
      };
    }
  }
  const accepted = oneSignalResult.status === "accepted" || webPushResult.acceptedCount > 0;
  const failed =
    oneSignalResult.status === "failed" ||
    oneSignalResult.status === "partial" ||
    webPushResult.status === "failed" ||
    webPushResult.status === "partial";
  const targetCount = oneSignalResult.targetCount + webPushResult.targetCount;
  const status = failed
    ? accepted
      ? "partial"
      : "failed"
    : targetCount === 0
      ? "failed"
      : "accepted";
  const result = {
    status,
    targetCount,
    providerRecipientCount:
      oneSignalResult.status === "accepted" && oneSignalResult.providerRecipientCount === null
        ? null
        : (oneSignalResult.providerRecipientCount ?? 0) + webPushResult.acceptedCount,
    providerNotificationIds: oneSignalResult.providerNotificationIds,
    errorCode: failed
      ? (webPushResult.errorCode ?? oneSignalResult.errorCode)
      : targetCount === 0
        ? "no_push_endpoints"
        : null,
  };
  const { error: saveError } = await db
    .from("notification_push_deliveries")
    .update({
      status: result.status,
      provider_notification_ids: result.providerNotificationIds,
      provider_recipient_count: result.providerRecipientCount,
      error_code: result.errorCode,
      updated_at: new Date().toISOString(),
    })
    .eq("event_type", "chat")
    .eq("event_id", message.id)
    .in("recipient_id", claimedIds);
  if (saveError) {
    console.error("Chat push outcome could not be saved.");
    return c.json(
      { error: "The message remains sent, but its push result could not be recorded." },
      500,
    );
  }

  return c.json({
    status: result.status,
    targetCount: result.targetCount,
    providerRecipientCount: result.providerRecipientCount,
    errorCode: result.errorCode,
    webPush: webPushConfigured
      ? {
          status: webPushResult.status,
          targetCount: webPushResult.targetCount,
          acceptedCount: webPushResult.acceptedCount,
        }
      : null,
  });
}
