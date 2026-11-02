export type CompanyNavigationIcon =
  | "sparkles"
  | "building"
  | "code"
  | "compass"
  | "users"
  | "scale"
  | "mail";

export interface CompanyNavigationItem {
  label: string;
  slug: string;
  path: string;
  legacyPath: string;
}

export interface CompanyNavigationGroup {
  title: string;
  icon: CompanyNavigationIcon;
  items: CompanyNavigationItem[];
}

const item = (label: string, slug: string): CompanyNavigationItem => ({
  label,
  slug,
  path: slug === "forge" ? "/forge" : `/us#${slug}`,
  legacyPath: `/${slug}`,
});

export const companyNavigation: CompanyNavigationGroup[] = [
  {
    title: "Forge AI",
    icon: "sparkles",
    items: [
      item("Forge AI", "forge"),
      item("Forge Guide", "forge-docs"),
      item("Forge Pricing", "forge-pricing"),
      item("Forge API", "forge-api"),
      item("Forge Security", "forge-security"),
      item("Payments & Billing", "forge-payments"),
    ],
  },
  {
    title: "VELORYZ",
    icon: "building",
    items: [
      item("VELORYZ", "veloryz"),
      item("About", "about"),
      item("Journal", "blog"),
      item("Careers", "jobs"),
      item("Roadmap", "roadmap"),
    ],
  },
  {
    title: "Developers",
    icon: "code",
    items: [item("Developers & API", "developers"), item("VELORYZ AI", "veloryz-ai")],
  },
  {
    title: "Discover",
    icon: "compass",
    items: [
      item("Places & Discovery", "locations"),
      item("Explore", "popular"),
      item("VELORI Lite", "lite"),
      item("Verification", "verified"),
      item("Contacts & Non-users", "contact-uploading"),
    ],
  },
  {
    title: "Community",
    icon: "users",
    items: [item("Safety", "safety"), item("Community Guidelines", "community-guidelines")],
  },
  {
    title: "Legal",
    icon: "scale",
    items: [
      item("Privacy", "privacy"),
      item("Terms", "terms"),
      item("Cookies", "cookies"),
      item("Acceptable Use", "acceptable-use"),
      item("Data Policy", "data-policy"),
      item("Legal", "legal"),
    ],
  },
  {
    title: "Contact",
    icon: "mail",
    items: [item("Contact", "contact"), item("Help", "help")],
  },
];

export function companyPathForRoute(value: string): string {
  try {
    const target = new URL(value, "https://velori.invalid");
    const item = companyNavigation
      .flatMap((group) => group.items)
      .find((entry) => entry.legacyPath === target.pathname);
    if (item) return item.path;
    if (target.pathname === "/us" && target.hash === "#forge") return "/forge";
    if (target.pathname === "/directory") return "/us#about";
  } catch {
    return value;
  }
  return value;
}
