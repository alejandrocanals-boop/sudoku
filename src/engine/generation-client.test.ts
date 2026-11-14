import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestPuzzle } from './generation-client'
import type { GenerationWorkerReply, GenerationWorkerRequest } from './generation-protocol'
import type { GenerationResult } from './generator'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<GenerationWorkerReply>) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  postMessage = vi.fn<(message: GenerationWorkerRequest) => void>()
  terminate = vi.fn()
  constructor(_url: URL, _options: WorkerOptions) {
    FakeWorker.instances.push(this)
  }
  reply(data: GenerationWorkerReply) {
    this.onmessage?.({ data } as MessageEvent<GenerationWorkerReply>)
  }
}
const exhausted: GenerationResult = {
  status: 'exhausted', reason: 'attempt-limit', message: 'VUELVE A INTENTARLO',
  metrics: { attempts: 1, evaluated: 1, matched: 0, duplicates: 0, elapsedMs: 10 },
}
const latest = () => FakeWorker.instances.at(-1)!

beforeEach(() => {
  vi.useFakeTimers()
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('on-demand worker lifecycle', () => {
  it('starts only on request, forwards options and terminates after the reply', async () => {
    expect(FakeWorker.instances).toHaveLength(0)
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const request = requestPuzzle('hard', {
      maxAttempts: 7, maxDurationMs: 100, usedPuzzleIds: ['0'.repeat(81)], seed: 42, signal: controller.signal,
    })
    expect(latest().postMessage).toHaveBeenCalledWith({
      level: 'hard', limits: { maxAttempts: 7, maxDurationMs: 100, usedPuzzleIds: ['0'.repeat(81)] }, seed: 42,
    })
    latest().reply({ type: 'result', result: exhausted })
    await expect(request).resolves.toEqual(exhausted)
    expect(latest().terminate).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
    expect(latest().onmessage).toBeNull()
  })

  it('does not create a worker for a pre-cancelled request', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(requestPuzzle('easy', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeWorker.instances).toHaveLength(0)
  })

  it('terminates a running worker on abort and ignores its late reply', async () => {
    const controller = new AbortController()
    const request = requestPuzzle('hard', { signal: controller.signal })
    const lateReply = latest().onmessage!
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    lateReply({ data: { type: 'result', result: exhausted } } as MessageEvent<GenerationWorkerReply>)
    expect(latest().terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('enforces a total request deadline even if the worker never replies', async () => {
    const request = requestPuzzle('expert', { maxDurationMs: 100 })
    const rejected = expect(request).rejects.toMatchObject({ name: 'TimeoutError', message: expect.stringContaining('VUELVE A INTENTARLO') })
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(latest().terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects a late result even when the watchdog callback has not run yet', async () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const request = requestPuzzle('easy', { maxDurationMs: 100 })
    const rejected = expect(request).rejects.toMatchObject({ name: 'TimeoutError' })
    clock.mockReturnValue(101)
    latest().reply({ type: 'result', result: exhausted })
    await rejected
    expect(latest().terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['engine', 'worker', 'decode'] as const)('cleans up after a %s error', async kind => {
    const request = requestPuzzle('easy')
    const rejected = expect(request).rejects.toBeInstanceOf(Error)
    if (kind === 'engine') latest().reply({ type: 'error', message: 'Engine failed' })
    if (kind === 'worker') latest().onerror!()
    if (kind === 'decode') latest().onmessageerror!()
    await rejected
    expect(latest().terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('creates a separate finite request when retrying after exhaustion', async () => {
    const first = requestPuzzle('medium')
    latest().reply({ type: 'result', result: exhausted })
    await first
    const second = requestPuzzle('medium')
    expect(FakeWorker.instances).toHaveLength(2)
    latest().reply({ type: 'result', result: exhausted })
    await second
    for (const worker of FakeWorker.instances) expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('rejects invalid limits before creating a worker', async () => {
    await expect(requestPuzzle('easy', { maxAttempts: 0 })).rejects.toThrow(RangeError)
    await expect(requestPuzzle('easy', { seed: -1 })).rejects.toThrow(RangeError)
    expect(FakeWorker.instances).toHaveLength(0)
  })
})
