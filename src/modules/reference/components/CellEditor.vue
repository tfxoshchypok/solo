<script setup>
// One cell of a reference row, edited where it stands: in the «Довідники» table and in a consumer's
// copy in the inspector, so both commit and choose «так / ні» the same way (research R7, R17). A text
// or number cell keeps a local draft while it is typed into and emits `commit` with the text on blur
// or Enter; a yes/no cell emits on choice. The draft goes at commit, so a refused value leaves the
// field showing what is still stored (002/FR-006).
import { computed, ref } from 'vue'
import { NInput, NSelect } from 'naive-ui'
import { formatCell } from '../engine/cells.js'

const props = defineProps({
  /** @type {'name'|'text'|'number'|'yesno'} */
  kind: { type: String, required: true },
  value: { type: [String, Number, Boolean], default: null },
  /** A long text, such as a zone's purpose: it wraps, and Enter starts a new line instead of committing. */
  multiline: { type: Boolean, default: false },
  /** Carried by the element the user types into or chooses from. */
  dataCell: { type: String, default: null },
})

const emit = defineEmits(['commit'])

const YES_NO = [
  { label: 'так', value: true },
  { label: 'ні', value: false },
]

/** What is being typed; null means the field shows the stored value. */
const draft = ref(null)
const shown = computed(() => draft.value ?? formatCell(props.kind, props.value))

function commit() {
  if (draft.value === null) return
  const text = draft.value
  draft.value = null
  if (text !== formatCell(props.kind, props.value)) emit('commit', text)
}

function onEnter() {
  if (!props.multiline) commit()
}
</script>

<template>
  <n-select
    v-if="kind === 'yesno'"
    size="small"
    :value="value"
    :options="YES_NO"
    clearable
    :data-cell="dataCell"
    @update:value="(choice) => emit('commit', choice ?? null)"
  />
  <n-input
    v-else
    size="small"
    :value="shown"
    :type="multiline ? 'textarea' : 'text'"
    :autosize="multiline ? { minRows: 1, maxRows: 8 } : false"
    :input-props="{ 'data-cell': dataCell }"
    @update:value="(text) => (draft = text)"
    @blur="commit"
    @keydown.enter="onEnter"
  />
</template>
