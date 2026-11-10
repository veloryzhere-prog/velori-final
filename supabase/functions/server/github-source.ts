import { type Ctx, readJson, requireRecentReauth, writeAudit } from "./admin-core.ts";
import {
  creatorSourceReviewBranchName,
  isEligibleCreatorSourcePath,
  validateCreatorSourceFiles,
} from "./github-source-guards.ts";

const MAX_FILE_BYTES = 750_000;
type GitHubObject = Record<string, unknown>;

type GitHubConfig = {
  appId: string;
  privateKey: string;
  installationId: string;
  owner: string;
  repo: string;
  base: string;
};

function asGitHubObject(value: unknown): GitHubObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as GitHubObject)
    : null;
}

class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function config(): GitHubConfig | null {
  const appId = Deno.env.get("GITHUB_APP_ID") ?? "";
  const privateKey = (Deno.env.get("GITHUB_APP_PRIVATE_KEY") ?? "").replaceAll("\\n", "\n");
  const installationId = Deno.env.get("GITHUB_APP_INSTALLATION_ID") ?? "";
  const [owner = "", repo = ""] = (Deno.env.get("GITHUB_REPOSITORY") ?? "").split("/");
  if (!appId || !privateKey || !installationId || !owner || !repo) return null;
  return {
    appId,
    privateKey,
    installationId,
    owner,
    repo,
    base: Deno.env.get("GITHUB_BASE_BRANCH") || "main",
  };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function der(tag: number, value: Uint8Array): Uint8Array {
  const length = value.length;
  const lengthBytes =
    length < 128
      ? new Uint8Array([length])
      : (() => {
          const hex = length
            .toString(16)
            .padStart(Math.ceil(length.toString(16).length / 2) * 2, "0");
          const bytes = hex.match(/../g)!.map((part) => Number.parseInt(part, 16));
          return new Uint8Array([0x80 | bytes.length, ...bytes]);
        })();
  return new Uint8Array([tag, ...lengthBytes, ...value]);
}

function concat(...values: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(values.reduce((total, value) => total + value.length, 0));
  let offset = 0;
  for (const value of values) {
    output.set(value, offset);
    offset += value.length;
  }
  return output;
}

function appJwt(settings: GitHubConfig): Promise<string> {
  const pkcs1 = settings.privateKey.includes("BEGIN RSA PRIVATE KEY");
  const pem = settings.privateKey.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, "");
  const rawKey = Uint8Array.from(atob(pem), (character) => character.charCodeAt(0));
  const keyData = pkcs1
    ? der(
        0x30,
        concat(
          new Uint8Array([0x02, 0x01, 0x00]),
          new Uint8Array([
            0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05,
            0x00,
          ]),
          der(0x04, rawKey),
        ),
      )
    : rawKey;
  const keyBuffer = new ArrayBuffer(keyData.byteLength);
  new Uint8Array(keyBuffer).set(keyData);
  return crypto.subtle
    .importKey("pkcs8", keyBuffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"])
    .then(async (key) => {
      const now = Math.floor(Date.now() / 1000);
      const unsigned = `${base64Url(
        new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
      )}.${base64Url(
        new TextEncoder().encode(
          JSON.stringify({
            iat: now - 30,
            exp: now + 540,
            iss: settings.appId,
          }),
        ),
      )}`;
      const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        new TextEncoder().encode(unsigned),
      );
      return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
    });
}

async function requestData(path: string, token: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = asGitHubObject(data)?.message;
    throw new GitHubApiError(
      `${
        typeof message === "string" ? message : `GitHub returned HTTP ${response.status}.`
      } (HTTP ${response.status})`,
      response.status,
    );
  }
  return data;
}

async function request(path: string, token: string, init: RequestInit = {}): Promise<GitHubObject> {
  const data = asGitHubObject(await requestData(path, token, init));
  if (!data) throw new Error("GitHub returned an invalid object response.");
  return data;
}

async function requestList(path: string, token: string): Promise<GitHubObject[]> {
  const data = await requestData(path, token);
  if (!Array.isArray(data)) {
    throw new Error("GitHub returned an invalid list response.");
  }
  const items = data.map(asGitHubObject);
  if (items.some((item) => item === null)) {
    throw new Error("GitHub returned an invalid item in a list response.");
  }
  return items.filter((item): item is GitHubObject => item !== null);
}

async function requestOptional(path: string, token: string): Promise<GitHubObject | null> {
  try {
    return await request(path, token);
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) return null;
    throw error;
  }
}

function gitRefPath(repoPath: string, branch: string): string {
  return `${repoPath}/git/ref/heads/${branch.split("/").map(encodeURIComponent).join("/")}`;
}

