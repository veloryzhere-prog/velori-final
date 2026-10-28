import { extraInformationSlugs, informationPages } from "../../features/information/catalog";
export const PUBLIC_PAGE_REGISTRY = [
  ...extraInformationSlugs.map((slug) => ({
    slug,
    route: `/${slug}`,
    title: informationPages[slug].label,
    type: "information",
    group: slug.startsWith("forge-") ? "forge" : "platform",
  })),
  { slug: "about", route: "/about", title: "About", type: "about", group: "platform" },
  { slug: "privacy", route: "/privacy", title: "Privacy", type: "policy", group: "privacy" },
  { slug: "terms", route: "/terms", title: "Terms", type: "policy", group: "legal" },
  {
    slug: "community-guidelines",
    route: "/community-guidelines",
    title: "Community Guidelines",
    type: "guidelines",
    group: "community",
  },
  { slug: "safety", route: "/safety", title: "Safety", type: "safety", group: "community" },
  { slug: "help", route: "/help", title: "Help", type: "help", group: "platform" },
  { slug: "cookies", route: "/cookies", title: "Cookies", type: "policy", group: "privacy" },
  {
    slug: "acceptable-use",
    route: "/acceptable-use",
    title: "Acceptable Use",
    type: "policy",
    group: "community",
  },
  {
    slug: "data-policy",
    route: "/data-policy",
    title: "Data Policy",
    type: "policy",
    group: "privacy",
  },
  { slug: "legal", route: "/legal", title: "Legal", type: "policy", group: "legal" },
  { slug: "contact", route: "/contact", title: "Contact", type: "contact", group: "platform" },
] as const;

export const PUBLIC_PAGE_GROUPS = [
  { id: "forge", label: "Forge AI · guides, pricing & payments" },
  { id: "platform", label: "Platform" },
  { id: "community", label: "Safety & Community" },
  { id: "privacy", label: "Privacy & Data" },
  { id: "legal", label: "Legal" },
] as const;

export type PublicPageDefinition = (typeof PUBLIC_PAGE_REGISTRY)[number];
