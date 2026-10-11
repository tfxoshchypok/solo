// Autosave is debounced at 400 ms, so the window can close while a confirmed change is still
// sitting in the timer. FR-031 says that change must survive, which means something has to flush
// the sidecar before the process goes away.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import {
  AUTOSAVE_DELAY_MS,
  ProjectFileService,
  denormalize,
} from '@/services/ProjectFileService.js'
import { createCloseHandler, decideExit, flushPendingWrites } from '@/services/closeGuard.js'
import { ReferenceTablesFileService } from '@/services/ReferenceTablesFileService.js'
import { useProjectStore } from '@/stores/project.js'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { tree, consumer } from '../../fixtures/tree.js'
import { GatedFs, isSidecar, isTmp } from '../../fixtures/gatedFs.js'

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
          children: [consumer('fridge-node', { name: 'Холодильник' })],
        },
      ],
    }),
    { name: 'Квартира' },
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
  vi.useRealTimers()
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

describe('the window-close flush covers every pending write (FR-031, research R4)', () => {
  it('waits for a reference tables write that has not finished yet', async () => {
    const gated = new GatedFs()
    setFs(gated)
    const { release } = gated.hold()
    const saving = ReferenceTablesFileService.save(ReferenceTablesFileService.loadBuiltin())

    let flushed = false
    const flushing = flushPendingWrites().then(() => {
      flushed = true
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(flushed).toBe(false)

    release()
    await Promise.all([saving, flushing])
    expect(flushed).toBe(true)
  })

  it('still writes the queued project sidecar', async () => {
    ProjectFileService.scheduleAutosave(sample('Кухня перед закриттям'), PATH)

    await flushPendingWrites()

    expect(await ProjectFileService.findRecovery(PATH)).not.toBeNull()
  })

  // SAVE-02: the debounce has already fired and its write is on the disk's side. Nothing is queued,
  // so a flush that only looks at the queue lets the window go before the sidecar lands.
  it('waits for a sidecar write the autosave timer has already started', async () => {
    const gated = new GatedFs()
    setFs(gated)
    vi.useFakeTimers()
    const { release, reached } = gated.hold(isSidecar)
    ProjectFileService.scheduleAutosave(sample('Кухня, запис уже йде'), PATH)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    await reached
    vi.useRealTimers()

    const exit = vi.fn()
    const closing = createCloseHandler({ flush: flushPendingWrites, exit })()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(exit).not.toHaveBeenCalled()

    release()
    await closing
    expect(exit).toHaveBeenCalledTimes(1)
    expect(await gated.exists(`${PATH}.autosave.json`)).toBe(true)
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
    let dirty = true
    const save = vi.fn(async () => {
      dirty = false
      return '/home/user/квартира.eltree.json'
    })
    const { discard } = spies()
    const go = await decideExit({ isDirty: () => dirty, prompt: async () => 'save', save, discard })

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

describe('«Зберегти» on close covers only what it wrote (SAVE-01)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps the window open when an edit lands while the save is writing', async () => {
    const gated = new GatedFs({ savePath: PATH })
    setFs(gated)
    const project = useProjectStore()
    const treeStore = useTreeStore()
    await project.saveAs()
    treeStore.add({ parentId: treeStore.rootId, kind: 'panel', name: 'Кухня' })

    const { release, reached } = gated.hold(isTmp)
    const deciding = decideExit({
      isDirty: () => project.isDirty,
      prompt: async () => 'save',
      save: () => project.save(),
      discard: () => project.discardUnsaved(),
    })
    await reached
    treeStore.add({ parentId: treeStore.rootId, kind: 'panel', name: 'Ванна' })
    release()

    expect(await deciding).toBe(false)
    expect(project.isDirty).toBe(true)
  })
})
