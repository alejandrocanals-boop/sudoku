# SUDOKU

A Spanish, browser-local Sudoku PWA built with React, TypeScript and Vite. Four logical difficulty levels, unique symmetric puzzles generated on request, undo, active-play timing, local saves, validated backups, statistics and offline play.

Play: https://alejandrocanals-boop.github.io/sudoku/

## Development

Use Node 26 and the npm lockfile:

```sh
npm ci
npm run dev
npm run check
```

Default path: `/sudoku/`. Override `VITE_BASE_PATH` for a different host path. `npm run check` includes lint, tests, types, build, icon/path checks and generated service-worker auditing.

## Deployment

The Pages workflow builds `main`, checks the app, creates a static artifact without source maps or local paths, scans it, and deploys using GitHub's short-lived Actions token. It requires Pages to use GitHub Actions as its publishing source. No personal access token belongs in repository files or workflow secrets.

Progress and backups stay in the browser; there is no account, backend, analytics or external runtime service. Export a backup before clearing browser storage. Physical iPhone/Safari install and airplane-mode tests remain a manual release check.

See PWA.md, PERSISTENCE.md and STATISTICS.md for behavior and verification details.
See RELEASE.md for public deployment verification and pending physical iPhone checks.
