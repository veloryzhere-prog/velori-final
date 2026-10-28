import {
  parseSourceFiles,
  parseForgeStack,
  type SourceFile,
  type ForgeStack,
} from "./multi-file.ts";
import { studioId } from "./identity.ts";
export type Code = { html: string; css: string; js: string };
export type Page = Code & { path: string };
export type Turn = { id: string; prompt: string; result: string; createdAt: string };
export type ForgeProjectSetup = {
  version: 1;
  description: string;
  category: string;
  platform: "website" | "web-app" | "backend-api" | "presentation" | "custom";
  framework: "static-html" | "react-vite" | "python-fastapi";
  theme: "system" | "light" | "dark";
  design: string;
  color: string;
  animation: "off" | "subtle" | "balanced" | "expressive";
  responsive: "mobile-first" | "desktop-first" | "adaptive";
  aiProvider: "gemini" | "local";
  defaultMode: "build" | "ask";
  storage: "local";
  autosave: boolean;
  backupReminder: boolean;
  initialPrompt: string;
};
export type Project = {
  id: string;
  title: string;
  pages: Page[];
  /** Browser-owned editable source files; never sent to a cloud save. */
  files?: SourceFile[];
  stack?: ForgeStack;
  setup?: ForgeProjectSetup;
  history: Turn[];
  updatedAt: string;
  cloudUpdatedAt?: string;
};
export type Generated = {
  title: string;
  pages: Page[];
  files?: SourceFile[];
  stack?: ForgeStack;
  branded?: boolean;
};
export type Quota = {
  plan: "FREE" | "PREMIUM";
  freeLeft: number;
  tokens: number;
  editorLeft: number;
  canGenerate: boolean;
  canEdit: boolean;
};
export const validPath = (p: unknown): p is string =>
  typeof p === "string" &&
  /^[a-z][a-z0-9-]{0,39}$/.test(p) &&
  !["constructor", "prototype"].includes(p);
