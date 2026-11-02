import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import {
  ArrowUpRight,
  Building2,
  Code2,
  Compass,
  Mail,
  Menu,
  Scale,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { informationPages } from "../../features/information/catalog";
import {
  companyNavigation,
  companyPathForRoute,
  type CompanyNavigationGroup,
} from "./companyNavigation";
import "./company.css";

const InformationPage = lazy(async () => {
  const { PublicPage } = await import("../../app/views");
  return { default: PublicPage };
});

const groupIcons: Record<CompanyNavigationGroup["icon"], LucideIcon> = {
  sparkles: Sparkles,
  building: Building2,
  code: Code2,
  compass: Compass,
  users: Users,
  scale: Scale,
  mail: Mail,
};

function NavigationGroups({
  slug,
  onNavigate,
  firstLinkRef,
}: {
  slug: string;
  onNavigate?: () => void;
  firstLinkRef?: RefObject<HTMLAnchorElement | null>;
}) {
  return (
    <>
      {companyNavigation.map((group) => {
        const Icon = groupIcons[group.icon];
        return (
          <section className="company-hub__group" key={group.title}>
            <h2>
              <Icon size={14} aria-hidden="true" />
              {group.title}
            </h2>
            <ul>
              {group.items.map((item) => {
                const selected = slug === item.slug;
                return (
                  <li key={item.path}>
                    <Link
                      aria-current={selected ? "page" : undefined}
                      className={selected ? "is-active" : undefined}
                      onClick={onNavigate}
                      ref={selected ? firstLinkRef : undefined}
                      to={item.path}
                    >
                      <span>{item.label}</span>
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function MadeInIndia() {
  return (
    <section className="made-in-india" aria-label="Made in India by VELORYZ">
      <span className="made-in-india__heart" aria-hidden="true">
        ♡
      </span>
      <div className="made-in-india__content">
        <span className="made-in-india__title">MADE IN INDIA</span>
        <span className="made-in-india__subtitle">Built with care by VELORYZ</span>
      </div>
    </section>
  );
}

export function CompanyHub() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const requestedSlug = hash.slice(1).toLowerCase();
  const companyItems = companyNavigation.flatMap((group) => group.items);
  const selectedItem =
    (requestedSlug === "forge"
      ? undefined
      : companyItems.find((item) => item.slug === requestedSlug)) ??
    companyItems.find((item) => item.slug === "about")!;
  const selectedSlug = selectedItem.slug;
  const page = informationPages[selectedSlug];
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (requestedSlug === "forge") {
      navigate("/forge", { replace: true });
      return;
    }
    if (selectedSlug !== requestedSlug) navigate("/us#about", { replace: true });
  }, [navigate, requestedSlug, selectedSlug]);

  useEffect(() => {
    setMobileOpen(false);
  }, [hash]);

  useEffect(() => {
    if (!mobileOpen) return;
    const focusTimer = window.setTimeout(() => firstMobileLinkRef.current?.focus(), 240);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  const closeMenu = () => setMobileOpen(false);
  const handleCompanyPageLink = (event: MouseEvent<HTMLElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || (anchor.target && anchor.target !== "_self")) return;
    const target = new URL(anchor.href, window.location.href);
    if (target.origin !== window.location.origin) return;
    const route = companyPathForRoute(`${target.pathname}${target.search}${target.hash}`);
    if (route === `${target.pathname}${target.search}${target.hash}`) return;
    event.preventDefault();
    navigate(route);
  };

  return (
    <div className="company-hub">
      <aside className="company-hub__sidebar" aria-label="Company information">
        <Link className="company-hub__brand" to="/">
          <span>VELORI</span>
          <small>Company directory</small>
        </Link>
        <nav aria-label="Company pages">
          <NavigationGroups slug={selectedSlug} />
        </nav>
      </aside>

      <div className="company-hub__main">
        <div className="company-hub__mobile-bar">
          <span>Company directory</span>
          <button
            aria-controls="company-mobile-navigation"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close company navigation" : "Open company navigation"}
            className="company-hub__menu-button"
            onClick={() => setMobileOpen((open) => !open)}
            ref={menuButtonRef}
            type="button"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        <nav
          aria-hidden={!mobileOpen}
          aria-label="Company pages"
          className="company-hub__mobile-navigation"
          data-open={mobileOpen}
          id="company-mobile-navigation"
          inert={!mobileOpen}
        >
          <NavigationGroups
            firstLinkRef={firstMobileLinkRef}
            onNavigate={closeMenu}
            slug={selectedSlug}
          />
        </nav>

        <header className="company-hub__header">
          <span className="company-hub__eyebrow">VELORYZ · COMPANY & COMMUNITY</span>
          <h1>{selectedSlug === "about" ? "About VELORYZ" : selectedItem.label}</h1>
          <p>
            {page?.intro ??
              "Discover our products, company, technology, community and the people building VELORYZ."}
          </p>
        </header>

        <section
          className="company-hub__about"
          aria-label={`${selectedItem.label} page`}
          onClickCapture={handleCompanyPageLink}
        >
          <Suspense
            fallback={
              <div className="company-hub__loading" role="status">
                Loading {selectedItem.label}…
              </div>
            }
          >
            <InformationPage kind={selectedSlug} />
          </Suspense>
        </section>
        <MadeInIndia />
      </div>
    </div>
  );
}
