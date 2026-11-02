export type MoreSectionId = "support" | "about" | "community" | "legal" | "account" | "other";
export type MoreLink = readonly [label: string, route: string];
export type MoreLinkSection = {
  id: MoreSectionId;
  title: string;
  description: string;
  links: MoreLink[];
};

export const MORE_ACCOUNT_LINKS: readonly MoreLink[];
export function buildMoreLinkGroups(footerLinks: readonly MoreLink[]): MoreLinkSection[];
export function describeMoreLink(route: string, label: string): string;
