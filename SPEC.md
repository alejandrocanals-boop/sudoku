# SUDOKU — product specification

## Scope
Personal, free, offline-first installable PWA for iPhone Air; React, TypeScript, Vite, CSS, Vitest, vite-plugin-pwa, localStorage. No accounts, ads, backend, analytics, paid services or native app. Spanish UI. Standard 9×9 Sudoku; no notes, hints, number-first mode or remaining-number counters. One active game.

## Engine
- Pure TypeScript, independent of React and storage. Board: 81 integers (0 empty, 1–9 digits). Puzzle includes givens, unique solution and level.
- Validate inputs and units. Randomized backtracking creates a complete valid grid; count solutions with early stop at 2 to establish uniqueness. Seedable/injectable randomness for tests.
- Remove givens in 180° symmetric pairs (center independently), retaining exactly one solution. Generate only on request, never continuously; no pre-generated pool. Avoid exact repeated givens using locally saved puzzle IDs (canonical 81-digit givens string).
- Classify using a deterministic logical solver with persistent candidates. Apply simpler techniques first; test each cumulative tier from the original givens. Assign the lowest implemented tier that completes the solution. Do not grade merely by clue count or silently use backtracking to grade. This is an app-specific rating, not a universal difficulty measure.
  - FÁCIL: naked/hidden singles.
  - MEDIO: plus locked candidates, naked/hidden pairs.
  - DIFÍCIL: plus naked/hidden triples, X-Wing.
  - EXPERTO: plus Swordfish, XY-Wing, XYZ-Wing, simple coloring.
- Accept only requested tier, verified unique and solvable using supported logic; discard other boards. Bound attempts/time, support cancellation and retry with a clear message; never silently substitute difficulty. Benchmark first; add a Web Worker only if generation measurably blocks UI. If a tier is impractical, report evidence before changing algorithms or requirements.

## Game
- Home → CONTINUAR if saved game, NUEVA PARTIDA → four levels, ESTADÍSTICAS, AJUSTES. Confirm before replacing a saved game; keep it until a new puzzle is ready. One active game only. Return home without losing progress.
- Select cell first, then digit. Tapping a digit inserts/replaces in selected editable cell; originals immutable. Selecting a filled cell highlights equal digits plus row/column/box; empty selection highlights peers. BORRAR clears selected editable cell; DESHACER restores last changed board, including erasures/replacements. No-op moves do not enter history. Preserve history when reopening.
- Detect wrong entries against known solution. Default on, configurable. Red wrong numbers; count actual incorrect insertions/replacements with no limit, no penalty, no increase on no-op, erase or undo. Undo does not erase past mistakes. When detection is off, suppress live red errors and live error count; retain count for completion stats. Digits fully correctly placed are disabled (visible, faded); re-enable after undo/erase. With detection off, disable only when nine matching entries form a legal placement so the UI does not reveal correct answers.
- Timer starts on playable game screen; count active elapsed time only. Pause manually via timer, hide board while paused, resume explicitly. Stop when leaving game, document hidden, or app closed; no background catch-up. Resume on CONTINUAR; save accumulated time. Format MM:SS, HH:MM:SS when needed. Restart same puzzle after confirmation, resetting entries, undo, errors and time. No time limit.
- When board matches solution: freeze game, stop timer, record exactly one result per completed attempt, clear active game, show completion (time, errors, level). NUEVA PARTIDA, VOLVER AL INICIO, ESTADÍSTICAS. Repeated/reloaded completion must not duplicate stats.

## Persistence and statistics
- Versioned localStorage schema, validated input, recoverable defaults and clear error handling for storage failures. Save after each mutation, on lifecycle changes and periodically while timer runs. Store active puzzle/solution/entries/undo/time/errors; settings, used puzzle IDs and completed-game records. Never silently overwrite a readable saved game with defaults on failure.
- Stats: completed count and total active time (sum of completed games, as in approved prototype); per difficulty count, best time, average time; history newest first (date, level, duration, errors). No streaks or achievements. Empty data shows zero counts and em dash for unavailable averages/records. Clear statistics requires confirmation; does not clear game, settings or used puzzle IDs.
- Export/import versioned JSON backup (including game, settings, history, IDs). Validate complete payload before replacement, confirm import and preserve existing data if invalid. Download/share and file picker compatible with iOS Safari. No server sync.

## PWA and verification
- Install via Safari Add to Home Screen (standalone). Name and short name SUDOKU; Spanish; portrait-first; correct scope/start URL/base path for GitHub Pages project site. Icons per DESIGN.md (192/512 PNG + 180 Apple touch icon); no external assets at runtime.
- Precache production app shell/assets offline; offline cold launch after first successful load/install. Updates must not lose saved data or interrupt active play; avoid force reload mid-game. Storage is browser-managed, so backup is important. Request persistent storage when supported; do not promise permanence.
- Test uniqueness, logical tiers/techniques, symmetric removals, no repeats, bounded generation, immutable givens, input/undo/erase, errors, timing/lifecycle, persistence/backup, stats/deduplication and offline production launch. Final manual acceptance on actual iPhone Air and airplane mode.
