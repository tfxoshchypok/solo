<script setup>
// One cell of a reference row, edited where it stands: in the «Довідники» table, in a consumer's
// copy and in the project and panel properties in the inspector, so all of them commit and choose the
// same way (research R7, R17; 003 research R10). A text or number cell keeps a local draft while it is
// typed into and emits `commit` with the text on blur or Enter; a yes/no or choice cell emits on
// choice. The draft goes at commit, so a refused value leaves the field showing what is still stored
// (002/FR-006).
import { computed, ref } from 'vue'
import { NInput, NSelect } from 'naive-ui'
import { formatCell } from '../engine/cells.js'

const props = defineProps({
  /** @type {'name'|'text'|'number'|'yesno'|'count'|'positive'|'choice'} */
  kind: { type: String, required: true },
  value: { type: [String, Number, Boolean], default: null },
  /** The choices of a `choice` cell: `{ label, value }`, as `NSelect` takes them. */
  options: { type: Array, default: () => [] },
  /**
   * Shown while the value is empty, such as the project's value on a panel that inherits it (003
   * research R11). A select given none shows nothing rather than Naive UI's «Обрати».
   */
  placeholder: { type: String, default: undefined },
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
    v-if="kind === 'yesno' || kind === 'choice'"
    size="small"
    :value="value"
    :options="kind === 'yesno' ? YES_NO : options"
    :placeholder="placeholder || ' '"
    clearable
    :data-cell="dataCell"
    @update:value="(choice) => emit('commit', choice ?? null)"
  />
  <n-input
    v-else
    size="small"
    :value="shown"
    :placeholder="placeholder"
    :type="multiline ? 'textarea' : 'text'"
    :autosize="multiline ? { minRows: 1, maxRows: 8 } : false"
    :input-props="{ 'data-cell': dataCell }"
    @update:value="(text) => (draft = text)"
    @blur="commit"
    @keydown.enter="onEnter"
  />
</template>
