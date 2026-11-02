# VELORI staging AI end-to-end test procedure

This procedure is designed for a real staging Supabase deployment with server-side secrets already configured. It is for verification, not for local development or production deployment.

## Preconditions

- The app is deployed to a staging host or domain, and the origin is listed in `VELORI_STUDIO_ORIGINS`.
- `VELORI_STUDIO_ENABLED=true`
- `VELORI_STUDIO_GENERATION_ENABLED=true`
- `VELORI_STUDIO_ENCRYPTION_KEY` is present and valid.
- `GEMINI_API_KEY` and `VELORI_GEMINI_MODEL` are configured and approved.
- The user has an authenticated account in the same Supabase project.
- The database schema has been applied and the `velori-studio` Edge Function is live.

## 1. Server readiness check

Call the secure status route using the authenticated user session:

- `POST /functions/v1/velori-studio`
- Body: `{ "action": "status" }`

Expected result:

- `status` or capability payload indicates database, encryption, provider and generation readiness.
- No secret values are returned.
- Clear `503` errors appear when the environment is missing required values.

## 2. Authenticated generation request

Send a generation request using the authenticated session token:

- `POST /functions/v1/velori-studio`
- Headers: `apikey: <project public publishable/anon key>`, `Authorization: Bearer <test-user access token>`, `Content-Type: application/json`.
- Never use `SUPABASE_SERVICE_ROLE_KEY` for a browser request or user acceptance test.
- Body includes:
  - `action`: `"generate"`
  - `requestId`: a UUID
  - `prompt`: a natural-language app request
  - `pages`: current pages or one valid `index` page for a fresh project; do not send an empty array
  - `files`: the current project file set if available
  - `stack`: `"react"` to request a multi-file React project
  - `history`: recent prompt-history entries

Expected result:

- The route accepts the request only after auth, quota and generation gating passes.
- The response returns structured generated code and page sources.
- No raw provider key or secret appears in the response.
- If the runtime is misconfigured, the response returns a safe `503` or `429` error instead of exposing internals.

## 3. Local project persistence and quota accounting

This release is local-first: generated source is returned to the authenticated browser and saved to the user's device. The Edge Function stores accounting receipts, not generated source code. Do not expect a cloud project row to be created by generation.

Checks:

- Record the authenticated account's quota before requesting generation.
- Confirm the request reserves one allowance and creates an idempotent request receipt.
- Approve/apply the returned candidate in FORGE and verify the project survives a page reload in the same browser profile.
- Confirm the source is not persisted in the server receipt (`result` remains null) and no project source is sent to cloud storage by this flow.
- Request a deliberately invalid/failed generation in staging with an approved test account and verify the reservation is released.

Expected result:

- A successful request resolves to `complete` in `velori_studio_requests`; the account ledger reflects one consumed allowance.
- A failed request resolves to `failed`; free/token allowance is restored according to its recorded source.
- The generated source remains in local browser storage, while server events and receipts contain no source body.
- Repeating the same `requestId` does not start a second provider call or charge twice.

## 4. Multi-file React source validation

Verify the generated result includes the required file structure for a browser app and that each file remains within the safe size and content limits:

- `index.html`
- `src/` assets and entry files
- CSS and JavaScript payloads
- No traversal or reserved path names
- No oversized payloads or unsafe base64 content

Expected result:

- The parsed payload is accepted by `parsePages()` / `parseSourceFiles()`.
- The React starter contains `package.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/style.css`, `vite.config.ts` and `tsconfig.json`.
- Generated source can be exported as a ZIP and the static HTML preview remains explicitly separate from React runtime execution.
- FORGE does not execute generated React code inside the application browser in this release.

## 5. Acceptance criteria

The deployment is ready for controlled production rollout only if:

- the authenticated request path succeeds with a real provider key and valid model;
- delivery works for a real multi-file app request;
- project source persists locally after the user applies it, without being uploaded by this generation path;
- quota accounting reflects reserved, completed and failed requests accurately;
- the response remains safe, bounded and free of secret material.
