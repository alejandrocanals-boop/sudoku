# Public release

Repository: https://github.com/alejandrocanals-boop/sudoku

The user explicitly authorized public repository creation, commit, push, GitHub Actions and GitHub Pages deployment. The deployment workflow is pinned to official action revisions and has only read access for building; the separate deployment job receives Pages/OIDC permissions. It uses the existing npm lockfile and Node 26.

## Publication review

- Default and CI base: `/sudoku/`. Manifest ID/start/scope, Apple/manifest icons, app assets, service worker and navigation fallback share this project path.
- Source is staged from an explicit public file list. Local agent settings/instructions, environment files, dependencies, build outputs, screenshots, browser profiles and machine-specific benchmark evidence are excluded. The author identity uses a generic maintainer name and GitHub's no-reply address rather than a private name/email.
- `scripts/check-publication.mjs` scans staged files and the release artifact for common secret formats, private keys, personal email providers and local user paths. Matching values are never printed. PNGs are the reviewed icons generated from the local SVG.
- Workbox audit source maps remain local/CI verification inputs. `scripts/prepare-pages.mjs` creates a fresh `dist-pages` artifact containing only static app files, omitting maps and removing their JS references. This prevents generated maps from disclosing local filesystem paths. The workflow scans the artifact before uploading it.
- The existing six development-only advisories remain documented in DEPENDENCY_AUDIT.md. No affected build-only modules were found in the generated browser SW/runtime; no forced dependency upgrades were applied.

## Verification status

Local automated checks and Pages-path build verification are required before push. Public deployment and HTTPS/browser/offline verification results will be recorded after the Actions run completes.

## Pending physical device checks

- Safari Add to Home Screen on a real iPhone.
- Installed standalone launch and cold launch in airplane mode.
- Play, pause, close/reopen, backup export/import and update behavior on the device.

These physical tests remain pending by the user's request; desktop browser checks do not substitute for them.
