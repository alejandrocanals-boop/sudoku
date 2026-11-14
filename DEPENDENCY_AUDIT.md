# Dependency audit

Reviewed on 2026-11-14 for roadmap item 01, using the installed npm dependency tree and lockfile.

The exposure section below records the original pre-PWA scaffold. The item-10 follow-up at the end describes the current generated artifacts.

## Results

- `npm.cmd audit --json`: six affected packages, two low and four moderate; no high or critical findings. Exit 1 indicates the remaining findings.
- `npm.cmd audit --omit=dev --json`: zero findings; exit 0.
- There are three distinct advisories. The other three package entries inherit findings through their dependency chains; they are not additional vulnerabilities.

| Affected installed package | Severity | Origin / dependency path |
| --- | --- | --- |
| `deepmerge@4.3.1` | Low | [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4): prototype poisoning of merged objects |
| `@rollup/plugin-node-resolve@16.0.3` | Low | Inherits `deepmerge` |
| `glob@11.1.0` | Moderate | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): traversal continues after cancellation; also inherits `minimatch` |
| `minimatch@10.2.6` | Moderate | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): pattern amplification can exhaust CPU/memory |
| `workbox-build@7.4.1` | Moderate | Inherits `@rollup/plugin-node-resolve` and `glob` |
| `vite-plugin-pwa@2.0.0` | Moderate | Inherits `workbox-build` |

All six are under the development dependency `vite-plugin-pwa`. A separate `minimatch@5.1.9` under the Workbox build tooling is outside this advisory's affected range.

## Exposure assessment

The following conclusions are based on the installed source and current project configuration, rather than the production-only audit alone:

- `vite.config.ts` enables only the React plugin. Application imports do not use PWA/Workbox APIs or register a service worker. The verified build emits only `index.html` and the application JavaScript asset; there is no service worker today.
- In `@rollup/plugin-node-resolve/dist/es/index.js`, `deepMerge` is used to clone the plugin's own defaults. Workbox's `build/lib/bundle.js` invokes `nodeResolve()` without external options. This inspected path does not merge attacker-supplied objects.
- Workbox's `build/lib/get-file-details.js` uses `globSync` with local build-directory patterns and no `AbortSignal`. It does not rely on cancellation as a traversal limit, so the cancellation-bypass condition is absent on this path.
- Glob uses minimatch with optimization level 2, so the vulnerable preprocessing can be reached in the build tooling. Exploitation requires attacker-controlled patterns; the current app supplies none. Future PWA patterns must remain trusted project configuration.
- Build tools can affect generated artifacts even when listed as development dependencies. Inspection of Workbox's `build/templates/sw-template.js` and `build/lib/bundle.js` shows that globbing and plugin resolution run in Node during generation; the service worker template imports browser Workbox runtime modules, not `glob`, `minimatch`, `deepmerge` or Rollup plugins. This is a source review of the generator, not validation of a future PWA artifact. Re-audit and inspect the actual generated service worker/runtime when implementing item 10, including any custom imports or caching configuration.

## Fix decision and verification

No dependency or lockfile changes are justified for this item. The deepmerge advisory lists no patched release. The published fixes for glob (`14.0.2`) and minimatch (`11.0.1`) are outside the parents' respective `^11.0.1` and `^10.1.1` ranges. npm proposes `vite-plugin-pwa@1.1.0`, a breaking downgrade outside the project's `^2.0.0` range. No forced fix, override, downgrade or dependency installation was performed.

It is safe to continue development with trusted build inputs in the current configuration. The six findings remain open upstream; this assessment does not claim that the dependencies are vulnerability-free. No current meaningful exposure was identified that requires a user decision.

`npm.cmd run check` passed: lint, Vitest and TypeScript/Vite production build. Vitest reported no test files; this audit adds no application behavior requiring a new unit test. PowerShell blocks `npm.ps1` on this machine, so commands used the equivalent `npm.cmd` launcher without changing execution policy.

## PWA follow-up (item 10)

Rechecked on 2026-11-14 after enabling the PWA plugin. Full audit still reports the same six development-package entries (two low, four moderate), and the production-only audit still reports zero. Dependencies and lockfile remain unchanged; no compatible fixes were proposed.

The production build now generates `sw.js` plus a local Workbox browser runtime. Source-map inventories for both generated files are checked by `scripts/check-pwa-build.mjs`: none contains modules from deepmerge, glob, minimatch or @rollup/plugin-node-resolve. The generated SW has message-gated activation, browser Workbox precaching/routing and fixed local asset URLs. Workbox's glob/resolve build paths still consume trusted local configuration, not imported game/backup data. Actual cold offline generation/play and a two-build waiting/update cycle passed in Chrome; see PWA.md. This is a current build exposure assessment, not a claim that the upstream build dependencies have no vulnerabilities.
