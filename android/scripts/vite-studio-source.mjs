import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readdir, readFile, rename, writeFile, lstat, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { relative, resolve, sep } from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url)).replace(/[\\/]+$/, "");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".html", ".json"]);
const sourceRoots = {
  story: [
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "src/app/story-editor-page.tsx",
    "src/app/story-editor.css",
    "src/index.css",
    "src/styles/reference-ui.css",
    "src/components/story-editor",
    "src/lib/story-editor",
    "src/lib/studio-catalog.ts",
  ],
  reel: [
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "src/app/views.tsx",
    "src/app/social-media-pages.tsx",
    "src/index.css",
    "src/styles/reference-ui.css",
    "src/components/reel-editor",
    "src/lib/reel-editor",
    "src/lib/studio-catalog.ts",
  ],
  post: [
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "src/app/views.tsx",
    "src/index.css",
    "src/styles/reference-ui.css",
    "src/components/post-editor",
    "src/components/studios",
    "src/app/social-engagement.tsx",
    "src/lib/post-editor",
    "src/lib/post-media.ts",
    "src/styles/tokens.css",
    "src/styles/post-studio.css",
    "types/post-editor.ts",
    "src/lib/studio-catalog.ts",
  ],
};
const skippedDirectories = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  "generated",
  "__generated__",
  ".vite",
  "build",
  "out",
  "target",
  "__tests__",
]);
const digest = (source) => createHash("sha256").update(source).digest("hex");
const projectPath = (absolute, root) =>
  absolute.slice(root.length).replaceAll("\\", "/").replace(/^\/+/, "");
const protectedPath = (path) => {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  const segments = normalized.split("/");
  const name = segments.at(-1) ?? "";
  return (
    segments.some((part) =>
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
      ].includes(part),
    ) ||
    name.startsWith(".env") ||
    name.endsWith(".pem") ||
    name.endsWith(".key") ||
    name.endsWith(".p12") ||
    name.endsWith(".pfx") ||
    name.endsWith(".sqlite") ||
    name.endsWith(".db") ||
    name.endsWith(".lock") ||
    [
      "package.json",
      "pnpm-lock.yaml",
      "vite.config.ts",
      "tsconfig.json",
      "deno.json",
      "deno.jsonc",
    ].includes(name)
  );
};

const secretPattern =
  /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|sk_(?:live|test)_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{30,})\b|\b(?:service[_-]?role[_-]?key|secret[_-]?key|private[_-]?key|access[_-]?token|api[_-]?key|client[_-]?secret|password)\s*[:=]\s*["'][^"']{12,}["'])/i;
const repositoryLocks = new Map();
function gitFailureSummary(output, operation) {
  const message = output.toLowerCase();
  if (
    /authentication failed|could not read username|terminal prompts disabled|permission denied \(publickey\)|bad credentials/.test(
      message,
    )
  )
    return "GitHub authentication was unavailable. Check the existing Git credential manager.";
  if (/repository not found|access denied|write access/.test(message))
    return "The configured GitHub repository could not be accessed with the current account.";
  if (/non-fast-forward|fetch first|stale info|remote contains work/.test(message))
    return "The GitHub branch has changed. No force push was attempted; reconcile the branch before retrying.";
  if (/failed to push some refs|hook declined|pre-push/.test(message))
    return "The push was rejected by a local Git hook or remote policy. The local commit remains intact.";
  if (/author identity unknown|unable to auto-detect email|empty ident name/.test(message))
    return "Git commit identity is not configured for this checkout.";
  if (/pre-commit|hook/.test(message)) return `A local Git hook rejected the ${operation}.`;
  if (operation === "remote read")
    return "GitHub remote could not be read. Check network access and the existing Git credential manager.";
  return `Git ${operation} did not complete. Check local Git hooks, network access, repository permissions, and branch status.`;
}

function parseStatus(output) {
  const rows = output.split("\0").filter(Boolean);
  let branch = "";
  const changes = [];
  for (const row of rows) {
    if (row.startsWith("## ")) {
      branch = row.slice(3).split("...")[0];
      continue;
    }
    const indexStatus = row[0] ?? " ";
    const worktreeStatus = row[1] ?? " ";
    const path = row.slice(3);
    if (path)
      changes.push({
        path,
        status: `${indexStatus}${worktreeStatus}`,
        staged: indexStatus !== " " && indexStatus !== "?",
      });
  }
  return { branch, changes };
}

