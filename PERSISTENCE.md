# Persistence and backups

Roadmap item 08, 2026-11-14. No new dependencies or lockfile changes.

## Stored document

`localStorage['sudoku.save']` contains one JSON document with `version: 1`, `activeGame`, `settings`, `usedPuzzleIds` and `completedGames`. A single `setItem` replaces the document; a failed write leaves the previous document untouched. No separate keys can become partially updated. Browser storage remains browser-managed; a downloaded backup is the portable recovery path.

- Active game: puzzle/givens/solution/level, attempt ID, visible entries, selected cell, complete undo stack, cumulative errors, accumulated milliseconds and stopped lifecycle status. The runtime monotonic baseline is never serialized. Playing snapshots are saved as paused; loading never counts background time or resumes automatically.
- Settings currently contain the error-detection flag, defaulting to on for a new document. Existing valid settings survive reload, export and import.
- Used puzzle IDs persist when a new puzzle is adopted. Future generation receives the recovered IDs and still excludes exact repeats.
- Completed records contain attempt/puzzle IDs, level, canonical UTC completion date, duration and errors. Item 09 now records and clears the active attempt atomically; see STATISTICS.md. Incoming records remain validated and retained. Legacy pending completed games are finalized once on recovery/import; games already dismissed before completion recording existed cannot be reconstructed.

## Validation and recovery

`schema.ts` validates the complete incoming document and rejects unknown versions, missing/extra fields, invalid numeric ranges, malformed IDs/settings/records and duplicate attempt identities. For the active game it verifies original digits, a valid compatible complete solution, rotational clue symmetry, uniqueness, exact logical tier, selection, time, status and the entire undo replay from the original givens. User entries may contain mistakes or unit conflicts. Errors must cover at least the wrong insertions still present in the undo stack, while previously undone mistakes remain cumulative.

External JSON is limited to 10 MiB, with a one-second cooperative validation budget including solution counting/logical work. An over-budget candidate is rejected without replacement. Original stored text is retained for recovery export after validation failure. No automatic fallback write is allowed after a failed read, corrupt document or unsupported version. Defaults are usable in memory, with a visible error and explicit recovery options. REINTENTAR asks before replacing current in-memory changes with a newly validated stored document. Quota/write failures retain current session edits and allow a save retry or export. A changed stored string, such as another tab's write, blocks automatic overwrite; this is conflict detection, not a cross-tab transaction lock.

`useSavedSession` loads outside rendering, saves after each actual game/settings mutation, checkpoints running time every five seconds and saves on visibility hiding/`pagehide`. Hidden/closed sessions resume only via CONTINUAR. Lifecycle listeners, intervals and pending generation are cleaned up on unmount. A crash or forced browser termination may lose active time since the last periodic checkpoint; no closed-app time is added later.

## Backup flow

Settings exposes detection, EXPORTAR COPIA and IMPORTAR COPIA. Item 09 also enables statistics/history and confirmed statistics clearing, preserving the current game, settings and used IDs.

- Export serializes the current in-memory document, including edits not saved because of a storage error. It downloads `sudoku-copia.json` through a Blob URL and native download anchor. iOS Safari can store/share the downloaded file through Files. Invalid original text can separately be exported as `sudoku-recuperacion.json` using EXPORTAR DATOS GUARDADOS.
- Import uses the native file picker (`.json`/JSON), checks file size before reading and validates the entire payload before displaying a replacement confirmation. CANCELAR changes nothing. Confirmation performs the storage write before adopting any imported settings/game/history/IDs. Failure keeps the previous document and session and leaves the confirmation available to retry. Pending file reads are ignored when navigation/recovery supersedes them.
- The downloaded document and the stored document use the same versioned format. Future incompatible formats are rejected; there is no silent partial import or destructive migration.

## Verification

All 37 focused persistence tests and all 227 project tests pass with `npm run check` (lint, Vitest, TypeScript, build). Tests cover timer/undo round-trips, valid erroneous boards, records, malformed/future data, nonunique puzzles, wrong tiers, history corruption, limits, blocked reads, quota failures, recovery and changed storage.

`scripts/check-ui.mjs` additionally checks actual reload recovery, periodic checkpoints, persistent settings, a real downloaded JSON file and native file-input selection, invalid/cancelled imports, atomic rollback under a simulated quota error, successful retry, and recovery from corrupt storage without automatic replacement. It also retains the existing play/layout checks. Run only against a local app in an isolated test browser profile: the script clears local storage for that local test origin. Downloads and screenshots stay under ignored `node_modules/.tmp/ui-check/`.

Chrome desktop/mobile emulation and production preview are verified. Actual iPhone/Safari download, Files sharing, installation, browser storage behavior and offline acceptance remain in the device/release checks.
