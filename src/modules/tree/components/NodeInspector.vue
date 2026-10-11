<script setup>
// The properties of whatever is selected, editable where it stands (FR-029). The entry and a panel
// carry a name and a note (FR-006, FR-012). A consumer shows its own fields — name and cable section —
// and below them, as a group of their own, the copies of its load type and zone rows (002/FR-022).
// Each select shows the copied name whatever the table now says, and choosing a row copies it afresh;
// each copied value is edited on this consumer only (002/FR-015, 002/FR-021, research R14, R17).
import { computed, nextTick, ref, watch } from 'vue'
import { NEmpty, NForm, NFormItem, NInput, NSelect, NTag, useMessage, useThemeVars } from 'naive-ui'
import { useTreeStore } from '../stores/tree.js'
import { RuleError } from '../engine/treeOps.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import { columns } from '@/modules/reference/config/columns.js'
import { formatCell, parseCell, parseNumberCell } from '@/modules/reference/engine/cells.js'
import { TableRuleError } from '@/modules/reference/engine/tableOps.js'
import CellEditor from '@/modules/reference/components/CellEditor.vue'

const tree = useTreeStore()
const reference = useReferenceTablesStore()
const message = useMessage()
const themeVars = useThemeVars()
const muted = computed(() => ({ color: themeVars.value.textColor3 }))

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
const sectionDraft = ref('')

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

watch(
  () => [node.value?.id, node.value?.cableSectionMm2],
  () => {
    sectionDraft.value = formatCell('number', node.value?.cableSectionMm2)
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

/**
 * The value both row selects are bound to, which no option carries. `NSelect` then always shows the
 * fallback option, labelled with the copied name, whether the row was since renamed or deleted
 * (002/FR-015), and choosing even the row the copy came from reaches the handler (research R14).
 */
const COPY = '@copy'

const optionsOf = (rows) => rows.map((row) => ({ label: row.name, value: row.id }))
const valueColumns = (table) => columns[table].filter((column) => column.key !== 'name')

/** The two copies, in the order the group shows them. Both names change only by choosing a row. */
const copyParts = computed(() => [
  {
    key: 'loadType',
    label: 'Тип навантаження',
    options: optionsOf(reference.tables.loadTypes),
    columns: valueColumns('loadTypes'),
    filterable: true,
  },
  {
    key: 'zone',
    label: 'Зона',
    options: optionsOf(reference.tables.zones),
    columns: valueColumns('zones'),
    filterable: false,
  },
])

/** A refused edit is said out loud; the field then shows what is still stored. */
function refused(error) {
  if (!(error instanceof RuleError) && !(error instanceof TableRuleError)) throw error
  message.warning(error.message)
}

/** Copies the chosen row afresh, the row the copy came from included (002/FR-014). */
function chooseRow(part, rowId) {
  if (node.value?.kind !== 'consumer') return
  try {
    if (part === 'loadType') tree.setLoadType(node.value.id, rowId)
    else tree.setZone(node.value.id, rowId)
  } catch (error) {
    refused(error)
  }
}

/** The input is parsed as the table parses it, so both refuse the same text (research R16). */
function commitCopy(part, column, input) {
  if (node.value?.kind !== 'consumer') return
  try {
    tree.setCopyValue(node.value.id, part, column.key, parseCell(column.kind, input))
  } catch (error) {
    refused(error)
  }
}

/** Empty means no cable yet (`null`); `2,5` and `2.5` are both 2.5 mm² (002/FR-011). */
function commitSection() {
  if (node.value?.kind !== 'consumer') return
  const stored = node.value.cableSectionMm2
  try {
    const next = parseNumberCell(sectionDraft.value)
    if (next === stored) {
      sectionDraft.value = formatCell('number', stored)
      return
    }
    tree.setCableSection(node.value.id, next)
  } catch (error) {
    refused(error)
    sectionDraft.value = formatCell('number', stored)
  }
}
</script>

<template>
  <div class="inspector">
    <n-empty v-if="!node" size="small" description="Виберіть вузол" />

    <n-form v-else label-placement="top" size="small">
      <div class="inspector-kind">
        <n-tag size="small" :bordered="false">{{ kindLabel }}</n-tag>
      </div>

      <div data-project-group>
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

        <n-form-item v-if="node.kind === 'consumer'" label="Переріз кабелю, мм²">
          <n-input
            v-model:value="sectionDraft"
            placeholder="Порожньо, поки кабель не прокладено"
            @change="commitSection"
            @blur="commitSection"
          />
        </n-form-item>

        <n-form-item v-else label="Нотатка">
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
      </div>

      <!-- Keyed by the node, so a half-typed copied value never carries over to the next consumer. -->
      <div
        v-if="node.kind === 'consumer'"
        :key="node.id"
        data-copy-group
        class="copy-group"
        :style="{ background: themeVars.actionColor }"
      >
        <div class="copy-caption" :style="muted">З довідника · копія</div>
        <section v-for="part in copyParts" :key="part.key" :data-copy="part.key" class="copy-part">
          <div data-copy-label>{{ part.label }}</div>
          <n-select
            data-row-select
            size="small"
            :value="COPY"
            :options="part.options"
            :fallback-option="() => ({ label: node[part.key].name })"
            :virtual-scroll="false"
            :filterable="part.filterable"
            @update:value="(rowId) => chooseRow(part.key, rowId)"
          />
          <div class="copy-grid">
            <template v-for="column in part.columns" :key="column.key">
              <span
                data-copy-label
                class="copy-label"
                :class="{ 'copy-wide': column.key === 'purpose' }"
                :style="muted"
              >
                {{ column.header }}
              </span>
              <cell-editor
                :class="{ 'copy-wide': column.key === 'purpose' }"
                :kind="column.kind"
                :value="node[part.key][column.key]"
                :multiline="column.key === 'purpose'"
                :data-cell="column.key"
                @commit="(input) => commitCopy(part.key, column, input)"
              />
            </template>
          </div>
        </section>
      </div>
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

.copy-group {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 10px;
  border-radius: 6px;
}

.copy-caption {
  font-size: 12px;
}

.copy-part {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.copy-grid {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px 8px;
  padding-left: 8px;
}

.copy-label {
  font-size: 12px;
}

.copy-wide {
  grid-column: 1 / -1;
}
</style>
