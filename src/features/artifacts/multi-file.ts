/* Copyright © 2026 VELORYZ. Source-file validation for local-first FORGE. */
export type SourceFile = { path: string; content: string };
export type ForgeStack = "static" | "react" | "multi-file";
export const safeSourcePath = (path: unknown): path is string =>
  typeof path === "string" &&
  path.length <= 140 &&
  /^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/i.test(path) &&
  !path
    .split("/")
    .some(
      (part) =>
        part === "." ||
        part === ".." ||
        part.startsWith(".env") ||
        [".git", ".ssh", ".aws", ".config"].includes(part),
    ) &&
  !/(?:^|\/)(?:id_rsa|id_ed25519|secrets?|credentials?)(?:\.|$)/i.test(path);
export function parseSourceFiles(value: unknown): SourceFile[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 60)
    throw new Error("Use up to 60 project source files.");
  const paths = new Set<string>();
  let bytes = 0;
  return value.map((raw) => {
    if (
      !raw ||
      !safeSourcePath(raw.path) ||
      typeof raw.content !== "string" ||
      paths.has(raw.path.toLowerCase())
    )
      throw new Error("Invalid, unsafe or duplicate source file path.");
    const size = new TextEncoder().encode(raw.content).length;
    if (size > 500000) throw new Error("Individual source files must be under 500 KB.");
    bytes += size;
    if (bytes > 2000000) throw new Error("Keep total project sources below 2 MB.");
    paths.add(raw.path.toLowerCase());
    return { path: raw.path, content: raw.content };
  });
}
export function parseForgeStack(value: unknown): ForgeStack {
  return value === "react" || value === "multi-file" ? value : "static";
}
export function reactStarterFiles(title: string): SourceFile[] {
  const safeTitle = title.replace(/[<>"'&]/g, "").slice(0, 80) || "VELORI App";
  return parseSourceFiles([
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "velori-react-app",
          private: true,
          version: "1.0.0",
          type: "module",
          scripts: { dev: "vite --host 127.0.0.1", build: "vite build", preview: "vite preview" },
          dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
          devDependencies: {
            vite: "^6.0.0",
            typescript: "^5.0.0",
            "@vitejs/plugin-react": "^4.0.0",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
          },
        },
        null,
        2,
      ),
    },
    {
      path: "index.html",
      content: `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
    },
    {
      path: "src/main.tsx",
      content: `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './style.css';\ncreateRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);\n`,
    },
    {
      path: "src/App.tsx",
      content: `export default function App(){return <main className="app"><span className="eyebrow">VELORI FORGE AI</span><h1>{${JSON.stringify(safeTitle)}}</h1><p>Edit src/App.tsx to build your React experience.</p><button type="button" onClick={()=>window.alert('Interaction ready')}>Try interaction</button></main>}`,
    },
    {
      path: "src/style.css",
      content:
        "*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f6f7fb;color:#171923}.app{max-width:800px;margin:12vh auto;padding:40px;background:white;border:1px solid #e6e8ee;border-radius:24px;box-shadow:0 28px 85px #131c3a12}h1{font-size:clamp(34px,5vw,64px);letter-spacing:-.055em}.eyebrow{font-size:12px;color:#6268ac;font-weight:800;letter-spacing:.14em}button{padding:13px 20px;border:0;border-radius:12px;background:#191c2b;color:#fff;cursor:pointer}",
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            module: "ESNext",
            jsx: "react-jsx",
            moduleResolution: "bundler",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            lib: ["ES2020", "DOM"],
            noEmit: true,
          },
          include: ["src"],
        },
        null,
        2,
      ),
    },
    {
      path: "vite.config.ts",
      content:
        "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins:[react()] });\n",
    },
  ]);
}

/** Portable Python API scaffold. Editing and ZIP export work offline; execution is external. */
export function pythonApiStarterFiles(title: string): SourceFile[] {
  const safeTitle = title.replace(/[<>"'&\r\n]/g, "").slice(0, 80) || "VELORI API";
  return parseSourceFiles([
    {
      path: "main.py",
      content: `from fastapi import FastAPI\nfrom pydantic import BaseModel\n\napp = FastAPI(title=${JSON.stringify(safeTitle)})\n\nclass PingResult(BaseModel):\n    message: str\n\n@app.get("/api/health", response_model=PingResult)\ndef health() -> PingResult:\n    return PingResult(message="ready")\n`,
    },
    {
      path: "requirements.txt",
      content: "fastapi>=0.115,<1\nuvicorn>=0.34,<1\npytest>=8,<10\nhttpx>=0.27,<1\n",
    },
    {
      path: "tests/test_api.py",
      content:
        "from fastapi.testclient import TestClient\nfrom main import app\n\ndef test_health():\n    response = TestClient(app).get('/api/health')\n    assert response.status_code == 200\n    assert response.json()['message'] == 'ready'\n",
    },
    {
      path: "README.md",
      content: `# ${safeTitle}\n\nPortable Python FastAPI source generated as a VELORI FORGE local starter.\n\n## Run locally\n\nCreate a virtual environment, install packages from requirements.txt, and start the API with \`uvicorn main:app --reload\`.\n\nTests: \`pytest\`.\n\nFORGE's static browser preview does **not** execute the Python API. No payment provider or database is connected until you explicitly add one.\n`,
    },
  ]);
}
