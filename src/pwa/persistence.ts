let requested = false

/** Best effort after an explicit user action; denial must never prevent play. */
export async function requestPersistentStorage(): Promise<void> {
  if (requested || typeof navigator.storage?.persist !== 'function') return
  requested = true
  try { await navigator.storage.persist() } catch { /* Browser-managed storage remains usable. */ }
}
