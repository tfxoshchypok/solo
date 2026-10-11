// The store around the file: which project is open, whether it has unsaved work, and what happens
// when a load fails. The view calls these actions and nothing else — no component here touches
// `ProjectFileService` or the filesystem directly (contracts/services.md).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { useProjectStore } from '@/stores/project.js'
import { createEmptyTree, useTreeStore } from '@/modules/tree/stores/tree.js'
import {
  AUTOSAVE_DELAY_MS,
  ProjectFileService,
  denormalize,
  normalize,
} from '@/services/ProjectFileService.js'
import { LoadError } from '@/services/LoadError.js'
import { PROJECT_EXTENSION } from '@/services/PathService.js'
import { loadTypeRow, zoneRow } from '../../fixtures/tree.js'
import { GatedFs, isSidecar, isTmp } from '../../fixtures/gatedFs.js'
import { CRASHED_NAME, leaveCrashCopy, unsavedSidecarPath } from '../../fixtures/crashCopy.js'

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
    loadType: loadTypeRow(),
    zone: zoneRow(),
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

    // The crash: every store is gone, the disk is all that survives. «Новий» would not do here —
    // leaving unsaved work that way discards it, copy included (SAVE-03).
    setActivePinia(createPinia())
    const reopened = useProjectStore()
    await reopened.openRecovery(recovery.sidecarPath, PATH)
    expect(useTreeStore().nodeCount).toBe(2)
    expect(reopened.path).toBe(PATH)
    expect(reopened.isDirty).toBe(true)
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

  // "Don't save" on close is followed by the close handler's flush. A change still waiting out the
  // debounce must not survive that flush, or the next launch offers what the user just declined.
  it('choosing not to save leaves no sidecar behind, even with a change still queued', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.saveAs()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    await ProjectFileService.flushAutosave()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Ванна' })

    await project.discardUnsaved()
    await ProjectFileService.flushAutosave()

    expect(await project.findRecovery(PATH)).toBe(null)
  })

  it('choosing not to save a project that never had a file drops its sidecar too', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    await ProjectFileService.flushAutosave()
    expect(await project.findRecovery(null)).not.toBe(null)
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Ванна' })

    await project.discardUnsaved()
    await ProjectFileService.flushAutosave()

    expect(await project.findRecovery(null)).toBe(null)
  })
})

/** Swaps the suite's MemoryFs for one whose writes the test can hold. */
function useGatedFs() {
  const gated = new GatedFs({ dataDir: '/memfs/data', savePath: PATH, openPath: PATH })
  fs = gated
  setFs(gated)
  return gated
}

/** The panel names a project file (or a sidecar) holds, in file order. */
async function panelNames(filePath) {
  const written = JSON.parse(await fs.readText(filePath))
  return written.nodes.filter((node) => node.kind === 'panel').map((node) => node.name)
}

