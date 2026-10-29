import { InformationFooter } from "../features/information/InformationPage";
import { VeloriLoop } from "../components/VeloriLoop";
import { useInterfaceMotion } from "../motion/InterfaceMotion";
import { AnnouncementOverlay, AnnouncementPaper } from "../features/campaigns/AnnouncementPaper";
import {
  announcementEligible,
  announcementTargetsRoute,
  isForgeAnnouncementEntryRoute,
  safeCampaignUrl,
} from "../features/campaigns/policy.mjs";
import { ProductFrame } from "../product/ProductFrame";
import { useDeviceMessageAlerts } from "../lib/useDeviceMessageAlerts";
import { StatusIllustration } from "../components/StatusIllustration";
import { SystemStateFrame } from "../components/SystemStateFrame";
import { isApkOnlyAnnouncementName } from "../lib/apk-promotion-admin.mjs";
import {
  growthPopupCooldownRemaining,
  isCriticalGrowthPopupRoute,
  isGrowthPopupLockedByOtherTab,
} from "../lib/growth-popup-scheduler.mjs";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  Link,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  CircleHelp,
  Compass,
  Feather,
  Film,
  Home,
  LogIn,
  Mail,
  Menu,
  MessageCircle,
  Plus,
  Moon,
  RefreshCw,
  Search,
  Settings2,
  CircleDot,
  Sun,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useFeatureFlag, useFeatureFlags } from "../lib/feature-flags";
import { supabase } from "../lib/supabase";
import { useSiteSettings } from "../lib/site-settings";
import { AnimatedContent, AnimatedOutlet } from "../lib/motion";
import { customHtmlDocument } from "../lib/custom-html-document";
import { PROFILE_CHANGED_EVENT, type ProfileSnapshot } from "../lib/profile-events";
import { Button, Dialog, IconButton, Notification } from "../components/ui";
import {
  getAppearanceConfig,
  getErrorAnimationConfig,
  getAnimationConfig,
  getMaintenanceConfig,
  getHomepageConfig,
  getPageConfig,
  getSiteConfig,
  useSiteRuntimeConfig,
} from "../lib/runtime-config";
import {
  normalizeMotionConfig,
  type MotionPreset,
} from "../../supabase/functions/_shared/motion-config.mjs";
import error404 from "../assets/error-404.svg";
import error404Static from "../assets/error-404-static.svg";
import veloriLogo from "../imports/velori-official.svg";
import { VisitorLanding } from "./visitor-landing";
import { ShellPageIdentity } from "../components/ShellPageIdentity";
import { PUBLIC_PAGE_REGISTRY } from "./admin-console/page-registry";

function useMotionPresentation(
  errorType?: string,
  configOverride?: unknown,
  pathnameOverride?: string,
  deviceOverride?: "desktop" | "tablet" | "mobile",
) {
  const runtime = useSiteRuntimeConfig();
  const config = configOverride
    ? getSiteConfig(runtime.site, normalizeMotionConfig(configOverride), runtime.motionVersion)
    : runtime;
  const { pathname } = useLocation();
  const resolvedPathname = pathnameOverride || pathname;
  const { reduced: reducedMotion } = useInterfaceMotion();
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">(() =>
    window.innerWidth <= 680 ? "mobile" : window.innerWidth <= 980 ? "tablet" : "desktop",
  );
  useEffect(() => {
    const updateDevice = () =>
      setDevice(
        window.innerWidth <= 680 ? "mobile" : window.innerWidth <= 980 ? "tablet" : "desktop",
      );
    window.addEventListener("resize", updateDevice, { passive: true });
    return () => {
      window.removeEventListener("resize", updateDevice);
    };
  }, []);
  const resolvedDevice = deviceOverride ?? device;
  const pageConfig = getPageConfig(config, resolvedPathname, resolvedDevice);
  const experience = pageConfig.experience;
  const errorResolution = errorType
    ? getErrorAnimationConfig(config, resolvedPathname, errorType, resolvedDevice)
    : null;
  const result: Record<string, unknown> = errorResolution?.animation ?? pageConfig.motion;
  const pagePreset =
    errorType === "MAINTENANCE"
      ? experience?.maintenance.enabled === true
        ? experience.maintenance.preset
        : undefined
      : errorType && experience?.error.enabled === true
        ? experience.error.preset
        : undefined;
  const preset: MotionPreset =
    !config.motion.global.enabled || result.intensity === "off"
      ? "none"
      : reducedMotion
        ? "reducedMotion" in result && result.reducedMotion === "fade"
          ? "fade"
          : "none"
        : pagePreset || (result.preset as MotionPreset);
  const speed = config.motion.global.speed;
  const multiplier = speed === "slow" ? 1.35 : speed === "fast" ? 0.75 : 1;
  const duration = reducedMotion
    ? preset === "fade"
      ? 100
      : 0
    : Math.round(Number(result.durationMs ?? 180) * multiplier);
  const intensity = String(result.intensity ?? config.motion.global.intensity);
  const intensityScale: Record<string, number> = {
    subtle: 0.5,
    standard: 1,
    expressive: 1.5,
    cinematic: 2,
  };
  const motionFactor = intensityScale[intensity] ?? 1;
  const style = {
    "--motion-duration": `${duration}ms`,
    "--motion-delay": `${reducedMotion ? 0 : Number(result.delayMs ?? 0)}ms`,
    "--motion-distance": `${Math.min(48, Math.max(0, Number(result.distance ?? 12) * motionFactor))}px`,
    "--motion-scale": String(1 - (1 - Number(result.scale ?? 0.98)) * motionFactor),
    "--motion-easing":
      result.easing === "spring" ? "cubic-bezier(.2,.8,.2,1)" : String(result.easing ?? "ease-out"),
    ...(result.backgroundColor ? { backgroundColor: result.backgroundColor } : {}),
    ...(result.surfaceColor ? { "--surface-primary": result.surfaceColor } : {}),
  } as CSSProperties;
  const page = errorType ? errorResolution?.page : undefined;
  return {
    preset,
    duration,
    intensity: String(result.intensity ?? config.motion.global.intensity),
    style,
    page,
    experience,
    animation: errorResolution?.animation,
  };
}