const setupCategories = new Set([
  "Website",
  "Web Application",
  "Dashboard",
  "Portfolio",
  "Storefront",
  "Presentation",
  "Business Tool",
  "API / Backend",
  "Full-Stack Application",
  "Custom",
]);
const setupDesigns = new Set([
  "Aurora Glass",
  "Ivory Glass",
  "Minimal",
  "Editorial",
  "Professional Dashboard",
  "Modern Gradient",
  "Soft Glass",
  "Bold Contemporary",
]);
export function parseForgeProjectSetup(value: unknown): ForgeProjectSetup {
  if (!value || typeof value !== "object") throw new Error("Invalid project setup.");
  const setup = value as Partial<ForgeProjectSetup>;
  if (
    setup.version !== 1 ||
    typeof setup.description !== "string" ||
    setup.description.length > 500 ||
    !setupCategories.has(setup.category ?? "") ||
    !["website", "web-app", "backend-api", "presentation", "custom"].includes(
      setup.platform ?? "",
    ) ||
    !["static-html", "react-vite", "python-fastapi"].includes(setup.framework ?? "") ||
    !["system", "light", "dark"].includes(setup.theme ?? "") ||
    !setupDesigns.has(setup.design ?? "") ||
    typeof setup.color !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(setup.color) ||
    !["off", "subtle", "balanced", "expressive"].includes(setup.animation ?? "") ||
    !["mobile-first", "desktop-first", "adaptive"].includes(setup.responsive ?? "") ||
    !["gemini", "local"].includes(setup.aiProvider ?? "") ||
    !["build", "ask"].includes(setup.defaultMode ?? "") ||
    setup.storage !== "local" ||
    typeof setup.autosave !== "boolean" ||
    typeof setup.backupReminder !== "boolean" ||
    typeof setup.initialPrompt !== "string" ||
    setup.initialPrompt.length > 4000
  )
    throw new Error("Project setup contains unsupported or invalid values.");
  return setup as ForgeProjectSetup;
}
export function parsePages(value: unknown): Page[] {
  if (!Array.isArray(value) || !value.length || value.length > 8)
    throw new Error("Use one to eight pages, including index.");
  const paths = new Set<string>();
  let total = 0;
  const pages = value.map((p) => {
    if (
      !p ||
      !validPath(p.path) ||
      paths.has(p.path) ||
      ![p.html, p.css, p.js].every((s) => typeof s === "string")
    )
      throw new Error("Invalid or duplicate page.");
    const size = new TextEncoder().encode(p.html + p.css + p.js).length;
    total += size;
    paths.add(p.path);
    if (size > 600000) throw new Error("Keep each page below 600 KB.");
    return { path: p.path, html: p.html, css: p.css, js: p.js };
  });
  if (!paths.has("index") || total > 1200000)
    throw new Error("Include index and keep total code below 1.2 MB.");
  return pages.sort((a, b) =>
    a.path === "index" ? -1 : b.path === "index" ? 1 : a.path.localeCompare(b.path),
  );
}
export function parseGenerated(value: unknown): Generated {
  const v = value as Partial<Generated>;
  if (!v || typeof v.title !== "string" || !v.title.trim() || v.title.length > 100)
    throw new Error("Incomplete AI result. Your draft is unchanged.");
  return {
    title: v.title.trim(),
    pages: parsePages(v.pages),
    ...(v.files !== undefined ? { files: parseSourceFiles(v.files) } : {}),
    ...(v.stack !== undefined ? { stack: parseForgeStack(v.stack) } : {}),
    branded: v.branded,
  };
}
export function validHistory(value: unknown): value is Turn[] {
  return (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every(
      (t) =>
        t &&
        typeof t.id === "string" &&
        typeof t.prompt === "string" &&
        t.prompt.length <= 4000 &&
        typeof t.result === "string" &&
        t.result.length <= 500 &&
        typeof t.createdAt === "string",
    )
  );
}
export function normalizeProject(value: unknown): Project {
  const v = value as Partial<Project> & Partial<Code> & { promptHistory?: Turn[] };
  if (
    !v ||
    typeof v.id !== "string" ||
    typeof v.title !== "string" ||
    v.title.length > 100 ||
    typeof v.updatedAt !== "string"
  )
    throw new Error("Invalid project.");
  const pages = parsePages(v.pages ?? [{ path: "index", html: v.html, css: v.css, js: v.js }]);
  const history = v.history ?? v.promptHistory ?? [];
  if (!validHistory(history)) throw new Error("Invalid project history.");
  return {
    id: v.id,
    title: v.title,
    pages,
    files: parseSourceFiles(v.files),
    stack: parseForgeStack(v.stack),
    ...(v.setup !== undefined ? { setup: parseForgeProjectSetup(v.setup) } : {}),
    history,
    updatedAt: v.updatedAt,
    cloudUpdatedAt: typeof v.cloudUpdatedAt === "string" ? v.cloudUpdatedAt : undefined,
  };
}
export function readProjects(storage: Pick<Storage, "getItem">, key: string): Project[] {
  try {
    const rows = JSON.parse(storage.getItem(key) ?? "[]");
    if (!Array.isArray(rows)) return [];
    return rows
      .flatMap((p) => {
        try {
          return [normalizeProject(p)];
        } catch {
          return [];
        }
      })
      .slice(0, 12);
  } catch {
    return [];
  }
}
export function saveProject(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  project: Project,
) {
  const valid = normalizeProject(project);
  const others = readProjects(storage, key).filter((p) => p.id !== valid.id);
  if (others.length >= 12)
    throw new Error("Your browser library is full. Export and remove an older project first.");
  const next = [valid, ...others];
  storage.setItem(key, JSON.stringify(next));
  return next;
}
export function importProject(text: string): Project {
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Import a valid project JSON object.");
  const pages = parsePages(
    value.pages ?? [{ path: "index", html: value.html, css: value.css, js: value.js }],
  );
  return {
    id: studioId(),
    title: typeof value.title === "string" ? value.title.slice(0, 100) : "Imported app",
    pages,
    files: parseSourceFiles(value.files),
    stack: parseForgeStack(value.stack),
    history: validHistory(value.history ?? value.promptHistory)
      ? (value.history ?? value.promptHistory)
      : [],
    updatedAt: new Date().toISOString(),
  };
}
