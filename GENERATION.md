# On-demand puzzle generation

Roadmap item 05, verified on 2026-11-14. No dependencies or UI changes.

## Contract

- Browser code calls `requestPuzzle(level, options)` from `src/engine/generation-client.ts` only after an explicit user request. Each call creates one module worker and terminates it on every completion, cancellation, timeout or error. There is no pool, startup generation, continuous generation or synchronous UI fallback.
- `generatePuzzle` is the synchronous engine used inside that worker. It creates a fresh complete grid by randomized backtracking, shuffles the 40 rotational pairs plus the independent center, and retains a removal only if the solution count remains exactly one. Clue presence, rather than digit values, is symmetric through 180 degrees.
- The final givens are classified by the lowest completing logical tier, independently from the original givens. Only an exact match to the requested tier is accepted. Classification never uses the backtracking counter. A rejected candidate is discarded; no alternative difficulty is substituted.
- Puzzle IDs are the canonical 81-digit givens string, including leading zeros. Pass the saved IDs as `usedPuzzleIds`. This engine excludes exact repeated givens and does not mutate the list. The caller must record the returned ID when adopting the puzzle; persistence and replacement of the current game belong to later roadmap tasks. A cancelled or failed request returns no replacement puzzle and writes no storage.
- Defaults are at most **2,000 attempts and 10,000 ms**. The engine checks its monotonic time budget and cancellation inside backtracking, between removals, between logical steps, and before returning success. Its deadline is cooperative within a logical step. The client's independent timer includes worker startup and terminates a nonresponsive worker. As with browser timers generally, actual callback delivery depends on event-loop scheduling.
- Engine exhaustion returns `status: 'exhausted'`, an `attempt-limit` or `time-limit` reason, metrics and an uppercase Spanish retry message. Core cancellation returns `status: 'cancelled'`. The browser client's `AbortSignal` rejects with `AbortError`; its total-request watchdog rejects with `TimeoutError` and the retry message. A retry is another explicit call. Runtime/transport failures reject rather than fabricating a puzzle.
- For repeatable tests, the engine accepts an injected random source and clock; the worker client accepts an unsigned 32-bit `seed`. The injected clock must be monotonic. Invalid levels, limits, seeds or random values are programming errors. Browser durations must fit a signed 32-bit timer.

## Benchmark and worker decision

Reproduce with `npm run benchmark:generation -- 10 GENERATION_BENCHMARK.json`.
The optional final argument saves individual records and summaries. The benchmark runs the synchronous engine via Vite's module loader and schedules a zero-delay timer before each request to measure how long the requesting event loop is blocked. It creates no puzzle pool or runtime data file unless an output path is supplied.

Measured on a reference desktop runtime. Machine-specific raw results are kept locally and excluded from publication. Ten requests per tier used seeds 2026–2035, default limits and no excluded IDs. No warm-up samples were discarded. Acceptance is exact-tier matches divided by fully evaluated candidates; success is requests completed before either bound. With ten observations, the recorded nearest-rank p95 is also the maximum.

| Requested tier | Successful requests | Evaluated candidates | Acceptance | Mean | Maximum |
| --- | --- | --- | --- | --- | --- |
| Easy | 10/10 | 13 | 76.92% | 9.72 ms | 21.58 ms |
| Medium | 10/10 | 101 | 9.90% | 55.96 ms | 120.45 ms |
| Hard | 10/10 | 2,512 | 0.40% | 1,167.10 ms | 3,037.28 ms |
| Expert | 10/10 | 119 | 8.40% | 57.83 ms | 133.39 ms |

The same-thread timer was delayed up to **3,038 ms** for Hard. This measured blocking justifies the worker. A preliminary 200-attempt sample exhausted two of three Hard requests, so the attempt bound was raised to 2,000 while keeping the 10-second duration bound and the existing algorithms/rating requirements.

These are desktop engine measurements, not iPhone, browser-rendering or cold-worker end-to-end timings. The test suite also compiles the actual worker with Vite and runs that emitted asset through a Node worker-message bridge: a Hard request completes while timers continue on the requesting thread. This checks the built artifact and off-thread execution, without claiming a real Safari test.

Hard's low acceptance is a material performance limitation: this small sample does not guarantee success on every seed or device. Bounds and explicit retry remain necessary, especially on slower hardware. Measure browser startup, responsive cancellation and all four levels on the actual iPhone during frontend/release acceptance before promising production latency. No tier was impractical in this desktop sample, and no requirement was relaxed.

## Verification

Focused tests cover all four generated tiers with fixed seeds, independently verify uniqueness and lowest-tier classification, compare logical completion to the generated solution, check clue symmetry and preservation of curated solutions, exclude duplicates, and exercise attempt exhaustion, mid-search time/cancellation checkpoints, invalid inputs and explicit retries. Worker lifecycle tests cover abort, watchdog expiration, engine/worker/decoding errors, late replies and termination. A separate integration test bundles and executes the real worker asset.

`npm run check`: lint, all 144 tests, TypeScript and production build passed. The current app remains the scaffold; its later frontend integration will import the worker client. The dedicated integration test verifies worker bundling before that import exists.
