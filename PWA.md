# PWA configuration and verification

Roadmap items 10/11, 2026-11-14. Published on GitHub Pages; see RELEASE.md for public verification and pending physical device checks. The existing `vite-plugin-pwa@2.0.0`/Workbox dependencies and npm lockfile are unchanged.

## Paths and manifest

The default and Pages CI base is `/sudoku/`, matching the public repository slug. Set `VITE_BASE_PATH` to the actual project path, with leading/trailing slashes, or `/` for a root site. Use the same environment for build and preview; do not override only Vite's CLI `--base`, since the manifest/registration must agree too.

PowerShell example:

```powershell
$env:VITE_BASE_PATH='/my-repository/'
npm.cmd run check
npm.cmd run preview -- --host 127.0.0.1
```

Without that override, preview is `http://127.0.0.1:4173/sudoku/`; development uses port 5173 and keeps SW registration disabled. The configuration rejects unnormalized, relative or host-like bases. Manifest ID, scope, start URL, icon paths, navigation fallback and registration all use the same base. The manifest declares SUDOKU, Spanish, standalone display, portrait orientation and the approved light theme/background. HTML includes safe-area viewport configuration, Apple standalone/title metadata, the Apple touch icon and local SVG favicon. Both `/sudoku/` and `/` build artifact paths were verified.

## Approved icons

`public/icons/sudoku.svg` is the local editable source: a square #F3F6FB background, thin #34557F grid spanning 20–80% of the canvas, and the approved 5/3/2/9 arrangement with 16%-sized sans-serif digits. There are no pre-rounded corners, shadows or external fonts. PNGs are 192×192, 512×512 and 180×180. Manifest icons use `purpose: any`; the 180px PNG is linked as the Apple touch icon.

`node scripts/export-icons.mjs` regenerates PNGs with the installed Chrome's SVG/canvas renderer through remote debugging on port 9222. It uses the local source, not an image service or additional dependency. Start Chrome with a separate test profile. The generated dimensions and source appearance were checked, including a visual review of the 512px PNG.

## Offline operation

Production uses `generateSW`. Static JS/CSS/HTML are precached, along with the manifest, SVG and all PNG icons. The 10-entry precache includes the separate generator worker and dynamically imported Workbox window client. There are no runtime API requests, external assets or precached user backups. User data remains in the existing versioned localStorage document; cache cleanup does not clear it.

The generated SW responds to scoped navigation with the precached project `index.html`. Installation must finish on the first connected visit before cold offline use. Later offline launches restore a stopped game and retain the existing explicit resume behavior. Fresh puzzle generation, rating and completion run locally offline as well.

## Safe updates and storage

The plugin uses its [prompt update lifecycle](https://vite-pwa-org.netlify.app/guide/prompt-for-update), with `skipWaiting: false`. A new build stays waiting while the current app is open. The installed plugin's `onNeedReload` callback is intercepted rather than allowing its default reload behavior. A singleton controller prevents duplicate registration under React StrictMode and consumes each reload authorization once.

ACTUALIZAR is offered only on idle Inicio after data recovery, with no active game, open confirmation or storage issue. A successful save is required before requesting activation and again before reload. If play/navigation begins while activation is pending, or if another tab activates the SW, that event cannot force this tab to reload. A later safe explicit action can reload an already-activated update. Closing all app tabs permits the browser's normal SW activation; the next launch recovers saved data. No periodic forced reload or automatic update dialog interrupts play.

The app requests `navigator.storage.persist()` once per page session after an explicit new-puzzle request, when supported. Denial/errors do not block play and do not imply guaranteed permanence; this follows the browser-managed behavior of [StorageManager.persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist). Backup/export remains available.

## Verification

- `npm run check`: lint, all **258 tests**, TypeScript, production build and `scripts/check-pwa-build.mjs`. The artifact check verifies icon dimensions, scoped manifest/HTML/cache paths, precaching of the generator and required assets, and the generated SW/runtime source-map inventory.
- Twenty-one PWA tests cover registration subscription cleanup, explicit/one-time reload authorization, active-state gating, external activation, navigation during activation, both save barriers, update errors, persistent-storage denial/absence and valid/invalid deployment paths.
- `node scripts/check-pwa.mjs`: creates two temporary production builds and serves them under `/sudoku/` on an isolated local origin. It installs the actual SW, saves a game, closes the tab and stops the HTTP server. A new tab then cold-launches a never-visited query URL with HTTP cache disabled and networking emulated offline. It restores and undoes saved input, fetches offline icons/manifest, generates a different puzzle via the cached worker, and completes a game without the server. Build B subsequently installs as waiting while another game is active. No reload occurs until the game is finished and ACTUALIZAR is explicitly chosen from Inicio; the saved document remains byte-for-byte unchanged by that reload.
- `node scripts/check-ui.mjs http://127.0.0.1:4173/sudoku/`: full play, statistics, storage, backup and responsive UI checks on production preview. It clears storage, SW registrations and caches for its local test origin, so run only in a separate test profile. Run browser scripts sequentially: backgrounding one test tab correctly pauses/block-resumes the other.
- `scripts/check-pwa-build.mjs node_modules/.tmp/pwa-root-build` also passed for a separately built `VITE_BASE_PATH=/` variant. Public deployment and cold-offline verification also passed; see RELEASE.md.

PWA/browser scripts use only installed Chrome, Node and existing Vite dependencies. Temporary build paths are verified before cleanup. Receipts/screenshots are under ignored `node_modules/.tmp/`. Safari Add to Home Screen, actual iPhone installation, physical airplane-mode cold launch and post-deployment reopen/backup remain item 11's device acceptance checks.

## Dependency follow-up

The refreshed npm audit remains at six affected development packages (two low, four moderate) from three advisories; `npm audit --omit=dev` reports zero. No compatible fix is proposed, so no forced downgrade/override was applied. The generated SW and its Workbox runtime source maps were inspected: affected build packages `deepmerge`, `glob`, `minimatch` and `@rollup/plugin-node-resolve` are absent. Only trusted, fixed project glob/config inputs reach those Node build paths. See DEPENDENCY_AUDIT.md for advisory links and the original exposure analysis; production-only audit results alone were not used as proof of browser safety.
