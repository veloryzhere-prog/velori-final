import { supabase } from "./supabase";

export type PushSupport = "unsupported" | "permission-denied" | "not-configured" | "ready";

const vapidPublicKey = String(import.meta.env["VITE_VAPID_PUBLIC_KEY"] ?? "").trim();
export const DEVICE_ALERTS_CHANGED = "velori:device-alerts-changed";

export function deviceAlertsSupported() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}
export function deviceAlertsEnabled(userId: string) {
  try {
    return localStorage.getItem(`velori.device-alerts.${userId}`) === "on";
  } catch {
    return false;
  }
}
export function setDeviceAlertsEnabled(userId: string, value: boolean) {
  localStorage.setItem(`velori.device-alerts.${userId}`, value ? "on" : "off");
  window.dispatchEvent(new Event(DEVICE_ALERTS_CHANGED));
}
export async function enableDeviceAlerts(userId: string) {
  if (!deviceAlertsSupported()) throw new Error("unsupported");
  // Call permission directly from the user's click, before any asynchronous work.
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(permission === "denied" ? "permission-denied" : "permission-dismissed");
  await notificationWorker();
  setDeviceAlertsEnabled(userId, true);
}
async function notificationWorker() {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const registration = await navigator.serviceWorker.register(new URL("service-worker.js", base), {
    scope: base.href,
  });
  let timer: number | undefined;
  try {
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("worker-unavailable")), 10000);
      }),
    ]);
    return registration.active ? registration : ready;
  } finally {
    window.clearTimeout(timer);
  }
}
export async function showDeviceAlert(
  title: string,
  body: string,
  url = "/messages",
  tag = "velori-device-test",
) {
  if (!deviceAlertsSupported() || Notification.permission !== "granted")
    throw new Error("permission-denied");
  const registration = await notificationWorker();
  await registration.showNotification(title, {
    body,
    tag,
    icon: new URL("pwa-192x192.png", registration.scope).href,
    data: { url },
  });
}

export function pushSupport(): PushSupport {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    return "unsupported";
  if (Notification.permission === "denied") return "permission-denied";
  if (!vapidPublicKey) return "not-configured";
  return "ready";
}

function decodeVapidKey(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function currentPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  return registration?.pushManager.getSubscription() ?? null;
}

export async function enablePushForDevice(profileId: string) {
  const support = pushSupport();
  if (support !== "ready") throw new Error(support);

  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(permission === "denied" ? "permission-denied" : "permission-dismissed");

  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  const registration = await navigator.serviceWorker.register(
    new URL("service-worker.js", baseUrl),
    {
      scope: baseUrl.href,
    },
  );
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(vapidPublicKey),
    }));
  const json = subscription.toJSON();
  const endpoint = subscription.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) throw new Error("subscription-incomplete");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: profileId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 300),
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,endpoint" },
  );
  if (error) {
    await subscription.unsubscribe().catch(() => false);
    throw error;
  }
  return subscription;
}

export async function disablePushForDevice(profileId: string) {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("profile_id", profileId)
    .eq("endpoint", subscription.endpoint);
  if (error) throw error;
  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed) throw new Error("unsubscribe-failed");
}