async function runProcess(command, args, cwd, timeoutMs = 90_000) {
  return await new Promise((resolveResult) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" },
    });
    let output = "";
    const append = (chunk) => {
      output = `${output}${chunk.toString()}`.slice(-1_000_000);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolveResult({ code: 1, output: `${output}\n${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveResult({ code, output });
    });
  });
}

async function git(root, args) {
  const result = await runProcess("git", args, root);
  if (result.code !== 0) throw new Error(gitFailureSummary(result.output, args[0]));
  return result.output;
}

async function withRepositoryLock(root, operation) {
  const key = resolve(root).toLowerCase();
  const previous = repositoryLocks.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise((resolveLock) => {
    release = resolveLock;
  });
  repositoryLocks.set(key, current);
  await previous.catch(() => {});
  try {
    return await operation();
  } finally {
    release();
    if (repositoryLocks.get(key) === current) repositoryLocks.delete(key);
  }
}

function isWithinRoot(root, absolute) {
  const rel = relative(root, absolute);
  return (
    Boolean(rel) &&
    rel !== ".." &&
    !rel.startsWith(`..${sep}`) &&
    !resolve(rel).startsWith(`..${sep}`)
  );
}

async function pathsFor(studio, root = projectRoot) {
  if (!sourceRoots[studio]) return null;
  const paths = [];
  for (const entry of sourceRoots[studio]) await collectFiles(`${root}/${entry}`, paths);
  return [...new Set(paths)].sort();
}

async function repositoryRoot(root) {
  const result = await runProcess("git", ["rev-parse", "--show-toplevel"], root);
  if (result.code !== 0) throw new Error("This local folder is not a Git working tree.");
  return await realpath(result.output.trim());
}

function looksLikeGitHubRemote(remoteUrl) {
  return (
    /^(?:https?:\/\/|ssh:\/\/)(?:[^@/]+@)?github\.com(?::\d+)?[/:]/i.test(remoteUrl) ||
    /^git@github\.com:/i.test(remoteUrl)
  );
}

async function gitContext(root, { allowNonGitHubRemote = false } = {}) {
  const repoRoot = await repositoryRoot(root);
  const branchResult = await runProcess("git", ["branch", "--show-current"], repoRoot);
  const branch = branchResult.code === 0 ? branchResult.output.trim() : "";
  let upstreamRemote = "";
  let upstreamBranch = "";
  if (branch) {
    const upstream = await runProcess(
      "git",
      ["for-each-ref", "--format=%(upstream:remotename)%00%(upstream)", `refs/heads/${branch}`],
      repoRoot,
    );
    const [remoteName = "", remoteRef = ""] = upstream.output.split("\0");
    const prefix = remoteName ? `refs/remotes/${remoteName}/` : "";
    if (upstream.code === 0 && remoteName && remoteRef.startsWith(prefix)) {
      upstreamRemote = remoteName;
      upstreamBranch = remoteRef.slice(prefix.length);
    }
  }
  const pushRemoteResult = branch
    ? await runProcess("git", ["config", "--get", `branch.${branch}.pushRemote`], repoRoot)
    : { code: 1, output: "" };
  const defaultPushRemote = await runProcess(
    "git",
    ["config", "--get", "remote.pushDefault"],
    repoRoot,
  );
  const remote =
    (pushRemoteResult.code === 0 && pushRemoteResult.output.trim()) ||
    (defaultPushRemote.code === 0 && defaultPushRemote.output.trim()) ||
    upstreamRemote;
  const merge = branch
    ? await runProcess("git", ["config", "--get", `branch.${branch}.merge`], repoRoot)
    : { code: 1, output: "" };
  const mergeRef = merge.code === 0 ? merge.output.trim() : "";
  const remoteBranch = mergeRef.startsWith("refs/heads/")
    ? mergeRef.slice("refs/heads/".length)
    : upstreamBranch;
  const remoteUrl = remote
    ? await runProcess("git", ["remote", "get-url", remote], repoRoot)
    : { code: 1, output: "" };
  const remoteExists = remoteUrl.code === 0;
  return {
    repoRoot,
    branch,
    detached: !branch,
    upstreamRemote,
    upstreamBranch,
    remote,
    remoteBranch,
    upstreamConfigured: Boolean(upstreamRemote && upstreamBranch),
    remoteConfigured:
      remoteExists && (allowNonGitHubRemote || looksLikeGitHubRemote(remoteUrl.output.trim())),
  };
}

async function currentStagedPaths(root) {
  return (await git(root, ["diff", "--cached", "--name-only", "-z"]))
    .split("\0")
    .filter(Boolean)
    .sort();
}

async function captureSaveBaseline(root, studio, path, options) {
  try {
    const context = await gitContext(root, options);
    const paths = await pathsFor(studio, context.repoRoot);
    if (!paths?.some((absolute) => projectPath(absolute, context.repoRoot) === path))
      return { error: "The file is outside the selected studio source allowlist." };
    if (context.detached) return { error: "The checkout has a detached HEAD." };
    if (!context.upstreamConfigured)
      return {
        error:
          "This branch has no configured upstream. Configure its remote branch before automatic sync.",
      };
    if (!context.remoteConfigured)
      return { error: "The configured push remote is missing or is not a GitHub repository." };
    const tracked = await runProcess(
      "git",
      ["ls-files", "--error-unmatch", "--", path],
      context.repoRoot,
    );
    const pathDiff = await runProcess(
      "git",
      ["diff", "--quiet", "HEAD", "--", path],
      context.repoRoot,
    );
    if (pathDiff.code !== 0)
      return {
        error:
          "This file already has local Git changes. It was saved locally; review and commit its existing changes separately.",
      };
    const head = (await git(context.repoRoot, ["rev-parse", "HEAD"])).trim();
    const staged = await currentStagedPaths(context.repoRoot);
    return {
      context,
      head,
      staged,
      tracked: tracked.code === 0,
      error: tracked.code !== 0 ? "Git could not confirm the selected file is tracked." : "",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Git synchronization is unavailable.",
    };
  }
}

async function remoteHead(context) {
  const result = await runProcess(
    "git",
    ["ls-remote", "--heads", context.remote, `refs/heads/${context.remoteBranch}`],
    context.repoRoot,
    30_000,
  );
  if (result.code !== 0) throw new Error(gitFailureSummary(result.output, "remote read"));
  const line = result.output.trim().split(/\r?\n/).find(Boolean);
  return line ? line.split("\t")[0] : "";
}

function netlifyDeploymentStatus(options) {
  if (!options.netlifyBuildHookUrl && !options.netlifyDeployBranch)
    return {
      state: "not-connected",
      message:
        "Netlify deployment is not configured. Local saves update this development site; hosted deployment requires a Netlify build hook.",
    };
  if (!options.netlifyBuildHookUrl || !options.netlifyDeployBranch)
    return {
      state: "misconfigured",
      message:
        "Netlify deployment needs both a build hook URL and its deploy branch configured on the local Vite server.",
    };
  try {
    const url = new URL(options.netlifyBuildHookUrl);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "api.netlify.com" ||
      !/^\/build_hooks\/[A-Za-z0-9_-]+$/.test(url.pathname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("invalid");
  } catch {
    return {
      state: "misconfigured",
      message:
        "The Netlify build hook URL is invalid. Configure the HTTPS URL from Netlify's Build hooks settings.",
    };
  }
  return {
    state: "connected",
    message: `Netlify deploy hook is configured for branch ${options.netlifyDeployBranch}. Local saves update this development site immediately; a hosted deploy is requested after GitHub confirms a push to that branch.`,
  };
}

async function requestNetlifyDeployment(options, branch) {
  const status = netlifyDeploymentStatus(options);
  if (status.state !== "connected") return status;
  if (branch !== options.netlifyDeployBranch)
    return {
      state: "failed",
      message: `GitHub push succeeded, but Netlify deployment was not requested: the pushed branch "${branch}" does not match the configured Netlify branch "${options.netlifyDeployBranch}".`,
    };
  try {
    const response = await fetch(options.netlifyBuildHookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      return {
        state: "failed",
        message: `GitHub push succeeded, but Netlify rejected the deploy request (HTTP ${response.status}). Retry the deployment after checking the Netlify build hook.`,
      };
    return {
      state: "queued",
      message: `Netlify accepted a deploy request for branch ${branch}. The hosted site will update after its build and publish complete.`,
    };
  } catch {
    return {
      state: "failed",
      message:
        "GitHub push succeeded, but Netlify could not be reached to queue a deploy. Retry after checking the local server's network access.",
    };
  }
}

async function retryNetlifyDeployment(root, commit, options) {
  const context = await gitContext(root, options);
  if (
    context.detached ||
    !context.remoteConfigured ||
    !context.upstreamConfigured ||
    context.remoteBranch !== options.netlifyDeployBranch
  )
    return {
      state: "failed",
      message:
        "Netlify deploy retry requires the current checkout to track the configured Netlify branch.",
    };
  const head = (await git(context.repoRoot, ["rev-parse", "HEAD"])).trim();
  if (head !== commit || (await remoteHead(context)) !== commit)
    return {
      state: "failed",
      message:
        "Netlify deploy retry is limited to the current commit already confirmed on the configured GitHub branch.",
    };
  return await requestNetlifyDeployment(options, context.remoteBranch);
}

function sourceCommitMessage(studio, path, baseCommit) {
  const label = studio[0].toUpperCase() + studio.slice(1);
  const subject = `Update ${label} studio source: ${path.split("/").at(-1)}`.slice(0, 100);
  const marker = Buffer.from(path, "utf8").toString("base64url");
  return `${subject}\n\nVelori-Source-Workbench: ${marker}\nVelori-Source-Base: ${baseCommit}`;
}

async function commitAndPushSavedSource({ root, studio, path, baseline, options }) {
  if (baseline.error)
    return {
      state: "failed",
      committed: false,
      pushed: false,
      retryAvailable: false,
      path,
      error: baseline.error,
    };
  const { context, head, staged: stagedBefore } = baseline;
  let commitCreated = false;
  let commitHash = "";
  let commitSubject = "";
  try {
    const freshContext = await gitContext(root, options);
    if (
      freshContext.repoRoot !== context.repoRoot ||
      freshContext.branch !== context.branch ||
      (await git(context.repoRoot, ["rev-parse", "HEAD"])).trim() !== head
    )
      throw new Error(
        "The active branch or HEAD changed while saving. The file is saved locally; sync was stopped.",
      );
    const remoteSha = await remoteHead(context);
    if (!remoteSha)
      throw new Error(
        `GitHub has no ${context.remoteBranch} branch matching this configured upstream. Sync was stopped safely.`,
      );
    if (remoteSha !== head)
      throw new Error(
        "The GitHub branch and local branch differ. The file is saved locally; update or review the branch before syncing.",
      );

    const added = await runProcess("git", ["add", "--", path], context.repoRoot);
    if (added.code !== 0)
      throw new Error(
        "Git could not stage the saved file. Check file permissions and the Git index state.",
      );
    const stagedNow = await currentStagedPaths(context.repoRoot);
    const expectedStaged = [...new Set([...stagedBefore, path])].sort();
    if (JSON.stringify(stagedNow) !== JSON.stringify(expectedStaged))
      throw new Error(
        "The Git index changed during synchronization. The file remains saved; inspect the index before retrying.",
      );
    const stagedDiff = await git(context.repoRoot, [
      "diff",
      "--cached",
      "--no-color",
      "--unified=0",
      "--",
      path,
    ]);
    const additions = stagedDiff
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"));
    if (additions.some((line) => secretPattern.test(line))) {
      await runProcess("git", ["restore", "--staged", "--", path], context.repoRoot);
      throw new Error(
        "A possible secret was detected in the saved diff. The file is saved locally but was not committed.",
      );
    }

    const message = sourceCommitMessage(studio, path, head);
    commitSubject = message.split("\n")[0];
    const commit = await runProcess(
      "git",
      ["commit", "--only", "-m", message, "--", path],
      context.repoRoot,
    );
    if (commit.code !== 0)
      throw new Error(
        `Git commit failed. The file is saved locally; check the checkout's commit identity and local Git hooks.`,
      );
    commitCreated = true;
    commitHash = (await git(context.repoRoot, ["rev-parse", "HEAD"])).trim();
    const parent = (await git(context.repoRoot, ["rev-parse", "HEAD^"])).trim();
    const committedFiles = (
      await git(context.repoRoot, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])
    )
      .split(/\r?\n/)
      .filter(Boolean)
      .sort();
    if (parent !== head || JSON.stringify(committedFiles) !== JSON.stringify([path]))
      return {
        state: "failed",
        committed: true,
        pushed: false,
        retryAvailable: false,
        path,
        branch: context.branch,
        commit: commitHash,
        message: message.split("\n")[0],
        error: `Commit ${commitHash.slice(0, 12)} exists locally, but Git reported an unexpected commit scope. GitHub was not updated. Inspect the commit before pushing.`,
      };

    const push = await runProcess(
      "git",
      ["push", context.remote, `HEAD:refs/heads/${context.remoteBranch}`],
      context.repoRoot,
      90_000,
    );
    if (push.code !== 0)
      return {
        state: "failed",
        committed: true,
        pushed: false,
        retryAvailable: true,
        path,
        branch: context.branch,
        commit: commitHash,
        message: message.split("\n")[0],
        error: `The file was saved and commit ${commitHash.slice(0, 12)} was created locally, but GitHub did not confirm the push. ${gitFailureSummary(push.output, "push")}`,
      };
    const confirmedSha = await remoteHead(context).catch(() => "");
    if (confirmedSha !== commitHash)
      return {
        state: "failed",
        committed: true,
        pushed: false,
        retryAvailable: true,
        path,
        branch: context.branch,
        commit: commitHash,
        message: message.split("\n")[0],
        error: `Git push returned success for ${commitHash.slice(0, 12)}, but the configured GitHub branch could not be verified. GitHub sync is not confirmed; retry safely.`,
      };
    const deployment = await requestNetlifyDeployment(options, context.remoteBranch);
    return {
      state: "success",
      committed: true,
      pushed: true,
      retryAvailable: false,
      path,
      branch: context.branch,
      commit: commitHash,
      message: message.split("\n")[0],
      timestamp: new Date().toISOString(),
      deployment,
      output: `Saved ${path}, committed ${commitHash.slice(0, 12)}, and verified the push to ${context.remote}/${context.remoteBranch}. ${deployment.message}`,
    };
  } catch (error) {
    return {
      state: "failed",
      committed: commitCreated,
      pushed: false,
      retryAvailable: commitCreated && Boolean(commitHash),
      path,
      branch: context.branch,
      ...(commitHash ? { commit: commitHash } : {}),
      ...(commitSubject ? { message: commitSubject } : {}),
      error: error instanceof Error ? error.message : "Git synchronization failed.",
    };
  }
}

