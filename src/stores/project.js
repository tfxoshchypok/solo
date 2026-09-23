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
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useCatalogStore } from '@/modules/tree/stores/catalog.js'

const DEFAULT_NAME = 'Новий проект'

/** What the native dialogs offer to filter on. */
const FILE_FILTERS = [{ name: 'Проект eltree', extensions: ['eltree.json', 'json'] }]

export const useProjectStore = defineStore('project', () => {
  const tree = useTreeStore()
  const catalog = useCatalogStore()

  /** null until the project has been saved once — a new project has no file yet. */
  const path = ref(null)
  const name = ref(DEFAULT_NAME)
  const isDirty = ref(false)
  /** The catalog version this project was authored against (contracts/project-file.md). */
  const catalogVersion = ref(null)
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
        catalogVersion: catalogVersion.value ?? catalog.catalogVersion,
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
      isDirty.value = true
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

  function open({ path: filePath, name: projectName, catalogVersion: version, createdAt: born }) {
    path.value = filePath ?? null
    name.value = projectName ?? DEFAULT_NAME
    catalogVersion.value = version ?? null
    createdAt.value = born ?? null
    isDirty.value = false
    recovery.value = null
  }

  function reset() {
    open({ path: null, name: DEFAULT_NAME, catalogVersion: null, createdAt: null })
  }

  /** An empty project: one entry node and no file behind it (FR-002). */
  function newProject() {
    ProjectFileService.cancelAutosave()
    replacing = true
    try {
      tree.reset()
    } finally {
      replacing = false
    }
    reset()
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
    replaceTree(normalize(project))
    open({
      path: filePath,
      name: project.name,
      catalogVersion: project.catalogVersion,
      createdAt: project.createdAt,
    })
  }

  /**
   * The same load, pointed at the sidecar but presented as the project file: the recovered state
   * is work that never reached the file, so it opens dirty and the next save writes it there.
   */
  async function openRecovery(sidecarPath, filePath) {
    const { project } = await ProjectFileService.load(sidecarPath)
    replaceTree(normalize(project))
    open({
      path: filePath ?? null,
      name: project.name,
      catalogVersion: project.catalogVersion,
      createdAt: project.createdAt,
    })
    isDirty.value = true
  }

  // ---------------------------------------------------------------- save

  async function save() {
    if (!path.value) return saveAs()
    const written = await ProjectFileService.save(snapshot(), path.value)
    createdAt.value = written.createdAt
    markSaved(path.value)
    return path.value
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

    const written = await ProjectFileService.save(snapshot(), target)
    createdAt.value = written.createdAt
    markSaved(target)
    return target
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
   * "Don't save" on the way out. The pending autosave is cancelled first: the close handler flushes
   * after this, and a queued write would put back the sidecar that was just removed.
   */
  async function discardUnsaved() {
    ProjectFileService.cancelAutosave()
    await discardRecovery()
  }

  return {
    path,
    name,
    isDirty,
    catalogVersion,
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
  }
})
