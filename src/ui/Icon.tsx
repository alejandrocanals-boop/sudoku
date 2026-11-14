type IconName = 'back' | 'pause' | 'undo' | 'erase' | 'check'
const paths: Record<IconName, string> = {
  back: 'm15 5-7 7 7 7', pause: 'M9 5v14M15 5v14',
  undo: 'M8 5 3 10l5 5M3 10h10a7 7 0 0 1 0 14',
  erase: 'm3 13 9-9a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3l-7 7H9l-6-5a1.5 1.5 0 0 1 0-2ZM8 8l10 10M9 20h13',
  check: 'm5 12 4 4L19 6',
}
export function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 26" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
