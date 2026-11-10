import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import studioSourcePlugin from "./vite-studio-source.mjs";

const fixtures = [];
const studioFiles = {
  story: "src/components/story-editor/editor.tsx",
  reel: "src/components/reel-editor/editor.tsx",
  post: "src/components/post-editor/editor.tsx",
};

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function bareGit(root, ...args) {
  return execFileSync("git", ["-c", "safe.bareRepository=all", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function fixture({ remote = true } = {}) {
  const base = await mkdtemp(join(tmpdir(), "velori-source-sync-"));
  fixtures.push(base);
  const root = join(base, "work");
  await mkdir(join(root, "src/components/story-editor"), { recursive: true });
  await mkdir(join(root, "src/components/reel-editor"), { recursive: true });
  await mkdir(join(root, "src/components/post-editor"), { recursive: true });
  await mkdir(join(root, "src/lib"), { recursive: true });
  for (const [studio, path] of Object.entries(studioFiles)) {
    await writeFile(join(root, path), `export const editor = '${studio} base';\n`);
  }
  await writeFile(join(root, "src/lib/studio-catalog.ts"), "export const catalog = 'base';\n");
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "VELORI test");
  git(root, "config", "user.email", "velori-test@example.invalid");
  git(root, "add", "--all");
  git(root, "commit", "-m", "Initial test source");
  const bare = join(base, "remote.git");
  if (remote) {
    execFileSync("git", ["init", "--bare", bare], { encoding: "utf8", stdio: "ignore" });
    git(root, "remote", "add", "origin", bare);
    git(root, "push", "--set-upstream", "origin", "main");
  }
  return { root, bare };
}

async function service(root, options = {}) {
  let middleware;
  studioSourcePlugin({ root, allowNonGitHubRemoteForTests: true, ...options }).configureServer({
    middlewares: {
      use(handler) {
        middleware = handler;
      },
    },
  });
  const server = createServer((request, response) =>
    middleware(request, response, () => {
      response.statusCode = 404;
      response.end();
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const base = `http://localhost:${port}`;
  return {
    server,
    async request(path, body, origin = body === undefined ? undefined : base) {
      return await fetch(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(origin ? { Origin: origin } : {}),
          Host: `localhost:${port}`,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
  };
}

async function openedFile(api, studio) {
  const path = studioFiles[studio];
  const response = await api.request(
    `/__velori_source/file?studio=${studio}&path=${encodeURIComponent(path)}`,
  );
  assert.equal(response.status, 200);
  return { path, ...(await response.json()) };
}

async function save(api, studio, source, content) {
  return await api.request("/__velori_source/save", {
    studio,
    path: source.path,
    content,
    expectedVersion: source.version,
  });
}

async function closeService(t, api) {
  t.after(() => new Promise((resolve) => api.server.close(resolve)));
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((base) => rm(base, { recursive: true, force: true })));
});

test("studio manifests include each editor entry point, implementation, and project stylesheets", async (t) => {
  const api = await service(process.cwd());
  await closeService(t, api);
  const expectedFiles = {
    story: [
      "src/app/story-editor-page.tsx",
      "src/app/story-editor.css",
      "src/components/story-editor/StoryStudio.tsx",
      "src/components/story-editor/story-studio.css",
      "src/index.css",
      "src/styles/reference-ui.css",
    ],
    reel: [
      "src/app/social-media-pages.tsx",
      "src/components/reel-editor/ReelStudio.tsx",
      "src/components/reel-editor/ReelCanvas.tsx",
      "src/components/reel-editor/ReelMediaLibrary.tsx",
      "src/components/reel-editor/ReelTimeline.tsx",
      "src/components/reel-editor/ReelInspector.tsx",
      "src/components/reel-editor/ReelPublishDialog.tsx",
      "src/components/reel-editor/reel-studio.css",
      "src/lib/reel-editor/types.ts",
      "src/lib/reel-editor/timeline.ts",
      "src/lib/reel-editor/frame-renderer.ts",
      "src/lib/reel-editor/render-reel.ts",
      "src/lib/reel-editor/publish.ts",
      "src/lib/reel-editor/draft.ts",
      "src/lib/reel-editor/assets.ts",
      "src/index.css",
      "src/styles/reference-ui.css",
    ],
    post: [
      "src/app/views.tsx",
      "src/components/post-editor/Canvas.tsx",
      "src/components/post-editor/Canvas.css",
      "src/components/post-editor/BrandTemplates.css",
      "src/components/post-editor/CollaborationPanel.css",
      "src/components/post-editor/Preview.css",
      "src/components/studios/StudioShell.tsx",
      "src/components/studios/left-panel/BrandTab.css",
      "src/components/studios/left-panel/MediaTab.css",
      "src/components/studios/left-panel/TemplatesTab.css",
      "src/components/studios/left-panel/ToolsTab.tsx",
      "src/components/studios/left-panel/ToolsTab.css",
      "src/components/studios/right-panel/ClipProperties.css",
      "src/components/studios/right-panel/LayerProperties.tsx",
      "src/components/studios/right-panel/LayerProperties.css",
      "src/components/studios/right-panel/PreviewPanel.css",
      "src/components/studios/right-panel/StickerProperties.css",
      "src/components/studios/right-panel/TextProperties.tsx",
      "src/components/studios/right-panel/TextProperties.css",
      "src/styles/tokens.css",
      "src/styles/post-studio.css",
      "src/index.css",
      "src/styles/reference-ui.css",
    ],
  };

  for (const [studio, requiredPaths] of Object.entries(expectedFiles)) {
    const response = await api.request(`/__velori_source/files?studio=${studio}`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    const listedPaths = new Set(payload.files.map((file) => file.path));
    for (const path of requiredPaths)
      assert.ok(listedPaths.has(path), `${studio} manifest is missing ${path}`);
  }
});

for (const studio of ["story", "reel", "post"]) {
  test(`${studio} Save writes, commits only its allowed source file, and confirms the remote head`, async (t) => {
    const { root, bare } = await fixture();
    const api = await service(root);
    await closeService(t, api);
    const source = await openedFile(api, studio);
    const edited = `export const editor = '${studio} saved';\n`;
    const response = await save(api, studio, source, edited);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.saved, true);
    assert.equal(result.sync.state, "success", result.sync.error);
    assert.equal(result.sync.committed, true);
    assert.equal(result.sync.pushed, true);
    assert.equal(result.sync.path, source.path);
    assert.equal(result.sync.branch, "main");
    assert.equal(result.sync.commit, git(root, "rev-parse", "HEAD"));
    assert.ok(result.sync.timestamp);
    assert.equal(await readFile(join(root, source.path), "utf8"), edited);
    assert.deepEqual(
      git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD").split("\n"),
      [source.path],
    );
    assert.equal(bareGit(bare, "rev-parse", "refs/heads/main"), git(root, "rev-parse", "HEAD"));
  });
}

test("a confirmed push queues Netlify only when its deploy branch matches", async (t) => {
  const { root } = await fixture();
  const api = await service(root, {
    netlifyBuildHookUrl: "https://api.netlify.com/build_hooks/test-hook",
    netlifyDeployBranch: "main",
  });
  await closeService(t, api);
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith("https://api.netlify.com/")) {
      requests.push({ input: String(input), method: init?.method });
      return new Response("{}", { status: 200 });
    }
    return await originalFetch(input, init);
  };
  try {
    const status = await (await api.request("/__velori_source/status")).json();
    assert.equal(status.deployment.state, "connected");
    assert.equal(JSON.stringify(status).includes("build_hooks"), false);
    const source = await openedFile(api, "story");
    const saved = await (
      await save(api, "story", source, "export const editor = 'deploy this';\n")
    ).json();
    assert.equal(saved.sync.pushed, true);
    assert.equal(saved.sync.deployment.state, "queued");
    assert.match(saved.sync.deployment.message, /after its build and publish complete/i);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "POST");
    assert.equal(requests[0].input, "https://api.netlify.com/build_hooks/test-hook");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a failed Netlify hook can be retried without repeating the GitHub push", async (t) => {
  const { root } = await fixture();
  const api = await service(root, {
    netlifyBuildHookUrl: "https://api.netlify.com/build_hooks/test-hook",
    netlifyDeployBranch: "main",
  });
  await closeService(t, api);
  const originalFetch = globalThis.fetch;
  let hookCalls = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith("https://api.netlify.com/")) {
      hookCalls += 1;
      return new Response("{}", { status: hookCalls === 1 ? 503 : 200 });
    }
    return await originalFetch(input, init);
  };
  try {
    const source = await openedFile(api, "story");
    const saved = await (
      await save(api, "story", source, "export const editor = 'retry deploy';\n")
    ).json();
    assert.equal(saved.sync.pushed, true);
    assert.equal(saved.sync.deployment.state, "failed");
    const retried = await (
      await api.request("/__velori_source/deploy/retry", {
        studio: "story",
        commit: saved.sync.commit,
      })
    ).json();
    assert.equal(retried.deployment.state, "queued");
    assert.equal(hookCalls, 2);
    assert.equal(git(root, "rev-list", "--count", "HEAD"), "2");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Netlify is not triggered for a push to a different branch", async (t) => {
  const { root } = await fixture();
  const api = await service(root, {
    netlifyBuildHookUrl: "https://api.netlify.com/build_hooks/test-hook",
    netlifyDeployBranch: "production",
  });
  await closeService(t, api);
  const originalFetch = globalThis.fetch;
  let hookCalls = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith("https://api.netlify.com/")) {
      hookCalls += 1;
      return new Response("{}", { status: 200 });
    }
    return await originalFetch(input, init);
  };
  try {
    const source = await openedFile(api, "story");
    const saved = await (
      await save(api, "story", source, "export const editor = 'wrong branch';\n")
    ).json();
    assert.equal(saved.sync.pushed, true);
    assert.equal(saved.sync.deployment.state, "failed");
    assert.match(saved.sync.deployment.message, /does not match/i);
    assert.equal(hookCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an unchanged save does not manufacture a commit", async (t) => {
  const { root } = await fixture();
  const api = await service(root);
  await closeService(t, api);
  const source = await openedFile(api, "story");
  const before = git(root, "rev-parse", "HEAD");
  const result = await (await save(api, "story", source, source.content)).json();
  assert.equal(result.saved, true);
  assert.equal(result.changed, false);
  assert.equal(result.sync.state, "unchanged");
  assert.equal(result.sync.committed, false);
  assert.equal(git(root, "rev-parse", "HEAD"), before);
});

test("unrelated staged and unstaged changes are left out of the source commit", async (t) => {
  const { root } = await fixture();
  const api = await service(root);
  await closeService(t, api);
  const source = await openedFile(api, "story");
  const catalog = join(root, "src/lib/studio-catalog.ts");
  await writeFile(catalog, "export const catalog = 'unrelated unstaged';\n");
  const result = await (
    await save(api, "story", source, "export const editor = 'scoped';\n")
  ).json();
  assert.equal(result.sync.pushed, true, result.sync.error);
  assert.deepEqual(
    git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD").split("\n"),
    [source.path],
  );
  assert.match(git(root, "status", "--short"), /studio-catalog\.ts/);

  const second = await fixture();
  const secondApi = await service(second.root);
  await closeService(t, secondApi);
  const secondSource = await openedFile(secondApi, "story");
  await writeFile(
    catalog.replace(root, second.root),
    "export const catalog = 'unrelated staged';\n",
  );
  git(second.root, "add", "src/lib/studio-catalog.ts");
  const secondResult = await (
    await save(secondApi, "story", secondSource, "export const editor = 'staged peer';\n")
  ).json();
  assert.equal(secondResult.sync.pushed, true, secondResult.sync.error);
  assert.deepEqual(
    git(second.root, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD").split("\n"),
    [secondSource.path],
  );
  assert.deepEqual(git(second.root, "diff", "--cached", "--name-only").split("\n"), [
    "src/lib/studio-catalog.ts",
  ]);
});

test("a pre-existing change to the selected file saves locally but is not silently committed", async (t) => {
  const { root } = await fixture();
  const api = await service(root);
  await closeService(t, api);
  const path = studioFiles.story;
  await writeFile(join(root, path), "export const editor = 'pre-existing edit';\n");
  const source = await openedFile(api, "story");
  const result = await (
    await save(api, "story", source, "export const editor = 'new workbench edit';\n")
  ).json();
  assert.equal(result.saved, true);
  assert.equal(result.sync.committed, false);
  assert.equal(result.sync.pushed, false);
  assert.match(result.sync.error, /already has local Git changes/i);
  assert.match(await readFile(join(root, path), "utf8"), /new workbench edit/);
  assert.equal(git(root, "rev-list", "--count", "HEAD"), "1");
});

test("a missing upstream saves locally and reports the exact blocker without guessing", async (t) => {
  const { root } = await fixture();
  git(root, "config", "--unset", "branch.main.remote");
  git(root, "config", "--unset", "branch.main.merge");
  const api = await service(root);
  await closeService(t, api);
  const source = await openedFile(api, "story");
  const result = await (
    await save(api, "story", source, "export const editor = 'local only';\n")
  ).json();
  assert.equal(result.saved, true);
  assert.equal(result.sync.committed, false);
  assert.equal(result.sync.pushed, false);
  assert.match(result.sync.error, /no configured upstream/i);
  assert.equal(git(root, "rev-list", "--count", "HEAD"), "1");
});

test("a commit-hook failure leaves the local file saved and never reports a commit", async (t) => {
  const { root } = await fixture();
  const hook = join(root, ".git/hooks/pre-commit");
  await writeFile(hook, "#!/bin/sh\necho test commit rejection >&2\nexit 1\n");
  await chmod(hook, 0o755);
  const api = await service(root);
  await closeService(t, api);
  const source = await openedFile(api, "story");
  const result = await (
    await save(api, "story", source, "export const editor = 'saved before hook failure';\n")
  ).json();
  assert.equal(result.saved, true);
  assert.equal(result.sync.committed, false);
  assert.equal(result.sync.pushed, false);
  assert.match(result.sync.error, /commit failed/i);
  assert.match(await readFile(join(root, source.path), "utf8"), /saved before hook failure/);
  assert.equal(git(root, "rev-list", "--count", "HEAD"), "1");
});

test("a failed push reports an unconfirmed GitHub state and Retry pushes the same commit once", async (t) => {
  const { root, bare } = await fixture();
  const hook = join(root, ".git/hooks/pre-push");
  await writeFile(hook, "#!/bin/sh\necho test push rejection >&2\nexit 1\n");
  await chmod(hook, 0o755);
  const api = await service(root);
  await closeService(t, api);
  const source = await openedFile(api, "reel");
  const saved = await (
    await save(api, "reel", source, "export const editor = 'committed but not pushed';\n")
  ).json();
  assert.equal(saved.saved, true);
  assert.equal(saved.sync.committed, true);
  assert.equal(saved.sync.pushed, false);
  assert.equal(saved.sync.retryAvailable, true);
  assert.match(saved.sync.error, /not confirm the push/i);
  assert.notEqual(bareGit(bare, "rev-parse", "refs/heads/main"), saved.sync.commit);

  const pending = await (await api.request("/__velori_source/git/pending?studio=reel")).json();
  assert.ok(pending.pending, JSON.stringify({ saved, pending }));
  assert.equal(pending.pending.commit, saved.sync.commit);
  await rm(hook);
  const retried = await (
    await api.request("/__velori_source/git/retry-push", {
      studio: "reel",
      commit: saved.sync.commit,
    })
  ).json();
  assert.equal(retried.sync.pushed, true, retried.sync.error);
  assert.equal(retried.sync.commit, saved.sync.commit);
  assert.equal(bareGit(bare, "rev-parse", "refs/heads/main"), saved.sync.commit);
  assert.equal(git(root, "rev-list", "--count", "HEAD"), "2");
  const duplicateRetry = await (
    await api.request("/__velori_source/git/retry-push", {
      studio: "reel",
      commit: saved.sync.commit,
    })
  ).json();
  assert.match(duplicateRetry.sync.error, /No matching single Source Workbench commit/);
  assert.equal(git(root, "rev-list", "--count", "HEAD"), "2");
});

test("a remote conflict before commit leaves the local save and does not push prior commits", async (t) => {
  const { root, bare } = await fixture();
  const competitor = join(root, "..", "competitor");
  git(root, "clone", "--branch", "main", bare, competitor);
  git(competitor, "config", "user.name", "Remote test");
  git(competitor, "config", "user.email", "remote-test@example.invalid");
  await writeFile(
    join(competitor, "src/lib/studio-catalog.ts"),
    "export const catalog = 'remote ahead';\n",
  );
  git(competitor, "add", "--all");
  git(competitor, "commit", "-m", "Advance remote branch");
  git(competitor, "push", "origin", "main");
  const api = await service(root);
  await closeService(t, api);
  const source = await openedFile(api, "post");
  const before = git(root, "rev-parse", "HEAD");
  const result = await (
    await save(api, "post", source, "export const editor = 'save despite conflict';\n")
  ).json();
  assert.equal(result.saved, true);
  assert.equal(result.sync.committed, false);
  assert.equal(result.sync.pushed, false);
  assert.match(result.sync.error, /branch.*differ/i);
  assert.equal(git(root, "rev-parse", "HEAD"), before);
});

test("unreachable remote errors do not leak credential-bearing URLs", async (t) => {
  const { root } = await fixture();
  const token = "ghp_abcdefghijklmnopqrstuvwxyz123456";
  git(root, "remote", "set-url", "origin", `https://test-user:${token}@127.0.0.1:1/owner/repo.git`);
  const api = await service(root);
  await closeService(t, api);
  const source = await openedFile(api, "story");
  const result = await (
    await save(api, "story", source, "export const editor = 'remote unavailable';\n")
  ).json();
  const responseText = JSON.stringify(result);
  assert.equal(result.saved, true);
  assert.equal(result.sync.committed, false);
  assert.equal(result.sync.pushed, false);
  assert.match(result.sync.error, /GitHub remote could not be read/i);
  assert.equal(responseText.includes(token), false);
  assert.equal(responseText.includes("test-user"), false);
});

test("invalid paths and cross-origin requests cannot use the local source service", async (t) => {
  const { root } = await fixture();
  const api = await service(root);
  await closeService(t, api);
  const denied = await api.request(
    "/__velori_source/files?studio=story",
    undefined,
    "http://outside.example",
  );
  assert.equal(denied.status, 403);
  const invalid = await api.request("/__velori_source/save", {
    studio: "story",
    path: "../../package.json",
    content: "malicious",
    expectedVersion: "anything",
  });
  assert.equal(invalid.status, 400);
  assert.equal(git(root, "rev-list", "--count", "HEAD"), "1");
});

test("Windows formatter treats shell metacharacters in an allowlisted filename as literal", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows shell-injection regression test.");
    return;
  }
  const { root } = await fixture({ remote: false });
  const api = await service(root);
  await closeService(t, api);
  const marker = `velori-shell-injection-${randomUUID()}`;
  const previousMarker = process.env.VELORI_TEST_INJECTION_MARKER;
  process.env.VELORI_TEST_INJECTION_MARKER = marker;
  const path = "src/components/story-editor/editor.ts&echo %VELORI_TEST_INJECTION_MARKER%& rem.ts";
  try {
    await writeFile(join(root, path), "export const safe = true;\n");
    const response = await api.request("/__velori_source/action", {
      action: "format",
      studio: "story",
      path,
    });
    const result = await response.json();
    assert.equal(response.status, 200, result.output);
    assert.equal(result.code, 0, result.output);
    assert.equal(result.output.includes(marker), false);
  } finally {
    if (previousMarker === undefined) delete process.env.VELORI_TEST_INJECTION_MARKER;
    else process.env.VELORI_TEST_INJECTION_MARKER = previousMarker;
  }
});

test("simultaneous saves create no duplicate commits and optimistic versions reject the second writer", async (t) => {
  const { root } = await fixture();
  const api = await service(root);
  await closeService(t, api);
  const source = await openedFile(api, "story");
  const [first, second] = await Promise.all([
    save(api, "story", source, "export const editor = 'first concurrent writer';\n"),
    save(api, "story", source, "export const editor = 'second concurrent writer';\n"),
  ]);
  const results = await Promise.all([first.json(), second.json()]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  assert.equal(results.filter((result) => result.sync?.committed).length, 1);
  assert.equal(git(root, "rev-list", "--count", "HEAD"), "2");
});
