# Rights verification checklist

**Current status: NOT CLEARED.** This checklist reflects repository-visible evidence only and is not a legal conclusion.

- [ ] Confirm the legal identity of the rights holder and authorized representative.
- [ ] Locate and review executed contributor/employee/contractor assignments or sufficient licences for existing first-party code.
- [ ] Verify the Git/Figma Make project history and terms applicable to imported/exported source.
- [ ] Resolve source and asset provenance for `.figma/`, `src/imports/`, brand logos, error/maintenance artwork, videos, templates, fonts, and icons.
- [ ] Review React/Vite starter assets in `reel-studio/src/assets/` and retain required notices or replace them.
- [ ] Review direct and transitive dependency licences against resolved lockfile versions and upstream licence texts.
- [ ] Complete required third-party attributions and redistribution notices.
- [ ] Have counsel review and approve the proposed proprietary terms in [LICENSE](../../LICENSE) and the intended public legal statements.
- [ ] Verify repository visibility, collaborator access, branch rules, secret scanning, and protected release controls with an authorized repository administrator.
- [ ] Identify the actual frontend production host, deployment project, protected credentials, and release checks; verify a real deployment before claiming automation.
- [ ] Configure a verified reporting contact before publishing an infringement-reporting policy.
- [ ] Populate `copyright-header-policy.json` only with paths for which first-party ownership/authorization is evidenced.
- [ ] Run `pnpm run copyright:check` and, only after all sources and rights are resolved, `pnpm run copyright:check -- --strict`.

Unresolved checklist items must remain visible; repository presence or a successful build does not clear them.