async function retryCandidate(root, studio, options) {
  const context = await gitContext(root, options);
  if (!context.upstreamConfigured || !context.remoteConfigured || context.detached) return null;
  const paths = await pathsFor(studio, context.repoRoot);
  if (!paths) throw new Error("Choose Story, Reel, or Post.");
  const parent = await runProcess("git", ["rev-parse", "HEAD^"], context.repoRoot);
  if (parent.code !== 0) return null;
  const commitMessage = await git(context.repoRoot, ["show", "-s", "--format=%B", "HEAD"]);
  const marker = commitMessage.match(/^Velori-Source-Workbench: ([A-Za-z0-9_-]+)$/m)?.[1];
  const baseMarker = commitMessage.match(/^Velori-Source-Base: ([a-f0-9]{40,64})$/m)?.[1];
  if (!marker || baseMarker !== parent.output.trim()) return null;
  let path = "";
  try {
    path = Buffer.from(marker, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const absolute = paths.find((candidate) => projectPath(candidate, context.repoRoot) === path);
  if (!absolute || protectedPath(path)) return null;
  const committedFiles = (
    await git(context.repoRoot, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])
  )
    .split(/\r?\n/)
    .filter(Boolean);
  if (committedFiles.length !== 1 || committedFiles[0] !== path) return null;
  const commit = (await git(context.repoRoot, ["rev-parse", "HEAD"])).trim();
  if ((await remoteHead(context).catch(() => "")) === commit) return null;
  return {
    context,
    path,
    commit,
    message: commitMessage.split(/\r?\n/).find(Boolean) ?? "Source workbench commit",
  };
}

async function retrySourcePush(root, studio, requestedCommit, options) {
  const candidate = await retryCandidate(root, studio, options);
  if (!candidate || candidate.commit !== requestedCommit)
    return {
      state: "failed",
      committed: false,
      pushed: false,
      error: "No matching single Source Workbench commit is available to retry on this branch.",
    };
  try {
    const remoteSha = await remoteHead(candidate.context);
    if (remoteSha === candidate.commit) {
      const deployment = await requestNetlifyDeployment(options, candidate.context.remoteBranch);
      return {
        state: "success",
        committed: true,
        pushed: true,
        retryAvailable: false,
        path: candidate.path,
        branch: candidate.context.branch,
        commit: candidate.commit,
        message: candidate.message,
        timestamp: new Date().toISOString(),
        deployment,
        output: `GitHub already contains commit ${candidate.commit.slice(0, 12)}. No duplicate commit was created.`,
      };
    }
    const parent = (
      await git(candidate.context.repoRoot, ["rev-parse", `${candidate.commit}^`])
    ).trim();
    if (!remoteSha || remoteSha !== parent)
      throw new Error(
        "The GitHub branch has moved since this commit. No push was attempted; reconcile the branch manually.",
      );
    const push = await runProcess(
      "git",
      ["push", candidate.context.remote, `HEAD:refs/heads/${candidate.context.remoteBranch}`],
      candidate.context.repoRoot,
      90_000,
    );
    if (push.code !== 0)
      throw new Error(
        `GitHub retry failed. The local commit remains intact. ${gitFailureSummary(push.output, "push")}`,
      );
    const confirmedSha = await remoteHead(candidate.context).catch(() => "");
    if (confirmedSha !== candidate.commit)
      throw new Error(
        "The retry command returned success, but GitHub did not confirm the branch head. The push remains unverified.",
      );
    const deployment = await requestNetlifyDeployment(options, candidate.context.remoteBranch);
    return {
      state: "success",
      committed: true,
      pushed: true,
      retryAvailable: false,
      path: candidate.path,
      branch: candidate.context.branch,
      commit: candidate.commit,
      message: candidate.message,
      timestamp: new Date().toISOString(),
      deployment,
      output: `Verified commit ${candidate.commit.slice(0, 12)} on ${candidate.context.remote}/${candidate.context.remoteBranch}. ${deployment.message}`,
    };
  } catch (error) {
    return {
      state: "failed",
      committed: true,
      pushed: false,
      retryAvailable: true,
      path: candidate.path,
      branch: candidate.context.branch,
      commit: candidate.commit,
      message: candidate.message,
      error: error instanceof Error ? error.message : "GitHub retry failed.",
    };
  }
}

async function gitSnapshot(root, studio, options) {
  const context = await gitContext(root, options);
  const paths = await pathsFor(studio, context.repoRoot);
  if (!paths) throw new Error("Choose Story, Reel, or Post.");
  const allowed = new Set(paths.map((path) => projectPath(path, context.repoRoot)));
  const status = parseStatus(
    await git(context.repoRoot, [
      "status",
      "--porcelain=v1",
      "-z",
      "--branch",
      "--untracked-files=all",
      "--no-renames",
    ]),
  );
  const changes = [];
  for (const item of status.changes) {
    const path = item.path.replaceAll("\\", "/");
    if (!allowed.has(path)) continue;
    const absolute = resolve(context.repoRoot, path);
    if (!isWithinRoot(context.repoRoot, absolute)) continue;
    const reasons = [];
    if (protectedPath(path)) reasons.push("Protected infrastructure or sensitive file");
    if (item.status[0] !== " " && item.status[0] !== "?")
      reasons.push("Already staged; the workflow will not rewrite the index");
    let content = "";
    let safeFile = false;
    try {
      const info = await lstat(absolute);
      if (!info.isFile() || info.isSymbolicLink())
        reasons.push("Only regular source files may be synchronized");
      else {
        const actual = await realpath(absolute);
        if (!isWithinRoot(context.repoRoot, actual))
          reasons.push("File resolves outside the repository");
        else {
          safeFile = true;
          content = await readFile(absolute, "utf8");
          if (secretPattern.test(content))
            reasons.push("Possible secret detected in file contents");
        }
      }
    } catch {
      reasons.push("File is missing or unreadable");
    }
    let diff = "";
    if (safeFile && !reasons.some((reason) => reason.includes("secret detected"))) {
      const diffArgs =
        item.status === "??"
          ? [
              "diff",
              "--no-index",
              "--no-color",
              "--",
              process.platform === "win32" ? "NUL" : "/dev/null",
              path,
            ]
          : ["diff", "--no-ext-diff", "--no-color", "HEAD", "--", path];
      const result = await runProcess("git", diffArgs, context.repoRoot);
      if (result.code === 0 || result.code === 1) diff = result.output;
      else reasons.push("Git could not produce a safe diff for this file");
    }
    changes.push({
      path,
      status: item.status,
      eligible: reasons.length === 0,
      reason: reasons.join("; "),
      diff: diff.slice(0, 200_000),
    });
  }
  changes.sort((a, b) => a.path.localeCompare(b.path));
  const stagedNames = await currentStagedPaths(context.repoRoot);
  const fingerprint = digest(
    JSON.stringify({
      branch: context.branch,
      changes: changes.map(({ path, status, diff }) => ({ path, status, diff })),
    }),
  );
  return {
    branch: context.branch,
    detached: context.detached,
    remoteConfigured: context.remoteConfigured,
    remoteName: context.remote,
    upstreamBranch: context.upstreamBranch,
    upstreamConfigured: context.upstreamConfigured,
    stagedChanges: stagedNames.length > 0,
    otherChanges: Math.max(0, status.changes.length - changes.length),
    changes,
    fingerprint,
    deployment: {
      state: "not-connected",
      message:
        "No deployment provider is connected. GitHub sync and deployment are separate operations.",
    },
  };
}
function localRequest(request) {
  const remote = (request.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
  const host = request.headers.host
    ?.split(":")[0]
    ?.replace(/^\[|\]$/g, "")
    .toLowerCase();
  if (
    !["127.0.0.1", "::1"].includes(remote) ||
    !["localhost", "127.0.0.1", "::1"].includes(host ?? "")
  )
    return false;
  const origin = request.headers.origin;
  if (request.method !== "GET" && !origin) return false;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === "http:" &&
      parsed.host === request.headers.host &&
      ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

async function collectFiles(path, output) {
  const info = await lstat(path).catch(() => null);
  if (!info || info.isSymbolicLink()) return;
  if (info.isFile()) {
    const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
    if (sourceExtensions.has(ext) && !/\.(test|spec|d)\.[^.]+$/i.test(path)) output.push(path);
    return;
  }
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    if (entry.isDirectory() || entry.isFile()) await collectFiles(`${path}/${entry.name}`, output);
  }
}

async function requestBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > 1_000_000) throw new Error("The source request is too large.");
  }
  return JSON.parse(body || "{}");
}

