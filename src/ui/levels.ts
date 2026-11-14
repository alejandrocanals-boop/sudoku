import type { LogicalLevel } from '../engine/solver'

export const LEVELS: readonly { value: LogicalLevel; label: string }[] = [
  { value: 'easy', label: 'FÁCIL' }, { value: 'medium', label: 'MEDIO' },
  { value: 'hard', label: 'DIFÍCIL' }, { value: 'expert', label: 'EXPERTO' },
]
export const levelLabel = (level: LogicalLevel): string => LEVELS.find(item => item.value === level)!.label