function ErrorArtwork({
  animated,
  assetUrl,
  alt,
  preset = "error-reveal",
  duration = 260,
  preview = false,
}: {
  animated: boolean;
  assetUrl: string | null;
  alt: string;
  preset?: string;
  duration?: number;
  preview?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { reduced: reducedMotion } = useInterfaceMotion();
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => setVideoFailed(false), [assetUrl]);
  const videoUrl = (() => {
    const normalized = assetUrl?.toLowerCase().split("?")[0] ?? "";
    return [".mp4", ".webm", ".mov", ".m4v"].some((extension) => normalized.endsWith(extension))
      ? assetUrl
      : null;
  })();
  useEffect(() => {
    if (!videoUrl || videoFailed || reducedMotion || !animated || preset === "none" || preview)
      return;
    void videoRef.current?.play().catch(() => undefined);
  }, [videoUrl, videoFailed, reducedMotion, animated, preset, preview]);

  const staticVideo = Boolean(
    videoUrl && !videoFailed && (!animated || reducedMotion || preset === "none"),
  );

  if (staticVideo) {
    return (
      <video
        className="error-art-video"
        src={videoUrl ?? undefined}
        controls
        playsInline
        preload="metadata"
        poster={error404Static}
        aria-label={alt}
        onError={() => setVideoFailed(true)}
      />
    );
  }
  if (!animated || reducedMotion || preset === "none") {
    return (
      <img
        src={assetUrl && !videoUrl ? assetUrl : error404Static}
        alt={alt}
        width="512"
        height="512"
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = error404Static;
        }}
      />
    );
  }
  if (videoUrl && !videoFailed) {
    return (
      <video
        ref={videoRef}
        className={`error-art-video motion-art motion-preset-${preset}`}
        data-motion-preset={preset}
        style={{ "--motion-duration": `${duration}ms` } as CSSProperties}
        src={videoUrl}
        autoPlay
        loop
        muted
        controls={preview}
        playsInline
        preload="metadata"
        aria-label={alt}
        onError={() => setVideoFailed(true)}
      />
    );
  }
  return (
    <img
      className="error-art-motion motion-art"
      data-motion-preset={preset}
      style={{ "--motion-duration": `${duration}ms` } as CSSProperties}
      src={videoFailed ? error404 : assetUrl || error404}
      alt={alt}
      width="512"
      height="512"
      onError={() => setVideoFailed(true)}
    />
  );
}

const mainNav = [
  { to: "/home", text: "Home", icon: Home },
  { to: "/explore", text: "Explore", icon: Compass },
  { to: "/reels", text: "Reels", icon: Film },
  { to: "/messages", text: "Messages", icon: MessageCircle, feature: "messaging_enabled" },
  { to: "/notifications", text: "Notifications", icon: Bell, feature: "notifications_enabled" },
  { to: "/groups", text: "Groups", icon: Users, feature: "groups_enabled" },
  { to: "/profile", text: "Profile", icon: Users },
  { to: "/saved", text: "Saved", icon: Bookmark },
];

const navIconMap: Record<string, typeof Home> = {
  home: Home,
  explore: Compass,
  search: Search,
  reels: Film,
  notifications: Bell,
  messages: MessageCircle,
  saved: Bookmark,
  settings: Settings2,
  create: Feather,
  profile: Users,
  groups: Users,
  help: CircleHelp,
  menu: Menu,
};

type NavigationRecord = {
  id: string;
  label: string;
  route: string;
  icon?: string;
  visible?: boolean;
  desktop_visible?: boolean;
  mobile_visible?: boolean;
  feature_flag?: string | null;
  navigation_scope?: "public" | "admin";
  position?: number;
};

/**
 * Route-first icon resolution for the navigation menus.
 *
 * Navigation rows come either from the seeded `mainNav` list (which stores the
 * React component name, e.g. "Home") or from the `navigation_items` table
 * (free-text icon column). Neither reliably matches the lowercase keys of
 * `navIconMap`, and the old `?? Home` fallback silently drew a house glyph for
 * every entry — the whole sidebar looked identical. Known routes win first,
 * then a case-insensitive icon name, and only then the home glyph.
 */
const navRouteIcons: Record<string, typeof Home> = {
  "/home": Home,
  "/explore": Compass,
  "/search": Search,
  "/reels": Film,
  "/messages": MessageCircle,
  "/notifications": Bell,
  "/saved": Bookmark,
  "/groups": Users,
  "/help": CircleHelp,
  "/settings": Settings2,
  "/create": Feather,
  "/stories": CircleDot,
  "/people": Users,
  "/profile": Users,
};

function resolveNavIcon(item: Pick<NavigationRecord, "icon" | "route">) {
  const direct = navRouteIcons[item.route];
  if (direct) return direct;
  // `/profile/someone` and similar parameterised routes.
  const section = item.route.split("/").slice(0, 2).join("/");
  const bySection = navRouteIcons[section];
  if (bySection) return bySection;
  return navIconMap[(item.icon ?? "").toLowerCase()] ?? Home;
}

function useNavigationItems() {
  const flags = useFeatureFlags();
  const [items, setItems] = useState<NavigationRecord[]>(
    mainNav.map(({ to, text, icon, feature }) => ({
      id: to,
      label: text,
      route: to,
      icon: icon.name,
      visible: true,
      desktop_visible: true,
      mobile_visible: true,
      feature_flag: feature,
      position: 0,
    })),
  );

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("navigation_items")
        .select(
          "id,label,route,icon,position,visible,desktop_visible,mobile_visible,feature_flag,navigation_scope",
        )
        .eq("navigation_scope", "public")
        .order("position", { ascending: true });
      if (!active) return;
      if (error || !data) {
        setItems(
          mainNav.map(({ to, text, icon, feature }) => ({
            id: to,
            label: text,
            route: to,
            icon: icon.name,
            visible: true,
            desktop_visible: true,
            mobile_visible: true,
            feature_flag: feature,
            position: 0,
          })),
        );
        return;
      }
      const configuredItems = data as NavigationRecord[];
      const next = configuredItems
        // Keep a defensive route boundary in the public client even if a stale
        // PostgREST schema cache or an older policy returns a mis-scoped row.
        .filter(
          (item) =>
            item.navigation_scope !== "admin" &&
            item.route !== "/admin" &&
            !item.route.startsWith("/admin/"),
        )
        .filter((item) => item.visible !== false)
        .filter((item) => !item.feature_flag || flags[item.feature_flag] !== false);
      // Fill only destinations with no public row. A row that an administrator
      // explicitly hides remains hidden.
      const configuredRoutes = new Set(
        configuredItems
          .filter((item) => item.navigation_scope !== "admin")
          .map((item) => item.route),
      );
      const defaultsForMissingRoutes = mainNav
        .filter(
          ({ to, feature }) => !configuredRoutes.has(to) && (!feature || flags[feature] !== false),
        )
        .map(({ to, text, icon, feature }, position) => ({
          id: to,
          label: text,
          route: to,
          icon: icon.name,
          visible: true,
          desktop_visible: true,
          mobile_visible: true,
          feature_flag: feature,
          navigation_scope: "public" as const,
          position: 100 + position,
        }));
      const completePublicNav = [...next, ...defaultsForMissingRoutes].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0),
      );
      setItems(
        completePublicNav.length > 0
          ? completePublicNav
          : mainNav.map(({ to, text, icon, feature }) => ({
              id: to,
              label: text,
              route: to,
              icon: icon.name,
              visible: true,
              desktop_visible: true,
              mobile_visible: true,
              feature_flag: feature,
              position: 0,
            })),
      );
    }
    void load();
    return () => {
      active = false;
    };
  }, [flags]);

  return items;
}

type OwnProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * The signed-in member's own profile row.
 *
 * The shell previously showed the email local-part as the account name and a
 * single letter as the avatar, which is not the identity the rest of the app
 * uses in the feed, comments and messages. Reading the real row keeps every
 * surface consistent after a refresh and gives the sidebar a route to the
 * member's own profile.
 */
function useOwnProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  useEffect(() => {
    let active = true;
    const applyProfileChange = (event: Event) => {
      const changed = (event as CustomEvent<ProfileSnapshot>).detail;
      if (changed?.id === userId) {
        active = false;
        setProfile(changed);
      }
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, applyProfileChange);
    if (!userId) {
      setProfile(null);
      return () => window.removeEventListener(PROFILE_CHANGED_EVENT, applyProfileChange);
    }
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      setProfile(error ? null : ((data as OwnProfile | null) ?? null));
    })();
    return () => {
      active = false;
      window.removeEventListener(PROFILE_CHANGED_EVENT, applyProfileChange);
    };
  }, [userId]);
  return profile;
}

function LiveAnnouncements() {
  type Item = {
    id: string;
    title: string;
    message: string;
    internal_name?: string;
    custom_html?: string;
    custom_css?: string;
    icon?: string;
    link?: string;
    priority?: string;
    dismissible?: boolean;
    state?: string;
    display_mode?: string;
    media_type?: string;
    media_url?: string;
    media_alt?: string;
    poster_url?: string;
    cta_label?: string;
    action_type?: string;
    target_route?: string;
    target_routes?: string[];
    frequency_mode?: string;
    max_show_count?: number;
    delay_seconds?: number;
    starts_at?: string;
    ends_at?: string;
  };
  const { user } = useAuth();
  const enabled = useFeatureFlag("announcements_enabled", true);
  const { pathname } = useLocation();
  const [items, setItems] = useState<Item[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [modalId, setModalId] = useState<string | null>(null);
  const activeModalId = useRef<string | null>(null);
  const popupOwnerId = useRef(`tab-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const popupChannel = useRef<BroadcastChannel | null>(null);
  const [lastPopupClosedAt, setLastPopupClosedAt] = useState(() => {
    try {
      return Number(localStorage.getItem("velori.growth-popup.last-closed-at")) || 0;
    } catch {
      return 0;
    }
  });
  const [blockedByOtherTab, setBlockedByOtherTab] = useState(false);
  const markedRef = useRef<Record<string, boolean>>({});
  const [brokenMedia, setBrokenMedia] = useState<Record<string, boolean>>({});
  const modalItem = items.find((item) => item.id === modalId && !dismissed[item.id]);
  const priorityScore = (value?: string) =>
    ({ critical: 4, high: 3, normal: 2, low: 1 })[value ?? "normal"] ?? 0;
  const safeHref = safeCampaignUrl;

  useEffect(() => {
    const syncLock = () => {
      try {
        const rawLock = localStorage.getItem("velori.growth-popup.active");
        const lock = rawLock ? JSON.parse(rawLock) : null;
        setBlockedByOtherTab(isGrowthPopupLockedByOtherTab(lock, popupOwnerId.current, Date.now()));
        setLastPopupClosedAt(
          Number(localStorage.getItem("velori.growth-popup.last-closed-at")) || 0,
        );
      } catch {
        setBlockedByOtherTab(false);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === "velori.growth-popup.active" ||
        event.key === "velori.growth-popup.last-closed-at"
      ) {
        syncLock();
      }
    };
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("velori.growth-popup-scheduler");
    popupChannel.current = channel;
    if (channel) {
      channel.onmessage = (event: MessageEvent<{ owner?: string; type?: string }>) => {
        if (event.data?.owner === popupOwnerId.current) return;
        if (event.data?.type === "open") setBlockedByOtherTab(true);
        else if (event.data?.type === "close") syncLock();
      };
    }
    syncLock();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", syncLock);
    const lockTimer = window.setInterval(syncLock, 5_000);
    return () => {
      window.clearInterval(lockTimer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", syncLock);
      channel?.close();
      popupChannel.current = null;
    };
  }, []);

  const acquirePopupLock = () => {
    const now = Date.now();
    try {
      const rawLock = localStorage.getItem("velori.growth-popup.active");
      const lock = rawLock ? JSON.parse(rawLock) : null;
      if (isGrowthPopupLockedByOtherTab(lock, popupOwnerId.current, now)) {
        setBlockedByOtherTab(true);
        return false;
      }
      localStorage.setItem(
        "velori.growth-popup.active",
        JSON.stringify({ owner: popupOwnerId.current, openedAt: now }),
      );
      const stored = JSON.parse(localStorage.getItem("velori.growth-popup.active") ?? "null");
      if (stored?.owner !== popupOwnerId.current) {
        setBlockedByOtherTab(true);
        return false;
      }
    } catch {
      // Storage is best-effort; announcements remain usable in private browsing.
    }
    popupChannel.current?.postMessage({ type: "open", owner: popupOwnerId.current });
    return true;
  };

  const releasePopupLock = () => {
    try {
      const rawLock = localStorage.getItem("velori.growth-popup.active");
      const lock = rawLock ? JSON.parse(rawLock) : null;
      if (lock?.owner === popupOwnerId.current) {
        localStorage.removeItem("velori.growth-popup.active");
      }
    } catch {
      // Storage is best-effort; the lock expires for other tabs.
    }
    popupChannel.current?.postMessage({ type: "close", owner: popupOwnerId.current });
  };

  const recordPopupClosed = () => {
    const closedAt = Date.now();
    setLastPopupClosedAt(closedAt);
    try {
      localStorage.setItem("velori.growth-popup.last-closed-at", String(closedAt));
    } catch {
      // The cooldown remains active for this mounted application instance.
    }
    releasePopupLock();
  };

  useEffect(
    () => () => {
      releasePopupLock();
    },
    [],
  );

  const markViewed = (item: Item) => {
    void supabase.rpc("record_system_announcement_event", {
      p_announcement_id: item.id,
      p_kind: "view",
    });
    try {
      sessionStorage.setItem(`velori.announcement.${item.id}`, "1");
    } catch {
      /* session limit is best effort */
    }
    if (user?.id) {
      void supabase
        .from("system_announcement_user_state")
        .select("show_count")
        .eq("announcement_id", item.id)
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) =>
          supabase.from("system_announcement_user_state").upsert({
            announcement_id: item.id,
            user_id: user.id,
            show_count: (data?.show_count ?? 0) + 1,
            last_seen_at: new Date().toISOString(),
          }),
        );
    } else {
      try {
        const key = `velori.announcement.${item.id}`;
        const saved = JSON.parse(localStorage.getItem(key) ?? "{}") as { count?: number };
        localStorage.setItem(
          key,
          JSON.stringify({ ...saved, count: (saved.count ?? 0) + 1, last: Date.now() }),
        );
      } catch {
        /* local state is best effort for private browsing */
      }
    }
  };

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setModalId(null);
      if (activeModalId.current) recordPopupClosed();
      activeModalId.current = null;
      return;
    }
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    async function load() {
      let result = await supabase
        .from("system_announcements")
        .select(
          "id,title,message,internal_name,custom_html,custom_css,icon,link,priority,dismissible,active,starts_at,ends_at,state,display_mode,media_type,media_url,media_alt,poster_url,cta_label,action_type,target_route,target_routes,frequency_mode,max_show_count,delay_seconds",
        )
        .eq("active", true);
      if (result.error) {
        // The old banner schema remains a graceful fallback during a staggered migration rollout.
        result = (await supabase
          .from("system_announcements")
          .select(
            "id,title,message,internal_name,icon,link,priority,dismissible,active,starts_at,ends_at",
          )
          .eq("active", true)) as typeof result;
      }
      if (!active || result.error) return;
      const now = Date.now();
      const candidates = ((result.data ?? []) as unknown as Item[])
        .filter((item) => {
          if (isApkOnlyAnnouncementName(item.internal_name)) return false;
          const start = item.starts_at ? new Date(item.starts_at).getTime() : 0;
          const end = item.ends_at ? new Date(item.ends_at).getTime() : Number.POSITIVE_INFINITY;
          return (
            now >= start &&
            now < end &&
            !(item.display_mode === "modal" && isCriticalGrowthPopupRoute(pathname)) &&
            announcementTargetsRoute(item, pathname)
          );
        })
        .sort(
          (a, b) =>
            priorityScore(b.priority) - priorityScore(a.priority) ||
            new Date(b.starts_at ?? 0).getTime() - new Date(a.starts_at ?? 0).getTime(),
        );

      let stateById: Record<
        string,
        { show_count: number; dismissed_at?: string | null; last_seen_at?: string | null }
      > = {};
      if (user?.id) {
        const stateResult = candidates.length
          ? await supabase
              .from("system_announcement_user_state")
              .select("announcement_id,show_count,dismissed_at,last_seen_at")
              .eq("user_id", user.id)
              .in(
                "announcement_id",
                candidates.map((item) => item.id),
              )
          : { data: [], error: null };
        if (!stateResult.error)
          for (const state of stateResult.data ?? []) stateById[state.announcement_id] = state;
      }
      const eligible = candidates.filter((item) => {
        let sessionSeen = false;
        let state = stateById[item.id] || {};
        try {
          sessionSeen = !!sessionStorage.getItem(`velori.announcement.${item.id}`);
          if (!user?.id)
            state = JSON.parse(localStorage.getItem(`velori.announcement.${item.id}`) || "{}");
        } catch {
          /* Memory-only display when storage is unavailable. */
        }
        return announcementEligible(item, state, sessionSeen);
      });
      if (!active) return;
      setItems((current) => {
        const stillOnRoute = current.filter(
          (item) => candidates.some((candidate) => candidate.id === item.id) && !dismissed[item.id],
        );
        const combined = [
          ...stillOnRoute,
          ...eligible.filter((item) => !stillOnRoute.some((visible) => visible.id === item.id)),
        ];
        const open = current.find((item) => item.id === activeModalId.current);
        if (
          open &&
          !isCriticalGrowthPopupRoute(pathname) &&
          !combined.some((item) => item.id === open.id)
        ) {
          combined.unshift(open);
        }
        return combined;
      });
      for (const banner of eligible.filter((item) => item.display_mode !== "modal")) {
        if (!markedRef.current[banner.id]) {
          markedRef.current[banner.id] = true;
          markViewed(banner);
        }
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visible);
    channel = supabase
      .channel("public-system-announcements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_announcements" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [pathname, user?.id, enabled]);

  useEffect(() => {
    if (!isCriticalGrowthPopupRoute(pathname) || !activeModalId.current) return;
    activeModalId.current = null;
    setModalId(null);
    recordPopupClosed();
  }, [pathname]);

  const closeModal = (item: Item, acknowledged = false) => {
    setDismissed((current) => ({ ...current, [item.id]: true }));
    activeModalId.current = null;
    setModalId(null);
    recordPopupClosed();
    if (acknowledged || item.dismissible !== false) {
      void supabase.rpc("record_system_announcement_event", {
        p_announcement_id: item.id,
        p_kind: acknowledged ? "acknowledgement" : "dismissal",
      });
      if (user?.id) {
        void supabase.from("system_announcement_user_state").upsert({
          announcement_id: item.id,
          user_id: user.id,
          ...(item.dismissible !== false ? { dismissed_at: new Date().toISOString() } : {}),
          ...(acknowledged ? { acknowledged_at: new Date().toISOString() } : {}),
        });
      } else {
        try {
          if (item.dismissible !== false)
            localStorage.setItem(
              `velori.announcement.${item.id}`,
              JSON.stringify({
                ...JSON.parse(localStorage.getItem(`velori.announcement.${item.id}`) || "{}"),
                dismissed: true,
                last: Date.now(),
              }),
            );
        } catch {
          /* best effort */
        }
      }
    }
  };

  const banners = items.filter((item) => item.display_mode !== "modal" && !dismissed[item.id]);
  useEffect(() => {
    if (modalId || modalItem || blockedByOtherTab || document.hidden) return;
    const next = items.find(
      (item) =>
        item.display_mode === "modal" &&
        !dismissed[item.id] &&
        !isCriticalGrowthPopupRoute(pathname),
    );
    if (!next) return;
    const cooldown = growthPopupCooldownRemaining(lastPopupClosedAt, Date.now());
    const delay = Math.max(cooldown, (next.delay_seconds ?? 0) * 1000);
    const timer = window.setTimeout(() => {
      if (document.hidden || !acquirePopupLock()) return;
      activeModalId.current = next.id;
      setModalId(next.id);
      if (!markedRef.current[next.id]) {
        markedRef.current[next.id] = true;
        markViewed(next);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [items, modalId, modalItem?.id, dismissed, blockedByOtherTab, lastPopupClosedAt, pathname]);
  if (!enabled || (!banners.length && !modalItem)) return null;
  return (
    <>
      {banners.length ? (
        <div className="announcement-stack">
          {banners.map((item) => (
            <AnnouncementPaper
              key={item.id}
              item={{ ...item, display_mode: "banner" }}
              onDismiss={item.dismissible === false ? undefined : () => closeModal(item)}
              onAction={() => {
                void supabase.rpc("record_system_announcement_event", {
                  p_announcement_id: item.id,
                  p_kind: "cta_click",
                });
                closeModal(item, true);
              }}
            />
          ))}
        </div>
      ) : null}
      {modalItem ? (
        <AnnouncementOverlay
          item={modalItem}
          onClose={(acknowledged) => closeModal(modalItem, acknowledged)}
          onAction={() => {
            void supabase.rpc("record_system_announcement_event", {
              p_announcement_id: modalItem.id,
              p_kind: "cta_click",
            });
            closeModal(modalItem, true);
          }}
        />
      ) : null}
    </>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  const appearance = getAppearanceConfig(useSiteRuntimeConfig());
  const settings = useSiteSettings();
  // site_name may already end with a period (e.g. "VELORI."); the styled
  // brand-period span below would then render a double period ("VELORI..").
  const name = settings.site_name.replace(/\.+$/, "");
  return (
    <Link to="/home" className="brand" aria-label={`${name} home`}>
      <img className="brand-logo" src={appearance.logoUrl} alt="" aria-hidden="true" />
      {!compact && (
        <span>
          {name}
          <span className="brand-period">.</span>
        </span>
      )}
    </Link>
  );
}

function ThemeButton() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(root.dataset.theme === "dark"));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return (
    <IconButton
      className="shell-theme-action"
      label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next = !dark;
        document.documentElement.dataset.theme = next ? "dark" : "light";
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute("content", next ? "#100914" : "#FAF8FC");
        window.dispatchEvent(new Event("theme-preference-updated"));
        try {
          localStorage.setItem("velori-theme", next ? "dark" : "light");
        } catch {
          // The selected theme remains active for this page load.
        }
        setDark(next);
      }}
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </IconButton>
  );
}

/**
 * Routes an anonymous visitor may open directly.
 *
 * Auth flows render standalone, without the application shell, so signing in
 * and signing up stay simple. The informational pages render inside the normal
 * shell because they are public by nature and link back to the app. The home,
 * post, and profile entry routes show the visitor landing page; unmatched paths
 * continue to the CMS/404 resolver.
 */
const PUBLIC_AUTH_ROUTES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/confirm",
  "/auth/confirmed",
  "/auth/check-email",
  "/verify-email",
]);

const PUBLIC_CONTENT_ROUTES = new Set([
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/community-guidelines",
  "/safety",
  "/cookies",
  "/acceptable-use",
  "/data-policy",
  "/legal",
  "/help",
  "/maintenance",
]);

const SESSION_REQUIRED_ROUTES = [
  "/feed",
  "/explore",
  "/search",
  "/people",
  "/hashtags",
  "/notifications",
  "/messages",
  "/saved",
  "/archive",
  "/trash",
  "/drafts",
  "/create",
  "/stories",
  "/reels",
  "/groups",
  "/settings",
];

/** A signed-in member should never sit on the login or signup screens. */
const AUTH_ENTRY_ROUTES = new Set(["/login", "/signup"]);

/**
 * Rendered for the brief moment before the stored session is known, so an
 * anonymous visitor never sees the authenticated application flicker in.
 */
function VisitorBoot() {
  return (
    <div className="initial-route-fallback" role="status" aria-live="polite">
      <img
        className="initial-official-logo"
        src={veloriLogo}
        alt="VELORI"
        width="1280"
        height="720"
      />
      <span className="initial-route-progress" aria-hidden="true" />
      <span>Starting VELORI…</span>
    </div>
  );
}

const createOptions = [
  { to: "/create", icon: Feather, title: "Create post", hint: "Share words, photos or video" },
  {
    to: "/stories?create=1",
    icon: CircleDot,
    title: "Add story",
    hint: "Share a moment for 24 hours",
  },
  {
    to: "/reels/create",
    icon: Film,
    title: "Create reel",
    hint: "Upload and publish a short video",
  },
];

/**
 * One tap from anywhere opens this, and it offers exactly three social actions.
 * Advanced options live inside each creator rather than here.
 */
function CreateSheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      open
      title="Create"
      description="Choose what you want to share."
      onClose={onClose}
      className="create-dialog"
      actions={
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="create-sheet-options">
        {createOptions.map(({ to, icon: Icon, title, hint }) => (
          <Link key={to} to={to} className="create-sheet-option" onClick={onClose}>
            <span className="create-sheet-icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{hint}</small>
            </span>
          </Link>
        ))}
      </div>
    </Dialog>
  );
}

/** The administrator's site-wide banner, dismissible like the live ones. */
function SiteAnnouncement({ text }: { text: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(false), [text]);
  if (hidden || !text) return null;
  return (
    <div className="announcement-banner" role="status">
      <span className="announcement-copy">
        <span>{text}</span>
      </span>
      <button type="button" aria-label="Dismiss announcement" onClick={() => setHidden(true)}>
        Dismiss
      </button>
    </div>
  );
}

// Keep recovery, confirmation, and administrator routes available so a global
// maintenance switch cannot lock users out of account recovery or maintenance controls.
const MAINTENANCE_EXEMPT = new Set([
  "/admin",
  "/admin/login",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/confirm",
  "/auth/confirmed",
  "/auth/check-email",
  "/verify-email",
]);

export function Shell() {
  const { user, loading: authLoading } = useAuth();
  const settings = useSiteSettings();
  const runtimeConfig = useSiteRuntimeConfig();
  const flags = useFeatureFlags();
  useDeviceMessageAlerts(user?.id, flags.messaging_enabled && flags.notifications_enabled);
  const navItems = useNavigationItems();
  const homepage = getHomepageConfig(runtimeConfig);
  const [online, setOnline] = useState(navigator.onLine);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const { pathname, search, hash } = useLocation();
  const forgeEntryRoute = isForgeAnnouncementEntryRoute(pathname);
  const [, setMaintenanceBoundary] = useState(0);
  const [signOutError, setSignOutError] = useState("");
  const profile = useOwnProfile(user?.id);
  useEffect(() => {
    setSignOutError("");
  }, [pathname]);
  useEffect(() => {
    const now = Date.now();
    const boundaries = [
      runtimeConfig.site.maintenance_starts_at,
      runtimeConfig.site.maintenance_ends_at,
    ]
      .map((value) => (value ? Date.parse(value) : Number.NaN))
      .filter((value) => Number.isFinite(value) && value > now)
      .sort((a, b) => a - b);
    if (!boundaries.length) return;
    const timer = window.setTimeout(
      () => setMaintenanceBoundary((value) => value + 1),
      Math.max(0, boundaries[0] - now + 1),
    );
    const refreshOnFocus = () => setMaintenanceBoundary((value) => value + 1);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [runtimeConfig.site.maintenance_starts_at, runtimeConfig.site.maintenance_ends_at]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!user || !flags.messaging_enabled) {
      setMessageUnreadCount(0);
      return;
    }
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase.rpc("conversation_unread_total");
      if (!active || error) return;
      setMessageUnreadCount(Math.max(0, Number(data) || 0));
    };
    void refresh();
    const refreshEvent = () => void refresh();
    const channel = supabase
      .channel(`global-messaging-unread:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refreshEvent)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${user.id}`,
        },
        refreshEvent,
      )
      .subscribe();
    window.addEventListener("velori:messaging-unread-refresh", refreshEvent);
    window.addEventListener("focus", refreshEvent);
    return () => {
      active = false;
      window.removeEventListener("velori:messaging-unread-refresh", refreshEvent);
      window.removeEventListener("focus", refreshEvent);
      void supabase.removeChannel(channel);
    };
  }, [flags.messaging_enabled, user?.id]);

  useEffect(() => {
    if (!user || !flags.notifications_enabled) {
      setNotificationUnreadCount(0);
      return;
    }
    let active = true;
    const refresh = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      if (!active || error) return;
      setNotificationUnreadCount(Math.max(0, Number(count ?? 0)));
    };
    void refresh();
    const refreshEvent = () => void refresh();
    const channel = supabase
      .channel(`global-notifications-unread:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        refreshEvent,
      )
      .subscribe();
    window.addEventListener("focus", refreshEvent);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshEvent);
      void supabase.removeChannel(channel);
    };
  }, [flags.notifications_enabled, user?.id]);

  // A failed sign-out previously left the user apparently still signed in with
  // no explanation, because the promise was discarded with `void`.
  async function signOut() {
    setSignOutError("");
    const { error } = await supabase.auth.signOut();
    if (error) setSignOutError("Signing out failed. Check your connection and try again.");
  }

  const maintenance = getMaintenanceConfig(runtimeConfig, pathname);
  if (!MAINTENANCE_EXEMPT.has(pathname) && !pathname.startsWith("/admin/") && maintenance.enabled)
    return (
      <AnimatedContent>
        <Maintenance />
      </AnimatedContent>
    );

  // Deterministic auth gate. Until the stored session is known we show a short
  // branded loader, never the authenticated application. A signed-out visitor
  // never reaches the feed, stories, messages or any personal dashboard.
  if (authLoading) return <VisitorBoot />;
  if (/^\/(?:forge|artifacts|studio|preview|s)(?:\/|$)/.test(pathname))
    return (
      <>
        <AnimatedOutlet />
        {forgeEntryRoute ? <LiveAnnouncements /> : null}
      </>
    );
  if (user && AUTH_ENTRY_ROUTES.has(pathname)) return <Navigate to="/home" replace />;
  if (!user && PUBLIC_AUTH_ROUTES.has(pathname))
    return (
      <div className="visitor-auth-wrap">
        <header className="visitor-auth-top">
          <Brand />
        </header>
        <AnimatedOutlet />
        <InformationFooter compact />
      </div>
    );
  if (
    !user &&
    SESSION_REQUIRED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  ) {
    return <Navigate to="/login" replace state={{ from: `${pathname}${search}${hash}` }} />;
  }
  if (
    !user &&
    (pathname === "/" || pathname === "/home" || /^\/(?:post|profile)\/[^/]+\/?$/.test(pathname))
  )
    return (
      <AnimatedContent>
        <VisitorLanding from={`${pathname}${search}${hash}`} />
      </AnimatedContent>
    );
  if (!user)
    return (
      <div className="public-content-shell">
        <header className="public-content-header">
          <Brand />
          <nav aria-label="Account">
            <Link to="/login">Log in</Link>
            <Link className="button button-primary" to="/signup">
              Create account
            </Link>
          </nav>
        </header>
        <main className="public-content-main">
          <AnimatedOutlet />
        </main>
        <InformationFooter />
      </div>
    );

  return (
    <ProductFrame
      items={navItems}
      profile={profile}
      messages={messageUnreadCount}
      notifications={notificationUnreadCount}
      onSignOut={() => void signOut()}
      signOutError={signOutError}
      theme={<ThemeButton />}
      stories={flags.stories_enabled}
      reels={flags.reels_enabled}
      online={online}
      messagingEnabled={flags.messaging_enabled}
      notificationsEnabled={flags.notifications_enabled}
    >
      <AnimatedOutlet />
      {homepage.announcement && <SiteAnnouncement text={homepage.announcement} />}
      <LiveAnnouncements />
    </ProductFrame>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  to,
}: {
  icon: typeof Home;
  title: string;
  text: string;
  action?: string;
  to?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-art">
        <div className="empty-orbit" />
        <div className="empty-orbit orbit-two" />
        <Icon size={31} strokeWidth={1.5} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && to && (
        <Link className="button button-primary" to={to}>
          {action} <ArrowRight size={17} />
        </Link>
      )}
    </div>
  );
}