// SAVE-01: the snapshot is taken before the write, so anything the user does while the write runs
// is not in the file. Only what was written may count as saved.
describe('a save that overlaps an edit (SAVE-01)', () => {
  it('an edit made while «Зберегти» is writing stays unsaved, and the next save writes it', async () => {
    const gated = useGatedFs()
    const project = useProjectStore()
    const tree = useTreeStore()
    const panelId = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    await project.saveAs()
    tree.rename(panelId, 'До збереження')

    const { release, reached } = gated.hold(isTmp)
    const saving = project.save()
    await reached
    tree.rename(panelId, 'Після початку збереження')
    release()
    await saving

    expect(await panelNames(PATH)).toEqual(['До збереження'])
    expect(project.isDirty).toBe(true)

    await project.save()
    expect(await panelNames(PATH)).toEqual(['Після початку збереження'])
    expect(project.isDirty).toBe(false)
  })

  it('an edit made while «Зберегти як…» is writing stays unsaved', async () => {
    const gated = useGatedFs()
    const project = useProjectStore()
    const tree = useTreeStore()
    const panelId = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'До збереження' })

    const { release, reached } = gated.hold(isTmp)
    const saving = project.saveAs()
    await reached
    tree.rename(panelId, 'Після початку збереження')
    release()

    expect(await saving).toBe(PATH)
    expect(project.path).toBe(PATH)
    expect(await panelNames(PATH)).toEqual(['До збереження'])
    expect(project.isDirty).toBe(true)
  })

  it('an undo while the save is writing counts as a change too', async () => {
    const gated = useGatedFs()
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.saveAs()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })

    const { release, reached } = gated.hold(isTmp)
    const saving = project.save()
    await reached
    tree.history.undo()
    release()
    await saving

    expect(await panelNames(PATH)).toEqual(['Кухня'])
    expect(project.isDirty).toBe(true)
  })

  // The edit's sidecar is written while the save still runs. Finishing the save must neither delete
  // it nor leave it older than the file, or the next open does not offer it.
  it('a change made during a slow save keeps a sidecar the next open offers', async () => {
    vi.useFakeTimers()
    const gated = useGatedFs()
    const project = useProjectStore()
    const tree = useTreeStore()
    const panelId = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'До збереження' })
    await project.saveAs()

    tree.rename(panelId, 'Ще до збереження')
    const { release, reached } = gated.hold(isTmp)
    const saving = project.save()
    await reached
    tree.rename(panelId, 'Після початку збереження')
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    release()
    await saving
    await ProjectFileService.flushAutosave()

    const recovery = await project.findRecovery(PATH)
    expect(recovery).not.toBe(null)
    expect(await panelNames(recovery.sidecarPath)).toEqual(['Після початку збереження'])
  })

  it('a failed write leaves the project unsaved', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.saveAs()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })

    vi.spyOn(fs, 'writeText').mockRejectedValueOnce(new Error('диск заповнений'))
    await expect(project.save()).rejects.toThrow('диск заповнений')
    expect(project.isDirty).toBe(true)
  })

  it('a slow save of one project cannot rewrite the project opened after it', async () => {
    const other = `/home/user/дача${PROJECT_EXTENSION}`
    const otherBorn = '2025-05-01T00:00:00.000Z'
    const gated = useGatedFs()
    await ProjectFileService.save(
      denormalize(createEmptyTree(), { name: 'Дача', createdAt: otherBorn }),
      other,
    )
    const project = useProjectStore()
    const tree = useTreeStore()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })

    const { release, reached } = gated.hold(isTmp)
    const saving = project.saveAs()
    await reached
    // The other project takes the editor at once; `openPath` itself settles only after the copy of
    // the left one is dropped, which waits behind this save on the write queue (SAVE-03).
    const opening = project.openPath(other)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(project.path).toBe(other)
    release()
    await Promise.all([saving, opening])

    expect(project.path).toBe(other)
    expect(project.name).toBe('Дача')
    expect(project.createdAt).toBe(otherBorn)
    expect(project.isDirty).toBe(false)
  })
})

