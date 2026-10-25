<script setup>
// One reference table, edited cell by cell (002/FR-004, research R7). Every cell is a `CellEditor`,
// which commits on blur or Enter, or on choice for a yes/no cell. Every accepted edit is stored at
// once by the store. A refused one is shown with its reason and the cell goes back to what is stored
// (002/FR-005, 002/FR-006). A row is deleted only after the user confirms it in a dialog.
//
// The row id is the table's row key and nothing more: it is never rendered (002/FR-005).
import { computed, h, ref } from 'vue'
import { NButton, NDataTable, NIcon, NInput, useMessage } from 'naive-ui'
import { TrashOutline } from '@vicons/ionicons5'
import { useConfirm } from '@/composables/useConfirm.js'
import { REFERENCE_TABLES } from '@/schemas/index.js'
import { columns, tableTitles } from '../config/columns.js'
import { rowLabel, TableRuleError } from '../engine/tableOps.js'
import { useReferenceTablesStore } from '../stores/referenceTables.js'
import CellEditor from './CellEditor.vue'

const props = defineProps({
  table: {
    type: String,
    required: true,
    validator: (value) => REFERENCE_TABLES.includes(value),
  },
})

const store = useReferenceTablesStore()
const message = useMessage()
const confirm = useConfirm()

const rows = computed(() => store.tables[props.table])

/** The enclosure sizes have no name, so a new row is added without one (research R8). */
const named = computed(() => columns[props.table].some((column) => column.kind === 'name'))
const newName = ref('')

function report(error) {
  if (error instanceof TableRuleError) message.warning(error.message)
  else message.error(`Не вдалося записати довідники — ${error?.message ?? error}`)
}

/** @param {string|boolean|null} input typed text, or the value a yes/no select chose */
async function commit(row, column, input) {
  try {
    await store.updateCell(props.table, row.id, column.key, input)
  } catch (error) {
    report(error)
  }
}

async function addRow() {
  try {
    await store.addRow(props.table, named.value ? newName.value : undefined)
    newName.value = ''
  } catch (error) {
    report(error)
  }
}

async function removeRow(row) {
  const confirmed = await confirm({
    title: 'Видалити рядок?',
    content:
      `Рядок «${rowLabel(props.table, row)}» зникне з довідника «${tableTitles[props.table]}». ` +
      'Споживачі, яким його вже скопійовано, свої значення збережуть.',
  })
  if (!confirmed) return
  try {
    await store.deleteRow(props.table, row.id)
  } catch (error) {
    report(error)
  }
}

const WIDTHS = { name: 240, purpose: 300 }

const tableColumns = computed(() => [
  ...columns[props.table].map((column) => ({
    key: column.key,
    title: column.header,
    minWidth: WIDTHS[column.key] ?? 110,
    render: (row) =>
      h(CellEditor, {
        kind: column.kind,
        value: row[column.key],
        dataCell: column.key,
        onCommit: (input) => commit(row, column, input),
      }),
  })),
  {
    key: 'actions',
    title: '',
    width: 52,
    render: (row) =>
      h(
        NButton,
        {
          quaternary: true,
          size: 'small',
          'aria-label': 'Видалити рядок',
          title: 'Видалити рядок',
          onClick: () => removeRow(row),
        },
        { icon: () => h(NIcon, null, { default: () => h(TrashOutline) }) },
      ),
  },
])
</script>

<template>
  <div class="reference-table">
    <div class="reference-table-add">
      <n-input
        v-if="named"
        v-model:value="newName"
        size="small"
        placeholder="Назва нового рядка"
        :input-props="{ 'data-add-name': '' }"
        @keydown.enter="addRow"
      />
      <n-button size="small" @click="addRow">Додати рядок</n-button>
    </div>
    <n-data-table
      size="small"
      :columns="tableColumns"
      :data="rows"
      :row-key="(row) => row.id"
      :bordered="true"
    />
  </div>
</template>

<style scoped>
.reference-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reference-table-add {
  display: flex;
  gap: 8px;
  max-width: 480px;
}
</style>
