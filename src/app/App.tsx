import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { RouterProvider } from "react-router";
import { AuthProvider } from "../lib/auth";
import { FeatureFlagsProvider } from "../lib/feature-flags";
import { MotionProvider } from "../motion/MotionProvider";
import { ViewportRuntime } from "../components/ViewportRuntime";
import { MotionControl } from "../motion/MotionControl";
import { MotionExperience } from "../motion/MotionExperience";
import { useInterfaceMotion } from "../motion/InterfaceMotion";
import { MotionProvider as MotionSettingsProvider } from "../lib/motion-provider";
import { SiteSettingsProvider } from "../lib/site-settings";
import { ThemeSettingsProvider } from "../lib/theme-settings";
import { getAnimationConfig, useSiteRuntimeConfig } from "../lib/runtime-config";
import { router } from "./routes";
import { MentionAssist } from "../components/MentionAssist";
import { PwaAssistant } from "./pwa-assistant";

class RuntimeErrorBoundary extends Component<
  { children: ReactNode },
  {
    hasError: boolean;
  }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    // Keep diagnostics useful without dumping potentially sensitive messages or
    // stack traces into a browser console visible to ordinary users.
    console.error("VELORI runtime render failure", error.name);
  }

  render() {
    return this.state.hasError ? <RuntimeErrorFallback /> : this.props.children;
  }
}

function RuntimeErrorFallback() {
  // This boundary is outside RouterProvider: never use router hooks here.
  return <FatalErrorPage detail="ApplicationError" />;
}

/**
 * Last-resort screen, rendered when the providers themselves fail.
 *
 * This deliberately uses NO context, NO hooks beyond React's own, and NO
 * stylesheet classes. Provider failures are caught by the outer boundary, so
 * this fallback can render even when a configuration provider is unavailable.
 *
 * Inline styles keep it rendering even when the stylesheet chunk never loaded.
 */
export function FatalErrorPage({ detail }: { detail: string }) {
  return (
    <main
      role="alert"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#fff8fc",
        color: "#241d28",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <style>
        {
          "@keyframes velori-recover{50%{transform:translateY(-7px) rotate(4deg)}}html[data-ui-motion=full] .velori-fatal-mark{animation:velori-recover 5s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.velori-fatal-mark{animation:none!important}}.velori-fatal-actions>*:focus-visible{outline:3px solid #3478f6;outline-offset:4px}"
        }
      </style>
      <section
        style={{
          maxWidth: "530px",
          padding: "36px 24px",
          textAlign: "center",
          background: "white",
          border: "1px solid #eedee8",
          borderRadius: "26px",
        }}
      >
        <p style={{ fontSize: "11px", letterSpacing: ".18em", color: "#a33d70", fontWeight: 700 }}>
          VELORI · A MOMENT TO RECONNECT
        </p>
        <div
          className="velori-fatal-mark"
          aria-hidden="true"
          style={{
            width: "88px",
            height: "88px",
            display: "grid",
            placeItems: "center",
            margin: "30px auto",
            background: "#fff0f6",
            color: "#c34d86",
            borderRadius: "26px",
            fontSize: "44px",
            boxShadow: "9px 12px 0 #fff4cc",
          }}
        >
          ♡
        </div>
        <h1 style={{ fontSize: "32px", lineHeight: 1.15, letterSpacing: "-.04em" }}>
          Let’s get you back.
        </h1>
        <p style={{ lineHeight: 1.7, fontSize: "14px", color: "#706575" }}>
          VELORI couldn’t load this page. Check your connection and try again. If you were
          submitting something, check whether it saved before resending.
        </p>
        <p style={{ fontSize: "11px", color: "#786975" }}>Reference: {detail}</p>
        <div
          className="velori-fatal-actions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            justifyContent: "center",
            marginTop: "24px",
          }}
        >
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: "46px",
              padding: "12px 22px",
              borderRadius: "12px",
              border: 0,
              background: "#c34d86",
              color: "white",
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href="/home"
            style={{
              minHeight: "46px",
              padding: "12px 22px",
              borderRadius: "12px",
              border: "1px solid #eedee8",
              color: "#241d28",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Go home
          </a>
        </div>
      </section>
    </main>
  );
}

class RootRenderErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; detail: string }
> {
  state = { hasError: false, detail: "" };

  static getDerivedStateFromError(error: Error) {
    // Only the error's own name is surfaced. Messages from a failed fetch can
    // contain endpoint URLs or internal detail, so they are logged, not shown.
    return { hasError: true, detail: error.name || "Error" };
  }

  componentDidCatch(error: Error) {
    console.error("VELORI provider render failure", error.name);
  }

  render() {
    return this.state.hasError ? (
      <FatalErrorPage detail={this.state.detail} />
    ) : (
      this.props.children
    );
  }
}

export default function AppRouter() {
  return (
    <RootRenderErrorBoundary>
      <MotionProvider>
        <ViewportRuntime />
        <MotionControl />
        <MotionExperience />
        <AuthProvider>
          <FeatureFlagsProvider>
            <SiteSettingsProvider>
              <ThemeSettingsProvider>
                <MotionSettingsProvider>
                  <RuntimeErrorBoundary>
                    <RouterProvider router={router} />
                  </RuntimeErrorBoundary>
                  <MentionAssist />
                  <PwaAssistant />
                  <StartupIntro />
                </MotionSettingsProvider>
              </ThemeSettingsProvider>
            </SiteSettingsProvider>
          </FeatureFlagsProvider>
        </AuthProvider>
      </MotionProvider>
    </RootRenderErrorBoundary>
  );
}

