import type { CmsContentBlock } from "../../app/cms-public-page";
export type DocumentationContact = {
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
};
export type DocumentationSource = {
  title: string;
  slug: string;
  route: string;
  content: string;
  custom_html: string;
  custom_css: string;
  custom_js: string;
  content_mode: "custom_html";
  content_blocks: CmsContentBlock[];
  seo_title: string;
  seo_description: string;
  og_title: string;
  og_description: string;
  hero_image: string;
  footer_enabled: boolean;
  animation_enabled: boolean;
};
export const DOCUMENT_RELEASE: string;
export const DOCUMENT_CSS: string;
export const DOCUMENT_JS: string;
export function resolveDocumentLink(value: string, contact?: DocumentationContact): string;
export function buildDocumentationDocument(
  kind: string,
  contact?: DocumentationContact,
): DocumentationSource;
