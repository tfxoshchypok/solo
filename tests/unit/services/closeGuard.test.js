// Autosave is debounced at 400 ms, so the window can close while a confirmed change is still
// sitting in the timer. FR-031 says that change must survive, which means something has to flush
// the sidecar before the process goes away.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { ProjectFileService, denormalize } from '@/services/ProjectFileService.js'
import { createCloseHandler, decideExit } from '@/services/closeGuard.js'
import { tree, consumer } from '../../fixtures/tree.js'

const PATH = '/home/user/квартира.eltree.json'

function sample(panelName) {
  return denormalize(
    tree({
      id: 'root',
      kind: 'entry',
      name: 'Ввід',
      children: [
        {
          id: 'kitchen',
          kind: 'panel',
          name: panelName,
          children: [consumer('fridge-node', 'fridge', { typeName: 'Холодильник' })],
        },
      ],
    }),
    { name: 'Квартира', catalogVersion: '2026.09.1' },
  )
}

let fs = null

beforeEach(() => {
  fs = new MemoryFs()
  setFs(fs)
  ProjectFileService.cancelAutosave()
})

afterEach(() => {
  ProjectFileService.cancelAutosave()
  vi.restoreAllMocks()
})

describe('the window-close guard keeps the last change (FR-031)', () => {
  it('writes the queued sidecar when the window closes inside the debounce', async () => {
    ProjectFileService.scheduleAutosave(sample('Кухня після правки'), PATH)

    // No timer has fired yet: this is exactly the 400 ms window the user can close the window in.
    expect(await ProjectFileService.findRecovery(PATH)).toBeNull()

    const exit = vi.fn()
    await createCloseHandler({ flush: ProjectFileService.flushAutosave, exit })()

    const recovery = await ProjectFileService.findRecovery(PATH)
    expect(recovery).not.toBeNull()
    const written = JSON.parse(await fs.readText(recovery.sidecarPath))
    expect(written.nodes.find((node) => node.id === 'kitchen').name).toBe('Кухня після правки')
  })

  it('flushes before it exits, never the other way round', async () => {
    const order = []
    const flush = vi.fn(async () => {
      await Promise.resolve()
      order.push('flush')
    })
    const exit = vi.fn(() => order.push('exit'))

    await createCloseHandler({ flush, exit })()

    expect(order).toEqual(['flush', 'exit'])
  })

  it('gives up on a flush that hangs, because the close now depends on this handler', async () => {
    // `exitProcessOnClose` is off, so nothing else will close the window if this never returns.
    const flush = vi.fn(() => new Promise(() => {}))
    const exit = vi.fn()

    await createCloseHandler({ flush, exit, timeoutMs: 10 })()

    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('still exits when the flush fails, so a broken disk cannot trap the window open', async () => {
    const flush = vi.fn().mockRejectedValue(new Error('диск недоступний'))
    const exit = vi.fn()

    await createCloseHandler({ flush, exit })()

    expect(exit).toHaveBeenCalledTimes(1)
  })
})

describe('the close guard asks before dropping unsaved work', () => {
  const handlerWith = (beforeExit, effects = {}) =>
    createCloseHandler({
      beforeExit,
      flush: effects.flush ?? vi.fn(),
      exit: effects.exit ?? vi.fn(),
      timeoutMs: 10,
    })

  it('stops the close when the decision says to stay', async () => {
    const flush = vi.fn()
    const exit = vi.fn()
    await handlerWith(() => false, { flush, exit })()

    expect(exit).not.toHaveBeenCalled()
    // The autosave timer is left running: the session continues, so the sidecar still matters.
    expect(flush).not.toHaveBeenCalled()
  })

  it('flushes and exits when the decision says to go', async () => {
    const flush = vi.fn()
    const exit = vi.fn()
    await handlerWith(async () => true, { flush, exit })()

    expect(flush).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('exits anyway when the decision itself throws, rather than trapping the window', async () => {
    const exit = vi.fn()
    await handlerWith(
      () => {
        throw new Error('діалог не відкрився')
      },
      { exit },
    )()

    expect(exit).toHaveBeenCalledTimes(1)
  })
})

describe('decideExit turns the user’s answer into a verdict (FR-031)', () => {
  const spies = () => ({ prompt: vi.fn(), save: vi.fn(), discard: vi.fn() })

  it('lets a saved project close without asking anything', async () => {
    const { prompt, save, discard } = spies()
    const go = await decideExit({ isDirty: () => false, prompt, save, discard })

    expect(go).toBe(true)
    expect(prompt).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
  })

  it('keeps the window open when the user cancels', async () => {
    const { save, discard } = spies()
    const go = await decideExit({
      isDirty: () => true,
      prompt: async () => 'cancel',
      save,
      discard,
    })

    expect(go).toBe(false)
    expect(save).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
  })

  it('saves and then closes when the user asks to save', async () => {
    const save = vi.fn().mockResolvedValue('/home/user/квартира.eltree.json')
    const { discard } = spies()
    const go = await decideExit({ isDirty: () => true, prompt: async () => 'save', save, discard })

    expect(go).toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
    expect(discard).not.toHaveBeenCalled()
  })

  it('stays open when the save is abandoned at the file dialog', async () => {
    // `saveAs` resolves null when the user backs out of the native dialog; closing then would
    // throw away the very work they were in the middle of saving.
    const save = vi.fn().mockResolvedValue(null)
    const go = await decideExit({
      isDirty: () => true,
      prompt: async () => 'save',
      save,
      discard: vi.fn(),
    })

    expect(go).toBe(false)
  })

  it('stays open when the save fails, so the error is not the last thing before an exit', async () => {
    const save = vi.fn().mockRejectedValue(new Error('диск заповнений'))
    const go = await decideExit({
      isDirty: () => true,
      prompt: async () => 'save',
      save,
      discard: vi.fn(),
    })

    expect(go).toBe(false)
  })

  it('drops the autosave sidecar when the user chooses not to save', async () => {
    // Otherwise the next launch offers to recover exactly what they just declined to keep.
    const discard = vi.fn()
    const go = await decideExit({
      isDirty: () => true,
      prompt: async () => 'discard',
      save: vi.fn(),
      discard,
    })

    expect(go).toBe(true)
    expect(discard).toHaveBeenCalledTimes(1)
  })
})
