import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'
import { createUpdateController } from './update-controller'
import { resolveBasePath } from '../../config/base-path'

function fixture() {
  let callbacks: RegisterSWOptions = {}
  const activate = vi.fn(async () => {})
  const reload = vi.fn()
  const register = vi.fn((options: RegisterSWOptions) => { callbacks = options; return activate })
  const controller = createUpdateController({ register, reload })
  controller.start()
  return { controller, reload, activate, register, callbacks }
}

describe('safe update lifecycle', () => {
  it('registers once and unsubscribes notifications across StrictMode-style mounts', () => {
    const value = fixture()
    const listener = vi.fn()
    const unsubscribe = value.controller.subscribe(listener)
    value.controller.start()
    expect(value.register).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenLastCalledWith(false)
    value.callbacks.onNeedRefresh!()
    expect(listener).toHaveBeenLastCalledWith(true)
    unsubscribe()
    listener.mockClear()
    value.callbacks.onNeedRefresh!()
    expect(listener).not.toHaveBeenCalled()
  })

  it('does not activate or reload when the UI guard is false, even after explicit apply', async () => {
    const value = fixture()
    value.callbacks.onNeedRefresh!()
    const save = vi.fn(() => true)
    await value.controller.apply(save)
    expect(save).not.toHaveBeenCalled()
    expect(value.activate).not.toHaveBeenCalled()
    value.callbacks.onNeedReload!()
    expect(value.reload).not.toHaveBeenCalled()
  })

  it('never reloads for another tab activation without this tab authorizing it', () => {
    const value = fixture()
    value.controller.setAllowed(true)
    value.callbacks.onNeedReload!()
    expect(value.reload).not.toHaveBeenCalled()
  })

  it('requires a successful save before requesting activation and before reloading', async () => {
    const value = fixture()
    value.controller.setAllowed(true)
    value.callbacks.onNeedRefresh!()
    const save = vi.fn(() => false)
    await value.controller.apply(save)
    expect(value.activate).not.toHaveBeenCalled()
    save.mockReturnValue(true)
    await value.controller.apply(save)
    expect(value.activate).toHaveBeenCalledOnce()
    expect(value.reload).not.toHaveBeenCalled()
    value.callbacks.onNeedReload!()
    expect(value.reload).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledTimes(3)
  })

  it('rechecks current safety if play begins while activation is in flight', async () => {
    const value = fixture()
    value.controller.setAllowed(true)
    value.callbacks.onNeedRefresh!()
    await value.controller.apply(() => true)
    value.controller.setAllowed(false)
    value.callbacks.onNeedReload!()
    expect(value.reload).not.toHaveBeenCalled()
    value.controller.setAllowed(true)
    expect(value.reload).not.toHaveBeenCalled()
    await value.controller.apply(() => true)
    expect(value.reload).toHaveBeenCalledOnce()
  })

  it('does not reload if the final save fails after activation', async () => {
    const value = fixture()
    value.controller.setAllowed(true)
    value.callbacks.onNeedRefresh!()
    const save = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)
    await value.controller.apply(save)
    value.callbacks.onNeedReload!()
    expect(value.reload).not.toHaveBeenCalled()
  })

  it('revokes authorization after an update error', async () => {
    const value = fixture()
    value.controller.setAllowed(true)
    value.callbacks.onNeedRefresh!()
    value.activate.mockRejectedValue(new Error('Offline'))
    await expect(value.controller.apply(() => true)).rejects.toThrow('Offline')
    value.callbacks.onNeedReload!()
    expect(value.reload).not.toHaveBeenCalled()
  })
  it('consumes authorization once even if the browser reports controlling twice', async () => {
    const value = fixture()
    value.controller.setAllowed(true)
    value.callbacks.onNeedRefresh!()
    await value.controller.apply(() => true)
    value.callbacks.onNeedReload!()
    value.callbacks.onNeedReload!()
    expect(value.reload).toHaveBeenCalledOnce()
  })
})

afterEach(() => vi.unstubAllGlobals())
it('requests persistent storage once after a user action and tolerates denial/errors', async () => {
  vi.resetModules()
  const persist = vi.fn(async () => { throw new Error('Denied') })
  vi.stubGlobal('navigator', { storage: { persist } })
  const { requestPersistentStorage } = await import('./persistence')
  await expect(requestPersistentStorage()).resolves.toBeUndefined()
  await requestPersistentStorage()
  expect(persist).toHaveBeenCalledOnce()
})
it('works when persistent storage is unsupported', async () => {
  vi.resetModules()
  vi.stubGlobal('navigator', {})
  const { requestPersistentStorage } = await import('./persistence')
  await expect(requestPersistentStorage()).resolves.toBeUndefined()
})

it.each(['/', '/SUDOKU/', '/other-project/'])('accepts deployment base %s', path => {
  expect(resolveBasePath(path)).toBe(path)
})
it('defaults to the public sudoku repository path', () => {
  expect(resolveBasePath()).toBe('/sudoku/')
})
it.each(['SUDOKU', '//host/', '/a/../b/', '/a?x/', '/a#x/', '/a\\b/', '/a'])('rejects unsafe base %s', path => {
  expect(() => resolveBasePath(path)).toThrow()
})