// SAVE-03: leaving a project with unsaved changes is what «Незбережені зміни зникнуть» → «Продовжити»
// confirmed. Once the next project has loaded, the copy of the one left behind must not survive —
// neither one already written nor one still on its way — or reopening it offers what was discarded.
describe('switching to another project (SAVE-03)', () => {
  const SIDECAR = `${PATH}.autosave.json`
  const OTHER = `/home/user/дача${PROJECT_EXTENSION}`
  const OTHER_SIDECAR = `${OTHER}.autosave.json`

  /** A second project on disk, written directly so the autosave queue stays untouched. */
  async function writeOther(filePath = OTHER, name = 'Дача') {
    await fs.writeText(filePath, JSON.stringify(denormalize(createEmptyTree(), { name })))
  }

  /** A saved project with one unsaved panel; the copy of it is not written yet. */
  async function dirtySavedProject() {
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.saveAs()
    const panelId = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    return { project, tree, panelId }
  }

  it('«Відкрити…» after the copy of the left project was written drops that copy', async () => {
    await writeOther()
    const { project } = await dirtySavedProject()
    await ProjectFileService.flushAutosave()
    expect(await fs.exists(SIDECAR)).toBe(true)

    await project.openPath(OTHER)
    await ProjectFileService.autosaveSettled()

    expect(project.path).toBe(OTHER)
    expect(await fs.exists(SIDECAR)).toBe(false)
    expect(await project.findRecovery(PATH)).toBe(null)
  })

  it('«Відкрити…» while the copy still waits for its timer: the copy never appears', async () => {
    vi.useFakeTimers()
    await writeOther()
    const { project } = await dirtySavedProject()

    await project.openPath(OTHER)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    await ProjectFileService.autosaveSettled()

    expect(await fs.exists(SIDECAR)).toBe(false)
  })

  it('«Відкрити…» while the copy is being written: it is gone once that write lands', async () => {
    vi.useFakeTimers()
    const gated = useGatedFs()
    await writeOther()
    const { project } = await dirtySavedProject()
    const { release, reached } = gated.hold(isSidecar)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    await reached

    const opening = project.openPath(OTHER)
    release()
    await opening
    await ProjectFileService.autosaveSettled()

    expect(project.path).toBe(OTHER)
    expect(await fs.exists(SIDECAR)).toBe(false)
  })

  it('«Новий» after a project that never had a file drops its copy', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    await ProjectFileService.flushAutosave()
    expect(await project.findRecovery(null)).not.toBe(null)

    await project.newProject()
    await ProjectFileService.autosaveSettled()

    expect(await project.findRecovery(null)).toBe(null)
  })

  it('restoring another project from its copy drops the left one and keeps the restored one', async () => {
    await writeOther()
    await writeOther(OTHER_SIDECAR, 'Дача, відновлена')
    const { project } = await dirtySavedProject()
    await ProjectFileService.flushAutosave()

    await project.openRecovery(OTHER_SIDECAR, OTHER)
    await ProjectFileService.autosaveSettled()

    expect(project.name).toBe('Дача, відновлена')
    expect(await fs.exists(SIDECAR)).toBe(false)
    expect(await fs.exists(OTHER_SIDECAR)).toBe(true)
  })

  it('restoring the same project from its own copy keeps that copy', async () => {
    const { project, tree } = await dirtySavedProject()
    await ProjectFileService.flushAutosave()

    await project.openRecovery(SIDECAR, PATH)
    await ProjectFileService.autosaveSettled()

    expect(tree.nodeCount).toBe(2)
    expect(await fs.exists(SIDECAR)).toBe(true)
  })

  // «Відкрити файл» on the recovery offer keeps the copy on purpose (TreeEditorView.vue). Nothing was
  // confirmed as discarded, so moving on to another project must leave it for later.
  it('a project without unsaved changes keeps its copy when another one opens', async () => {
    await writeOther()
    const { project } = await dirtySavedProject()
    await ProjectFileService.flushAutosave()
    await project.openPath(PATH)
    expect(project.isDirty).toBe(false)

    await project.openPath(OTHER)
    await ProjectFileService.autosaveSettled()

    expect(await fs.exists(SIDECAR)).toBe(true)
  })

  it('a broken file leaves the open project as it was, its copy and pending edit included', async () => {
    vi.useFakeTimers()
    const broken = '/home/user/зламаний.eltree.json'
    const { project, tree, panelId } = await dirtySavedProject()
    await ProjectFileService.flushAutosave()
    tree.rename(panelId, 'Кухня після правки')
    const before = tree.nodes
    await fs.writeText(broken, '{"schemaVersion": 1, "nodes": [')

    await expect(project.openPath(broken)).rejects.toBeInstanceOf(LoadError)
    expect(tree.nodes).toBe(before)
    expect(project.path).toBe(PATH)
    expect(project.isDirty).toBe(true)

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    await ProjectFileService.autosaveSettled()
    expect(await panelNames(SIDECAR)).toEqual(['Кухня після правки'])
  })

  it('the first «Зберегти як…» drops the copy of the project without a file', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    await ProjectFileService.flushAutosave()
    expect(await project.findRecovery(null)).not.toBe(null)

    await project.saveAs()

    expect(await project.findRecovery(null)).toBe(null)
  })
})

