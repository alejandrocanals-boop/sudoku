import type { GenerationLimits, GenerationResult } from './generator'
import type { LogicalLevel } from './solver'

export interface GenerationWorkerRequest {
  readonly level: LogicalLevel
  readonly limits: GenerationLimits
  readonly seed?: number
}

export type GenerationWorkerReply =
  | { readonly type: 'result'; readonly result: GenerationResult }
  | { readonly type: 'error'; readonly message: string }
