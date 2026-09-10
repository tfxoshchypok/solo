// Which file is open, whether it has unsaved work, and whether a crash left something to recover.
// The tree itself lives in modules/tree/stores/tree.js; this store is about the file around it.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { basename } from '@/services/PathService.js'

export const useProjectStore = defineStore('project', () => {
  /** null until the project has been saved once — a new project has no file yet. */
  const path = ref(null)
  const name = ref('Новий проект')
  const isDirty = ref(false)
  /** The catalog version this project was authored against (contracts/project-file.md). */
  const catalogVersion = ref(null)
  /** `{ sidecarPath, modifiedAt }` when an autosave is newer than the file (FR-031). */
  const recovery = ref(null)

  const fileName = computed(() => (path.value ? basename(path.value) : null))
  const hasFile = computed(() => path.value !== null)

  function markDirty() {
    isDirty.value = true
  }

  function markSaved(savedPath) {
    if (savedPath) path.value = savedPath
    isDirty.value = false
    recovery.value = null
  }

  function open({ path: filePath, name: projectName, catalogVersion: version }) {
    path.value = filePath ?? null
    name.value = projectName ?? 'Новий проект'
    catalogVersion.value = version ?? null
    isDirty.value = false
    recovery.value = null
  }

  function reset() {
    open({ path: null, name: 'Новий проект', catalogVersion: null })
  }

  return {
    path,
    name,
    isDirty,
    catalogVersion,
    recovery,
    fileName,
    hasFile,
    markDirty,
    markSaved,
    open,
    reset,
  }
})
