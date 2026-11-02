import { readJson, readString, service, type Ctx } from "./admin-core.ts";
import {
  createWebPushSender,
  validWebPushConfiguration,
  type WebPushSubscription,
} from "./web-push.ts";

function webPushOptions() {
  return {
    publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
    privateKey: (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").replaceAll("\\n", "\n"),
    subject: Deno.env.get("VAPID_SUBJECT") ?? "",
  };
}

export type WebPushDispatchResult = {
  status: "not_configured" | "no_recipients" | "accepted" | "partial" | "failed";
  targetCount: number;
  acceptedCount: number;
  expiredCount: number;
  failedCount: number;
  expiredSubscriptionIds: string[];
  errorCode: string | null;
};

export async function sendWebPushToSubscriptions(
  subscriptions: WebPushSubscription[],
  payload: { title: string; body: string; url: string; tag: string },
): Promise<WebPushDispatchResult> {
  const options = webPushOptions();
  if (!validWebPushConfiguration(options)) {
    return {
      status: "not_configured" as const,
      targetCount: 0,
      acceptedCount: 0,
      expiredCount: 0,
      failedCount: 0,
      expiredSubscriptionIds: [] as string[],
      errorCode: "web_push_not_configured",
    };
  }
  if (subscriptions.length === 0) {
    return {
      status: "no_recipients" as const,
      targetCount: 0,
      acceptedCount: 0,
      expiredCount: 0,
      failedCount: 0,
      expiredSubscriptionIds: [] as string[],
      errorCode: null,
    };
  }

  const sender = await createWebPushSender(options);
  let acceptedCount = 0;
  let expiredCount = 0;
  let failedCount = 0;
  const expiredSubscriptionIds: string[] = [];
  for (let offset = 0; offset < subscriptions.length; offset += 16) {
    const batch = subscriptions.slice(offset, offset + 16);
    const outcomes = await Promise.all(batch.map((subscription) => sender(subscription, payload)));
    for (const [index, outcome] of outcomes.entries()) {
      if (outcome.status === "accepted") acceptedCount += 1;
      else if (outcome.status === "expired") {
        expiredCount += 1;
        const id = batch[index]?.id;
        if (typeof id === "string") expiredSubscriptionIds.push(id);
      } else failedCount += 1;
    }
  }

  const targetCount = subscriptions.length;
  const remainingFailures = expiredCount + failedCount;
  return {
    status: remainingFailures === 0 ? "accepted" : acceptedCount > 0 ? "partial" : "failed",
    targetCount,
    acceptedCount,
    expiredCount,
    failedCount,
    expiredSubscriptionIds,
    errorCode:
      remainingFailures === 0
        ? null
        : failedCount > 0
          ? "web_push_delivery_failed"
          : "web_push_subscriptions_expired",
  };
}

export async function loadWebPushSubscriptions(
  db: ReturnType<typeof service>,
  profileIds: string[],
): Promise<{ subscriptions: WebPushSubscription[] } | { error: string }> {
  const subscriptions: WebPushSubscription[] = [];
  for (let offset = 0; offset < profileIds.length; offset += 500) {
    const profileBatch = profileIds.slice(offset, offset + 500);
    for (let page = 0; ; page += 1) {
      const { data, error } = await db
        .from("push_subscriptions")
        .select("id,profile_id,endpoint,p256dh,auth")
        .in("profile_id", profileBatch)
        .order("id", { ascending: true })
        .range(page * 1000, page * 1000 + 999);
      if (error) return { error: "web_push_subscription_lookup_failed" };
      for (const row of data ?? []) {
        if (
          typeof row.id === "string" &&
          typeof row.profile_id === "string" &&
          typeof row.endpoint === "string" &&
          typeof row.p256dh === "string" &&
          typeof row.auth === "string"
        ) {
          subscriptions.push({
            id: row.id,
            profile_id: row.profile_id,
            endpoint: row.endpoint,
            p256dh: row.p256dh,
            auth: row.auth,
          });
        }
      }
      if ((data ?? []).length < 1000) break;
    }
  }
  return { subscriptions };
}

export async function handleWebPushTest(c: Ctx) {
  const accessToken = c.req.header("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!accessToken) return c.json({ error: "Sign in to test web push delivery." }, 401);

  const { data: authData, error: authError } = await service().auth.getUser(accessToken);
  if (authError || !authData.user?.id) {
    return c.json({ error: "The sign-in session is invalid or expired." }, 401);
  }

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const endpoint = readString(body.value, "endpoint", 2049);
  if (!endpoint || endpoint.length > 2048) {
    return c.json({ error: "The browser push subscription is invalid." }, 400);
  }

  const db = service();
  const { data: preference, error: preferenceError } = await db
    .from("notification_preferences")
    .select("push_enabled,push_system")
    .eq("profile_id", authData.user.id)
    .maybeSingle();
  if (preferenceError)
    return c.json({ error: "Notification preferences could not be checked." }, 500);
  if (!preference?.push_enabled || preference.push_system === false) {
    return c.json({ error: "Enable system push notifications before sending a test." }, 409);
  }

  const { data: subscription, error: subscriptionError } = await db
    .from("push_subscriptions")
    .select("id,profile_id,endpoint,p256dh,auth")
    .eq("profile_id", authData.user.id)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (subscriptionError)
    return c.json({ error: "The browser subscription could not be checked." }, 500);
  if (!subscription) return c.json({ error: "This browser is not subscribed to web push." }, 404);

  const result = await sendWebPushToSubscriptions([subscription], {
    title: "VELORI push test",
    body: "This test was sent by VELORI’s notification server.",
    url: "/settings/notifications",
    tag: "velori-web-push-test",
  });
  if (result.status === "not_configured") {
    return c.json({ error: "The server-side Web Push keys are not configured." }, 503);
  }
  if (result.status !== "accepted") {
    if (result.expiredCount > 0) {
      const { error: deleteError } = await db
        .from("push_subscriptions")
        .delete()
        .eq("id", subscription.id);
      if (deleteError) {
        return c.json({ error: "The expired browser subscription could not be removed." }, 500);
      }
    }
    return c.json(
      {
        status: result.status,
        accepted: false,
        expired: result.expiredCount > 0,
        error: "The push service did not accept the test notification.",
      },
      502,
    );
  }

  return c.json({
    status: "accepted",
    accepted: true,
    message: "The push service accepted the request; device display is not confirmed.",
  });
}