// RECOVERY-01: a project that never had a file keeps its copy in the data directory, and nothing
// offered it after a crash. The editor starts with a new empty project, whose first edit would
// write over that copy.
describe('a project without a file, left by a crash (RECOVERY-01)', () => {
  it('nothing to recover: nothing is offered, and an edit made during the check is autosaved', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()

    const checking = project.checkStartupRecovery()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    expect(await checking).toBe(null)
    await ProjectFileService.flushAutosave()

    expect(await panelNames(await unsavedSidecarPath())).toEqual(['Кухня'])
  })

  it('the new empty project cannot write over the copy before the user answers', async () => {
    const { sidecarPath } = await leaveCrashCopy()
    const before = await fs.readText(sidecarPath)
    const project = useProjectStore()
    const tree = useTreeStore()

    const checking = project.checkStartupRecovery()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Нова' })
    expect(await checking).toMatchObject({ name: CRASHED_NAME })
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Ще одна' })
    await ProjectFileService.flushAutosave()

    expect(await fs.readText(sidecarPath)).toBe(before)
  })

  it.each([
    ['«Не зберігати» on close', (project) => project.discardUnsaved()],
    ['«Новий»', (project) => project.newProject()],
    ['«Зберегти як…»', (project) => project.saveAs()],
  ])('%s before the answer leaves the copy alone', async (_, operation) => {
    const { sidecarPath } = await leaveCrashCopy()
    const before = await fs.readText(sidecarPath)
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.checkStartupRecovery()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Нова' })

    await operation(project)
    await ProjectFileService.autosaveSettled()

    expect(await fs.readText(sidecarPath)).toBe(before)
  })

  it('«Відновити» brings back the tree, the name and the consumers, as unsaved work without a file', async () => {
    const { project: copy } = await leaveCrashCopy()
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.checkStartupRecovery()

    await project.restoreStartupRecovery()

    expect(tree.nodes).toEqual(normalize(copy).nodes)
    expect(project.name).toBe(CRASHED_NAME)
    expect(project.path).toBe(null)
    expect(project.isDirty).toBe(true)

    const showSaveDialog = vi.spyOn(fs, 'showSaveDialog')
    expect(await project.save()).toBe(PATH)
    expect(showSaveDialog).toHaveBeenCalledTimes(1)
  })

  it('backing out of the first save keeps the restored work unsaved and recoverable', async () => {
    const { sidecarPath } = await leaveCrashCopy()
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.checkStartupRecovery()
    await project.restoreStartupRecovery()
    fs.savePath = null

    expect(await project.save()).toBe(null)

    expect(project.isDirty).toBe(true)
    expect(await project.findRecovery(null)).toMatchObject({ sidecarPath })

    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Після відновлення' })
    await ProjectFileService.flushAutosave()
    expect(await panelNames(sidecarPath)).toEqual(['Верстати', 'Після відновлення'])
  })

  it('«Відкинути копію» removes that copy, and the autosave picks up from there', async () => {
    const { sidecarPath } = await leaveCrashCopy()
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.checkStartupRecovery()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Нова' })

    await project.discardStartupRecovery()

    expect(await fs.exists(sidecarPath)).toBe(false)
    await ProjectFileService.flushAutosave()
    expect(await panelNames(sidecarPath)).toEqual(['Нова'])
  })

  it('a broken copy is not applied, and is kept under another name rather than deleted', async () => {
    const { sidecarPath } = await leaveCrashCopy('{ зламано')
    const project = useProjectStore()
    const tree = useTreeStore()

    const found = await project.checkStartupRecovery()

    expect(found.refusal.error).toBeInstanceOf(LoadError)
    expect(found.refusal.keptAs).toContain('unsaved.refused-')
    expect(await fs.readText(found.refusal.keptAs)).toBe('{ зламано')
    expect(await fs.exists(sidecarPath)).toBe(false)
    expect(tree.nodeCount).toBe(1)
    expect(project.isDirty).toBe(false)
  })

  // The edit is queued for a project without a file. Written as such after the save dropped the
  // unsaved copy, it would come back on the next launch as a project that never had one.
  it('an edit made while the first «Зберегти як…» is writing lands in the file’s copy', async () => {
    const gated = useGatedFs()
    const project = useProjectStore()
    const tree = useTreeStore()
    const panelId = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'До збереження' })
    await ProjectFileService.flushAutosave()

    const { release, reached } = gated.hold(isTmp)
    const saving = project.saveAs()
    await reached
    tree.rename(panelId, 'Після початку збереження')
    release()
    await saving
    await ProjectFileService.flushAutosave()

    expect(await gated.exists(await unsavedSidecarPath())).toBe(false)
    expect(await panelNames(`${PATH}.autosave.json`)).toEqual(['Після початку збереження'])
    expect(project.isDirty).toBe(true)
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