export function RuntimeLoading({
  label = "Loading",
  pathname,
  previewConfig,
}: {
  label?: string;
  pathname?: string;
  previewConfig?: unknown;
}) {
  const motion = useMotionPresentation(undefined, previewConfig, pathname);
  const runtime = useSiteRuntimeConfig();
  const config = previewConfig
    ? getSiteConfig(runtime.site, normalizeMotionConfig(previewConfig), runtime.motionVersion)
    : runtime;
  const loading = getAnimationConfig(config, pathname || window.location.pathname, "loading");
  const [assetReady, setAssetReady] = useState(false);
  const [assetFailed, setAssetFailed] = useState(false);
  const { reduced: reducedMotion } = useInterfaceMotion();
  const motionEnabled =
    config.motion.global.enabled && config.motion.global.intensity !== "off" && !reducedMotion;
  const assetUrl = motionEnabled && loading.enabled ? loading.assetUrl : "";
  const videoUrl = assetUrl?.toLowerCase().split("?")[0].endsWith(".mp4") ? assetUrl : "";

  useEffect(() => {
    setAssetReady(false);
    setAssetFailed(false);
    if (!videoUrl) return;
    const timeout = window.setTimeout(() => setAssetFailed(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [videoUrl]);

  const configuredPreset = loading.enabled ? loading.preset : "none";
  const preset = motionEnabled ? configuredPreset : "none";
  const duration = loading.durationMs;
  return (
    <div className="runtime-loading" role="status" aria-live="polite">
      {videoUrl && !assetFailed ? (
        <video
          className="runtime-loading-video"
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          onCanPlay={() => setAssetReady(true)}
          onError={() => setAssetFailed(true)}
          style={{ visibility: assetReady ? "visible" : "hidden" }}
        />
      ) : null}
      {(!videoUrl || assetFailed || !assetReady) &&
        (preset === "none" ? (
          <VeloriLoop />
        ) : (
          <span
            className={`motion-loader-mark motion-loader-${preset}`}
            data-motion-preset={preset}
            style={{ "--motion-duration": `${duration}ms` } as CSSProperties}
            aria-hidden="true"
          />
        ))}
      <p>{loading.message || label}</p>
    </div>
  );
}

export function Problem({
  message,
  retry,
  diagnostic,
}: {
  message: string;
  retry?: () => void;
  diagnostic?: string;
}) {
  const settings = useSiteSettings();
  const motion = useMotionPresentation("CONTENT_UNAVAILABLE");
  const page = motion.page;
  const experience = motion.experience?.error?.enabled ? motion.experience.error : undefined;
  const errorPreset = motion.preset;
  return (
    <div
      className="problem"
      role="alert"
      style={
        experience?.backgroundColor ? { backgroundColor: experience.backgroundColor } : undefined
      }
    >
      <span className="problem-art">
        {experience?.assetUrl ||
        page?.illustrationUrl ||
        motion.animation?.assetUrl ||
        settings.error_animation_url ? (
          <ErrorArtwork
            animated={motion.animation?.enabled === true}
            assetUrl={
              experience?.assetUrl ||
              page?.illustrationUrl ||
              motion.animation?.assetUrl ||
              settings.error_animation_url
            }
            alt=""
            preset={errorPreset}
            duration={motion.duration}
          />
        ) : (
          <span className="problem-recovery-icon" aria-hidden="true">
            <RefreshCw size={24} />
          </span>
        )}
      </span>
      <span className="problem-dot" />
      <div>
        <strong>{experience?.title || page?.title || "We couldn't load this right now."}</strong>
        <p>{experience?.message || page?.subtitle || message}</p>
        {diagnostic && import.meta.env.DEV && (
          <details className="problem-diagnostic">
            <summary>Technical details</summary>
            <pre>{diagnostic}</pre>
          </details>
        )}
      </div>
      {experience?.actionUrl || page?.primaryUrl ? (
        <a
          className="button button-soft"
          href={experience?.actionUrl || page?.primaryUrl}
          rel={
            /^https:/i.test(experience?.actionUrl || page?.primaryUrl || "")
              ? "noreferrer"
              : undefined
          }
        >
          {experience?.actionLabel || page?.primaryLabel || "Continue"}
        </a>
      ) : null}
      {!experience?.actionUrl && !page?.primaryUrl && retry ? (
        <button className="button button-soft" onClick={retry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function NotFound({
  previewConfig,
  previewPathname,
  previewDevice,
  preview = false,
}: {
  previewConfig?: unknown;
  previewPathname?: string;
  previewDevice?: "desktop" | "tablet" | "mobile";
  preview?: boolean;
} = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const settings = useSiteSettings();
  const motion = useMotionPresentation("NOT_FOUND", previewConfig, previewPathname, previewDevice);
  const page = motion.page?.enabled ? motion.page : undefined;
  const experience = motion.experience?.error?.enabled ? motion.experience.error : undefined;
  const errorPreset = motion.preset;
  return (
    <SystemStateFrame>
      <section
        className={`not-found motion-page motion-intensity-${motion.intensity} error-layout-${page?.layout || "centered"} error-align-${page?.alignment || "center"}`}
        data-motion-preset={errorPreset}
        style={{
          ...motion.style,
          ...(page?.backgroundColor ? { backgroundColor: page.backgroundColor } : {}),
          ...(experience?.backgroundColor ? { backgroundColor: experience.backgroundColor } : {}),
        }}
      >
        <div className="not-found-art">
          <ErrorArtwork
            animated={motion.animation?.enabled === true}
            assetUrl={
              experience?.assetUrl ||
              page?.illustrationUrl ||
              motion.animation?.assetUrl ||
              settings.error_animation_url
            }
            alt="A yellow robot sitting beneath a large 404 and the word Oops"
            preset={errorPreset}
            duration={motion.duration}
            preview={preview}
          />
        </div>
        {page?.logoUrl ? (
          <img
            className="error-page-logo"
            src={page.logoUrl}
            alt="VELORI"
            width="132"
            height="44"
            onError={(event) => event.currentTarget.remove()}
          />
        ) : null}
        <div className="eyebrow">A LITTLE DETOUR</div>
        <h1>{experience?.title || page?.title || "Page not found."}</h1>
        <p>
          {experience?.message ||
            page?.subtitle ||
            "The link might have changed, or the page may no longer be available. Let's get you somewhere good."}
        </p>
        <div className="action-row">
          {experience?.actionUrl || page?.primaryUrl ? (
            <a
              href={preview ? undefined : experience?.actionUrl || page?.primaryUrl}
              aria-disabled={preview}
              className="button button-primary"
            >
              {experience?.actionLabel || page?.primaryLabel || "Continue"}
            </a>
          ) : preview ? (
            <span className="button button-primary">
              <Home size={17} /> {page?.primaryLabel || "Go Home"}
            </span>
          ) : (
            <button
              type="button"
              className="button button-primary"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={17} /> {page?.primaryLabel || "Check again"}
            </button>
          )}
          {page?.secondaryUrl ? (
            <a
              href={preview ? undefined : page.secondaryUrl}
              aria-disabled={preview}
              className="button button-outline"
            >
              {page.secondaryLabel || "More information"}
            </a>
          ) : preview ? (
            <span className="button button-outline">
              <Search size={17} /> {page?.secondaryLabel || "Search VELORI"}
            </span>
          ) : (
            <Link to="/search" className="button button-outline">
              <Search size={17} /> {page?.secondaryLabel || "Search VELORI"}
            </Link>
          )}
          <button className="button button-quiet" disabled={preview} onClick={() => navigate(-1)}>
            <ArrowLeft size={17} /> Back
          </button>
          {!user && !preview ? (
            <>
              <Link to="/signup" className="button button-outline">
                Create account
              </Link>
              <Link to="/login" className="button button-quiet">
                Log in
              </Link>
            </>
          ) : null}
        </div>
        <p className="nf-footnote">404 · The good conversations are still here.</p>
      </section>
    </SystemStateFrame>
  );
}

export function Maintenance({
  previewConfig,
  previewPathname,
  previewDevice,
  preview = false,
  previewSettings,
}: {
  previewConfig?: unknown;
  previewPathname?: string;
  previewDevice?: "desktop" | "tablet" | "mobile";
  preview?: boolean;
  previewSettings?: Partial<import("../lib/site-settings").SiteSettings>;
} = {}) {
  const liveSettings = useSiteSettings();
  const settings = preview ? { ...liveSettings, ...previewSettings } : liveSettings;
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (!settings.maintenance_ends_at) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [settings.maintenance_ends_at]);
  const motion = useMotionPresentation(
    "MAINTENANCE",
    previewConfig,
    previewPathname,
    previewDevice,
  );
  const page = motion.page?.enabled ? motion.page : undefined;
  const experience = motion.experience?.maintenance?.enabled
    ? motion.experience.maintenance
    : undefined;
  const illustrationUrl =
    experience?.assetUrl ||
    page?.illustrationUrl ||
    settings.maintenance_animation_url ||
    motion.animation?.assetUrl ||
    undefined;
  const maintenanceEnd = settings.maintenance_ends_at
    ? Date.parse(settings.maintenance_ends_at)
    : Number.NaN;
  const remainingSeconds = Number.isFinite(maintenanceEnd)
    ? Math.max(0, Math.ceil((maintenanceEnd - clock) / 1000))
    : null;
  return (
    <SystemStateFrame>
      <section
        className={`maintenance-page motion-page motion-intensity-${motion.intensity} error-layout-${page?.layout || "centered"} error-align-${page?.alignment || "center"}`}
        data-motion-preset={motion.preset}
        style={{
          ...motion.style,
          ...(page?.backgroundColor ? { backgroundColor: page.backgroundColor } : {}),
          ...(experience?.backgroundColor ? { backgroundColor: experience.backgroundColor } : {}),
        }}
      >
        {page?.logoUrl ? (
          <img
            className="error-page-logo"
            src={page.logoUrl}
            alt="VELORI"
            width="132"
            height="44"
            onError={(event) => event.currentTarget.remove()}
          />
        ) : null}
        <div className="eyebrow">A MOMENT BEHIND THE SCENES</div>
        <div className="status-scope">
          {settings.maintenance_scope === "site"
            ? "Platform maintenance"
            : `Updating ${settings.maintenance_route || "this page"}`}
        </div>
        <h1>{experience?.title || page?.title || "A little pause. A better VELORI."}</h1>
        <p className="maintenance-lead">
          {experience?.message ||
            page?.subtitle ||
            "We’re taking a moment to make things better. Please check back shortly — we’ll bring this space back as soon as it’s ready."}
        </p>
        {remainingSeconds !== null && remainingSeconds > 0 ? (
          <p className="maintenance-countdown" role="timer" aria-live="off">
            Scheduled maintenance ends in{" "}
            {`${Math.floor(remainingSeconds / 3600)
              .toString()
              .padStart(2, "0")}:${Math.floor((remainingSeconds % 3600) / 60)
              .toString()
              .padStart(2, "0")}:${(remainingSeconds % 60).toString().padStart(2, "0")}`}
          </p>
        ) : null}
        <figure className="maintenance-figure">
          {illustrationUrl ? (
            <ErrorArtwork
              animated={motion.animation?.enabled === true}
              assetUrl={illustrationUrl}
              alt="VELORI maintenance illustration"
              preset={motion.preset}
              duration={motion.duration}
              preview={preview}
            />
          ) : (
            <StatusIllustration kind="maintenance" animated={motion.preset !== "none"} />
          )}
          <figcaption>A short intermission for your corner of the internet.</figcaption>
        </figure>
        <div className="action-row">
          {experience?.actionUrl || page?.primaryUrl ? (
            <a
              className="button button-primary"
              href={preview ? undefined : experience?.actionUrl || page?.primaryUrl}
              aria-disabled={preview}
            >
              {experience?.actionLabel || page?.primaryLabel || "Continue"}
            </a>
          ) : preview ? (
            <span className="button button-primary">
              <Home size={17} /> {page?.primaryLabel || "Go Home"}
            </span>
          ) : (
            <Link to="/home" className="button button-primary">
              <Home size={17} /> {page?.primaryLabel || "Go Home"}
            </Link>
          )}
          {page?.secondaryUrl ? (
            <a
              className="button button-outline"
              href={preview ? undefined : page.secondaryUrl}
              aria-disabled={preview}
            >
              {page.secondaryLabel || "More information"}
            </a>
          ) : preview ? (
            <span className="button button-outline">
              <Mail size={17} /> {page?.secondaryLabel || "Contact us"}
            </span>
          ) : (
            <Link to="/contact" className="button button-outline">
              <Mail size={17} /> {page?.secondaryLabel || "Contact us"}
            </Link>
          )}
        </div>
      </section>
    </SystemStateFrame>
  );
}

export function RouteError() {
  const error = useRouteError();
  const offline = navigator.onLine === false;
  const status = offline
    ? 408
    : isRouteErrorResponse(error)
      ? error.status
      : error instanceof DOMException && error.name === "AbortError"
        ? 408
        : error instanceof TypeError && /fetch|network/i.test(error.message)
          ? 503
          : 500;
  const title = offline
    ? "You’re offline."
    : status === 404
      ? "Page not found."
      : status === 401
        ? "Sign in to continue."
        : status === 403
          ? "You don't have access to this page."
          : status === 400
            ? "That request couldn't be understood."
            : status === 409
              ? "This page has changed."
              : status === 422
                ? "Some information needs attention."
                : status === 429
                  ? "You're doing that too often."
                  : status === 408
                    ? "That request took too long."
                    : status >= 500
                      ? "VELORI is having trouble."
                      : "We couldn't open this page.";
  const message = offline
    ? "Reconnect to Wi-Fi or mobile data, then try again. If you were submitting something, check whether it saved before resending."
    : status === 404
      ? "The link might have changed, or the page may no longer be available."
      : status === 401
        ? "Your session may have expired. Sign in and try again."
        : status === 403
          ? "Your account doesn't have permission to view this page."
          : status === 400
            ? "Please check the link or information and try again."
            : status === 409
              ? "The page may have changed while you were here. Reload and try again."
              : status === 422
                ? "Review the information and try again."
                : status === 429
                  ? "Please wait a moment before trying again."
                  : status === 408 || status === 503
                    ? "The service may be unavailable or your connection may have interrupted the request. Try again when you're connected."
                    : status === 502 || status === 504
                      ? "A connected service didn't respond in time. Please try again shortly."
                      : "This page ran into a problem. Please try again. If you were submitting something, check whether it saved before resending.";
  return <ErrorPage status={status} title={title} message={message} />;
}

export function ErrorPage({
  status,
  title,
  message,
  animated,
  previewConfig,
  previewPathname,
  previewDevice,
  errorTypeOverride,
  preview = false,
}: {
  status: number;
  title: string;
  message: string;
  animated?: boolean;
  previewConfig?: unknown;
  previewPathname?: string;
  previewDevice?: "desktop" | "tablet" | "mobile";
  errorTypeOverride?: string;
  preview?: boolean;
}) {
  const errorType =
    errorTypeOverride ??
    (status === 404
      ? "NOT_FOUND"
      : status === 401
        ? "AUTH_FAILURE"
        : status === 403
          ? "FORBIDDEN"
          : status === 429
            ? "RATE_LIMITED"
            : status === 502
              ? "BAD_GATEWAY"
              : status === 408 || status === 504
                ? "OFFLINE"
                : status === 503
                  ? "SERVICE_UNAVAILABLE"
                  : "SERVER_ERROR");
  const motion = useMotionPresentation(errorType, previewConfig, previewPathname, previewDevice);
  const page = motion.page?.enabled ? motion.page : undefined;
  const experience = motion.experience?.error?.enabled ? motion.experience.error : undefined;
  const errorPreset = motion.preset;
  return (
    <SystemStateFrame>
      <section
        className={`not-found motion-page motion-intensity-${motion.intensity} error-layout-${page?.layout || "centered"} error-align-${page?.alignment || "center"}`}
        data-motion-preset={errorPreset}
        style={{
          ...motion.style,
          ...(page?.backgroundColor ? { backgroundColor: page.backgroundColor } : {}),
          ...(experience?.backgroundColor ? { backgroundColor: experience.backgroundColor } : {}),
        }}
        role="alert"
      >
        <div className="not-found-art">
          {experience?.assetUrl || page?.illustrationUrl || motion.animation?.assetUrl ? (
            <ErrorArtwork
              animated={animated ?? motion.animation?.enabled === true}
              assetUrl={
                experience?.assetUrl || page?.illustrationUrl || motion.animation?.assetUrl || null
              }
              alt="VELORI service illustration"
              preset={errorPreset}
              duration={motion.duration}
              preview={preview}
            />
          ) : (
            <StatusIllustration
              kind={
                errorType === "OFFLINE"
                  ? "offline"
                  : status === 404
                    ? "missing"
                    : status === 401 || status === 403
                      ? "locked"
                      : "error"
              }
              animated={animated !== false && motion.preset !== "none"}
            />
          )}
        </div>
        <div className="eyebrow">VELORI · ERROR {status}</div>
        <h1>{experience?.title || page?.title || title}</h1>
        <p>{experience?.message || page?.subtitle || message}</p>
        <div className="action-row">
          {experience?.actionUrl || page?.primaryUrl ? (
            <a
              className="button button-primary"
              href={preview ? undefined : experience?.actionUrl || page?.primaryUrl}
              aria-disabled={preview}
              rel={
                /^https:/i.test(experience?.actionUrl || page?.primaryUrl || "")
                  ? "noreferrer"
                  : undefined
              }
            >
              {experience?.actionLabel || page?.primaryLabel || "Continue"}
            </a>
          ) : (
            <button
              className="button button-primary"
              disabled={preview}
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={17} /> {page?.primaryLabel || "Try again"}
            </button>
          )}
          {page?.secondaryUrl ? (
            <a
              className="button button-outline"
              href={preview ? undefined : page.secondaryUrl}
              aria-disabled={preview}
              rel={/^https:/i.test(page.secondaryUrl) ? "noreferrer" : undefined}
            >
              {page.secondaryLabel || "More information"}
            </a>
          ) : (
            <a
              href={preview ? undefined : status === 401 ? "/login" : "/home"}
              aria-disabled={preview}
              className="button button-outline"
            >
              {status === 401 && !page?.secondaryLabel ? <LogIn size={17} /> : <Home size={17} />}
              {page?.secondaryLabel || (status === 401 ? "Sign in" : "Go Home")}
            </a>
          )}
        </div>
      </section>
    </SystemStateFrame>
  );
}
