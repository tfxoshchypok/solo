// Which file is open, whether it has unsaved work, and whether a crash left something to recover.
// The tree itself lives in modules/tree/stores/tree.js; this store is about the file around it.
//
// It is also the only place that talks to `ProjectFileService` and to the native dialogs, which is
// what keeps the views free of I/O (contracts/services.md).
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { basename, projectFileName, PROJECT_EXTENSION } from '@/services/PathService.js'
import { getFs } from '@/services/fs/index.js'
import { ProjectFileService, denormalize, normalize } from '@/services/ProjectFileService.js'
import { LoadError } from '@/services/LoadError.js'
import { useTreeStore } from '@/modules/tree/stores/tree.js'

const DEFAULT_NAME = 'Новий проект'

/** What the native dialogs offer to filter on. */
const FILE_FILTERS = [{ name: 'Проект eltree', extensions: ['eltree.json', 'json'] }]

export const useProjectStore = defineStore('project', () => {
  const tree = useTreeStore()

  /** null until the project has been saved once — a new project has no file yet. */
  const path = ref(null)
  const name = ref(DEFAULT_NAME)
  const isDirty = ref(false)
  /** Set once, on the first save, and carried through every later one. */
  const createdAt = ref(null)
  /** `{ sidecarPath, modifiedAt }` when an autosave is newer than the file (FR-031). */
  const recovery = ref(null)

  const fileName = computed(() => (path.value ? basename(path.value) : null))
  const hasFile = computed(() => path.value !== null)

  /**
   * Replacing the whole tree changes `nodes` exactly the way an edit does, so the watcher below
   * would mark a freshly opened project dirty and autosave it back. The flag is read and cleared
   * synchronously, which is why the watcher runs with `flush: 'sync'`.
   */
  let replacing = false

  /**
   * Bumped by every edit and undo. A save remembers the revision it wrote, and only clears
   * `isDirty` if the tree is still there when the write lands (SAVE-01).
   */
  let revision = 0

  /**
   * Bumped whenever another project takes the editor, so a write still running for the previous
   * one cannot claim to have saved this one (SAVE-01).
   */
  let session = 0

  /**
   * From the start of the startup check until the user answers, the copy of a project without a
   * file belongs to the crash that left it: nothing writes over it or removes it (RECOVERY-01).
   * Edits still happen; their own copy is written once the hold ends.
   */
  let holdingUnsaved = false
  /** The copy the startup check found, until it is restored or discarded. */
  let startupCopy = null

  const unsavedHeld = () => holdingUnsaved && !path.value

  function replaceTree(next) {
    replacing = true
    try {
      tree.setTree(next)
    } finally {
      replacing = false
    }
  }

  /** The project as it would be written right now. */
  function snapshot() {
    return denormalize(
      { rootId: tree.rootId, nodes: tree.nodes },
      {
        name: name.value,
        createdAt: createdAt.value ?? undefined,
      },
    )
  }

  // Every structural change — including an undo — is unsaved work and restarts the 400 ms sidecar
  // timer. `treeOps` returns a new frozen map each time, so watching the reference is enough.
  watch(
    () => tree.nodes,
    () => {
      if (replacing) return
      revision += 1
      isDirty.value = true
      if (unsavedHeld()) return
      ProjectFileService.scheduleAutosave(snapshot(), path.value)
    },
    { flush: 'sync' },
  )

  function markDirty() {
    isDirty.value = true
  }

  function markSaved(savedPath) {
    if (savedPath) path.value = savedPath
    isDirty.value = false
    recovery.value = null
  }

  function open({ path: filePath, name: projectName, createdAt: born }) {
    session += 1
    path.value = filePath ?? null
    name.value = projectName ?? DEFAULT_NAME
    createdAt.value = born ?? null
    isDirty.value = false
    recovery.value = null
  }

  function reset() {
    open({ path: null, name: DEFAULT_NAME, createdAt: null })
  }

  /**
   * Called once the next project is ready to take the editor, before it does. Leaving unsaved
   * changes is what «Незбережені зміни зникнуть» → «Продовжити» confirmed, so their copy goes: the
   * queued write is dropped, and the copy is removed behind any write already running (SAVE-03).
   *
   * A project without unsaved changes keeps its copy — nothing about it was declined. So does one
   * opened again, whose copy may be the very state it is being restored from, and a held one,
   * which still waits for the user's answer.
   *
   * @param {boolean} reopened the next project is this one again
   * @returns {Promise<void>} resolves once the copy is gone
   */
  function leave(reopened) {
    const left = { path: path.value, dirty: isDirty.value, held: unsavedHeld() }
    ProjectFileService.cancelAutosave()
    if (!left.dirty || reopened || left.held) return Promise.resolve()
    return ProjectFileService.discardRecovery(left.path)
  }

  /** An empty project: one entry node and no file behind it (FR-002). */
  async function newProject() {
    const leaving = leave(false)
    replacing = true
    try {
      tree.reset()
    } finally {
      replacing = false
    }
    reset()
    await leaving
  }

  // ---------------------------------------------------------------- open

  /** @returns {Promise<string|null>} the chosen path, or null when the user cancelled */
  async function pickToOpen() {
    return getFs().showOpenDialog({ title: 'Відкрити проект', filters: FILE_FILTERS })
  }

  /**
   * Loads a file into the editor. A `LoadError` escapes before `replaceTree`, so a refused file
   * leaves the open project exactly as it was — which is the whole of FR-036.
   */
  async function openPath(filePath) {
    const { project } = await ProjectFileService.load(filePath)
    const leaving = leave(path.value === filePath)
    replaceTree(normalize(project))
    open({
      path: filePath,
      name: project.name,
      createdAt: project.createdAt,
    })
    await leaving
  }

  /**
   * The same load, pointed at the sidecar but presented as the project file: the recovered state
   * is work that never reached the file, so it opens dirty and the next save writes it there.
   */
  async function openRecovery(sidecarPath, filePath) {
    const { project } = await ProjectFileService.load(sidecarPath)
    const leaving = leave(path.value === (filePath ?? null))
    replaceTree(normalize(project))
    open({
      path: filePath ?? null,
      name: project.name,
      createdAt: project.createdAt,
    })
    isDirty.value = true
    await leaving
  }

  // ---------------------------------------------------------------- save

  /**
   * The snapshot is taken before the `await`, so an edit or an undo made while the file is written
   * is not in it: the project stays dirty, and that edit's sidecar is written after the save on the
   * same queue, so it survives (SAVE-01). A write that lands after another project was opened says
   * nothing about that project.
   */
  async function writeTo(target) {
    const writtenSession = session
    const writtenRevision = revision
    // A held copy is not this project's to drop, so the save is told it never lived anywhere else.
    const previousPath = unsavedHeld() ? target : path.value
    const written = await ProjectFileService.save(snapshot(), target, { previousPath })
    if (session !== writtenSession) return target

    path.value = target
    createdAt.value = written.createdAt
    recovery.value = null
    if (revision === writtenRevision) isDirty.value = false
    return target
  }

  async function save() {
    if (!path.value) return saveAs()
    return writeTo(path.value)
  }

  /** @returns {Promise<string|null>} where it landed, or null when the user cancelled */
  async function saveAs() {
    const picked = await getFs().showSaveDialog({
      title: 'Зберегти проект',
      filters: FILE_FILTERS,
      defaultPath: projectFileName(name.value),
    })
    if (!picked) return null

    // A dialog that returns a bare name would otherwise produce a project the open filter hides.
    const target = picked.endsWith('.json') ? picked : `${picked}${PROJECT_EXTENSION}`
    // An untouched default name is worth replacing with the one the user just typed in the dialog.
    if (name.value === DEFAULT_NAME) {
      name.value = basename(target)
        .replace(PROJECT_EXTENSION, '')
        .replace(/\.json$/, '')
    }

    return writeTo(target)
  }

  // ---------------------------------------------------------------- recovery

  /** @returns {Promise<{ sidecarPath: string, modifiedAt: number }|null>} */
  async function findRecovery(filePath) {
    recovery.value = await ProjectFileService.findRecovery(filePath ?? path.value)
    return recovery.value
  }

  async function discardRecovery(filePath) {
    await ProjectFileService.discardRecovery(filePath ?? path.value)
    recovery.value = null
  }

  /**
   * @param {(error: Error) => void} handler told when a sidecar write fails
   * @returns {() => void} unregisters it
   */
  function onAutosaveError(handler) {
    return ProjectFileService.setAutosaveErrorHandler(handler)
  }

  /**
   * "Don't save" on the way out. The pending autosave is cancelled first: the close handler flushes
   * after this, and a queued write would put back the sidecar that was just removed. A held copy
   * is the crash's, not this project's, so it stays.
   */
  async function discardUnsaved() {
    ProjectFileService.cancelAutosave()
    if (unsavedHeld()) return
    await discardRecovery()
  }

  // ---------------------------------------------------------------- startup recovery

  /** Ends the hold; whatever was edited during it gets its copy now. */
  function releaseUnsaved() {
    holdingUnsaved = false
    startupCopy = null
    if (isDirty.value && !path.value) ProjectFileService.scheduleAutosave(snapshot(), null)
  }

  /**
   * Looks for the copy a crash left of a project without a file. The hold starts before the first
   * `await`, so not even an edit made during the check can write over the copy (RECOVERY-01).
   *
   * A copy that cannot be read stays where it is and stays held: this session has no way to tell
   * what it holds, so it may not write over it either.
   *
   * @returns {Promise<{ name: string, modifiedAt: number }|{ refusal: { error: LoadError, keptAs: string|null } }|null>}
   *   the copy to offer; a broken one, moved aside (`keptAs` is null when that failed too, and the
   *   copy then stays held); or null when there is nothing to recover
   */
  async function checkStartupRecovery() {
    holdingUnsaved = true
    const found = await ProjectFileService.findRecovery(null)
    if (!found) {
      releaseUnsaved()
      return null
    }
    try {
      const { project } = await ProjectFileService.load(found.sidecarPath)
      startupCopy = found
      return { name: project.name, modifiedAt: found.modifiedAt }
    } catch (error) {
      if (!(error instanceof LoadError)) throw error
      const keptAs = await ProjectFileService.setAsideRecovery(found.sidecarPath)
      if (keptAs) releaseUnsaved()
      return { refusal: { error, keptAs } }
    }
  }

  /** «Відновити»: the copy is work that never reached a file, so it opens dirty and without one. */
  async function restoreStartupRecovery() {
    await openRecovery(startupCopy.sidecarPath, null)
    holdingUnsaved = false
    startupCopy = null
  }

  /** «Відкинути копію»: the copy goes before any write of the project now in the editor. */
  async function discardStartupRecovery() {
    const discarding = ProjectFileService.discardRecovery(null)
    releaseUnsaved()
    await discarding
  }

  return {
    path,
    name,
    isDirty,
    createdAt,
    recovery,
    fileName,
    hasFile,
    markDirty,
    markSaved,
    open,
    reset,
    newProject,
    pickToOpen,
    openPath,
    openRecovery,
    save,
    saveAs,
    findRecovery,
    discardRecovery,
    discardUnsaved,
    onAutosaveError,
    checkStartupRecovery,
    restoreStartupRecovery,
    discardStartupRecovery,
  }
})
