<script setup>
import { computed, h, onBeforeUnmount, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { NButton, NIcon, NLayout, NLayoutSider, NMenu, useMessage } from 'naive-ui'
import { GitNetworkOutline, LibraryOutline, MoonOutline, SunnyOutline } from '@vicons/ionicons5'
import { useUiStore } from '@/stores/ui.js'
import { useProjectStore } from '@/stores/project.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import { useExitPrompt } from '@/composables/useExitPrompt.js'
import { LoadError } from '@/services/LoadError.js'
import { decideExit, setExitDecision } from '@/services/closeGuard.js'

const ui = useUiStore()
const project = useProjectStore()
const referenceTables = useReferenceTablesStore()
const route = useRoute()
const message = useMessage()
const promptExit = useExitPrompt()

// Closing the window with unsaved work asks first (FR-031). The shell registers the question rather
// than the tree view, because the shell stays mounted whichever section is open (002/FR-008,
// research R10). A failed save is reported and keeps the window open, so the error is not the last
// thing the user sees before the exit.
const unregisterExitDecision = setExitDecision(() =>
  decideExit({
    isDirty: () => project.isDirty,
    prompt: promptExit,
    save: async () => {
      try {
        return await project.save()
      } catch (error) {
        if (error instanceof LoadError) message.error(`Файл не відкрився — ${error.message}`)
        else message.error(error?.message ?? 'Не вдалося звернутися до файлу.')
        throw error
      }
    },
    discard: () => project.discardUnsaved(),
  }),
)
onBeforeUnmount(unregisterExitDecision)

// The shell lives for the whole session, so it reads the stored reference tables once, at startup,
// and says so once if the stored file had to be set aside (002/FR-007). Both sections read the
// tables through the store from then on.
onMounted(async () => {
  try {
    await referenceTables.load()
  } catch (error) {
    message.error(`Не вдалося прочитати довідники — ${error?.message ?? error}`)
    return
  }
  const refusal = referenceTables.refusal
  if (!refusal) return
  const kept = refusal.keptAs
    ? `файл збережено як ${refusal.keptAs}`
    : 'зіпсований файл відкласти не вдалося'
  message.error(
    `Довідники не прочитались — ${refusal.error.message}. Відкрито початкові таблиці; ${kept}.`,
    { duration: 10000, closable: true },
  )
})

const icon = (component) => () => h(NIcon, null, { default: () => h(component) })
const link = (to, label) => () => h(RouterLink, { to }, { default: () => label })

const menuOptions = computed(() => [
  { key: 'tree', label: link('/tree', 'Дерево'), icon: icon(GitNetworkOutline) },
  { key: 'reference', label: link('/reference', 'Довідники'), icon: icon(LibraryOutline) },
])

const activeKey = computed(() => route.name ?? 'tree')
const titleText = computed(() =>
  project.fileName ? `${project.name} — ${project.fileName}` : project.name,
)
</script>

<template>
  <n-layout has-sider class="app-shell">
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed="ui.sidebarCollapsed"
      :collapsed-width="56"
      :width="220"
      show-trigger
      @collapse="ui.sidebarCollapsed = true"
      @expand="ui.sidebarCollapsed = false"
    >
      <n-menu
        :collapsed="ui.sidebarCollapsed"
        :collapsed-width="56"
        :options="menuOptions"
        :value="activeKey"
      />
    </n-layout-sider>

    <n-layout class="app-body">
      <header class="app-toolbar">
        <span class="app-title app-ellipsis">
          {{ titleText }}<span v-if="project.isDirty" class="app-dirty"> •</span>
        </span>

        <div class="app-toolbar-actions">
          <slot name="toolbar" />

          <n-button
            quaternary
            size="small"
            :aria-label="ui.theme === 'dark' ? 'Світла тема' : 'Темна тема'"
            @click="ui.toggleTheme()"
          >
            <template #icon>
              <n-icon>
                <SunnyOutline v-if="ui.theme === 'dark'" />
                <MoonOutline v-else />
              </n-icon>
            </template>
          </n-button>
        </div>
      </header>

      <main class="app-content">
        <slot />
      </main>
    </n-layout>
  </n-layout>
</template>

<style scoped>
.app-shell {
  height: 100vh;
}

.app-body {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 0;
}

.app-toolbar {
  display: flex;
  align-items: center;
  gap: var(--app-gutter);
  height: var(--app-toolbar-height);
  min-height: var(--app-toolbar-height);
  padding: 0 var(--app-gutter);
  border-bottom: 1px solid var(--app-border);
}

.app-title {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
}

.app-dirty {
  opacity: 0.6;
}

.app-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.app-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
</style>
