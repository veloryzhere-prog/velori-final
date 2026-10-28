import { SceneHeading } from "../components/SceneHeading";
import { PageWorkspace } from "../components/PageWorkspace";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Check, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../lib/auth";
import { friendlyError, supabase } from "../lib/supabase";
import {
  currentPushSubscription,
  disablePushForDevice,
  enablePushForDevice,
  pushSupport,
  deviceAlertsEnabled,
  deviceAlertsSupported,
  enableDeviceAlerts,
  setDeviceAlertsEnabled,
  showDeviceAlert,
} from "../lib/push-notifications";
import { EmptyState } from "./shell";

type Preferences = {
  profile_id: string;
  likes: boolean;
  comments: boolean;
  replies: boolean;
  follows: boolean;
  mentions: boolean;
  stories: boolean;
  reels: boolean;
  messages: boolean;
  groups: boolean;
  announcements: boolean;
  system: boolean;
  push_enabled: boolean;
  push_likes: boolean;
  push_comments: boolean;
  push_replies: boolean;
  push_follows: boolean;
  push_mentions: boolean;
  push_stories: boolean;
  push_reels: boolean;
  push_messages: boolean;
  push_groups: boolean;
  push_announcements: boolean;
  push_system: boolean;
};

const defaults: Omit<Preferences, "profile_id"> = {
  likes: true,
  comments: true,
  replies: true,
  follows: true,
  mentions: true,
  stories: true,
  reels: true,
  messages: true,
  groups: true,
  announcements: true,
  system: true,
  push_enabled: false,
  push_likes: true,
  push_comments: true,
  push_replies: true,
  push_follows: true,
  push_mentions: true,
  push_stories: true,
  push_reels: true,
  push_messages: true,
  push_groups: true,
  push_announcements: true,
  push_system: true,
};

const categories: {
  id: keyof typeof defaults;
  push: keyof typeof defaults;
  label: string;
  detail: string;
}[] = [
  {
    id: "likes",
    push: "push_likes",
    label: "Likes",
    detail: "When someone likes your post or comment.",
  },
  {
    id: "comments",
    push: "push_comments",
    label: "Comments",
    detail: "When someone comments on your content.",
  },
  {
    id: "replies",
    push: "push_replies",
    label: "Replies",
    detail: "When someone replies to your comment.",
  },
  {
    id: "follows",
    push: "push_follows",
    label: "Follows",
    detail: "New followers and follow requests.",
  },
  {
    id: "mentions",
    push: "push_mentions",
    label: "Mentions",
    detail: "When someone mentions or tags you.",
  },
  { id: "stories", push: "push_stories", label: "Stories", detail: "Story reactions and replies." },
  { id: "reels", push: "push_reels", label: "Reels", detail: "Likes and comments on your Reels." },
  { id: "messages", push: "push_messages", label: "Messages", detail: "New direct messages." },
  {
    id: "groups",
    push: "push_groups",
    label: "Groups",
    detail: "Group invitations, requests, and updates.",
  },
  {
    id: "announcements",
    push: "push_announcements",
    label: "Announcements",
    detail: "Platform announcements from VELORI.",
  },
  {
    id: "system",
    push: "push_system",
    label: "Security and system",
    detail: "Important account and service notices.",
  },
];

function messageForPushError(error: unknown) {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "unsupported") return "This browser does not support web push notifications.";
  if (reason === "permission-denied")
    return "Notifications are blocked in your browser. Change the site permission in your browser settings to enable them.";
  if (reason === "not-configured")
    return "Push delivery has not been configured for this VELORI deployment yet.";
  if (reason === "permission-dismissed")
    return "Allow notifications in the browser prompt to subscribe this device.";
  if (reason === "subscription-incomplete")
    return "The browser returned an incomplete push subscription. Try again.";
  if (reason === "unsubscribe-failed")
    return "The browser could not remove this device subscription. Try again.";
  return friendlyError(error as { code?: string; message?: string });
}

