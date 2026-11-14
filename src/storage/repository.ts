import { emptySavedData, parseSavedData, serializeSavedData, type SavedData } from './schema'

export const SAVE_KEY = 'sudoku.save'
export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
export type StorageIssue = 'read' | 'invalid' | 'write' | 'conflict'
type WriteResult = { ok: true } | { ok: false; issue: StorageIssue }
export type LoadResult = { ok: true; data: SavedData } | { ok: false; issue: StorageIssue }

export class SaveRepository {
  private provider: () => StoragePort
  private writable = false
  private original: string | null = null
  private blockedIssue: StorageIssue = 'read'

  constructor(provider: () => StoragePort) { this.provider = provider }

  get recoveryText(): string | null { return this.original }

  load(): LoadResult {
    this.writable = false
    try {
      this.original = this.provider().getItem(SAVE_KEY)
    } catch {
      this.blockedIssue = 'read'
      return { ok: false, issue: 'read' }
    }
    try {
      const data = this.original === null ? emptySavedData() : parseSavedData(this.original)
      this.writable = true
      return { ok: true, data }
    } catch {
      this.blockedIssue = 'invalid'
      return { ok: false, issue: 'invalid' }
    }
  }

  save(data: SavedData): WriteResult {
    if (!this.writable) return { ok: false, issue: this.blockedIssue }
    try {
      if (this.provider().getItem(SAVE_KEY) !== this.original) {
        this.writable = false
        this.blockedIssue = 'conflict'
        return { ok: false, issue: 'conflict' }
      }
      const text = serializeSavedData(data)
      if (text === this.original) return { ok: true }
      this.provider().setItem(SAVE_KEY, text)
      this.original = text
      return { ok: true }
    } catch {
      return { ok: false, issue: 'write' }
    }
  }

  /** Call only after parseSavedData and explicit replacement confirmation. One atomic setItem. */
  import(data: SavedData): WriteResult {
    try {
      const text = serializeSavedData(data)
      this.provider().setItem(SAVE_KEY, text)
      this.original = text
      this.writable = true
      return { ok: true }
    } catch {
      return { ok: false, issue: 'write' }
    }
  }
}
