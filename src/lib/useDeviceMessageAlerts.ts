import { useEffect, useReducer } from "react";
import { supabase } from "./supabase";
import { messageAlertTarget } from "./device-alert-policy.mjs";
import { deviceAlertsEnabled, showDeviceAlert, DEVICE_ALERTS_CHANGED } from "./push-notifications";

/** Foreground-page realtime delivery. Background push is a separate server capability. */
export function useDeviceMessageAlerts(userId: string | undefined, enabled: boolean) {
  const [preferenceVersion, refreshPreference] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === `velori.device-alerts.${userId}`) refreshPreference();
    };
    window.addEventListener(DEVICE_ALERTS_CHANGED, refreshPreference);
    window.addEventListener("storage", storageChanged);
    return () => {
      window.removeEventListener(DEVICE_ALERTS_CHANGED, refreshPreference);
      window.removeEventListener("storage", storageChanged);
    };
  }, [userId]);
  useEffect(() => {
    if (
      !userId ||
      !enabled ||
      !deviceAlertsEnabled(userId) ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    let active = true;
    const seen = new Set<string>();
    const inFlight = new Set<string>();
    async function receive(item: Record<string, unknown>) {
      if (
        !active ||
        !deviceAlertsEnabled(userId!) ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      )
        return;
      const id = typeof item.id === "string" ? item.id : "";
      const target = messageAlertTarget(item, userId!, window.location.href);
      if (!id || !target || seen.has(id) || inFlight.has(id)) return;
      // A visible VELORI tab already displays an in-app unread indicator.
      if (document.visibilityState === "visible") return;
      inFlight.add(id);
      try {
        if (!target.conversation) {
          if (item.entity_type !== "message" || typeof item.entity_id !== "string") return;
          const { data: message, error } = await supabase
            .from("messages")
            .select("conversation_id,deleted_at")
            .eq("id", item.entity_id)
            .maybeSingle();
          if (error || !message || message.deleted_at || !active) return;
          target.conversation = message.conversation_id;
          target.url = `/messages?conversation=${encodeURIComponent(message.conversation_id)}`;
        }
        const [
          { data: preferences, error },
          { data: participant, error: participantError },
          { data: currentNotification, error: notificationError },
        ] = await Promise.all([
          supabase
            .from("notification_preferences")
            .select("messages,push_messages")
            .eq("profile_id", userId!)
            .maybeSingle(),
          supabase
            .from("conversation_participants")
            .select("muted_until,notifications_enabled")
            .eq("user_id", userId!)
            .eq("conversation_id", target.conversation!)
            .maybeSingle(),
          supabase
            .from("notifications")
            .select("read_at")
            .eq("id", id)
            .eq("recipient_id", userId!)
            .maybeSingle(),
        ]);
        if (
          !active ||
          error ||
          participantError ||
          notificationError ||
          !currentNotification ||
          currentNotification.read_at ||
          !participant ||
          participant.notifications_enabled === false ||
          preferences?.messages === false ||
          preferences?.push_messages === false ||
          (participant.muted_until && Date.parse(participant.muted_until) > Date.now())
        )
          return;
        const deliver = async () => {
          if (!active || !deviceAlertsEnabled(userId!) || document.visibilityState === "visible")
            return;
          const key = `velori.alert.last.${userId}`;
          try {
            if (localStorage.getItem(key) === id) return;
          } catch {
            /* Tag still coalesces duplicate alerts. */
          }
          await showDeviceAlert(
            "New message on VELORI",
            "Open your inbox to read it.",
            target.url,
            `velori-message-${id}`,
          );
          try {
            localStorage.setItem(key, id);
          } catch {
            /* Optional duplicate protection. */
          }
          seen.add(id);
          if (seen.size > 100) seen.delete(seen.values().next().value!);
        };
        if (navigator.locks)
          await navigator.locks.request(`velori-device-alert-${userId}`, deliver);
        else await deliver();
      } catch {
        /* Browser revocation must not interrupt messaging. */
      } finally {
        inFlight.delete(id);
      }
    }
    const channel = supabase
      .channel(`device-message-alerts:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (event) => void receive(event.new),
      )
      .subscribe();
    const stopNotifications = () => {
      void navigator.serviceWorker
        ?.getRegistration(import.meta.env.BASE_URL)
        .then((registration) => registration?.getNotifications())
        .then((items) =>
          items
            ?.filter((item) => item.tag.startsWith("velori-message-"))
            .forEach((item) => item.close()),
        )
        .catch(() => {});
    };
    return () => {
      active = false;
      void supabase.removeChannel(channel);
      stopNotifications();
    };
  }, [userId, enabled, preferenceVersion]);
}
