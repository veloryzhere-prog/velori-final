import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type NativeNotificationState = {
  permissionGranted: boolean;
  canRequestPermission: boolean;
  subscriptionId: string | null;
  optedIn: boolean;
  externalId: string | null;
};

type PermissionState = NativeNotificationState & { granted: boolean };
type RoutePayload = { route: string | null };

type NativeNotificationsPlugin = {
  getState(): Promise<NativeNotificationState>;
  requestPermission(): Promise<PermissionState>;
  openNotificationSettings(): Promise<void>;
  takePendingNotificationRoute(): Promise<RoutePayload>;
  login(options: { externalId: string; identityToken: string }): Promise<{ linked: boolean }>;
  logout(): Promise<{ linked: boolean }>;
  optIn(): Promise<NativeNotificationState>;
  optOut(): Promise<NativeNotificationState>;
  addListener(
    eventName: "permissionChanged" | "subscriptionChanged",
    listener: (state: NativeNotificationState) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "notificationClick",
    listener: (payload: RoutePayload) => void,
  ): Promise<PluginListenerHandle>;
};

export const nativeNotifications = registerPlugin<NativeNotificationsPlugin>("VeloriNotifications");

export function nativeAndroidNotificationsAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function isInternalNotificationRoute(value: string | null | undefined): value is string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return false;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && !url.username && !url.password;
  } catch {
    return false;
  }
}
