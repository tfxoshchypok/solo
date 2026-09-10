// Theme and drawer state. Persisted through Neutralino.storage, which is a key/value store in the
// app's own directory — not a project concern, so it never reaches the project file.
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { storage } from '@neutralinojs/lib'
import { isNeutralinoRuntime } from '@/services/fs/index.js'

const STORAGE_KEY = 'ui'

export const useUiStore = defineStore('ui', () => {
  const theme = ref('light')
  const sidebarCollapsed = ref(false)

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function snapshot() {
    return { theme: theme.value, sidebarCollapsed: sidebarCollapsed.value }
  }

  /** Outside the Neutralino window there is nowhere to persist to, and that is not an error. */
  async function restore() {
    if (!isNeutralinoRuntime()) return
    try {
      const saved = JSON.parse(await storage.getData(STORAGE_KEY))
      if (saved.theme) theme.value = saved.theme
      if (typeof saved.sidebarCollapsed === 'boolean') {
        sidebarCollapsed.value = saved.sidebarCollapsed
      }
    } catch {
      // No key stored yet — the defaults above stand.
    }
  }

  watch([theme, sidebarCollapsed], () => {
    if (!isNeutralinoRuntime()) return
    storage.setData(STORAGE_KEY, JSON.stringify(snapshot())).catch(() => {})
  })

  // Keeps the `[data-theme]` hook in assets/main.css in step with the store.
  watch(
    theme,
    (value) => {
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = value
      }
    },
    { immediate: true },
  )

  return { theme, sidebarCollapsed, toggleTheme, restore }
})
