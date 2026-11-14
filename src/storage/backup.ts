import { MAX_BACKUP_BYTES, parseSavedData, type SavedData } from './schema'

export async function readBackup(file: Pick<File, 'size' | 'text'>): Promise<SavedData> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup is too large')
  return parseSavedData(await file.text())
}

/** Download is the baseline iOS Safari path; the downloaded JSON can be shared via Files. */
export function downloadBackup(text: string, filename = 'sudoku-copia.json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Leave time for Safari's download handoff before releasing the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
