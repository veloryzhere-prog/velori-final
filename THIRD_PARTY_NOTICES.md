# Third-party notices and licence review

This file is a register entry point, not a declaration that every dependency or asset has been legally cleared.

## Software dependencies

Direct runtime and development dependencies are declared in the root `package.json` and, where present, nested package manifests. Their installed package version and declared licence metadata are captured in [the machine-readable IP inventory](./docs/legal/intellectual-property-inventory.json) when the package is installed. Package metadata may be missing or inaccurate and does not replace the upstream `LICENSE`, `NOTICE`, or attribution file.

Before a release, review direct and transitive dependencies for:

- the exact version resolved by the lockfile;
- the complete licence text and any copyright notices;
- source-distribution, attribution, patent, notice, or copyleft obligations;
- compatibility with the intended proprietary distribution and deployment model.

The repository uses React, Vite, Supabase JS, Tailwind CSS, CodeMirror, Remotion/Twick, Framer Motion/Motion, Lucide and other packages. This list is illustrative, not exhaustive; the package manifests and lockfiles are authoritative for the dependency set.

## Assets and imported material

The repository includes Figma Make/import indicators and media, image, SVG, and font assets. The available repository does not establish the creator, source, applicable tool terms, or redistribution permission for every asset. The inventory marks those records for rights review; do not treat branding, filenames, or local presence as proof of ownership.

React/Vite starter artwork under `reel-studio/src/assets/` is treated as third-party scaffold material pending verification of the exact upstream source and licence. Preserve upstream notices and replace or clear it before distribution if required.

The current path-level census classifies 20 paths as Figma/import-indicated, 2 as third-party scaffold with unverified licences, 775 as other uncertain-origin files, and 21 as generated. No file is verified as first-party or third-party from the evidence available in this checkout. These classifications do **not** establish that a file is unlicensed; they mean its provenance or applicable rights have not been verified. The [per-file inventory](./docs/legal/file-copyright-inventory.md) names each path, while the [machine-readable inventory](./docs/legal/intellectual-property-inventory.json) records the evidence and content hash.

The inventory scans for dated notices in file-header/comment positions; the current scan did not identify a matching notice. This is not proof that no upstream attribution is required: the per-file source and asset provenance still needs manual review, and any upstream notice must be checked against its original source before editing or redistribution.

## Action required

No complete, verified third-party notice bundle was found in the repository baseline. The rights holder must review each relevant upstream notice and asset provenance, then update this document with exact attributions and licence references before declaring distribution clearance.
