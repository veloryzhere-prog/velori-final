# License review

- Existing VELORI source notices, dependencies and legal inventory retained. This report does not assert ownership of unresolved third-party assets or AI-generated user work.
- Added `@webcontainer/api` 1.6.4, pinned in package.json and pnpm-lock.yaml. Its SDK LICENSE is reproduced under references/webcontainer-sdk-LICENSE.txt. The SDK wrapper license does not remove the separate commercial runtime licensing requirement.
- Official WebContainer commercial policy: https://webcontainers.io/enterprise — production commercial use needs a license. No VELORI license/contract was supplied or verified, so the production runtime gate remains disabled.
- Official runtime prerequisites: https://webcontainers.io/guides/quickstart — secure context, SharedArrayBuffer and reviewed isolation headers. No protection was disabled.
- Official bolt.diy README and license reviewed: https://github.com/stackblitz-labs/bolt.diy and https://github.com/stackblitz-labs/bolt.diy/blob/main/LICENSE (MIT; StackBlitz and contributors). Its runtime source pages could not be retrieved through search. No bolt.diy source was copied or vendored. New adapter/orchestration files are original implementation informed by documented runtime interfaces; this is not a full upstream integration audit.
- Docker image contents are operator-supplied, digest-pinned and not bundled. Audit their distribution and dependency licenses before deployment. No Electron binary or new container image is included.
- Existing licensing, watermarks, payment entitlements and generated-work rights remain separate. No frontend entitlement grants were added. Stripe production billing was not enabled or altered.

## Inventory status (2026-10-27)

The latest hash-based inventory covers 952 meaningful files; 949 origins remain unresolved. The matching check verifies inventory consistency only and does not establish ownership or licensing. No WebContainer commercial authorization was supplied or verified, so its production runtime remains disabled.
