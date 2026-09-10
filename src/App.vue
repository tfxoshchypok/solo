<script setup>
import { computed, onMounted } from 'vue'
import {
  NConfigProvider,
  NDialogProvider,
  NMessageProvider,
  NGlobalStyle,
  darkTheme,
  dateUkUA,
  ukUA,
} from 'naive-ui'
import AppLayout from '@/components/AppLayout.vue'
import { useUiStore } from '@/stores/ui.js'

const ui = useUiStore()

const theme = computed(() => (ui.theme === 'dark' ? darkTheme : null))

onMounted(async () => {
  await ui.restore()
})
</script>

<template>
  <n-config-provider :theme="theme" :locale="ukUA" :date-locale="dateUkUA">
    <n-global-style />
    <n-dialog-provider>
      <n-message-provider>
        <AppLayout>
          <RouterView />
        </AppLayout>
      </n-message-provider>
    </n-dialog-provider>
  </n-config-provider>
</template>