function StartupIntro() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedAt = useRef(0);
  const runtime = useSiteRuntimeConfig();
  const settingsReady = runtime.siteReady;
  const motionReady = runtime.motionReady;
  const { reduced: reduceMotion } = useInterfaceMotion();
  const pathname = window.location.pathname;
  const startup = getAnimationConfig(runtime, pathname, "startup");
  const videoSource = startup.assetUrl || undefined;
  const [mode, setMode] = useState<"waiting" | "video" | "fallback" | "done">(() =>
    reduceMotion ? "done" : "waiting",
  );
  // A late settings response must never cover work the visitor has already begun.
  useEffect(() => {
    if (mode === "done") return;
    const dismiss = () => setMode("done");
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((name) =>
      window.addEventListener(name, dismiss, { capture: true, passive: true }),
    );
    return () => events.forEach((name) => window.removeEventListener(name, dismiss, true));
  }, [mode]);

  useEffect(() => {
    if (reduceMotion) setMode("done");
  }, [reduceMotion]);

  useEffect(() => {
    if (mode !== "waiting") return;
    if (reduceMotion) {
      setMode("done");
      return;
    }
    if (settingsReady && motionReady) {
      if (!runtime.motion.global.enabled || runtime.motion.global.intensity === "off") {
        setMode("done");
        return;
      }
      if (startup.enabled && startup.preset === "none") {
        setMode("done");
        return;
      }
      if (startup?.showOncePerSession) {
        try {
          const key = `velori-startup-seen:${pathname}`;
          if (sessionStorage.getItem(key) === "1") {
            setMode("done");
            return;
          }
          sessionStorage.setItem(key, "1");
        } catch {
          // The startup animation remains bounded if session storage is blocked.
        }
      }
      const delay = window.setTimeout(
        () => setMode(videoSource ? "video" : "fallback"),
        Math.min(startup?.delayMs ?? 0, 5000),
      );
      return () => window.clearTimeout(delay);
    }
    const waitLimit = window.setTimeout(() => setMode(videoSource ? "video" : "fallback"), 2500);
    return () => window.clearTimeout(waitLimit);
  }, [
    mode,
    reduceMotion,
    settingsReady,
    motionReady,
    startup,
    videoSource,
    pathname,
    runtime.motion.global.enabled,
    runtime.motion.global.intensity,
  ]);

  useEffect(() => {
    if (mode !== "video") return;
    let completed = false;
    const video = videoRef.current;
    startedAt.current = performance.now();
    const timeout = Math.min(7000, Math.max(startup.minimumDisplayMs, startup.durationMs));
    const watchdog = window.setTimeout(
      () => {
        if (!completed) setMode("fallback");
      },
      Math.max(1000, timeout),
    );
    void video?.play().catch(() => {
      completed = true;
      window.clearTimeout(watchdog);
      setMode("fallback");
    });
    return () => {
      completed = true;
      window.clearTimeout(watchdog);
    };
  }, [mode, videoSource, startup.durationMs, startup.minimumDisplayMs]);

  useEffect(() => {
    if (mode !== "fallback") return;
    const timer = window.setTimeout(
      () => setMode("done"),
      Math.min(5000, Math.max(500, startup.minimumDisplayMs || 700)),
    );
    return () => window.clearTimeout(timer);
  }, [mode, startup.minimumDisplayMs]);

  const completeIntro = () => {
    const minimum = startup.minimumDisplayMs;
    const remaining = Math.max(0, minimum - (performance.now() - startedAt.current));
    window.setTimeout(() => setMode("done"), Math.min(5000, remaining));
  };

  if (mode === "done" || mode === "waiting") return null;
  // Until the published motion document arrives, `startup` still holds the global
  // default, so painting its preset here flashed the wrong animation before
  // settling onto the administrator's per-page override. No animation is playing
  // during the waiting phase, so the intro simply carries no preset until the
  // real configuration is known.
  const settledPreset = motionReady ? startup.preset || "fade" : "";
  return (
    <div
      className={`startup-intro${settledPreset ? ` motion-preset-${settledPreset}` : ""}`}
      data-motion-preset={settledPreset || undefined}
      data-motion-state={mode}
      role="status"
      aria-label="Opening VELORI"
    >
      {mode === "video" ? (
        <video
          ref={videoRef}
          className="startup-intro-video"
          src={videoSource}
          autoPlay
          loop={startup.loop}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          onEnded={completeIntro}
          onError={() => setMode("fallback")}
        />
      ) : (
        <div className="premium-startup-mark" aria-hidden="true">
          <span>v</span>
          <strong>VELORI</strong>
          <small>YOUR WORLD. YOUR PEOPLE.</small>
        </div>
      )}
      <span className="startup-intro-progress" aria-hidden="true" />
      <span className="sr-only">Starting your VELORI space</span>
    </div>
  );
}
