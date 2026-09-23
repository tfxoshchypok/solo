<script setup>
// The properties of whatever is selected, editable where it stands (FR-029). Name and note are
// the two fields every kind carries (FR-006, FR-012); a consumer additionally shows which catalog
// type it came from, as text — the type is chosen at placement and does not change afterwards.
import { computed, nextTick, ref, watch } from 'vue'
import { NEmpty, NForm, NFormItem, NInput, NInputNumber, NTag, NText } from 'naive-ui'
import { useTreeStore } from '../stores/tree.js'

const tree = useTreeStore()

const node = computed(() => tree.selected)

const nameInput = ref(null)

/** F2 in the canvas puts the cursor here — the rename path that needs no pointer (FR-030). */
async function focusName() {
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select?.()
}

defineExpose({ focusName })

const KIND_LABEL = { entry: 'Ввід', panel: 'Щиток', consumer: 'Споживач' }
const kindLabel = computed(() => KIND_LABEL[node.value?.kind] ?? '')

/**
 * The text fields hold a draft of their own. `n-input` is controlled — it renders exactly what
 * `value` gives it — so binding it straight to the store meant every keystroke was painted back
 * to the stored name and the field looked frozen. The draft is what the user is typing; the store
 * is what has been committed.
 *
 * Committed on blur and on Enter rather than on every keystroke: one rename is one undo step, so
 * typing a name would otherwise fill the 100-step history with prefixes of it (FR-011).
 */
const nameDraft = ref('')
const noteDraft = ref('')

// Watching the value, not only the selection: a name changed underneath the field — an undo, a
// rename from elsewhere — has to reach it too. While the user types, the stored value does not
// move, so this does not fight them for the field.
watch(
  () => [node.value?.id, node.value?.name],
  () => {
    nameDraft.value = node.value?.name ?? ''
  },
  { immediate: true },
)

watch(
  () => [node.value?.id, node.value?.note],
  () => {
    noteDraft.value = node.value?.note ?? ''
  },
  { immediate: true },
)

/** A blank name is refused by the schema, so the field returns to the name that still stands. */
function commitName(value) {
  if (!node.value) return
  const next = (value ?? '').trim()
  if (next === '' || next === node.value.name) {
    nameDraft.value = node.value.name
    return
  }
  tree.rename(node.value.id, next)
}

function commitNote(value) {
  if (!node.value) return
  const next = value ?? ''
  if (next === (node.value.note ?? '')) return
  tree.setNote(node.value.id, next)
}

/** Eight downlights are one node with a quantity of eight, not eight siblings (FR-025). */
const quantity = computed({
  get: () => node.value?.quantity ?? 1,
  set: (value) => {
    if (!node.value || !Number.isInteger(value) || value < 1) return
    if (value === node.value.quantity) return
    tree.setQuantity(node.value.id, value)
  },
})
</script>

<template>
  <div class="inspector">
    <n-empty v-if="!node" size="small" description="Виберіть вузол" />

    <n-form v-else label-placement="top" size="small">
      <div class="inspector-kind">
        <n-tag size="small" :bordered="false">{{ kindLabel }}</n-tag>
        <n-text v-if="node.kind === 'consumer'" depth="3" class="app-ellipsis">
          {{ node.typeName }}
        </n-text>
      </div>

      <n-form-item label="Назва">
        <n-input
          ref="nameInput"
          v-model:value="nameDraft"
          placeholder="Назва вузла"
          :maxlength="120"
          @change="commitName"
          @blur="commitName(nameDraft)"
        />
      </n-form-item>

      <n-form-item v-if="node.kind === 'consumer'" label="Кількість">
        <n-input-number v-model:value="quantity" :min="1" :precision="0" style="width: 100%" />
      </n-form-item>

      <n-form-item label="Нотатка">
        <n-input
          v-model:value="noteDraft"
          type="textarea"
          placeholder="Довільний текст"
          :maxlength="2000"
          :autosize="{ minRows: 2, maxRows: 6 }"
          @change="commitNote"
          @blur="commitNote(noteDraft)"
        />
      </n-form-item>
    </n-form>
  </div>
</template>

<style scoped>
.inspector {
  padding: var(--app-gutter);
}

.inspector-kind {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--app-gutter);
  min-width: 0;
}
</style>