async function github(settings: GitHubConfig) {
  const jwt = await appJwt(settings);
  const installation = await request(
    `/app/installations/${encodeURIComponent(settings.installationId)}/access_tokens`,
    jwt,
    { method: "POST", body: "{}" },
  );
  if (typeof installation.token !== "string") {
    throw new Error("GitHub did not issue an installation token.");
  }
  return {
    token: installation.token,
    repoPath: `/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}`,
  };
}

async function baseRevision(token: string, repoPath: string, base: string) {
  const ref = await request(gitRefPath(repoPath, base), token);
  const sha = asGitHubObject(ref.object)?.sha;
  if (typeof sha !== "string") {
    throw new Error("The configured GitHub base branch was not found.");
  }
  const commit = await request(`${repoPath}/git/commits/${sha}`, token);
  const tree = asGitHubObject(commit.tree)?.sha;
  if (typeof tree !== "string") {
    throw new Error("GitHub could not read the base tree.");
  }
  return { sha, tree };
}

async function existingReviewCommit(
  token: string,
  repoPath: string,
  branch: string,
  baseSha: string,
  treeSha: string,
): Promise<string | null> {
  const ref = await requestOptional(gitRefPath(repoPath, branch), token);
  if (!ref) return null;
  const sha = asGitHubObject(ref.object)?.sha;
  if (typeof sha !== "string") {
    throw new Error("GitHub returned an invalid source review ref.");
  }
  const commit = await request(`${repoPath}/git/commits/${encodeURIComponent(sha)}`, token);
  const currentTreeSha = asGitHubObject(commit.tree)?.sha;
  const parents = Array.isArray(commit.parents)
    ? commit.parents.map(asGitHubObject).filter((parent) => parent !== null)
    : [];
  if (currentTreeSha !== treeSha || parents.length !== 1 || parents[0].sha !== baseSha) {
    throw new GitHubApiError(
      "A source review branch with this identity already exists with different content. It was not overwritten.",
      409,
    );
  }
  return sha;
}

async function existingReviewPullRequest(
  token: string,
  repoPath: string,
  owner: string,
  branch: string,
  base: string,
): Promise<GitHubObject | null> {
  const query = new URLSearchParams({
    state: "all",
    head: `${owner}:${branch}`,
    base,
    per_page: "100",
  });
  const pullRequests = await requestList(`${repoPath}/pulls?${query}`, token);
  return (
    pullRequests.find(
      (pullRequest) =>
        asGitHubObject(pullRequest.head)?.ref === branch &&
        asGitHubObject(pullRequest.base)?.ref === base,
    ) ?? null
  );
}

export const handleCreatorSourceFilesGet = async (c: Ctx) => {
  const settings = config();
  if (!settings) {
    return c.json(
      {
        error: "GitHub App integration is not configured on the server.",
      },
      503,
    );
  }
  try {
    const { token, repoPath } = await github(settings);
    const base = await baseRevision(token, repoPath, settings.base);
    const tree = await request(`${repoPath}/git/trees/${base.tree}?recursive=1`, token);
    if (!Array.isArray(tree.tree) || tree.truncated) {
      return c.json({ error: "GitHub returned an incomplete source tree." }, 503);
    }
    const entries = tree.tree;
    const files: Array<{ path: string; sha: string; bytes: number }> = [];
    for (const entry of entries) {
      const item = asGitHubObject(entry);
      if (
        !item ||
        item.type !== "blob" ||
        typeof item.path !== "string" ||
        typeof item.sha !== "string" ||
        !isEligibleCreatorSourcePath(item.path)
      ) {
        continue;
      }
      files.push({
        path: item.path,
        sha: item.sha,
        bytes: typeof item.size === "number" ? item.size : 0,
      });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    return c.json({
      branch: settings.base,
      baseSha: base.sha,
      files,
      deployment: {
        state: "not-deployed",
        message:
          "This source review does not deploy the website. Deployment happens through the repository's normal merge and release workflow.",
      },
    });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? `GitHub source listing failed: ${error.message}`
            : "GitHub source listing failed.",
      },
      502,
    );
  }
};

export const handleCreatorSourceFileGet = async (c: Ctx) => {
  const path = c.req.query("path") ?? "";
  if (!isEligibleCreatorSourcePath(path)) {
    return c.json(
      {
        error: "That path is outside the approved creator source files.",
      },
      403,
    );
  }
  const settings = config();
  if (!settings) {
    return c.json(
      {
        error: "GitHub App integration is not configured on the server.",
      },
      503,
    );
  }
  try {
    const { token, repoPath } = await github(settings);
    const base = await baseRevision(token, repoPath, settings.base);
    const file = await request(
      `${repoPath}/contents/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}?ref=${encodeURIComponent(base.sha)}`,
      token,
    );
    if (file.type !== "file" || typeof file.content !== "string" || typeof file.sha !== "string") {
      return c.json({ error: "GitHub did not return a source file." }, 404);
    }
    const content = new TextDecoder().decode(
      Uint8Array.from(atob(file.content.replaceAll("\n", "")), (character) =>
        character.charCodeAt(0),
      ),
    );
    if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) {
      return c.json(
        {
          error: "That source file exceeds the 750 KB editor limit.",
        },
        413,
      );
    }
    return c.json({
      path,
      content,
      sha: file.sha,
      baseSha: base.sha,
      branch: settings.base,
    });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? `GitHub source file could not be loaded: ${error.message}`
            : "GitHub source file could not be loaded.",
      },
      502,
    );
  }
};

