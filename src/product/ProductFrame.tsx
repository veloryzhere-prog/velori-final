import { InformationFooter } from "../features/information/InformationPage";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate, useNavigation } from "react-router";
import {
  House,
  Compass,
  Clapperboard,
  MessageCircle,
  Bell,
  Users,
  Bookmark,
  Settings,
  HelpCircle,
  UserRound,
  Plus,
  Search,
  Menu,
  LogOut,
  ArrowUpRight,
  ImagePlus,
  Camera,
  Film,
  Code2,
  BookOpen,
  CreditCard,
} from "lucide-react";
import { Dialog } from "../components/ui";
type Item = {
  route: string;
  label: string;
  visible?: boolean;
  desktop_visible?: boolean;
  mobile_visible?: boolean;
};
type Identity = {
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
} | null;
const iconFor = (route: string) =>
  route.startsWith("/profile")
    ? UserRound
    : {
        "/home": House,
        "/explore": Compass,
        "/search": Search,
        "/reels": Clapperboard,
        "/messages": MessageCircle,
        "/notifications": Bell,
        "/groups": Users,
        "/saved": Bookmark,
        "/settings": Settings,
        "/help": HelpCircle,
        "/forge": Code2,
        "/forge-docs": BookOpen,
        "/forge-pricing": CreditCard,
        "/forge-payments": CreditCard,
      }[route] || Compass;
