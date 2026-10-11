<script setup>
// What the user sees when the homogeneity rule refuses an add: the rule in their own terms, and
// the one-step way out that FR-016 and FR-017 require the refusal to come with.
//
// The refusal itself is not a failure state to dismiss — it is a fork with two named exits, so
// the dialog leads with the remedy rather than with the error.
import { computed, ref, watch } from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NRadio,
  NRadioGroup,
  NSpace,
  NText,
} from 'naive-ui'
import { useTreeStore } from '../stores/tree.js'

const props = defineProps({
  /** The `RuleError` that came back from the store, or null when there is nothing to resolve. */
  error: { type: Object, default: null },
  /**
   * What the user was trying to do. An add carries the node to create, with the two rows it will
   * copy — `{ kind, name, loadType, zone }`. A move carries the node that already exists —
   * `{ op: 'move', nodeId, parentId }`. Both refusals offer the same two fixes (SC-002).
   */
  pending: { type: Object, default: null },
})

const emit = defineEmits(['resolved', 'cancel'])

const tree = useTreeStore()

const fix = computed(() => props.error?.fix ?? null)
const show = computed(() => Boolean(fix.value))

const kind = computed(() => fix.value?.kind ?? null)

const panelName = ref('')
const targetPanelId = ref(null)

const candidatePanels = computed(() =>
  (fix.value?.candidatePanelIds ?? []).map((id) => ({
    id,
    name: tree.nodes[id]?.name ?? id,
  })),
)

// Fresh defaults each time the dialog opens, so a name typed for one refusal is never reused for
// the next one without the user seeing it. `immediate` covers the case where the component is
// mounted with a refusal already in hand — without it the target panel would start out unset and
// the apply button would be dead on arrival.
watch(
  fix,
  (value) => {
    if (!value) return
    panelName.value = 'Група 1'
    targetPanelId.value = value.candidatePanelIds?.[0] ?? null
  },
  { immediate: true },
)

const applyLabel = computed(() => {
  if (kind.value === 'wrapConsumersInNewPanel')
    return isMove.value ? 'Перенести і перемістити' : 'Перенести і додати'
  return isMove.value ? 'Перемістити сюди' : 'Покласти сюди'
})

const canApply = computed(() => {
  if (kind.value === 'wrapConsumersInNewPanel') return panelName.value.trim() !== ''
  if (kind.value === 'placeUnderChildPanel') return Boolean(targetPanelId.value)
  return false
})

/** A move resolves by relocating a node that exists; an add resolves by creating one. */
const isMove = computed(() => props.pending?.op === 'move')

function applyWrap() {
  const parentId = fix.value.parentId
  const name = panelName.value.trim()
  return isMove.value
    ? tree.wrapConsumersAndMove({ parentId, panelName: name, nodeId: props.pending.nodeId })
    : tree.wrapConsumersAndAdd({ parentId, panelName: name, pending: props.pending })
}

function applyPlaceUnder() {
  const parentId = targetPanelId.value
  if (!isMove.value) return tree.add({ parentId, ...props.pending })

  tree.move(props.pending.nodeId, parentId, tree.nodes[parentId].childIds.length)
  return props.pending.nodeId
}

function apply() {
  if (!canApply.value) return
  const nodeId = kind.value === 'wrapConsumersInNewPanel' ? applyWrap() : applyPlaceUnder()
  emit('resolved', nodeId)
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    class="fix-dialog"
    title="Так не можна — але є один крок, який це вирішує"
    :bordered="false"
    :mask-closable="false"
    @close="emit('cancel')"
  >
    <n-text depth="2">{{ error?.message }}</n-text>

    <n-form v-if="kind === 'wrapConsumersInNewPanel'" label-placement="top" size="small">
      <n-form-item label="Назва щитка, у який переїдуть наявні споживачі">
        <n-input v-model:value="panelName" :maxlength="120" placeholder="Наприклад, Освітлення" />
      </n-form-item>
    </n-form>

    <n-form v-else-if="kind === 'placeUnderChildPanel'" label-placement="top" size="small">
      <n-form-item label="Під який щиток покласти">
        <n-radio-group v-model:value="targetPanelId">
          <n-space vertical>
            <n-radio v-for="panel in candidatePanels" :key="panel.id" :value="panel.id">
              {{ panel.name }}
            </n-radio>
          </n-space>
        </n-radio-group>
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button size="small" @click="emit('cancel')">Скасувати</n-button>
        <n-button size="small" type="primary" :disabled="!canApply" @click="apply">
          {{ applyLabel }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.fix-dialog {
  max-width: 460px;
}
</style>
