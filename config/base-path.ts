export function resolveBasePath(value = '/sudoku/'): string {
  if (!value.startsWith('/') || !value.endsWith('/') || value.includes('//') || /[?#\\]/.test(value)
    || new URL(value, 'https://example.invalid').pathname !== value) {
    throw new Error('VITE_BASE_PATH must be an absolute, normalized path with leading/trailing slashes')
  }
  return value
}
