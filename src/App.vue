<script setup>
import { computed, onMounted } from 'vue'
import {
  NConfigProvider,
  NDialogProvider,
  NMessageProvider,
  NGlobalStyle,
  darkTheme,
  dateUkUA,
  lightTheme,
  ukUA,
} from 'naive-ui'
import AppLayout from '@/components/AppLayout.vue'
import { useUiStore } from '@/stores/ui.js'

const ui = useUiStore()

const theme = computed(() => (ui.theme === 'dark' ? darkTheme : null))

// Naive UI's message is a white card with grey text, easy to miss at the top of the window. Each kind
// gets its own colour as a tint and an outline, built from the active theme's colours, so a warning
// or an error reads as one at a glance in both themes.
function messageOverrides(common) {
  const overrides = { fontSize: '15px', padding: '12px 20px', iconSize: '22px', maxWidth: '720px' }
  for (const kind of ['Info', 'Success', 'Warning', 'Error']) {
    const accent = common[`${kind.toLowerCase()}Color`]
    overrides[`color${kind}`] = `color-mix(in srgb, ${accent} 16%, ${common.popoverColor})`
    overrides[`textColor${kind}`] = common.textColor1
    overrides[`boxShadow${kind}`] = `0 0 0 2px ${accent}, ${common.boxShadow2}`
  }
  return overrides
}

const themeOverrides = computed(() => ({
  Message: messageOverrides((ui.theme === 'dark' ? darkTheme : lightTheme).common),
}))

onMounted(async () => {
  await ui.restore()
})
</script>

<template>
  <n-config-provider
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="ukUA"
    :date-locale="dateUkUA"
  >
    <n-global-style />
    <n-dialog-provider>
      <n-message-provider :duration="6000" closable keep-alive-on-hover>
        <AppLayout>
          <RouterView />
        </AppLayout>
      </n-message-provider>
    </n-dialog-provider>
  </n-config-provider>
</template>