function respond(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

async function runCheck(action, sourcePath = null) {
  const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const tasks = { typecheck: ["typecheck"], test: ["test"], build: ["build"] };
  if (action !== "format" && !tasks[action])
    throw new Error("Choose typecheck, test, build, or format an allowlisted source file.");
  if (action === "format" && !sourcePath)
    throw new Error("Choose an allowlisted source file to format.");
  const formatter = action === "format";
  const command = formatter ? process.execPath : packageManager;
  const args = formatter
    ? [resolve(projectRoot, "node_modules/oxfmt/bin/oxfmt"), "--write", "--", sourcePath]
    : tasks[action];
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      shell: !formatter && process.platform === "win32",
      windowsHide: true,
    });
    let output = "";
    const append = (chunk) => {
      output = `${output}${chunk.toString()}`.slice(-12000);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => resolve({ code: 1, output: `${output}\n${error.message}` }));
    child.on("close", (code) => resolve({ code, output }));
  });
}

export default function studioSourcePlugin({
  root = projectRoot,
  allowNonGitHubRemoteForTests = false,
  netlifyBuildHookUrl = "",
  netlifyDeployBranch = "",
} = {}) {
  const gitOptions = {
    allowNonGitHubRemote: allowNonGitHubRemoteForTests,
    netlifyBuildHookUrl,
    netlifyDeployBranch,
  };
  return {
    name: "velori-trusted-local-source-workbench",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith("/__velori_source/")) return next();
        if (!localRequest(request))
          return respond(response, 403, {
            error: "Source access is available only from this computer.",
          });
        try {
          if (request.method === "GET" && url.pathname === "/__velori_source/status") {
            const deployment = netlifyDeploymentStatus(gitOptions);
            return respond(response, 200, {
              available: true,
              mode: "local-development",
              deploys: deployment.state === "connected",
              deployment,
            });
          }
          if (request.method === "GET" && url.pathname === "/__velori_source/files") {
            const studio = url.searchParams.get("studio") ?? "";
            const paths = await pathsFor(studio, root);
            if (!paths) return respond(response, 400, { error: "Choose Story, Reel, or Post." });
            const files = await Promise.all(
              paths.map(async (path) => {
                const source = await readFile(path, "utf8");
                return {
                  path: projectPath(path, root),
                  bytes: Buffer.byteLength(source),
                  version: digest(source),
                };
              }),
            );
            return respond(response, 200, { studio, files });
          }
          if (request.method === "GET" && url.pathname === "/__velori_source/file") {
            const studio = url.searchParams.get("studio") ?? "";
            const requested = url.searchParams.get("path") ?? "";
            const paths = await pathsFor(studio, root);
            const absolute = paths?.find((path) => projectPath(path, root) === requested);
            if (!absolute)
              return respond(response, 404, {
                error: "That file is outside the selected studio source allowlist.",
              });
            const source = await readFile(absolute, "utf8");
            return respond(response, 200, {
              path: requested,
              content: source,
              version: digest(source),
            });
          }
          if (request.method === "POST" && url.pathname === "/__velori_source/save") {
            const body = await requestBody(request);
            return await withRepositoryLock(root, async () => {
              const paths = await pathsFor(body.studio ?? "", root);
              const absolute = paths?.find((path) => projectPath(path, root) === body.path);
              if (!absolute || typeof body.content !== "string" || body.content.length > 750_000)
                return respond(response, 400, {
                  error: "Choose an allowed source file and provide content under 750 KB.",
                });
              const info = await lstat(absolute).catch(() => null);
              if (
                !info?.isFile() ||
                info.isSymbolicLink() ||
                !isWithinRoot(root, await realpath(absolute))
              )
                return respond(response, 403, {
                  error: "Only regular source files inside this repository can be saved.",
                });
              const current = await readFile(absolute, "utf8");
              if (!body.expectedVersion || digest(current) !== body.expectedVersion)
                return respond(response, 409, {
                  error: "This source file changed on disk. Reload it before saving.",
                });
              if (current === body.content)
                return respond(response, 200, {
                  path: body.path,
                  version: digest(body.content),
                  saved: true,
                  changed: false,
                  sync: {
                    state: "unchanged",
                    committed: false,
                    pushed: false,
                    retryAvailable: false,
                  },
                  deployed: false,
                });

              const baseline = await captureSaveBaseline(
                root,
                body.studio ?? "",
                body.path,
                gitOptions,
              );
              const temporary = `${absolute}.velori-save-${process.pid}`;
              try {
                await writeFile(temporary, body.content, { encoding: "utf8", mode: info.mode });
                await rename(temporary, absolute);
              } catch (error) {
                const { unlink } = await import("node:fs/promises");
                await unlink(temporary).catch(() => {});
                throw error;
              }
              const savedContent = await readFile(absolute, "utf8");
              if (digest(savedContent) !== digest(body.content))
                throw new Error("The source file could not be verified after saving.");
              const sync = await commitAndPushSavedSource({
                root,
                studio: body.studio,
                path: body.path,
                baseline,
                options: gitOptions,
              });
              return respond(response, 200, {
                path: body.path,
                version: digest(savedContent),
                saved: true,
                changed: true,
                sync,
                deployed: false,
              });
            });
          }
          if (request.method === "POST" && url.pathname === "/__velori_source/action") {
            const body = await requestBody(request);
            let sourcePath = null;
            if (body.action === "format") {
              const allowed = await pathsFor(body.studio ?? "", root);
              sourcePath = allowed?.find((path) => projectPath(path, root) === body.path) ?? null;
              if (!sourcePath)
                return respond(response, 404, {
                  error: "Format is limited to the selected studio source allowlist.",
                });
            }
            const result = await runCheck(body.action, sourcePath);
            return respond(response, result.code === 0 ? 200 : 422, {
              ...result,
              action: body.action,
              deployed: false,
            });
          }
          if (request.method === "GET" && url.pathname === "/__velori_source/git/status") {
            const studio = url.searchParams.get("studio") ?? "";
            const snapshot = await gitSnapshot(root, studio, gitOptions);
            snapshot.deployment = netlifyDeploymentStatus(gitOptions);
            return respond(response, 200, snapshot);
          }
          if (request.method === "GET" && url.pathname === "/__velori_source/git/pending") {
            const studio = url.searchParams.get("studio") ?? "";
            return await withRepositoryLock(root, async () => {
              const pending = await retryCandidate(root, studio, gitOptions);
              return respond(response, 200, { pending });
            });
          }
          if (request.method === "POST" && url.pathname === "/__velori_source/git/retry-push") {
            const body = await requestBody(request);
            if (typeof body.commit !== "string" || !/^[a-f0-9]{40,64}$/i.test(body.commit))
              return respond(response, 400, {
                error: "Choose a valid pending source commit to retry.",
              });
            return await withRepositoryLock(root, async () => {
              const sync = await retrySourcePush(root, body.studio ?? "", body.commit, gitOptions);
              return respond(response, sync.pushed ? 200 : 422, { sync });
            });
          }
          if (request.method === "POST" && url.pathname === "/__velori_source/deploy/retry") {
            const body = await requestBody(request);
            if (typeof body.commit !== "string" || !/^[a-f0-9]{40,64}$/i.test(body.commit))
              return respond(response, 400, { error: "Choose a valid pushed commit to deploy." });
            return await withRepositoryLock(root, async () => {
              const deployment = await retryNetlifyDeployment(root, body.commit, gitOptions);
              return respond(response, deployment.state === "queued" ? 200 : 422, {
                deployment,
              });
            });
          }
          return respond(response, 404, { error: "Unknown source workbench operation." });
        } catch (error) {
          return respond(response, 500, {
            error: error instanceof Error ? error.message : "The local source service failed.",
          });
        }
      });
    },
  };
}
