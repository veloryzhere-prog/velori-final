export const MORE_ACCOUNT_LINKS = [
  ["Your account", "/settings"],
  ["Account information", "/settings/account"],
  ["Appearance", "/settings/appearance"],
  ["Privacy settings", "/settings/privacy"],
  ["Notification preferences", "/settings/notifications"],
];

const sectionMetadata = [
  {
    id: "support",
    title: "Help & support",
    description: "Find answers, contact VELORI, or learn how to manage your information.",
  },
  {
    id: "about",
    title: "About VELORI",
    description: "Discover the people, product, guides, and direction behind VELORI.",
  },
  {
    id: "community",
    title: "Community",
    description: "Explore community spaces, safety information, and discovery tools.",
  },
  {
    id: "legal",
    title: "Legal & privacy",
    description: "Read the policies and guidance that explain how VELORI works.",
  },
  {
    id: "account",
    title: "Account & application",
    description: "Manage your account and personal app preferences.",
  },
  {
    id: "other",
    title: "More from VELORI",
    description: "Additional destinations published in the VELORI directory.",
  },
];

const sectionForRoute = new Map([
  ["/help", "support"],
  ["/contact", "support"],
  ["/contact-uploading", "support"],
  ["/about", "about"],
  ["/veloryz", "about"],
  ["/blog", "about"],
  ["/jobs", "about"],
  ["/developers", "about"],
  ["/roadmap", "about"],
  ["/directory", "about"],
  ["/veloryz-ai", "about"],
  ["/forge", "about"],
  ["/forge-docs", "about"],
  ["/forge-pricing", "about"],
  ["/forge-api", "about"],
  ["/forge-security", "about"],
  ["/forge-payments", "about"],
  ["/locations", "community"],
  ["/popular", "community"],
  ["/verified", "community"],
  ["/safety", "community"],
  ["/community-guidelines", "community"],
  ["/privacy", "legal"],
  ["/terms", "legal"],
  ["/cookies", "legal"],
  ["/acceptable-use", "legal"],
  ["/data-policy", "legal"],
  ["/legal", "legal"],
  ["/lite", "account"],
  ...MORE_ACCOUNT_LINKS.map(([, route]) => [route, "account"]),
]);

export function buildMoreLinkGroups(footerLinks) {
  const allLinks = [...footerLinks];
  const availableRoutes = new Set(allLinks.map(([, route]) => route));
  for (const link of MORE_ACCOUNT_LINKS) {
    if (!availableRoutes.has(link[1])) allLinks.push(link);
  }

  const groups = new Map(sectionMetadata.map((section) => [section.id, { ...section, links: [] }]));
  for (const link of allLinks) {
    if (!Array.isArray(link) || typeof link[0] !== "string" || typeof link[1] !== "string") {
      continue;
    }
    const [, route] = link;
    if (!route.startsWith("/") || route.startsWith("//")) continue;
    const sectionId = sectionForRoute.get(route) ?? "other";
    groups.get(sectionId).links.push(link);
  }
  return [...groups.values()].filter((section) => section.links.length > 0);
}

const descriptions = new Map([
  ["/help", "Browse answers and practical guides."],
  ["/contact", "Reach the VELORI team through official contact details."],
  ["/about", "Learn what VELORI brings together."],
  ["/privacy", "Understand VELORI’s privacy practices."],
  ["/terms", "Read the terms for using VELORI."],
  ["/settings", "Manage your VELORI account and preferences."],
  ["/settings/account", "Review your account information and security options."],
  ["/settings/privacy", "Choose how your profile and information are shared."],
  ["/settings/notifications", "Choose the updates you want to receive."],
]);

export function describeMoreLink(route, label) {
  return descriptions.get(route) ?? `Open ${label} on VELORI.`;
}
