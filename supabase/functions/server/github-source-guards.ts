export const SOURCE_READ_PERMISSION = "motion.read";
export const SOURCE_WRITE_PERMISSION = "motion.write";
export const SOURCE_PERMISSION_BY_ACTION = {
  browse: SOURCE_READ_PERMISSION,
  pullRequest: SOURCE_WRITE_PERMISSION,
} as const;

export async function creatorSourceReviewBranchName(
  baseSha: string,
  files: ReadonlyArray<{ path: string; content: string; sha: string }>,
): Promise<string> {
  const identity = JSON.stringify({
    baseSha: baseSha.toLowerCase(),
    files: [...files]
      .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
      .map(({ path, content, sha }) => ({ path, content, sha })),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const suffix = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
  return `velori/creator-source-${baseSha.slice(0, 12).toLowerCase()}-${suffix}`;
}

const STUDIO_ROOTS = [
  "src/app/story-editor-page.tsx",
  "src/app/story-editor.css",
  "src/components/story-editor/",
  "src/lib/story-editor/",
  "src/pages/ReelStudio/",
  "src/components/reel-editor/",
  "src/lib/reel-editor/",
  "src/components/post-editor/",
  "src/components/studios/",
  "src/lib/post-editor/",
  "src/styles/post-studio.css",
  "types/post-editor.ts",
  "src/lib/studio-catalog.ts",
] as const;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json"]);
const MAX_FILES = 12;
const MAX_FILE_BYTES = 750_000;
const MAX_TOTAL_BYTES = 2_000_000;
const SECRET_PATTERN =
  /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|sk_(?:live|test)_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{30,})\b|\b(?:service[_-]?role[_-]?key|secret[_-]?key|private[_-]?key|access[_-]?token|api[_-]?key|client[_-]?secret|password)\s*[:=]\s*["'][^"']{12,}["'])/i;

export function isEligibleCreatorSourcePath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  const segments = normalized.split("/");
  const name = segments.at(-1) ?? "";
  const lower = normalized.toLowerCase();
  return (
    normalized === path &&
    !normalized.startsWith("/") &&
    !segments.some((part) => !part || part === "." || part === "..") &&
    STUDIO_ROOTS.some((root) =>
      root.endsWith("/") ? normalized.startsWith(root) : normalized === root,
    ) &&
    SOURCE_EXTENSIONS.has(name.slice(name.lastIndexOf(".")).toLowerCase()) &&
    !/\.(test|spec|d)\.[^.]+$/i.test(name) &&
    !segments.some((part) =>
      [
        ".git",
        ".github",
        "node_modules",
        "dist",
        "coverage",
        "generated",
        "__generated__",
        ".vite",
        "build",
        "out",
        "target",
        "supabase",
        "scripts",
      ].includes(part.toLowerCase()),
    ) &&
    !name.toLowerCase().startsWith(".env") &&
    ![".sqlite", ".db", ".pem", ".key", ".p12", ".pfx", ".lock"].some((ext) => lower.endsWith(ext))
  );
}

export function validateCreatorSourceFiles(value: unknown):
  | {
      ok: true;
      files: Array<{ path: string; content: string; sha: string }>;
      bytes: number;
    }
  | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_FILES) {
    return {
      ok: false,
      error: `Choose between 1 and ${MAX_FILES} files for one review.`,
    };
  }
  const seen = new Set<string>();
  const files: Array<{ path: string; content: string; sha: string }> = [];
  let bytes = 0;
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "A source file entry is invalid." };
    }
    const { path, content, sha } = item as Record<string, unknown>;
    if (typeof path !== "string" || !isEligibleCreatorSourcePath(path)) {
      return {
        ok: false,
        error: "A selected path is outside the approved creator source files.",
      };
    }
    if (seen.has(path)) {
      return { ok: false, error: "A source path was selected more than once." };
    }
    if (typeof content !== "string" || typeof sha !== "string" || !/^[a-f0-9]{40}$/i.test(sha)) {
      return {
        ok: false,
        error: `The source content or base revision for ${path} is invalid.`,
      };
    }
    const fileBytes = new TextEncoder().encode(content).byteLength;
    if (fileBytes > MAX_FILE_BYTES) {
      return { ok: false, error: `${path} exceeds the 750 KB file limit.` };
    }
    if (SECRET_PATTERN.test(content)) {
      return {
        ok: false,
        error: `${path} appears to contain a credential and cannot be submitted.`,
      };
    }
    bytes += fileBytes;
    seen.add(path);
    files.push({ path, content, sha });
  }
  if (bytes > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      error: "The review exceeds the 2 MB total source limit.",
    };
  }
  return { ok: true, files, bytes };
}
