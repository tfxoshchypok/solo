<script setup>
// The properties of whatever is selected, editable where it stands (FR-029). The entry and a panel
// carry a name and a note (FR-006, FR-012). A consumer shows its own fields — name and cable section —
// and below them, as a group of their own, the copies of its load type and zone rows (002/FR-022).
// Each select shows the copied name whatever the table now says, and choosing a row copies it afresh;
// each copied value is edited on this consumer only (002/FR-015, 002/FR-021, research R14, R17).
// Below name and note, the entry edits the six project properties, and a panel shows the five it may
// override, inherited ones empty with the project's value in grey and the mark «з проекту» (003/FR-002,
// 003/FR-005, 003 research R10, R11).
import { computed, nextTick, ref, watch } from 'vue'
import {
  NButton,
  NCheckbox,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NTag,
  useMessage,
  useThemeVars,
} from 'naive-ui'
import { useTreeStore } from '../stores/tree.js'
import { RuleError } from '../engine/treeOps.js'
import { effectiveProperty, isInherited } from '../engine/panelProperties.js'
import { ACCESSORIES, CALCULATED_LABELS, PROJECT_PROPERTIES } from '../config/properties.js'
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

/** The text the editor parses as the table does, then the engine checks against the property's rule. */
function commitProjectProperty(property, input) {
  try {
    tree.setProjectProperty(property.key, parseCell(property.kind, input))
  } catch (error) {
    refused(error)
  }
}

/** An empty commit gives `null`, as «Скинути» does: the panel inherits again (003/FR-006). */
function commitPanelOverride(property, input) {
  if (node.value?.kind !== 'panel') return
  try {
    tree.setPanelOverride(node.value.id, property.key, parseCell(property.kind, input))
  } catch (error) {
    refused(error)
  }
}

const OVERRIDABLE = PROJECT_PROPERTIES.filter((property) => property.overridable)

/**
 * The «Розрахунок» fields: a panel's own three, then the line pair for a consumer or a panel under a
 * panel (003/FR-011, 003/FR-012). Computed from the parent, so a move of the selected panel shows
 * the pair at once.
 */
const calculatedKeys = computed(() => {
  const current = node.value
  if (!current || current.kind === 'entry') return []
  const keys =
    current.kind === 'panel' ? ['enclosure', 'deviceComposition', 'accessoryQuantities'] : []
  if (current.kind === 'consumer' || tree.nodes[current.parentId]?.kind === 'panel') {
    keys.push('groupRcd', 'phase')
  }
  return keys
})

const inherited = (property) => isInherited(tree.nodes, node.value.id, property.key)

/** What the panel shows for an inherited property: the project's value as the user reads it. */
function inheritedLabel(property) {
  if (!inherited(property)) return ''
  const value = effectiveProperty(tree.nodes, tree.rootId, node.value.id, property.key)
  if (property.kind === 'choice') {
    return property.options.find((option) => option.value === value)?.label ?? ''
  }
  return formatCell(property.kind, value)
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

      <div v-if="node.kind === 'entry'" data-project-properties class="properties-group">
        <div class="group-caption" :style="muted">Властивості проекту</div>
        <n-form-item
          v-for="property in PROJECT_PROPERTIES"
          :key="property.key"
          :label="property.label"
          :data-property="property.key"
        >
          <cell-editor
            :kind="property.kind"
            :value="node.projectProperties[property.key]"
            :options="property.options"
            placeholder=""
            @commit="(input) => commitProjectProperty(property, input)"
          />
        </n-form-item>
      </div>

      <!-- Keyed by the node, so a half-typed value never carries over to the next panel. -->
      <div
        v-if="node.kind === 'panel'"
        :key="node.id"
        data-panel-properties
        class="properties-group"
      >
        <div class="group-caption" :style="muted">Властивості щитка</div>
        <n-form-item
          v-for="property in OVERRIDABLE"
          :key="property.key"
          :label="property.label"
          :data-property="property.key"
        >
          <template #label>
            <span class="property-label">
              {{ property.label }}
              <n-tag v-if="inherited(property)" data-inherited size="small" :bordered="false">
                з проекту
              </n-tag>
            </span>
          </template>
          <!-- «Скинути» sits beside the editor: inside the label a click on the label's text would press it. -->
          <div class="override-row">
            <cell-editor
              :kind="property.kind"
              :value="node.overrides[property.key]"
              :options="property.options"
              :placeholder="inheritedLabel(property)"
              @commit="(input) => commitPanelOverride(property, input)"
            />
            <n-button
              v-if="!inherited(property)"
              data-reset
              text
              size="small"
              @click="commitPanelOverride(property, null)"
            >
              Скинути
            </n-button>
          </div>
        </n-form-item>
      </div>

      <!-- Each panel's own copy of the incoming devices, so a table edit never relabels a mark. -->
      <div v-if="node.kind === 'panel'" data-install-marks class="properties-group">
        <div class="group-caption" :style="muted">Встановлювати</div>
        <div class="marks">
          <n-checkbox
            v-for="device in node.incomingDevices"
            :key="device.id"
            :data-device="device.id"
            :checked="device.install"
            @update:checked="(checked) => tree.setIncomingDeviceMark(node.id, device.id, checked)"
          >
            {{ device.name }}
          </n-checkbox>
        </div>
      </div>

      <div v-if="node.kind === 'panel'" data-buy-marks class="properties-group">
        <div class="group-caption" :style="muted">Купувати окремо</div>
        <div class="marks">
          <n-checkbox
            v-for="accessory in ACCESSORIES"
            :key="accessory.key"
            :data-accessory="accessory.key"
            :checked="node.buySeparately[accessory.key]"
            @update:checked="(checked) => tree.setBuySeparately(node.id, accessory.key, checked)"
          >
            {{ accessory.label }}
          </n-checkbox>
        </div>
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

      <!-- Last for a panel, after the copy group for a consumer; nothing fills these yet. -->
      <div v-if="calculatedKeys.length" data-calculated class="properties-group">
        <div class="group-caption" :style="muted">Розрахунок</div>
        <n-form-item v-for="key in calculatedKeys" :key="key" :label="CALCULATED_LABELS[key]">
          <n-input :value="node.calculated[key]" disabled placeholder="" />
        </n-form-item>
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

.properties-group {
  margin-top: 4px;
}

.group-caption {
  font-size: 12px;
  margin-bottom: 6px;
}

.marks {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.property-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.override-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.override-row > :first-child {
  flex: 1;
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
