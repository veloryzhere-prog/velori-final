import {
  creatorSourceReviewBranchName,
  isEligibleCreatorSourcePath,
  SOURCE_PERMISSION_BY_ACTION,
  validateCreatorSourceFiles,
} from "./github-source-guards.ts";

Deno.test("hosted source review is limited to approved studio code files", () => {
  for (const path of [
    "src/components/story-editor/Scene.tsx",
    "src/lib/reel-editor/export-pipeline.mjs",
    "src/components/post-editor/Inspector.css",
    "src/components/post-editor/Preview.css",
    "src/components/studios/right-panel/LayerProperties.css",
    "src/components/studios/right-panel/PreviewPanel.css",
    "src/pages/ReelStudio/reel-studio.css",
    "src/styles/post-studio.css",
    "src/lib/studio-catalog.ts",
  ]) {
    if (!isEligibleCreatorSourcePath(path)) {
      throw new Error(`${path} should be eligible.`);
    }
  }
  for (const path of [
    "../.env",
    "src/components/story-editor/.env.local",
    "src/components/story-editor/Scene.test.tsx",
    "src/components/story-editor/generated/Scene.tsx",
    "supabase/migrations/unsafe.sql",
    "src/components/creator-manager/StudioSourceWorkbench.tsx",
    "src/components/story-editor/key.pem",
  ]) {
    if (isEligibleCreatorSourcePath(path)) {
      throw new Error(`${path} must be excluded.`);
    }
  }
});

Deno.test("pull request input validates path, revision, duplicate files, and credential content", () => {
  const sha = "a".repeat(40);
  const valid = validateCreatorSourceFiles([
    {
      path: "src/components/story-editor/Scene.tsx",
      content: "export const scene = true;",
      sha,
    },
  ]);
  if (!valid.ok || valid.files.length !== 1) {
    throw new Error("Expected one valid source file.");
  }
  const secret = validateCreatorSourceFiles([
    {
      path: "src/components/story-editor/Scene.tsx",
      content: "const apiKey = 'abcdefghijklmnop';",
      sha,
    },
  ]);
  if (secret.ok || !secret.error.includes("credential")) {
    throw new Error("Credential content must be rejected.");
  }
  const duplicate = validateCreatorSourceFiles([
    { path: "src/components/story-editor/Scene.tsx", content: "one", sha },
    { path: "src/components/story-editor/Scene.tsx", content: "two", sha },
  ]);
  if (duplicate.ok || !duplicate.error.includes("more than once")) {
    throw new Error("Duplicate paths must be rejected.");
  }
});

Deno.test("identical hosted source reviews resolve to the same isolated branch", async () => {
  const baseSha = "a".repeat(40);
  const files = [
    {
      path: "src/components/story-editor/Scene.tsx",
      content: "scene",
      sha: "b".repeat(40),
    },
    {
      path: "src/lib/story-editor/tools.ts",
      content: "tools",
      sha: "c".repeat(40),
    },
  ];
  const branch = await creatorSourceReviewBranchName(baseSha, files);
  if (branch !== (await creatorSourceReviewBranchName(baseSha, [...files].reverse()))) {
    throw new Error("File order must not change the review branch identity.");
  }
  if (
    branch ===
    (await creatorSourceReviewBranchName(baseSha, [{ ...files[0], content: "changed" }, files[1]]))
  ) {
    throw new Error("A changed source edit must use a different review branch.");
  }
  if (branch === (await creatorSourceReviewBranchName("d".repeat(40), files))) {
    throw new Error("A changed base revision must use a different review branch.");
  }
});

Deno.test("hosted source APIs reuse Creator Control Center RBAC permissions", () => {
  if (SOURCE_PERMISSION_BY_ACTION.browse !== "motion.read") {
    throw new Error("Browsing must require motion.read.");
  }
  if (SOURCE_PERMISSION_BY_ACTION.pullRequest !== "motion.write") {
    throw new Error("Pull requests must require motion.write.");
  }
});