export const handleCreatorSourcePullRequest = async (c: Ctx) => {
  const reauth = await requireRecentReauth(c, 10);
  if (reauth) return reauth;
  const parsed = await readJson(c.req.raw);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const title =
    typeof parsed.value.title === "string" ? parsed.value.title.trim().slice(0, 120) : "";
  const body = typeof parsed.value.body === "string" ? parsed.value.body.trim().slice(0, 4000) : "";
  const baseSha = parsed.value.baseSha;
  if (title.length < 5 || typeof baseSha !== "string" || !/^[a-f0-9]{40}$/i.test(baseSha)) {
    return c.json(
      {
        error: "Provide a review title and the source revision you reviewed.",
      },
      400,
    );
  }
  const validated = validateCreatorSourceFiles(parsed.value.files);
  if (!validated.ok) return c.json({ error: validated.error }, 400);
  const settings = config();
  if (!settings) {
    return c.json(
      {
        error: "GitHub App integration is not configured on the server.",
      },
      503,
    );
  }
  const { user } = c.get("admin");
  let reviewBranch: string | undefined;
  let reviewCommitSha: string | undefined;
  try {
    const { token, repoPath } = await github(settings);
    const base = await baseRevision(token, repoPath, settings.base);
    if (base.sha !== baseSha) {
      return c.json(
        {
          error:
            "The base branch changed after review. Reload the source files and review the new diff.",
        },
        409,
      );
    }
    for (const file of validated.files) {
      const current = await request(
        `${repoPath}/contents/${file.path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}?ref=${encodeURIComponent(base.sha)}`,
        token,
      );
      if (current.sha !== file.sha) {
        return c.json(
          {
            error: `${file.path} changed on GitHub after it was loaded. Reload and review it again.`,
          },
          409,
        );
      }
    }
    const blobs = await Promise.all(
      validated.files.map(async (file) => {
        const blob = await request(`${repoPath}/git/blobs`, token, {
          method: "POST",
          body: JSON.stringify({
            content: base64(new TextEncoder().encode(file.content)),
            encoding: "base64",
          }),
        });
        if (typeof blob.sha !== "string") {
          throw new Error("GitHub did not return a source blob.");
        }
        return { path: file.path, mode: "100644", type: "blob", sha: blob.sha };
      }),
    );
    const tree = await request(`${repoPath}/git/trees`, token, {
      method: "POST",
      body: JSON.stringify({ base_tree: base.tree, tree: blobs }),
    });
    if (typeof tree.sha !== "string") {
      throw new Error("GitHub did not return the review tree.");
    }
    const branch = await creatorSourceReviewBranchName(base.sha, validated.files);
    reviewBranch = branch;
    let commitSha = await existingReviewCommit(token, repoPath, branch, base.sha, tree.sha);
    if (!commitSha) {
      const commit = await request(`${repoPath}/git/commits`, token, {
        method: "POST",
        body: JSON.stringify({
          message: title,
          tree: tree.sha,
          parents: [base.sha],
        }),
      });
      if (typeof commit.sha !== "string") {
        throw new Error("GitHub did not return the review commit.");
      }
      try {
        await request(`${repoPath}/git/refs`, token, {
          method: "POST",
          body: JSON.stringify({
            ref: `refs/heads/${branch}`,
            sha: commit.sha,
          }),
        });
        commitSha = commit.sha;
      } catch (error) {
        if (!(error instanceof GitHubApiError && error.status === 422)) {
          throw error;
        }
        commitSha = await existingReviewCommit(token, repoPath, branch, base.sha, tree.sha);
        if (!commitSha) throw error;
      }
    }
    if (!commitSha) {
      throw new Error("GitHub did not confirm the source review commit.");
    }
    reviewCommitSha = commitSha;

    let pullRequest: GitHubObject | null = await existingReviewPullRequest(
      token,
      repoPath,
      settings.owner,
      branch,
      settings.base,
    );
    let reusedPullRequest = pullRequest !== null;
    if (!pullRequest) {
      try {
        pullRequest = await request(`${repoPath}/pulls`, token, {
          method: "POST",
          body: JSON.stringify({
            title,
            head: branch,
            base: settings.base,
            body:
              body || "Creator source changes prepared through the VELORI admin review workflow.",
          }),
        });
      } catch (error) {
        try {
          pullRequest = await existingReviewPullRequest(
            token,
            repoPath,
            settings.owner,
            branch,
            settings.base,
          );
        } catch (statusError) {
          let auditRecorded = true;
          try {
            await writeAudit(c.req.raw, {
              adminUserId: user.id,
              action: "admin.creator_source.branch_created",
              targetType: "git_branch",
              targetId: branch,
              reason: "pull_request_status_unverified",
              result: "failure",
              metadata: {
                files: validated.files.map((file) => file.path),
                commit: commitSha,
              },
            });
          } catch {
            auditRecorded = false;
          }
          return c.json(
            {
              error: `The source branch and commit exist, but GitHub could not verify pull-request status after the create request failed: ${
                error instanceof Error ? error.message : "Unknown GitHub error."
              }; status lookup failed: ${
                statusError instanceof Error ? statusError.message : "Unknown GitHub error."
              }. Retrying this same source edit will reuse its branch and commit.`,
              branch,
              commit: commitSha,
              pushed: true,
              pullRequestCreated: false,
              auditRecorded,
            },
            502,
          );
        }
        if (!pullRequest) {
          let auditRecorded = true;
          try {
            await writeAudit(c.req.raw, {
              adminUserId: user.id,
              action: "admin.creator_source.branch_created",
              targetType: "git_branch",
              targetId: branch,
              reason: "pull_request_creation_failed",
              result: "failure",
              metadata: {
                files: validated.files.map((file) => file.path),
                commit: commitSha,
              },
            });
          } catch {
            auditRecorded = false;
          }
          return c.json(
            {
              error: `The source branch and commit exist, but GitHub did not confirm a pull request: ${
                error instanceof Error ? error.message : "Unknown GitHub error."
              }. Retrying this same source edit will reuse its branch and commit.`,
              branch,
              commit: commitSha,
              pushed: true,
              pullRequestCreated: false,
              auditRecorded,
            },
            502,
          );
        }
        reusedPullRequest = true;
      }
    }
    if (!pullRequest) throw new Error("GitHub did not return a pull request.");
    const pullRequestNumber = pullRequest.number;
    const pullRequestUrl = pullRequest.html_url;
    const pullRequestState = pullRequest.state;
    if (
      typeof pullRequestNumber !== "number" ||
      typeof pullRequestUrl !== "string" ||
      typeof pullRequestState !== "string"
    ) {
      throw new Error("GitHub returned an incomplete pull request response.");
    }
    if (
      asGitHubObject(pullRequest.head)?.ref !== branch ||
      asGitHubObject(pullRequest.head)?.sha !== commitSha ||
      asGitHubObject(pullRequest.base)?.ref !== settings.base
    ) {
      throw new GitHubApiError(
        "GitHub returned a pull request whose source branch or base no longer matches this edit.",
        409,
      );
    }
    if (pullRequestState !== "open") {
      return c.json(
        {
          error: `A previous pull request for this exact source edit is ${pullRequestState}; it was not reopened or duplicated.`,
          branch,
          commit: commitSha,
          pullRequest: {
            number: pullRequestNumber,
            url: pullRequestUrl,
            state: pullRequestState,
          },
        },
        409,
      );
    }

    let auditRecorded = true;
    try {
      await writeAudit(c.req.raw, {
        adminUserId: user.id,
        action: reusedPullRequest
          ? "admin.creator_source.pull_request_reused"
          : "admin.creator_source.pull_request_created",
        targetType: "pull_request",
        targetId: String(pullRequestNumber),
        metadata: {
          branch,
          files: validated.files.map((file) => file.path),
          commit: commitSha,
        },
      });
    } catch {
      auditRecorded = false;
    }
    return c.json({
      branch,
      commit: commitSha,
      pullRequest: {
        number: pullRequestNumber,
        url: pullRequestUrl,
        state: pullRequestState,
      },
      reused: reusedPullRequest,
      auditRecorded,
      warning: auditRecorded
        ? undefined
        : "The pull request exists, but the administrator audit log could not be written.",
      deployment: {
        state: "not-deployed",
        message: "A pull request is ready for review. It has not been merged or deployed.",
      },
    });
  } catch (error) {
    const retryNote =
      reviewBranch && reviewCommitSha
        ? ` The exact review branch ${reviewBranch} and commit ${reviewCommitSha} already exist; retrying this same edit will reuse them.`
        : "";
    const status = error instanceof GitHubApiError && error.status === 409 ? 409 : 502;
    return c.json(
      {
        error:
          error instanceof Error
            ? `GitHub pull request failed: ${error.message}${retryNote}`
            : "GitHub pull request failed.",
      },
      status,
    );
  }
};
