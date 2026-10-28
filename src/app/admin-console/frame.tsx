import { AdminWorkspace } from "./AdminWorkspace";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NavLink, Navigate, useLocation } from "react-router";
import {
  Building2,
  ChevronDown,
  FileText,
  LogOut,
  Megaphone,
  Plus,
  Shield,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { changeAdminCredentials, updateAdminProfile } from "../../lib/admin-api";
import { Button, Input, Label } from "./primitives";
import { AnimatedOutlet } from "../../lib/motion";
import {
  AdminSessionProvider,
  submitPassword,
  useAdminSession,
  usePermission,
  usePermissions,
  useReauth,
  type ReauthHandle,
} from "./session";
import { ConsoleSearch } from "./search";
import { ConsoleSidebar, AdminLogo, AREAS, GROUPS, adminHome } from "./navigation";
import { areaDestination } from "./tools.mjs";
import { Dialog, ReauthDialog, describe } from "./widgets";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrator",
  admin: "Administrator",
  moderator: "Moderator",
  content_manager: "Content manager",
  support: "Support",
};

const ReauthContext = createContext<ReauthHandle | null>(null);

/** Client-side reachability gate for one console screen. The server enforces the
 * permission on every request, so this only avoids showing a screen that cannot
 * work — it is not the control. */
