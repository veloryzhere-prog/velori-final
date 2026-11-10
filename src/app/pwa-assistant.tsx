import { useEffect, useRef, useState } from "react";
import { Check, Download, RefreshCw, X } from "lucide-react";
import { useSiteSettings } from "../lib/site-settings";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_DISMISSED_KEY = "velori-pwa-install-dismissed-at";
const UPDATE_DISMISSED_KEY = "velori-pwa-update-dismissed-at";
const DISMISSAL_PERIOD = 14 * 24 * 60 * 60 * 1000;
const UPDATE_DISMISSAL_PERIOD = 24 * 60 * 60 * 1000;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function dismissalIsCurrent(key: string, period: number) {
  try {
    const dismissedAt = Number(localStorage.getItem(key));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < period;
  } catch {
    return false;
  }
}

function rememberDismissal(key: string) {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // Dismissal only needs to last for this page when browser storage is unavailable.
  }
}

function isSafariOnIOS() {
  const ua = navigator.userAgent;
  const iOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
  return iOS && safari;
}

export function PwaAssistant() {
  const siteSettings = useSiteSettings();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(() =>
    dismissalIsCurrent(INSTALL_DISMISSED_KEY, DISMISSAL_PERIOD),
  );
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(() =>
    dismissalIsCurrent(UPDATE_DISMISSED_KEY, UPDATE_DISMISSAL_PERIOD),
  );
  const updatingByChoice = useRef(false);
  const [installResult, setInstallResult] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;
    let currentRegistration: ServiceWorkerRegistration | null = null;

    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
    const workerUrl = new URL("service-worker.js", baseUrl);
    const workerScope = baseUrl.href;
    const setUpdateFromWaitingWorker = () => {
      if (
        currentRegistration?.waiting &&
        !dismissalIsCurrent(UPDATE_DISMISSED_KEY, UPDATE_DISMISSAL_PERIOD)
      ) {
        setUpdateReady(true);
        setUpdateDismissed(false);
      }
    };

    const onControllerChange = () => {
      if (updatingByChoice.current) window.location.reload();
    };

    void navigator.serviceWorker
      .register(workerUrl.href, { scope: workerScope })
      .then((nextRegistration) => {
        if (!active) return;
        currentRegistration = nextRegistration;
        setRegistration(nextRegistration);
        setUpdateFromWaitingWorker();

        nextRegistration.addEventListener("updatefound", () => {
          const installing = nextRegistration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateFromWaitingWorker();
            }
          });
        });
      })
      .catch(() => {
        // The application remains fully usable when service workers are blocked.
      });

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    const updateWhenActive = () => {
      if (document.visibilityState === "visible")
        void currentRegistration?.update().catch(() => {});
    };
    window.addEventListener("focus", updateWhenActive);
    window.addEventListener("online", updateWhenActive);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("focus", updateWhenActive);
      window.removeEventListener("online", updateWhenActive);
    };
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setInstallResult(true);
      setInstallDismissed(false);
      window.setTimeout(() => setInstallResult(false), 5000);
    };
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = () => setInstalled(isStandalone());
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    standaloneQuery.addEventListener("change", onDisplayModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      standaloneQuery.removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  const dismissInstall = () => {
    rememberDismissal(INSTALL_DISMISSED_KEY);
    setInstallDismissed(true);
    setIosHelpOpen(false);
  };

  const install = async () => {
    if (!installPrompt) {
      setIosHelpOpen(true);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
      else dismissInstall();
    } catch {
      // Ignore a browser prompt failure; VELORI continues working in the tab.
    }
  };

  const updateNow = () => {
    if (!registration?.waiting) return;
    updatingByChoice.current = true;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(() => {
      if (updatingByChoice.current) window.location.reload();
    }, 5000);
  };

  const dismissUpdate = () => {
    rememberDismissal(UPDATE_DISMISSED_KEY);
    setUpdateDismissed(true);
    setUpdateReady(false);
  };

  const showInstall =
    siteSettings.pwa_install_enabled &&
    !installed &&
    !installDismissed &&
    (Boolean(installPrompt) || isSafariOnIOS());
  const showUpdate = updateReady && !updateDismissed;

  return (
    <div className="pwa-assistant" aria-live="polite">
      {showUpdate ? (
        <section
          className="pwa-card pwa-update-card"
          role="status"
          aria-label="VELORI update available"
        >
          <span className="pwa-card-mark" aria-hidden="true">
            <RefreshCw size={19} />
          </span>
          <div className="pwa-card-copy">
            <strong>Update available</strong>
            <span>A new version of VELORI is ready.</span>
          </div>
          <button className="pwa-primary-button" onClick={updateNow} type="button">
            Update now
          </button>
          <button
            className="pwa-close-button"
            onClick={dismissUpdate}
            type="button"
            aria-label="Later"
          >
            <X size={18} />
          </button>
        </section>
      ) : showInstall ? (
        <section className="pwa-card" aria-label="Install VELORI">
          <span className="pwa-card-mark" aria-hidden="true">
            <Download size={19} />
          </span>
          <div className="pwa-card-copy">
            <strong>{siteSettings.pwa_install_title}</strong>
            <span>{siteSettings.pwa_install_description}</span>
            {iosHelpOpen ? (
              <ol className="pwa-ios-steps">
                <li>Tap Safari’s Share button.</li>
                <li>
                  Choose <b>Add to Home Screen</b>.
                </li>
                <li>
                  Tap <b>Add</b> to finish.
                </li>
              </ol>
            ) : null}
          </div>
          <button
            className="pwa-primary-button"
            onClick={() => (iosHelpOpen ? dismissInstall() : void install())}
            type="button"
          >
            {iosHelpOpen ? "Done" : siteSettings.pwa_install_cta}
          </button>
          <button
            className="pwa-close-button"
            onClick={dismissInstall}
            type="button"
            aria-label="Not now"
          >
            <X size={18} />
          </button>
        </section>
      ) : installResult ? (
        <div className="pwa-installed-toast" role="status">
          <Check size={16} /> VELORI is installed.
        </div>
      ) : null}
    </div>
  );
}
