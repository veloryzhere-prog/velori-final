import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  Code2,
  Compass,
  CreditCard,
  FileText,
  HelpCircle,
  LifeBuoy,
  Link2,
  MessageCircle,
  Palette,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { useInformationFooterLinks } from "../features/information/InformationPage";
import {
  buildMoreLinkGroups,
  describeMoreLink,
  type MoreSectionId,
} from "../features/information/more-page-policy.mjs";
import "./more-page.css";

const sectionIcons: Record<MoreSectionId, typeof Compass> = {
  support: LifeBuoy,
  about: Sparkles,
  community: Users,
  legal: ShieldCheck,
  account: Settings2,
  other: Compass,
};

const linkIcons: Record<string, typeof Compass> = {
  "/help": HelpCircle,
  "/contact": MessageCircle,
  "/contact-uploading": ShieldCheck,
  "/about": Sparkles,
  "/veloryz": Sparkles,
  "/blog": BookOpen,
  "/jobs": BriefcaseBusiness,
  "/developers": Code2,
  "/roadmap": BookOpen,
  "/directory": Compass,
  "/privacy": ShieldCheck,
  "/terms": FileText,
  "/safety": ShieldCheck,
  "/community-guidelines": Users,
  "/locations": Compass,
  "/popular": Compass,
  "/forge-api": Code2,
  "/forge-security": ShieldCheck,
  "/forge-pricing": CreditCard,
  "/forge-payments": CreditCard,
  "/settings": Settings2,
  "/settings/account": UserRound,
  "/settings/appearance": Palette,
  "/settings/privacy": ShieldCheck,
  "/settings/notifications": Bell,
};

export function MorePage() {
  const footerLinks = useInformationFooterLinks();
  const sections = buildMoreLinkGroups(footerLinks);

  return (
    <section className="more-page" aria-labelledby="more-page-title">
      <header className="more-page-heading">
        <span className="more-page-eyebrow">YOUR VELORI</span>
        <div className="more-page-brand" aria-hidden="true">
          <img src="/velori-wing-mark.png" alt="" />
        </div>
        <h1 id="more-page-title">More to explore</h1>
        <p>Helpful links, community information, and the settings that keep your space yours.</p>
      </header>

      <div className="more-page-sections">
        {sections.map((section) => {
          const Icon = sectionIcons[section.id as keyof typeof sectionIcons];
          return (
            <section
              className="more-page-section"
              key={section.id}
              aria-labelledby={`more-${section.id}`}
            >
              <header>
                <span className="more-page-section-icon" aria-hidden="true">
                  <Icon size={19} />
                </span>
                <div>
                  <h2 id={`more-${section.id}`}>{section.title}</h2>
                  <p>{section.description}</p>
                </div>
              </header>
              <nav aria-label={section.title}>
                {section.links.map(([label, route]) => {
                  const Icon = linkIcons[route] ?? Link2;
                  return (
                    <Link className="more-page-link" key={`${label}:${route}`} to={route}>
                      <span className="more-page-link-icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <span className="more-page-link-copy">
                        <span>{label}</span>
                        <small>{describeMoreLink(route, label)}</small>
                      </span>
                      <ChevronRight className="more-page-chevron" size={18} aria-hidden="true" />
                    </Link>
                  );
                })}
              </nav>
            </section>
          );
        })}
      </div>
    </section>
  );
}