export function NotificationSettingsPage() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deviceAlerts, setDeviceAlerts] = useState(false);
  const support = pushSupport();

  const load = useCallback(async () => {
    if (!user) {
      setPreferences(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [{ data, error: queryError }, subscription] = await Promise.all([
      supabase.from("notification_preferences").select("*").eq("profile_id", user.id).maybeSingle(),
      currentPushSubscription().catch(() => null),
    ]);
    if (queryError) setError(friendlyError(queryError));
    else setPreferences({ ...defaults, ...(data ?? {}), profile_id: user.id } as Preferences);
    setDeviceSubscribed(Boolean(subscription));
    setDeviceAlerts(deviceAlertsEnabled(user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(values: Partial<Preferences>, busyKey: string) {
    if (!user || !preferences) return;
    setBusy(busyKey);
    setError("");
    setNotice("");
    const next = { ...preferences, ...values, profile_id: user.id };
    const { error: saveError } = await supabase
      .from("notification_preferences")
      .upsert(next, { onConflict: "profile_id" });
    if (saveError) setError(friendlyError(saveError));
    else {
      setPreferences(next);
      setNotice("Notification preferences saved.");
    }
    setBusy("");
  }

  async function toggleDevice() {
    if (!user) return;
    setBusy("device");
    setError("");
    setNotice("");
    try {
      if (deviceSubscribed) await disablePushForDevice(user.id);
      else await enablePushForDevice(user.id);
      setDeviceSubscribed(!deviceSubscribed);
      setNotice(
        deviceSubscribed
          ? "Push notifications are off for this device."
          : "This device is subscribed to push notifications.",
      );
    } catch (cause) {
      setError(messageForPushError(cause));
    }
    setBusy("");
  }

  async function toggleAlerts() {
    if (!user) return;
    setBusy("alerts");
    setError("");
    setNotice("");
    try {
      if (deviceAlerts) setDeviceAlertsEnabled(user.id, false);
      else await enableDeviceAlerts(user.id);
      setDeviceAlerts(!deviceAlerts);
      setNotice(
        deviceAlerts
          ? "Device message alerts turned off."
          : "Device message alerts enabled. Keep VELORI open in a tab to receive them.",
      );
    } catch (cause) {
      setError(messageForPushError(cause));
    } finally {
      setBusy("");
    }
  }

  async function testAlert() {
    setBusy("test");
    setError("");
    setNotice("");
    try {
      await showDeviceAlert(
        "VELORI notifications are ready",
        "This is your test notification. Tap to open your inbox.",
      );
      setNotice(
        "Test alert sent to your device notification system. Check your browser and device notification settings if it is hidden.",
      );
    } catch (cause) {
      setError(messageForPushError(cause));
    } finally {
      setBusy("");
    }
  }

  const heading = (
    <SceneHeading
      eyebrow="YOUR SETTINGS"
      title="Notifications"
      subtitle="Choose the updates you want to keep close."
    />
  );
  if (!user)
    return (
      <PageWorkspace area="settings" className="">
        {heading}
        <EmptyState
          icon={Bell}
          title="Sign in to manage notifications"
          text="Your notification preferences are private to your account."
          action="Sign in"
          to="/login"
        />
      </PageWorkspace>
    );

  return (
    <PageWorkspace area="settings" className="notification-settings-page">
      {heading}
      {error && (
        <div className="inline-feedback is-error" role="alert">
          <p>{error}</p>
          <button className="button button-outline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      {notice && (
        <p className="inline-feedback is-success" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <div className="skeleton-stack" aria-label="Loading notification preferences">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : preferences ? (
        <>
          <section
            className="settings-section push-device-card"
            aria-labelledby="message-alert-heading"
          >
            <div className="settings-icon">
              <Bell size={21} />
            </div>
            <div className="settings-body">
              <h2 id="message-alert-heading">Message alerts on this device</h2>
              <p>
                Receive a system notification when a new message arrives while VELORI is open in a
                background tab. Message text and sender names stay hidden. Muted conversations stay
                quiet.
              </p>
              <div className="setting-row">
                <div>
                  <strong>{deviceAlerts ? "Device alerts are on" : "Device alerts are off"}</strong>
                  <small>
                    {!deviceAlertsSupported()
                      ? "Use a browser with notification support over HTTPS. On iPhone or iPad, add VELORI to your Home Screen first."
                      : "Notification" in window && Notification.permission === "denied"
                        ? "Notifications are blocked. Allow them in your browser's site settings."
                        : "Keep a VELORI tab open. Delivery after closing the app requires background push setup below."}
                  </small>
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  aria-pressed={deviceAlerts}
                  disabled={
                    busy !== "" ||
                    !deviceAlertsSupported() ||
                    (!deviceAlerts &&
                      "Notification" in window &&
                      Notification.permission === "denied")
                  }
                  onClick={() => void toggleAlerts()}
                >
                  {busy === "alerts"
                    ? "Saving…"
                    : deviceAlerts
                      ? "Turn off"
                      : "Enable message alerts"}
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Check device delivery</strong>
                  <small>
                    A test alert confirms this browser can display a notification. Device focus
                    modes may silence it.
                  </small>
                </div>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => void testAlert()}
                  disabled={
                    busy !== "" ||
                    !deviceAlerts ||
                    !("Notification" in window) ||
                    Notification.permission !== "granted"
                  }
                >
                  {busy === "test" ? "Sending…" : "Send test alert"}
                </button>
              </div>
              <Link to="/messages">Open your inbox →</Link>
            </div>
          </section>
          <section
            className="settings-section push-device-card"
            aria-labelledby="push-device-heading"
          >
            <div className="settings-icon">
              <Bell size={21} />
            </div>
            <div className="settings-body">
              <h2 id="push-device-heading">Background push</h2>
              <p>
                Subscriptions for delivery after closing VELORI. A configured server sender is
                required; subscribing alone does not verify delivery. VELORI asks for permission
                only when you enable it.
              </p>
              <div className="setting-row">
                <div>
                  <strong>
                    {deviceSubscribed
                      ? "This device is subscribed"
                      : "This device is not subscribed"}
                  </strong>
                  <small>
                    {support === "permission-denied"
                      ? "Notifications are blocked by your browser."
                      : support === "unsupported"
                        ? "This browser does not support web push."
                        : support === "not-configured"
                          ? "Web push server keys are not configured for this deployment."
                          : "Permission: " +
                            ("Notification" in window ? Notification.permission : "unsupported")}
                  </small>
                </div>
                <button
                  type="button"
                  className={deviceSubscribed ? "button button-outline" : "button button-primary"}
                  onClick={() => void toggleDevice()}
                  disabled={
                    busy !== "" ||
                    loading ||
                    support === "unsupported" ||
                    support === "not-configured" ||
                    support === "permission-denied"
                  }
                >
                  {busy === "device"
                    ? "Saving…"
                    : deviceSubscribed
                      ? "Turn off on this device"
                      : "Enable on this device"}
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Push delivery</strong>
                  <small>
                    Master switch for push notifications across your subscribed devices.
                  </small>
                </div>
                <button
                  type="button"
                  className="button button-outline"
                  aria-pressed={preferences.push_enabled}
                  onClick={() =>
                    void save({ push_enabled: !preferences.push_enabled }, "push-enabled")
                  }
                  disabled={
                    busy !== "" || loading || (!preferences.push_enabled && support !== "ready")
                  }
                >
                  {preferences.push_enabled ? (
                    <>
                      <Check size={15} /> On
                    </>
                  ) : (
                    <>
                      <BellOff size={15} /> Off
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          <section
            className="settings-section notification-preference-card"
            aria-labelledby="categories-heading"
          >
            <div className="settings-icon cyan-icon">
              <ShieldCheck size={21} />
            </div>
            <div className="settings-body">
              <h2 id="categories-heading">Activity categories</h2>
              <p>
                Choose which activities appear in your notification timeline and which can use push.
              </p>
              <div className="notification-preference-list">
                <div className="notification-preference-head">
                  <span>Activity</span>
                  <span>In-app</span>
                  <span>Push</span>
                </div>
                {categories.map((category) => (
                  <div className="notification-preference-row" key={category.id}>
                    <div>
                      <strong>{category.label}</strong>
                      <small>{category.detail}</small>
                    </div>
                    <label>
                      <span className="sr-only">In-app notifications for {category.label}</span>
                      <input
                        type="checkbox"
                        checked={preferences[category.id]}
                        onChange={(event) =>
                          void save({ [category.id]: event.target.checked }, category.id)
                        }
                        disabled={busy !== "" || loading}
                      />
                    </label>
                    <label>
                      <span className="sr-only">Push notifications for {category.label}</span>
                      <input
                        type="checkbox"
                        checked={preferences[category.push]}
                        onChange={(event) =>
                          void save({ [category.push]: event.target.checked }, category.push)
                        }
                        disabled={busy !== "" || loading || !preferences.push_enabled}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </PageWorkspace>
  );
}
