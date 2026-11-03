import { Bell, BellRing, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button, Dialog } from "../components/ui";
import { supabase } from "./supabase";
import { supabasePublishableKey, supabaseUrl } from "../../utils/supabase/info";
import { useAuth } from "./auth";
import {
  isInternalNotificationRoute,
  nativeAndroidNotificationsAvailable,
  nativeNotifications,
  type NativeNotificationState,
} from "./native-notifications";
import {
  enableOneSignalWebPush,
  oneSignalWebPushEnabled,
  oneSignalWebPushSupport,
} from "./onesignal-web";
import "./native-notification-experience.css";

const DISMISSED_KEY = "velori.notification-intro-dismissed.v2";

function readDismissedUser() {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function rememberDismissal(profileId: string) {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, profileId);
  } catch {
    // Keep dismissal in memory when session storage is unavailable.
  }
}

async function setPushPreference(profileId: string, enabled: boolean) {
  const { data: existing, error: readError } = await supabase
    .from("notification_preferences")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (readError) throw readError;

  const { error } = existing
    ? await supabase
        .from("notification_preferences")
        .update({ push_enabled: enabled })
        .eq("profile_id", profileId)
    : await supabase
        .from("notification_preferences")
        .insert({ profile_id: profileId, push_enabled: enabled });
  if (error) throw error;
}

async function identityToken() {
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
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(response.status === 503 ? "not-configured" : "identity-failed");
  const payload = (await response.json()) as { token?: unknown };
  if (typeof payload.token !== "string" || payload.token.length === 0) {
    throw new Error("identity-failed");
  }
  return payload.token;
}

function messageForIdentityError(error: unknown) {
  if (error instanceof Error && error.message === "not-configured") {
    return "Secure push account linking is waiting for server-side OneSignal identity keys.";
  }
  return "Push notifications could not sync with this account. Open notification settings to retry.";
}

