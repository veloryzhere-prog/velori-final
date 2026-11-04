import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";
import { supabasePublishableKey, supabaseUrl } from "../../utils/supabase/info";

type OneSignalPushSubscription = {
  readonly optedIn: boolean;
  optIn(): Promise<void>;
  optOut(): Promise<void>;
};

type OneSignalWebClient = {
  login(externalId: string, identityToken?: string): Promise<void>;
  logout(): Promise<void>;
  Notifications: {
    requestPermission(fallbackToSettings?: boolean): Promise<void>;
  };
  User: {
    PushSubscription: OneSignalPushSubscription;
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: {
      push(callback: (client: OneSignalWebClient) => void): unknown;
    };
  }
}

let operationQueue: Promise<void> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>) {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function getOneSignalClient() {
  if (typeof window === "undefined" || !window.OneSignalDeferred?.push) {
    return Promise.reject(new Error("onesignal-unavailable"));
  }
  return new Promise<OneSignalWebClient>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("onesignal-unavailable")), 10000);
    window.OneSignalDeferred?.push((client) => {
      window.clearTimeout(timeout);
      resolve(client);
    });
  });
}

export function oneSignalWebPushSupport() {
  if (
    typeof window === "undefined" ||
    Capacitor.isNativePlatform() ||
    !window.isSecureContext ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported" as const;
  }
  if (window.location.origin !== "https://chat.veloryz.online") {
    return "origin-not-configured" as const;
  }
  if (Notification.permission === "denied") return "permission-denied" as const;
  return "ready" as const;
}

export async function oneSignalWebPushEnabled() {
  const support = oneSignalWebPushSupport();
  if (support !== "ready") return false;
  const client = await getOneSignalClient();
  return client.User.PushSubscription.optedIn;
}

async function oneSignalIdentityToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("session-expired");

  const response = await fetch(
    `${supabaseUrl}/functions/v1/server/notifications/onesignal/identity-token`,
    {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) {
    if (response.status === 503) throw new Error("onesignal-not-configured");
    if (response.status === 401) throw new Error("session-expired");
    throw new Error("onesignal-identity-failed");
  }
  const payload: unknown = await response.json().catch(() => null);
  const token = payload && typeof payload === "object" ? Reflect.get(payload, "token") : null;
  if (typeof token !== "string" || !token) {
    throw new Error("onesignal-identity-failed");
  }
  return token;
}

async function linkOneSignalUser(client: OneSignalWebClient, profileId: string) {
  const identityToken = await oneSignalIdentityToken();
  await client.login(profileId, identityToken);
}

export function syncOneSignalWebUser(profileId: string | null, isCurrent = () => true) {
  return serialize(async () => {
    const support = oneSignalWebPushSupport();
    if (support === "unsupported" || support === "origin-not-configured") return;
    const client = await getOneSignalClient();
    await client.logout();
    if (!profileId || !isCurrent() || support !== "ready" || !client.User.PushSubscription.optedIn)
      return;
    await linkOneSignalUser(client, profileId);
  });
}

export function enableOneSignalWebPush(profileId: string) {
  return serialize(async () => {
    const support = oneSignalWebPushSupport();
    if (support !== "ready") throw new Error(support);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error(permission === "denied" ? "permission-denied" : "permission-dismissed");
    }
    const client = await getOneSignalClient();
    await client.logout();
    await linkOneSignalUser(client, profileId);
    await client.Notifications.requestPermission();
    await client.User.PushSubscription.optIn();
    if (!client.User.PushSubscription.optedIn) throw new Error("onesignal-subscription-failed");
  });
}

export function disableOneSignalWebPush() {
  return serialize(async () => {
    const client = await getOneSignalClient();
    await client.User.PushSubscription.optOut();
    if (client.User.PushSubscription.optedIn) throw new Error("onesignal-subscription-failed");
  });
}

export function sendOneSignalTestForDevice(profileId: string) {
  return serialize(async () => {
    const client = await getOneSignalClient();
    if (!client.User.PushSubscription.optedIn) throw new Error("not-subscribed");
    await linkOneSignalUser(client, profileId);

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("session-expired");

    const response = await fetch(
      `${supabaseUrl}/functions/v1/server/notifications/onesignal/test`,
      {
        method: "POST",
        headers: {
          apikey: supabasePublishableKey,
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(10000),
      },
    );
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 503) throw new Error("onesignal-not-configured");
      if (response.status === 401) throw new Error("session-expired");
      if (response.status === 404) throw new Error("not-subscribed");
      if (response.status === 409) throw new Error("push-disabled");
      throw new Error("onesignal-test-failed");
    }
    const message = result && typeof result === "object" ? Reflect.get(result, "message") : null;
    return typeof message === "string"
      ? message
      : "OneSignal accepted the test request; device display is not confirmed.";
  });
}
