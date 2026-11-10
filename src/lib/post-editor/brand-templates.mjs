export const BRAND_STORAGE_KEY = "velori-post-brand-kit-v1";
export const TEMPLATE_STORAGE_KEY = "velori-post-templates-v1";

export const TEMPLATE_PLATFORMS = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "X",
  "Pinterest",
  "Threads",
];
export const TEMPLATE_INDUSTRIES = [
  "General",
  "Food",
  "Fashion",
  "Travel",
  "Fitness",
  "Technology",
  "Education",
  "Beauty",
  "Finance",
  "Nonprofit",
];
export const TEMPLATE_TYPES = ["Announcement", "Quote", "Promotion", "Story", "Event", "Tip"];

const palettes = [
  ["#6d5dfc", "#f472b6", "#111827"],
  ["#0f766e", "#99f6e4", "#042f2e"],
  ["#ea580c", "#fed7aa", "#431407"],
  ["#2563eb", "#bfdbfe", "#172554"],
  ["#be123c", "#fecdd3", "#4c0519"],
  ["#4d7c0f", "#d9f99d", "#1a2e05"],
];

export function createTemplateCatalog() {
  const recipes = [];
  for (let i = 0; i < 1200; i += 1) {
    recipes.push({
      id: `starter-${String(i + 1).padStart(4, "0")}`,
      name: `${TEMPLATE_TYPES[i % TEMPLATE_TYPES.length]} ${TEMPLATE_INDUSTRIES[Math.floor(i / 6) % TEMPLATE_INDUSTRIES.length]} ${String(Math.floor(i / 60) + 1).padStart(2, "0")}`,
      platform: TEMPLATE_PLATFORMS[Math.floor(i / 60) % TEMPLATE_PLATFORMS.length],
      industry: TEMPLATE_INDUSTRIES[Math.floor(i / 6) % TEMPLATE_INDUSTRIES.length],
      type: TEMPLATE_TYPES[i % TEMPLATE_TYPES.length],
      palette: palettes[i % palettes.length],
      content: "Your idea starts here. Replace this copy with your own.",
      locked: { colors: true, logoPosition: true },
      starter: true,
    });
  }
  return recipes;
}

export function applyBrandTokens(text, brandKit) {
  const tokens = {
    "{{brand}}": brandKit.name || "Your brand",
    "{{tone}}": brandKit.tone || "",
  };
  return Object.entries(tokens).reduce(
    (value, [token, replacement]) => value.replaceAll(token, replacement),
    text,
  );
}

export function filterTemplates(
  templates,
  { platform = "All", industry = "All", type = "All", query = "" } = {},
) {
  const needle = query.trim().toLowerCase();
  return templates.filter(
    (item) =>
      (platform === "All" || item.platform === platform) &&
      (industry === "All" || item.industry === industry) &&
      (type === "All" || item.type === type) &&
      (!needle ||
        `${item.name} ${item.platform} ${item.industry} ${item.type}`
          .toLowerCase()
          .includes(needle)),
  );
}

export function pushHistory(history, value, limit = 50) {
  return [...history, value].slice(-limit);
}