export function RequirePermission({ anyOf, children }: { anyOf: string[]; children: ReactNode }) {
  const granted = usePermissions();
  const allowed = anyOf.length === 0 || anyOf.some((permission) => granted.has(permission));
  if (!allowed) {
    return (
      <div className="admin-card">
        <p className="admin-denied" role="alert">
          Your role does not include access to this screen. Contact an administrator if you need
          access.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

/** Wraps a screen body: enforces its permissions and hands it the shared reauth
 * dialog, so no screen has to own that state. */
export function ConsoleScreen({ anyOf, children }: { anyOf: string[]; children: ReactNode }) {
  const reauth = useContext(ReauthContext);
  if (!reauth) {
    throw new Error("ConsoleScreen must be rendered inside the administrator console.");
  }
  return (
    <RequirePermission anyOf={anyOf}>
      <AdminWorkspace>{children}</AdminWorkspace>
    </RequirePermission>
  );
}

export function useScreenReauth(): ReauthHandle {
  const value = useContext(ReauthContext);
  if (!value) throw new Error("useScreenReauth must be used inside a ConsoleScreen.");
  return value;
}

function ForcedPasswordChange() {
  const { reload, signOut, error: sessionError } = useAdminSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = confirmPassword.length > 0 && nextPassword !== confirmPassword;

  return (
    <div className="admin-login-page">
      <div className="admin-login-panel">
        <AdminLogo />
        <div className="admin-login-heading">
          <h1>Choose a new administrator password</h1>
          <p>
            This account was created with a temporary password. Set your own before anything else in
            the console will load.
          </p>
        </div>
        <form
          className="admin-login-card"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            if (mismatch) {
              setError("The two passwords do not match.");
              return;
            }
            setBusy(true);
            void changeAdminCredentials({
              currentPassword,
              password: nextPassword,
              confirmation: confirmPassword,
            })
              .then(() => reload())
              .catch((caught: unknown) => setError(describe(caught)))
              .finally(() => setBusy(false));
          }}
        >
          {error || sessionError ? (
            <p className="admin-alert" role="alert">
              {error || sessionError}
            </p>
          ) : null}
          <Label>
            Temporary password
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword((event.target as HTMLInputElement).value)}
            />
          </Label>
          <Label>
            New password
            <Input
              type="password"
              autoComplete="new-password"
              value={nextPassword}
              onChange={(event) => setNextPassword((event.target as HTMLInputElement).value)}
            />
          </Label>
          <Label>
            Confirm new password
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword((event.target as HTMLInputElement).value)}
            />
          </Label>
          <p className="admin-security-note">
            At least 12 characters. Changing this password signs out every console session,
            including this one.
          </p>
          <div className="admin-form-actions">
            <Button
              type="submit"
              className="admin-primary"
              disabled={busy || mismatch || !currentPassword || nextPassword.length < 12}
            >
              {busy ? "Saving…" : "Set password and continue"}
            </Button>
            <Button type="button" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AccountPanel({ onClose }: { onClose: () => void }) {
  const { me, reload, signOut, error: sessionError } = useAdminSession();
  const [displayName, setDisplayName] = useState(me?.displayName ?? "");
  const [jobTitle, setJobTitle] = useState(me?.jobTitle ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.displayName ?? "");
    setJobTitle(me.jobTitle ?? "");
    setBio(me.bio ?? "");
  }, [me]);

  if (!me) return null;

  return (
    <Dialog
      title="Your administrator account"
      description={me.username}
      onClose={onClose}
      closeLabel="Close"
    >
      <dl className="admin-info-list">
        <dt>Role</dt>
        <dd>{ROLE_LABELS[me.roleKey] ?? me.roleKey}</dd>
        <dt>Session expires</dt>
        <dd>{new Date(me.sessionExpiresAt).toLocaleString()}</dd>
        <dt>Permissions granted</dt>
        <dd>{me.permissions.length}</dd>
      </dl>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          void updateAdminProfile({ displayName, jobTitle, bio })
            .then(() => reload())
            .catch((caught: unknown) => setError(describe(caught)))
            .finally(() => setBusy(false));
        }}
      >
        {error || sessionError ? (
          <p className="admin-alert" role="alert">
            {error || sessionError}
          </p>
        ) : null}
        <Label>
          Display name
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </Label>
        <Label>
          Job title
          <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
        </Label>
        <Label>
          Bio
          <Input value={bio} onChange={(event) => setBio(event.target.value)} />
        </Label>
        <div className="admin-form-actions">
          <Button type="submit" className="admin-primary" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </Button>
          <Button type="button" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ConsoleFrame() {
  const { me, loading, error, signOut } = useAdminSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [reauthBusy, setReauthBusy] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("velori.admin.sidebarCollapsed") === "true";
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const reauth = useReauth();
  // `/admin/search` is behind `users.view` on the server, so the field is not
  // drawn for a role that would only get a 403 from it.
  const canSearch = usePermission("users.view");
  const permissions = usePermissions();
  const home = adminHome(permissions);
  const canCreateAnnouncement = usePermission("notifications.edit");
  const canCreateAd = usePermission("ads.edit");
  const canCreatePage = usePermission("cms.edit");
  const canViewSettings = usePermission("settings.view");
  const menuBoundary = useRef<HTMLDivElement>(null);

  const pageTitle = useMemo(() => {
    if (location.pathname.startsWith("/admin/pages/")) return "Page studio";
    const routeNames: Record<string, string> = {
      "/admin/dashboard": "Dashboard",
      "/admin/users": "Users",
      "/admin/people": "Users",
      "/admin/analytics": "Dashboard",
      "/admin/groups": "Groups",
      "/admin/reports": "Reports",
      "/admin/posts": "Posts",
      "/admin/reels": "Reels",
      "/admin/stories": "Stories",
      "/admin/comments": "Comments",
      "/admin/messages": "Message reports",
      "/admin/cms": "Pages",
      "/admin/content": "Pages",
      "/admin/website/pages": "Pages",
      "/admin/website/navigation": "Navigation",
      "/admin/website/footer": "Footer navigation",
      "/admin/website/seo": "Routes & SEO",
      "/admin/website/about": "About page",
      "/admin/website/contact": "Contact page",
      "/admin/website/help": "Help page",
      "/admin/website/terms": "Terms page",
      "/admin/website/privacy": "Privacy page",
      "/admin/announcements": "Announcements",
      "/admin/communication": "Announcements",
      "/admin/notifications": "Notifications",
      "/admin/ads": "Advertisements",
      "/admin/website": "Website overview",
      "/admin/navigation": "Navigation",
      "/admin/branding": "Brand assets",
      "/admin/brand": "Brand assets",
      "/admin/brand-assets": "Brand assets",
      "/admin/theme": "Appearance",
      "/admin/motion": "Motion",
      "/admin/creator-control-center": "Creator Control Center",
      "/admin/creator-manager": "Creator Control Center",
      "/admin/manage-creators": "Creator Control Center",
      "/admin/studio-catalog": "Creator Control Center",
      "/admin/error-pages": "Error pages",
      "/admin/errors": "Error pages",
      "/admin/routes": "Routes & SEO",
      "/admin/moderation": "Reports",
      "/admin/settings": "Settings",
      "/admin/maintenance": "Maintenance",
      "/admin/feature-flags": "Features",
      "/admin/system": "System health",
      "/admin/admins": "Administrators",
      "/admin/roles": "Roles & access",
      "/admin/sessions": "Sessions",
      "/admin/security": "Security",
      "/admin/audit": "Audit log",
      "/admin/emails": "Email",
      "/admin/provisioning": "Provisioning",
    };
    return routeNames[location.pathname] ?? "Administration";
  }, [location.pathname]);
  const pageArea = useMemo(() => {
    const path = location.pathname;
    if (
      path.startsWith("/admin/pages/") ||
      path.startsWith("/admin/cms") ||
      path === "/admin/content"
    )
      return { label: "Content Studio", to: "/admin/cms" };
    if (
      ["/admin/announcements", "/admin/communication", "/admin/notifications"].some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      )
    )
      return { label: "Communications", to: "/admin/announcements" };
    if (path === "/admin/ads" || path.startsWith("/admin/ads/"))
      return { label: "Monetization", to: "/admin/ads" };
    if (
      [
        "/admin/users",
        "/admin/people",
        "/admin/groups",
        "/admin/posts",
        "/admin/reels",
        "/admin/stories",
        "/admin/comments",
        "/admin/reports",
        "/admin/messages",
      ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    )
      return { label: "Social", to: "/admin/users" };
    if (
      [
        "/admin/admins",
        "/admin/roles",
        "/admin/sessions",
        "/admin/security",
        "/admin/audit",
        "/admin/provisioning",
      ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    )
      return { label: "Administration", to: "/admin/admins" };
    if (
      [
        "/admin/system",
        "/admin/settings",
        "/admin/maintenance",
        "/admin/feature-flags",
        "/admin/emails",
      ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    )
      return { label: "System", to: "/admin/system" };
    return { label: "Site", to: "/admin/website" };
  }, [location.pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
    setProfileMenuOpen(false);
    setQuickCreateOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = document.querySelector<HTMLElement>(".admin-sidebar.is-open");
    const focusable = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
    const frame = window.requestAnimationFrame(() => focusable()[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!profileMenuOpen && !quickCreateOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!menuBoundary.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
        setQuickCreateOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setProfileMenuOpen(false);
      setQuickCreateOpen(false);
      requestAnimationFrame(() => {
        menuBoundary.current
          ?.querySelector<HTMLButtonElement>(
            profileMenuOpen ? ".admin-profile-button" : ".admin-quick-create-button",
          )
          ?.focus();
      });
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [profileMenuOpen, quickCreateOpen]);

  useEffect(() => {
    if (reauth.prompting) setReauthError(null);
  }, [reauth.prompting]);

  useEffect(() => {
    try {
      localStorage.setItem("velori.admin.sidebarCollapsed", String(sidebarCollapsed));
    } catch {
      /* Optional layout preference. */
    }
  }, [sidebarCollapsed]);

  const roleLabel = useMemo(() => (me ? (ROLE_LABELS[me.roleKey] ?? me.roleKey) : ""), [me]);

  if (loading) {
    return (
      <p className="admin-loading" role="status" aria-live="polite">
        Loading the administrator console…
      </p>
    );
  }

  if (error && !me) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-card-heading">
            <h1>The console could not load</h1>
            <p>{error}</p>
          </div>
          <div className="admin-form-actions">
            <Button
              type="button"
              className="admin-primary"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!me) return <Navigate to="/admin/login" replace />;
  if (me.mustChangePassword) {
    return (
      <>
        {error ? (
          <p className="admin-alert" role="alert">
            {error}
          </p>
        ) : null}
        <ForcedPasswordChange />
      </>
    );
  }

  return (
    <ReauthContext.Provider value={reauth}>
      <div className={`admin-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
        <a className="admin-skip-link" href="#admin-main-content">
          Skip to workspace
        </a>
        {error ? (
          <p className="admin-alert" role="alert">
            {error}
          </p>
        ) : null}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-mobile-menu-button"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMobileNavOpen((value) => !value)}
            >
              {mobileNavOpen ? (
                <X aria-hidden="true" />
              ) : (
                <span className="admin-menu-lines" aria-hidden="true" />
              )}
            </button>
            <div className="admin-page-context">
              <nav aria-label="Breadcrumb" className="admin-breadcrumbs">
                <NavLink to={home}>
                  {home === "/admin/dashboard" ? "Command Center" : "Workspace home"}
                </NavLink>
                {location.pathname !== "/admin/dashboard" ? (
                  <>
                    <span aria-hidden="true">/</span>
                    <NavLink
                      to={
                        areaDestination(
                          AREAS.find((area) => area.label === pageArea.label)!,
                          GROUPS,
                          permissions,
                        ) ?? home
                      }
                    >
                      {pageArea.label}
                    </NavLink>
                    <span aria-hidden="true">/</span>
                    <strong>{pageTitle}</strong>
                  </>
                ) : null}
              </nav>
            </div>
          </div>
          <div className="admin-topbar-search">
            <ConsoleSearch canSearchRecords={canSearch} />
          </div>
          <div className="admin-topbar-right" ref={menuBoundary}>
            {canCreateAnnouncement || canCreateAd || canCreatePage ? (
              <div className="admin-topbar-menu-wrap">
                <button
                  type="button"
                  className="admin-quick-create-button"
                  aria-expanded={quickCreateOpen}
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setQuickCreateOpen((value) => !value);
                  }}
                >
                  <Plus aria-hidden="true" />
                  <span>Create</span>
                  <ChevronDown aria-hidden="true" />
                </button>
                {quickCreateOpen ? (
                  <div
                    className="admin-topbar-popover admin-create-popover"
                    aria-label="Create something"
                  >
                    {canCreateAnnouncement ? (
                      <NavLink
                        to="/admin/announcements?create=1"
                        onClick={() => setQuickCreateOpen(false)}
                      >
                        <Megaphone aria-hidden="true" /> Create announcement
                      </NavLink>
                    ) : null}
                    {canCreateAd ? (
                      <NavLink to="/admin/ads?create=1" onClick={() => setQuickCreateOpen(false)}>
                        <Building2 aria-hidden="true" /> Create advertisement
                      </NavLink>
                    ) : null}
                    {canCreatePage ? (
                      <NavLink to="/admin/cms?create=1" onClick={() => setQuickCreateOpen(false)}>
                        <FileText aria-hidden="true" /> Create page
                      </NavLink>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="admin-topbar-menu-wrap">
              <button
                type="button"
                className="admin-profile-button"
                aria-expanded={profileMenuOpen}
                aria-label={`Administrator menu for ${me.displayName || me.username}`}
                onClick={() => {
                  setQuickCreateOpen(false);
                  setProfileMenuOpen((value) => !value);
                }}
              >
                <span className="admin-profile-avatar" aria-hidden="true">
                  {(me.displayName || me.username || "A").slice(0, 1).toUpperCase()}
                </span>
                <span className="admin-profile-copy">
                  <strong>{me.displayName || me.username}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
              {profileMenuOpen ? (
                <div
                  className="admin-topbar-popover admin-profile-popover"
                  aria-label="Administrator account"
                >
                  <div className="admin-profile-summary">
                    <strong>{me.displayName || me.username}</strong>
                    <span>{roleLabel}</span>
                    <small>@{me.username}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(true);
                      setProfileMenuOpen(false);
                    }}
                  >
                    <Users aria-hidden="true" /> Account details
                  </button>
                  <NavLink to="/admin/security" onClick={() => setProfileMenuOpen(false)}>
                    <Shield aria-hidden="true" /> Security
                  </NavLink>
                  {canViewSettings ? (
                    <NavLink to="/admin/settings" onClick={() => setProfileMenuOpen(false)}>
                      <SlidersHorizontal aria-hidden="true" /> Settings
                    </NavLink>
                  ) : null}
                  <button type="button" className="is-danger" onClick={() => void signOut()}>
                    <LogOut aria-hidden="true" /> Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="admin-workspace">
          {mobileNavOpen ? (
            <div
              className="admin-mobile-nav-scrim"
              role="presentation"
              onClick={() => setMobileNavOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Administration navigation"
                onClick={(event) => event.stopPropagation()}
              >
                <ConsoleSidebar
                  onNavigate={() => setMobileNavOpen(false)}
                  open
                  onClose={() => setMobileNavOpen(false)}
                  collapsed={false}
                  onCollapseToggle={() => undefined}
                  onAccount={() => setAccountOpen(true)}
                />
              </div>
            </div>
          ) : (
            <ConsoleSidebar
              collapsed={sidebarCollapsed}
              onCollapseToggle={() => setSidebarCollapsed((v) => !v)}
              onAccount={() => setAccountOpen(true)}
            />
          )}

          <main className="admin-main" id="admin-main-content" tabIndex={-1}>
            <AnimatedOutlet />
          </main>
        </div>

        {accountOpen ? <AccountPanel onClose={() => setAccountOpen(false)} /> : null}

        {reauth.prompting ? (
          <ReauthDialog
            busy={reauthBusy}
            error={reauthError}
            onClose={() => {
              setReauthError(null);
              reauth.resolve(false);
            }}
            onConfirm={(password) => {
              setReauthBusy(true);
              setReauthError(null);
              void submitPassword(password)
                .then(() => reauth.resolve(true))
                .catch((caught: unknown) => setReauthError(describe(caught)))
                .finally(() => setReauthBusy(false));
            }}
          />
        ) : null}
      </div>
    </ReauthContext.Provider>
  );
}

/** `/admin` has no screen of its own; the console opens on the dashboard. */
export function ConsoleIndex() {
  const permissions = usePermissions();
  return <Navigate to={adminHome(permissions)} replace />;
}

/** Mounted once, at the console layout route. */
export function AdminConsoleLayout() {
  return (
    <AdminSessionProvider>
      <ConsoleFrame />
    </AdminSessionProvider>
  );
}

export { ConsoleFrame };
