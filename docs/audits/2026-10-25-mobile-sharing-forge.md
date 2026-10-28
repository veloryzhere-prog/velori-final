# Mobile sharing and Forge usability — 25 October 2026

Status: frontend VERIFIED within the scope below; AI generation policy IMPLEMENTED, production deployment BLOCKED.

## Changes

- Replaced the post/reel/story sharing overlay with the shared accessible dialog: phone bottom sheet, selectable content link, clipboard action, optional native device share, sign-in return route, and real privacy-filtered username suggestions.
- Kept the existing direct-conversation RPC and message fields. Added an immediate submission guard, stable per-recipient/content nonce across uncertain retries, duplicate-message recovery, and visible failure handling. Search responses are ignored after the query changes.
- Forge now has labeled Build/Update actions, Ctrl/Cmd+Enter, three editable prompt suggestions, Copy source, a readable source label, and a preview-error panel that prepares a fix request without invoking AI automatically.
- Improved phone typography, touch targets, wrapped toolbars and header spacing. Full motion adds short panel/sheet entrances; Gentle/Off avoid them. Existing preview isolation and reduced-motion behavior are preserved.
- Startup artwork dismisses on pointer, keyboard, scroll or touch interaction. A late configuration response cannot obscure a workspace the visitor has already begun using.
- Prepared stronger Gemini instructions for natural language/Hinglish/typos, preservation of existing features, complete JSON-only code output, correct internal links, mobile accessibility, motion, and honest offline capabilities. Server validation rejects empty/misplaced HTML layers and malformed JavaScript without invoking generated code.

## Verification

- Current source recovered from published version 28, commit cd431216441a9d84e97973b9b9543295c140b107.
- Existing full Node suite ran: 297 cases; 281 passed and 16 repository-sync cases failed during fixture setup because Git for Windows could not create its MSYS named object in this sandbox. The first temporary-directory denial was resolved by using a writable workspace directory. Tests were not disabled or rewritten.
- Focused generation/backend policy tests: 15/15 pass, including malformed provider output, syntax checking without executing generated code, code layers and instruction contract.
- Frontend TypeScript and a production build passed. Final formatting, TypeScript, copyright consistency and build are repeated during packaging after the startup refinement.
- Actual Chromium: Forge workspace and guest-state sharing component measured at 320/375/430/768/1024/1440; no horizontal overflow or off-screen share dialog.
- Browser interactions passed: quick suggestions; source copy; Run; real sandbox runtime-error feedback and preparing a repair request; clipboard sharing; Full/Gentle/Off sheet animation; Escape and focus restoration; startup absent after early interaction. Zero unexpected page errors. Deliberately generated preview errors are recorded as expected.
- Screenshots inspected: phone Build, live preview and guest share sheet. Sharing fixture was explicitly labeled local component QA, without account data, and removed before packaging.

## Boundaries and remaining acceptance

- AI Edge policy was not deployed. The previous deployment attempt was not executed because automatic approval review could not run after a usage limit. It was not retried through a different path. Live velori-studio remains version 1 and still needs protected provider/encryption/activation configuration.
- No real model request, charge, receipt or message was sent during acceptance. Actual authenticated username discovery, multi-account share delivery, blocked/private content, physical-device share sheets and device keyboards still need end-to-end acceptance.
- Syntax validation cannot guarantee runtime-correct or error-free generated applications. Preview error reporting provides recovery; the current draft remains reviewable.
- No new dependency, schema, permission, secret or administrator-account changes. Existing staged transcription/commercial backend proposals were not deployed.
