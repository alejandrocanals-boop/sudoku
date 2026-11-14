# Public release

Repository: https://github.com/alejandrocanals-boop/sudoku

Public PWA: https://alejandrocanals-boop.github.io/sudoku/

The user explicitly authorized public repository creation, commit, push, GitHub Actions and GitHub Pages deployment. The deployment workflow is pinned to official action revisions and has only read access for building; the separate deployment job receives Pages/OIDC permissions. It uses the existing npm lockfile and Node 26.

## Publication review

- Default and CI base: `/sudoku/`. Manifest ID/start/scope, Apple/manifest icons, app assets, service worker and navigation fallback share this project path.
- Source is staged from an explicit public file list. Local agent settings/instructions, environment files, dependencies, build outputs, screenshots, browser profiles and machine-specific benchmark evidence are excluded. The author identity uses a generic maintainer name and GitHub's no-reply address rather than a private name/email.
- `scripts/check-publication.mjs` scans staged files and the release artifact for common secret formats, private keys, personal email providers and local user paths. Matching values are never printed. PNGs are the reviewed icons generated from the local SVG.
- Workbox audit source maps remain local/CI verification inputs. `scripts/prepare-pages.mjs` creates a fresh `dist-pages` artifact containing only static app files, omitting maps and removing their JS references. This prevents generated maps from disclosing local filesystem paths. The workflow scans the artifact before uploading it.
- The existing six development-only advisories remain documented in DEPENDENCY_AUDIT.md. No affected build-only modules were found in the generated browser SW/runtime; no forced dependency upgrades were applied.

## Verification status

- `npm run check` passed: lint, 258 tests, TypeScript, production build and PWA artifact checks. The default `/sudoku/` base has a regression test.
- The first public deployment succeeded in [GitHub Actions run 43631376033](https://github.com/alejandrocanals-boop/sudoku/actions/runs/43631376033), for commit `09ee266156fbb6a47c70e2b70e10a1b3190d6ac7`. Subsequent pushes run the same checks before deployment.
- Source review passed for all 92 initially tracked files; the static artifact scan passed for all 13 published files. Maps and private local evidence were excluded from both the repository and Pages artifact.
- `node scripts/check-live.mjs https://alejandrocanals-boop.github.io/sudoku/` passed against the public HTTPS deployment using installed Chrome in an isolated test profile. Manifest ID/start/scope and active SW scope are `/sudoku/`; all precached assets, generator worker and 192/512/180 icons resolve correctly. SW/runtime source-map URLs return 404 and deployed JS contains no map references or local filesystem paths.
- A new tab cold-launched a previously unvisited URL with HTTP cache disabled and networking offline. The document came from the service worker and an uncached network request failed. Saved input and undo recovered; a different puzzle was generated and completed, one result was stored and a valid JSON backup was exported, all offline. No uncaught page exceptions occurred.

The live-check script clears this GitHub Pages origin's storage, caches and service workers in its browser profile. Run it only with a separate disposable Chrome debugging profile, sequentially with other browser scripts. Local receipts and downloads remain ignored under `node_modules/.tmp/`.

## Pending physical device checks

- Safari Add to Home Screen on a real iPhone.
- Installed standalone launch and cold launch in airplane mode.
- Play, pause, close/reopen, backup export/import and update behavior on the device.

These physical tests remain pending by the user's request; desktop browser checks do not substitute for them.
