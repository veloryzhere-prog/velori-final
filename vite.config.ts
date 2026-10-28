import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import studioSourcePlugin from "./scripts/vite-studio-source.mjs";

export default defineConfig({
  server: {
    allowedHosts: ["terminal.local"],
    // Isolate only an explicit runtime QA origin; global social/auth headers are unchanged.
    headers: process.env.VELORI_FORGE_ISOLATION_QA === "true" ? {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    } : {},
  },
  plugins: [
    react(),
    tailwindcss(),
    studioSourcePlugin({
      netlifyBuildHookUrl: process.env.VELORI_NETLIFY_BUILD_HOOK_URL,
      netlifyDeployBranch: process.env.VELORI_NETLIFY_DEPLOY_BRANCH,
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
