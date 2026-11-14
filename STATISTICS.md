# Completion records, statistics and history

Roadmap item 09, verified 2026-11-14. No dependencies, schema version changes or game-mechanics changes.

## Recording

`game/statistics.ts` provides pure completion, aggregate, history-order and clear operations. On the transition into `completed`, `useSavedSession` creates a record with the stable attempt ID, puzzle ID, exact level, final active milliseconds, cumulative errors and current UTC ISO timestamp. Repeated attempts of the same puzzle have different attempt IDs and may both count; a replay of the same attempt does not append a record or replace its original date. A stale completion cannot clear a different active attempt.

The record and `activeGame: null` are serialized in a single document write. The UI retains the frozen completed game only for the completion dialog. Subsequent snapshots omit it, so reload cannot re-record a successful commit. If storage fails, the existing stored document remains intact and the record stays in memory with a visible save error; retry/export includes that same record and timestamp. Durability still requires a successful write or backup: reloading a session with failed writes can recover only the last saved progress.

Item-08 backups/saves may contain a completed active attempt that has not yet been recorded. Recovery/import normalizes it once into a record plus null active state before writing. Because that legacy format lacks a completion date, its date is the first recovery/import time; new completions use the actual transition time. An imported pending completion is normalized before the single import write. Already dismissed pre-item-09 wins cannot be reconstructed. Imported history continues through the strict version-1 validator, which rejects duplicate attempt IDs and inconsistent active/history identities.

## Screens and aggregates

- Home and completion now link to ESTADÍSTICAS. The two summaries show completed count and the sum of completed active time; unfinished active time is excluded.
- Each of the four levels shows count, shortest duration and arithmetic mean. Empty best/mean values use an em dash; zero-duration values remain valid times. Bars are proportional to the maximum level count, with zero width for empty tiers. No sample records or fallback statistics are shipped.
- HISTORIAL is sorted newest first on a copied array. Each row shows level, completion date/time in the browser's local zone using uppercase Spanish formatting, active duration and errors. Empty history has a real empty state. Small screens and enlarged text wrap and scroll rather than shrinking labels.
- Settings enables BORRAR ESTADÍSTICAS when records exist. A native modal requires confirmation. Only records are removed: current progress/undo/time, settings and used IDs survive. The clear is written before the in-memory records are replaced; a failed write retains both history and the open confirmation for retry. A cleared result is not resurrected by later timers or reload.

## Verification

Ten focused statistics tests cover idempotent attempt recording, distinct attempts, stale events, zero/empty aggregates, per-tier counts/means/bests, total completed time, newest-first order, non-mutating clears and retry of an atomic completion write. `npm run check` passes lint, all 237 tests, TypeScript and production build.

The local Chrome script `scripts/check-ui.mjs` additionally verifies empty statistics/history; a real completed puzzle followed by simulated quota failure, retry and reload; saved active-state clearing; real statistics/history screens at normal and 200% text; cancelled and failed clearing followed by successful retry; preservation of active game/settings/IDs; and legacy pending-completion recovery across repeated reloads. Existing generation, persistence, backup and responsive game checks remain enabled. Development and production preview passed; screenshots are under ignored `node_modules/.tmp/ui-check/`.

Actual iPhone/Safari verification remains in device/release acceptance. Cross-tab changed-document detection and storage limits retain the behavior documented in PERSISTENCE.md.
