import type { Plugin } from "vite";
export default function studioSourcePlugin(options?: {
  root?: string;
  allowNonGitHubRemoteForTests?: boolean;
  netlifyBuildHookUrl?: string;
  netlifyDeployBranch?: string;
}): Plugin;
