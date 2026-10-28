export const BRAND_STORAGE_KEY: string;
export const TEMPLATE_STORAGE_KEY: string;
export const TEMPLATE_PLATFORMS: string[];
export const TEMPLATE_INDUSTRIES: string[];
export const TEMPLATE_TYPES: string[];
export function createTemplateCatalog(): Array<{
  id: string;
  name: string;
  platform: string;
  industry: string;
  type: string;
  palette: string[];
  content: string;
  locked: { colors: boolean; logoPosition: boolean };
  starter: boolean;
}>;
export function applyBrandTokens(text: string, brandKit: { name?: string; tone?: string }): string;
export function filterTemplates<
  T extends { name: string; platform: string; industry: string; type: string },
>(
  templates: T[],
  filters?: { platform?: string; industry?: string; type?: string; query?: string },
): T[];
export function pushHistory<T>(history: T[], value: T, limit?: number): T[];