export function ProductFrame({
  children,
  items,
  profile,
  messages,
  notifications,
  onSignOut,
  signOutError,
  theme,
  stories,
  reels,
  online,
  messagingEnabled,
  notificationsEnabled,
}: {
  children: ReactNode;
  items: Item[];
  profile: Identity;
  messages: number;
  notifications: number;
  onSignOut: () => void;
  signOutError: string;
  theme: ReactNode;
  stories: boolean;
  reels: boolean;
  online: boolean;
  messagingEnabled: boolean;
  notificationsEnabled: boolean;
}) {
  const location = useLocation(),
    navigate = useNavigate();
  const navigation = useNavigation();
  const routeContent = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState(false),
    [create, setCreate] = useState(false),
    [query, setQuery] = useState("");
  const menuTrigger = useRef<HTMLButtonElement>(null),
    createTrigger = useRef<HTMLButtonElement>(null),
    headerCreateTrigger = useRef<HTMLButtonElement>(null),
    mobileCreateTrigger = useRef<HTMLButtonElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  const createOrigin = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    setMenu(false);
    setCreate(false);
  }, [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !(
          target instanceof HTMLElement &&
          (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)
        )
      ) {
        e.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const destination = (route: string) =>
    route === "/profile"
      ? profile
        ? "/profile/" + encodeURIComponent(profile.username)
        : "/settings/account"
      : route;
  const renderLink = (item: Item) => {
    const Icon = iconFor(item.route);
    const count =
      item.route === "/messages" ? messages : item.route === "/notifications" ? notifications : 0;
    return (
      <NavLink
        key={item.route}
        to={destination(item.route)}
        end={item.route === "/home"}
        aria-label={item.label}
        className={({ isActive }) => "v-nav-link" + (isActive ? " is-active" : "")}
      >
        <Icon size={21} />
        <span>{item.label}</span>
        {count > 0 && <b aria-label={count + " unread"}>{count > 99 ? "99+" : count}</b>}
      </NavLink>
    );
  };
  const nav = items.filter((x) => x.visible !== false);
  if (!nav.some((item) => item.route === "/search"))
    nav.splice(2, 0, { route: "/search", label: "Search" });
  const mobile = ["/home", "/explore", "/messages", "/profile"]
    .map((route) => nav.find((x) => x.route === route && x.mobile_visible !== false))
    .filter((x): x is Item => Boolean(x));
  const utility = [
    { route: "/forge", label: "Forge AI" },
    { route: "/saved", label: "Saved" },
    { route: "/settings", label: "Settings" },
    { route: "/help", label: "Help & support" },
  ].filter((x) => !nav.some((y) => y.route === x.route));
  const forgeLinks = [
    { route: "/forge-docs", label: "User guide" },
    { route: "/forge-pricing", label: "Plans & pricing" },
    { route: "/forge-payments", label: "Payments & billing" },
  ];
  return (
    <div
      className="v-product"
      data-release="32"
      data-immersive={["/create", "/stories/create", "/reels/create", "/reels"].includes(
        location.pathname,
      )}
      data-view={location.pathname.split("/")[1] || "home"}
    >
      <a
        className="v-skip-link"
        href="#velori-content"
        onClick={(event) => {
          event.preventDefault();
          routeContent.current?.focus();
          routeContent.current?.scrollIntoView({ block: "start" });
        }}
      >
        Skip to content
      </a>

      <aside className="v-sidebar">
        <Link className="v-wordmark" to="/home">
          <span className="v-brand-mark">
            <img src="/velori-wing-mark.png" alt="" />
          </span>
          VELORI
        </Link>
        <span className="v-nav-caption">YOUR EVERYDAY</span>
        <nav aria-label="Primary navigation">
          {nav.filter((x) => x.desktop_visible !== false).map(renderLink)}
        </nav>
        <button
          className="v-compose-button"
          ref={createTrigger}
          onClick={() => {
            createOrigin.current = createTrigger.current;
            setCreate(true);
          }}
        >
          <Plus size={19} />
          Create something
        </button>
        <div className="v-sidebar-bottom">
          <span className="v32-release">VELORI · V33</span>
          <nav aria-label="Account navigation">{utility.map(renderLink)}</nav>
          <details className="v-forge-resources">
            <summary>Forge resources</summary>
            <nav aria-label="Forge resources">{forgeLinks.map(renderLink)}</nav>
          </details>
          <button className="v-signout" onClick={onSignOut}>
            <LogOut size={18} />
            Sign out
          </button>
          {signOutError && <p role="alert">{signOutError}</p>}
          <Link className="v-self" to={destination("/profile")}>
            <span className="v-avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                (profile?.display_name || profile?.username || "V").slice(0, 1)
              )}
            </span>
            <span>
              <strong>{profile?.display_name || "Your profile"}</strong>
              <small>{profile ? "@" + profile.username : "Account settings"}</small>
            </span>
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </aside>
      <div className="v-main-column">
        <header className="v-app-header">
          {navigation.state !== "idle" && (
            <span className="v-route-progress" role="progressbar" aria-label="Loading page" />
          )}
          <button
            ref={menuTrigger}
            className="v-mobile-menu v-icon"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={21} />
          </button>
          <Link className="v-mobile-wordmark" to="/home">
            <img src="/velori-wing-mark.png" alt="" />
            VELORI
          </Link>
          <form
            className="v-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/search?q=" + encodeURIComponent(query.trim()));
            }}
          >
            <Search size={18} />
            <input
              ref={searchInput}
              aria-label="Search VELORI"
              placeholder="Search people, ideas, moments…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>/</kbd>
          </form>
          <div className="v-header-actions">
            <NavLink className="v-icon v-top-home" to="/home" aria-label="Home">
              <House size={21} />
            </NavLink>
            <Link className="v-forge-shortcut" to="/forge">
              <Code2 size={16} />
              Forge AI
            </Link>
            <div className="v-header-theme">{theme}</div>
            <button
              ref={headerCreateTrigger}
              className="v-icon v-header-create"
              aria-label="Create a post, reel or story"
              onClick={() => {
                createOrigin.current = headerCreateTrigger.current;
                setCreate(true);
              }}
            >
              <Plus size={22} />
            </button>
            {notificationsEnabled && (
              <Link
                className="v-icon"
                to="/notifications"
                aria-label={
                  notifications ? "Notifications, " + notifications + " unread" : "Notifications"
                }
              >
                <Bell size={21} />
                {notifications > 0 && (
                  <b className="v-unread-count" aria-hidden="true">
                    {notifications > 99 ? "99+" : notifications}
                  </b>
                )}
              </Link>
            )}
            {messagingEnabled && (
              <Link
                className="v-icon v-header-chat"
                to="/messages"
                aria-label={messages ? "Messages, " + messages + " unread" : "Messages"}
              >
                <MessageCircle size={21} />
                {messages > 0 && (
                  <b className="v-unread-count" aria-hidden="true">
                    {messages > 99 ? "99+" : messages}
                  </b>
                )}
              </Link>
            )}
            {reels && (
              <Link className="v-icon" to="/reels" aria-label="Watch Reels">
                <Clapperboard size={21} />
              </Link>
            )}
            <Link className="v-avatar" to={destination("/profile")} aria-label="Your profile">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                (profile?.display_name || "V").slice(0, 1)
              )}
            </Link>
          </div>
        </header>
        {!online && (
          <p className="v-offline" role="status">
            You’re offline. Reconnect to save changes.
          </p>
        )}
        <main
          id="velori-content"
          ref={routeContent}
          tabIndex={-1}
          className="v-route-content"
          aria-busy={navigation.state !== "idle"}
        >
          {children}
        </main>
        <div className="v-app-footer">
          <InformationFooter compact />
        </div>
      </div>
      <nav className="v-mobile-dock" aria-label="Mobile navigation">
        {mobile.slice(0, 2).map(renderLink)}
        <button
          ref={mobileCreateTrigger}
          className="v-dock-create"
          aria-label="Create something"
          onClick={() => {
            createOrigin.current = mobileCreateTrigger.current;
            setCreate(true);
          }}
        >
          <Plus size={24} />
        </button>
        {mobile.slice(2).map(renderLink)}
      </nav>
      {menu && (
        <Dialog
          open
          title="Your VELORI"
          description="Find your way around."
          onClose={() => {
            setMenu(false);
            menuTrigger.current?.focus();
          }}
          className="v-navigation-dialog"
        >
          <nav>
            {nav.filter((x) => x.mobile_visible !== false).map(renderLink)}
            {utility.map(renderLink)}
          </nav>
          <div className="v-mobile-resources">
            <strong>Make more with Forge</strong>
            <p>Your AI workspace, guides and account information.</p>
            <nav aria-label="Forge resources">{forgeLinks.map(renderLink)}</nav>
          </div>
          <div className="v-menu-appearance">
            <span>Appearance</span>
            {theme}
          </div>
          <button className="v-signout" onClick={onSignOut}>
            <LogOut size={18} />
            Sign out
          </button>
          {signOutError && <p role="alert">{signOutError}</p>}
        </Dialog>
      )}
      {create && (
        <Dialog
          open
          title="What will you share?"
          description="Start with a format. Make it yours."
          onClose={() => {
            setCreate(false);
            createOrigin.current?.focus();
          }}
          className="v-create-dialog"
        >
          <div className="v-create-options">
            {[
              {
                to: "/create",
                label: "Post",
                text: "A thought, a photo, a new perspective.",
                icon: ImagePlus,
              },
              ...(reels
                ? [
                    {
                      to: "/reels/create",
                      label: "Reel",
                      text: "Bring your ideas to life in motion.",
                      icon: Film,
                    },
                  ]
                : []),
              ...(stories
                ? [
                    {
                      to: "/stories/create",
                      label: "Story",
                      text: "The little moments of your day.",
                      icon: Camera,
                    },
                  ]
                : []),
            ].map(({ to, label, text, icon: Icon }) => (
              <Link key={to} to={to}>
                <span>
                  <Icon size={25} />
                </span>
                <div>
                  <strong>{label}</strong>
                  <small>{text}</small>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </div>
          <Link className="v-drafts-link" to="/drafts">
            Continue a saved draft <ArrowUpRight size={16} />
          </Link>
        </Dialog>
      )}
    </div>
  );
}