export function NativeNotificationExperience({ enabled = true }: { enabled?: boolean }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<NativeNotificationState | null>(null);
  const [dismissedUserId, setDismissedUserId] = useState(readDismissedUser);
  const [webPushEnabled, setWebPushEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [identitySyncAttempt, setIdentitySyncAttempt] = useState(0);
  const currentUserId = useRef<string | null>(null);
  const syncQueue = useRef(Promise.resolve());
  const pendingNotificationRoute = useRef<string | null>(null);
  const native = nativeAndroidNotificationsAvailable();
  const profileId = user?.id ?? null;
  const webPushSupport = oneSignalWebPushSupport();

  useEffect(() => {
    if (loading) return;
    if (profileId) {
      setDismissedUserId(readDismissedUser());
      return;
    }
    try {
      window.sessionStorage.removeItem(DISMISSED_KEY);
    } catch {
      // The signed-out state still resets the in-memory dismissal.
    }
    setDismissedUserId(null);
  }, [loading, profileId]);

  useEffect(() => {
    if (native || loading) return;
    if (!profileId) {
      setWebPushEnabled(null);
      return;
    }
    if (webPushSupport === "unsupported" || webPushSupport === "origin-not-configured") {
      setWebPushEnabled(null);
      return;
    }

    let active = true;
    setWebPushEnabled(null);
    const refresh = () => {
      void oneSignalWebPushEnabled()
        .then((isEnabled) => {
          if (active) setWebPushEnabled(isEnabled);
        })
        .catch((cause) => {
          if (!active) return;
          console.error("Browser notification status could not be checked.", cause);
          setWebPushEnabled(null);
          setError(
            "Browser notification status could not be checked. Open notification settings to retry.",
          );
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, [loading, native, profileId, webPushSupport]);

  useEffect(() => {
    setError("");
  }, [profileId]);

  useEffect(() => {
    if (!native) return;
    let active = true;
    const listeners: Array<{ remove: () => void }> = [];
    const refresh = (next: NativeNotificationState) => {
      if (active) setState(next);
    };
    const openRoute = (route: string | null) => {
      const destination = isInternalNotificationRoute(route) ? route : "/notifications";
      if (loading) {
        pendingNotificationRoute.current = destination;
        return;
      }
      if (`${location.pathname}${location.search}${location.hash}` === destination) return;
      if (!user && !loading) navigate("/login", { state: { from: destination } });
      else if (user) navigate(destination);
    };

    void nativeNotifications
      .getState()
      .then(refresh)
      .catch(() => {
        if (active) setError("Android notification status could not be checked.");
      });
    void Promise.all([
      nativeNotifications.addListener("permissionChanged", refresh),
      nativeNotifications.addListener("subscriptionChanged", refresh),
      nativeNotifications.addListener("notificationClick", ({ route }) => openRoute(route)),
    ]).then((handles) => {
      if (!active) handles.forEach((handle) => void handle.remove());
      else listeners.push(...handles);
    });
    void nativeNotifications
      .takePendingNotificationRoute()
      .then(({ route }) => {
        if (active && route) openRoute(route);
      })
      .catch(() => {
        if (active) setError("A notification destination could not be restored.");
      });
    if (!loading && pendingNotificationRoute.current) {
      const route = pendingNotificationRoute.current;
      pendingNotificationRoute.current = null;
      openRoute(route);
    }
    return () => {
      active = false;
      listeners.forEach((handle) => void handle.remove());
    };
  }, [location.hash, location.pathname, location.search, loading, navigate, native, user]);

  useEffect(() => {
    if (!native || loading) return;
    currentUserId.current = profileId;
    syncQueue.current = syncQueue.current
      .catch(() => undefined)
      .then(async () => {
        await nativeNotifications.logout();
        if (!profileId || currentUserId.current !== profileId) {
          setLinkError("");
          return;
        }
        try {
          const token = await identityToken();
          if (currentUserId.current !== profileId) return;
          await nativeNotifications.login({ externalId: profileId, identityToken: token });
          setLinkError("");
        } catch (cause) {
          setLinkError(messageForIdentityError(cause));
          throw cause;
        }
      })
      .catch(() => {
        setLinkError(
          (message) =>
            message ||
            "Push account linking failed. Retry account sync before using notifications.",
        );
      });
  }, [identitySyncAttempt, loading, native, profileId]);

  async function enableNotifications() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      if (!native) {
        if (webPushSupport === "permission-denied") {
          setError(
            "Browser notifications are blocked for this site. Allow them in your browser’s site settings, then return here.",
          );
          return;
        }
        if (webPushSupport !== "ready") {
          setError("Browser push notifications are not available on this device.");
          return;
        }
        await enableOneSignalWebPush(user.id);
        setWebPushEnabled(true);
        await setPushPreference(user.id, true);
        rememberDismissal(user.id);
        setDismissedUserId(user.id);
        return;
      }
      if (state?.permissionGranted) {
        if (state.optedIn) {
          await nativeNotifications.openNotificationSettings();
          return;
        }
        const subscribed = await nativeNotifications.optIn();
        setState(subscribed);
        await setPushPreference(user.id, true);
        rememberDismissal(user.id);
        setDismissedUserId(user.id);
        return;
      }
      if (state && !state.canRequestPermission) {
        await nativeNotifications.openNotificationSettings();
        return;
      }
      const next = await nativeNotifications.requestPermission();
      setState(next);
      if (!next.granted) {
        setError("Notifications remain off. You can enable them in Android app settings.");
        return;
      }
      await nativeNotifications.optIn();
      await setPushPreference(user.id, true);
      rememberDismissal(user.id);
      setDismissedUserId(user.id);
    } catch {
      setError(
        native
          ? "Android permission was requested, but notification setup could not be completed."
          : "Browser permission was requested, but notification setup could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function dismissIntro() {
    if (!profileId) return;
    rememberDismissal(profileId);
    setDismissedUserId(profileId);
    setError("");
  }

  if (!enabled) return null;
  const webPushAvailable = webPushSupport === "ready" || webPushSupport === "permission-denied";
  const devicePushOff = native
    ? state !== null && (!state.permissionGranted || !state.optedIn)
    : webPushAvailable && (webPushSupport === "permission-denied" || webPushEnabled === false);
  const showIntro = Boolean(user) && !loading && dismissedUserId !== profileId && devicePushOff;

  return (
    <>
      {linkError ? (
        <p className="native-notification-link-error" role="alert">
          {linkError} <Link to="/settings/notifications">Notification settings</Link>{" "}
          <button
            type="button"
            className="native-notification-retry"
            onClick={() => setIdentitySyncAttempt((attempt) => attempt + 1)}
          >
            Retry account sync
          </button>
        </p>
      ) : null}
      {error && !showIntro ? (
        <p className="native-notification-link-error" role="alert">
          {error} <Link to="/settings/notifications">Notification settings</Link>
        </p>
      ) : null}
      <Dialog
        open={showIntro}
        title="Stay connected with VELORI"
        description="Get important updates, messages, announcements and activity notifications without missing what matters."
        onClose={dismissIntro}
        className="native-notification-dialog"
      >
        <div className="native-notification-intro">
          <div className="native-notification-bell" aria-hidden="true">
            <BellRing size={30} />
          </div>
          <p>
            {native
              ? "Turn on this device’s notifications so messages and important activity never get missed."
              : "Turn on browser notifications on this device so you never miss a message or important update."}
          </p>
          {!native && webPushSupport === "permission-denied" ? (
            <p className="native-notification-help">
              Notifications are blocked by your browser. Change the site permission in browser
              settings, then sign back in to try again.
            </p>
          ) : null}
          {error ? (
            <p className="inline-feedback is-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="native-notification-actions">
          <Button
            variant="primary"
            loading={busy}
            disabled={!native && webPushSupport === "permission-denied"}
            onClick={() => void enableNotifications()}
          >
            <Bell size={17} aria-hidden="true" />
            {!native && webPushSupport === "permission-denied"
              ? "Blocked by browser"
              : "Enable Notifications"}
          </Button>
          {state?.permissionGranted === false && !state.canRequestPermission ? (
            <Button
              variant="outline"
              onClick={() => void nativeNotifications.openNotificationSettings()}
            >
              <Settings2 size={17} aria-hidden="true" />
              Open Android settings
            </Button>
          ) : null}
          {!native && webPushSupport === "permission-denied" ? (
            <Link
              className="button button-outline"
              to="/settings/notifications"
              onClick={dismissIntro}
            >
              Notification settings
            </Link>
          ) : null}
          <Button variant="quiet" disabled={busy} onClick={dismissIntro}>
            Maybe Later
          </Button>
        </div>
      </Dialog>
    </>
  );
}
