# Frontend verification

Roadmap item 07, 2026-11-14. The React scaffold is replaced with the approved home, level picker, playable board, keypad, pause state and native confirmation/completion dialogs. All UI copy is uppercase Spanish. CSS follows DESIGN.md tokens, system/Georgia fonts, square grid, nine-button keypad, exactly two board actions and safe-area spacing. Fonts on labels scale with the root text size; board digits follow the actual board width and keypad digits remain responsive to viewport width. Larger text scrolls vertically when needed.

## Integration and scope

- `src/ui/useSudoku.ts` owns the current session and starts a single generation request only on an explicit level selection/retry. It preserves the previous game until a successful replacement, confirms replacement first, aborts cancelled work, ignores stale results and retains session-used IDs. Worker failures and bounds expose a retry without substituting difficulty.
- `Game` and `Board` dispatch the existing pure game actions. Givens are protected, errors remain cumulative, highlight priority is selected/equal/peer, and solved keypad digits are disabled. Arrow keys and Home/End move cell focus; digit keys, Delete/Backspace and Ctrl/Cmd+Z work while the grid is focused. Dialogs use the browser's modal focus handling and Escape cancellation.
- The timer reads monotonic timestamps outside rendering. It stops on pause, restart confirmation, navigation, document hiding and `pagehide`. Foregrounding does not resume play; CONTINUAR does. A paused grid is removed from the DOM, not merely covered with a translucent layer.
- Completion shows actual level/time/errors and freezes interaction. Item 09 now records each attempt once and clears saved active state in the same document; the completion dialog remains visible until navigation. Statistics and history use real records, including after reload/import; see STATISTICS.md.
- Item 08 adds versioned persistence, recovery and backup; see PERSISTENCE.md. Reload restores a stopped game, used IDs, undo history and settings. AJUSTES exposes detection, backup controls and confirmed statistics clearing. No statistics are fabricated.

## Checks

`npm run check` passes lint, all 257 engine/game/storage/statistics/PWA tests, TypeScript, the production build and PWA artifact checks. The build emits the generation worker alongside the application, local CSS, icons, manifest and SW.

`node scripts/check-ui.mjs [app-url] [Chrome-debug-url]` runs browser integration checks using Node's built-in WebSocket client and the Chrome DevTools Protocol; no testing dependency was installed. Defaults are `http://127.0.0.1:5173/SUDOKU/` and `http://127.0.0.1:9222`. Start the app with `npm run dev` or the built app with `npm run preview`, and start the installed Chrome with remote debugging enabled and a separate temporary profile. The script creates/closes its own tab and clears that local origin's test storage, SW and caches. It loads the local logical solver through an isolated Vite cache to independently solve the real UI-generated puzzle for the completion check. Failure/cancellation tests replace the browser Worker constructor only inside that test tab, without application test hooks. Run it separately from other browser scripts so its page remains foregrounded. See PWA.md for cold-offline/update verification.

Browser checks passed against development and production preview:

- Spanish home, four level choices, no fake statistics.
- Real worker generation; immutable givens; cell selection; insert/replace, no-op errors, undo and erase.
- Keyboard grid navigation; modal focus and Escape cancellation.
- Pause hides digits; paused time remains fixed; resumed time advances; visibility/pagehide require explicit resume.
- Replacement cancellation, generation cancellation, failure and retry preserve the previous game and terminate workers.
- Confirmed restart resets entries/errors; completion displays real results and removes the home CONTINUAR action.
- Square board, exactly two board actions, nine keypad buttons and no horizontal overflow at 320/390/430/768 CSS px; home, difficulty, game and completion at 200% root text size.
- No uncaught browser exceptions. Mobile-sized screenshots were visually inspected; output is in ignored `node_modules/.tmp/ui-check/`.

Chrome mobile emulation is not an actual iPhone/Safari, installed-PWA or offline test. Those remain in the PWA/release acceptance items.

## Responsive game layout follow-up

The game now uses the dynamic viewport height and measured control heights to maximize the square board, without a fixed device size or portrait width cap. `useGameLayout` observes safe content space, controls and the game's border box (including bottom safe-area padding). It writes layout-only CSS variables and releases its observer/frame/resize listener on unmount. No game state, actions or timing mechanics changed. Remaining height is distributed between the top block, board, actions, keypad and footer. A minimum readable square and accessible controls take precedence over eliminating scroll on extreme heights; the footer retains safe padding even in that fallback.

The browser layout checks now cover 320×568, 390×600/667/844, 430×932, 768×1024 and 1024×768, plus 844×390 and 390×400 scroll fallbacks and 200% text at 320×568. Chrome safe-area overrides cover top/bottom and landscape side insets, including a bottom-inset-only change at constant viewport size. Checks assert the largest fitting square, distributed space, no unnecessary scrolling, safe footer padding and unchanged paused-board geometry. Measurements and screenshots are written to ignored `node_modules/.tmp/ui-check/`, including `layouts.json`.
