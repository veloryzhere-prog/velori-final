const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TARGETS_PER_REQUEST = 20_000;

export type OneSignalPushResult = {
  status: "accepted" | "partial" | "failed" | "not_configured" | "no_recipients";
  targetCount: number;
  providerRecipientCount: number | null;
  providerNotificationIds: string[];
  errorCode: string | null;
};

type PushInput = {
  externalIds: string[];
  title: string;
  message: string;
  route: string;
  campaignId: string;
  priority: string;
};

type PushOptions = {
  appId: string;
  apiKey: string;
  fetcher?: typeof fetch;
};

export function validOneSignalConfiguration(appId: string, apiKey: string) {
  const key = apiKey.trim().toLowerCase();
  return (
    UUID_PATTERN.test(appId) &&
    key.length >= 24 &&
    !["your_", "placeholder", "changeme", "replace_me"].some((value) => key.includes(value))
  );
}

export async function sendOneSignalPush(
  input: PushInput,
  options: PushOptions,
): Promise<OneSignalPushResult> {
  const externalIds = [...new Set(input.externalIds)].filter((id) => UUID_PATTERN.test(id));
  const baseResult = {
    targetCount: externalIds.length,
    providerRecipientCount: null,
    providerNotificationIds: [] as string[],
    errorCode: null as string | null,
  };
  if (!validOneSignalConfiguration(options.appId, options.apiKey)) {
    return { ...baseResult, status: "not_configured", errorCode: "provider_not_configured" };
  }
  if (externalIds.length === 0) return { ...baseResult, status: "no_recipients" };

  const fetcher = options.fetcher ?? fetch;
  let acceptedTargets = 0;
  let providerRecipientCount = 0;
  let recipientCountKnown = true;
  const providerNotificationIds: string[] = [];

  for (let offset = 0; offset < externalIds.length; offset += MAX_TARGETS_PER_REQUEST) {
    const batch = externalIds.slice(offset, offset + MAX_TARGETS_PER_REQUEST);
    let response: Response;
    try {
      response = await fetcher("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          authorization: `Key ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          app_id: options.appId,
          include_aliases: { external_id: batch },
          target_channel: "push",
          headings: { en: input.title },
          contents: { en: input.message },
          data: { route: input.route, campaignId: input.campaignId },
          android_channel_id: "general",
          priority: input.priority === "critical" ? 10 : 5,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return {
        ...baseResult,
        status: acceptedTargets > 0 ? "partial" : "failed",
        providerRecipientCount: recipientCountKnown ? providerRecipientCount : null,
        providerNotificationIds,
        errorCode: "provider_unreachable",
      };
    }

    if (!response.ok) {
      return {
        ...baseResult,
        status: acceptedTargets > 0 ? "partial" : "failed",
        providerRecipientCount: recipientCountKnown ? providerRecipientCount : null,
        providerNotificationIds,
        errorCode: `provider_http_${response.status}`,
      };
    }

    acceptedTargets += batch.length;
    const payload: unknown = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      recipientCountKnown = false;
      continue;
    }
    const providerId = Reflect.get(payload, "id");
    const recipients = Reflect.get(payload, "recipients");
    if (typeof providerId === "string" && providerId) providerNotificationIds.push(providerId);
    if (typeof recipients === "number" && Number.isFinite(recipients) && recipients >= 0) {
      providerRecipientCount += recipients;
    } else {
      recipientCountKnown = false;
    }
  }

  return {
    ...baseResult,
    status: "accepted",
    providerRecipientCount: recipientCountKnown ? providerRecipientCount : null,
    providerNotificationIds,
  };
}
