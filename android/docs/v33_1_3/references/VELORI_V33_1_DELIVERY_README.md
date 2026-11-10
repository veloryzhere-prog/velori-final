# VELORI V33.1 — Blueprint handoff package

**This is an implementation package, not an implemented or live V33.1 update.**

## Contents

- `VELORI_V33_1_PRODUCTION_BLUEPRINT.md`: complete 19-section release specification (product architecture, chat UI, music, stories, quotas, runtimes, security, copyright, QA and release runbook).
- `VELORI_V33_1_UI_REFERENCE.html`: standalone responsive, clickable **design prototype**, with FORGE chat, story navigation, music selection and admin states. No live API calls or production data.
- `VELORI_V33_1_WORK_EXECUTION_BRIEF.md`: action-oriented handoff instructions for the Work project holding the true V33 source.
- `V31_BASED_REFERENCE_PATCH.zip`: previously created patch against V31; **review and rebase file-by-file**, not a direct V33 replacement.
- `V31_BASED_PATCH_RELEASE_NOTES.md`: verification scope, outstanding work, test evidence and warnings.
- `V33_1_RELEASE_GATES.csv`: track completion and evidence for each release blocker.
- `MANIFEST.json`: packaging and provenance information.

## Installation / usage

1. Open the active VELORI V33 **Work** project and attach the blueprint, execution brief and (optionally) the UI reference.
2. Confirm the V33 source commit and whether its migrations differ from the V31 snapshot.
3. Use the reference patch for *individual* merge hunks only. Do not blindly copy it over live files.
4. Run each acceptance gate and document test evidence.
5. Publish the release only after all production gates pass.

## Important corrections

- Gemini is the model provider, not a full-stack builder runtime.
- Server progress must come from real run events, not simulated activity.
- Copyright and free-tier watermark/branding are different legal/technical concepts.
- Post soundtracks are linked media; exported images do not carry audio.
- Third-party licenses, audio distribution rights, vendor quotas and sandbox safety still apply.
- Actual current V33 source is **not available** in this chat's accessible files/connectors; full source here is V31 and must not be substituted.
