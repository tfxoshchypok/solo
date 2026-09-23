// The store around the file: which project is open, whether it has unsaved work, and what happens
// when a load fails. The view calls these actions and nothing else — no component here touches
// `ProjectFileService` or the filesystem directly (contracts/services.md).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { useProjectStore } from '@/stores/project.js'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { ProjectFileService, LoadError } from '@/services/ProjectFileService.js'
import { PROJECT_EXTENSION } from '@/services/PathService.js'

const PATH = `/home/user/квартира${PROJECT_EXTENSION}`

let fs = null

beforeEach(() => {
  setActivePinia(createPinia())
  fs = new MemoryFs({ dataDir: '/memfs/data', savePath: PATH, openPath: PATH })
  setFs(fs)
})

afterEach(() => {
  ProjectFileService.cancelAutosave()
  setFs(null)
  vi.useRealTimers()
})

/** Entry → panel → consumer, built through the store the way the UI builds it. */
function buildTree(tree) {
  const panelId = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
  tree.add({
    parentId: panelId,
    kind: 'consumer',
    name: 'Холодильник',
    typeId: 'fridge',
    typeName: 'Холодильник',
  })
  return panelId
}

describe('save and reopen (FR-001, FR-033, SC-005)', () => {
  it('reproduces the tree node for node after a new project wiped it', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    buildTree(tree)
    const before = tree.nodes

    await project.saveAs()
    project.newProject()
    expect(tree.nodeCount).toBe(1)

    await project.openPath(PATH)
    expect(tree.nodes).toEqual(before)
    expect(project.path).toBe(PATH)
    expect(project.isDirty).toBe(false)
  })

  it('adds the project extension when the dialog came back with a bare name', async () => {
    const project = useProjectStore()
    fs.savePath = '/home/user/гараж'

    const saved = await project.saveAs()
    expect(saved).toBe(`/home/user/гараж${PROJECT_EXTENSION}`)
    expect(await fs.exists(saved)).toBe(true)
  })

  it('leaves everything alone when the save dialog was cancelled', async () => {
    const project = useProjectStore()
    fs.savePath = null
    useTreeStore().add({ parentId: useTreeStore().rootId, kind: 'panel', name: 'Кухня' })

    expect(await project.saveAs()).toBe(null)
    expect(project.path).toBe(null)
    expect(project.isDirty).toBe(true)
  })
})

describe('a broken file reaches nothing (FR-036)', () => {
  it('leaves the open project untouched when the load fails', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    buildTree(tree)
    await project.saveAs()
    const before = tree.nodes

    await fs.writeText('/home/user/зламаний.eltree.json', '{"schemaVersion": 1, "nodes": [')

    await expect(project.openPath('/home/user/зламаний.eltree.json')).rejects.toBeInstanceOf(
      LoadError,
    )
    expect(tree.nodes).toEqual(before)
    expect(project.path).toBe(PATH)
  })
})

describe('unsaved work (FR-031)', () => {
  it('marks the project dirty on the first structural change', () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    expect(project.isDirty).toBe(false)

    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    expect(project.isDirty).toBe(true)
  })

  it('writes a sidecar once the editing pause has passed, and drops it on save', async () => {
    vi.useFakeTimers()
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.saveAs()

    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    vi.advanceTimersByTime(400)
    await ProjectFileService.autosaveSettled()
    expect(await fs.exists(`${PATH}.autosave.json`)).toBe(true)

    await project.save()
    expect(await fs.exists(`${PATH}.autosave.json`)).toBe(false)
    expect(project.isDirty).toBe(false)
  })

  it('offers the sidecar on open and restores it as work that is still unsaved', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.saveAs()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    await ProjectFileService.flushAutosave()

    const recovery = await project.findRecovery(PATH)
    expect(recovery.sidecarPath).toBe(`${PATH}.autosave.json`)

    project.newProject()
    await project.openRecovery(recovery.sidecarPath, PATH)
    expect(tree.nodeCount).toBe(2)
    expect(project.path).toBe(PATH)
    expect(project.isDirty).toBe(true)
  })

  it('declining the offer opens the file and the sidecar is gone', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.saveAs()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    await ProjectFileService.flushAutosave()

    await project.discardRecovery(PATH)
    await project.openPath(PATH)

    expect(tree.nodeCount).toBe(1)
    expect(await project.findRecovery(PATH)).toBe(null)
  })
})

describe('the native dialogs stay behind the adapter', () => {
  it('opens whatever the open dialog returned, and nothing when it was cancelled', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    buildTree(tree)
    await project.saveAs()
    project.newProject()

    expect(await project.pickToOpen()).toBe(PATH)
    fs.openPath = null
    expect(await project.pickToOpen()).toBe(null)
  })
})
