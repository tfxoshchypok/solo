<script setup>
import { computed, h } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { NButton, NIcon, NLayout, NLayoutSider, NMenu } from 'naive-ui'
import { GitNetworkOutline, MoonOutline, SunnyOutline } from '@vicons/ionicons5'
import { useUiStore } from '@/stores/ui.js'
import { useProjectStore } from '@/stores/project.js'

const ui = useUiStore()
const project = useProjectStore()
const route = useRoute()

const icon = (component) => () => h(NIcon, null, { default: () => h(component) })
const link = (to, label) => () => h(RouterLink, { to }, { default: () => label })

const menuOptions = computed(() => [
  { key: 'tree', label: link('/tree', 'Дерево'), icon: icon(GitNetworkOutline) },
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
