<script setup>
// A consumer is created from a load type and a zone, and named after the load type (002/FR-012).
// Both lists are the reference tables as they stand now, so a row added or deleted in «Довідники»
// is offered or gone here at once; an empty table offers nothing, and «Додати» stays disabled.
import { computed, nextTick, ref, watch } from 'vue'
import { NButton, NForm, NFormItem, NModal, NSelect } from 'naive-ui'
import { useTreeStore } from '../stores/tree.js'
import { RuleError } from '../engine/treeOps.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  /** The panel the consumer will hang under. */
  parentId: { type: String, default: null },
})

const emit = defineEmits(['placed', 'refused', 'cancel'])

const tree = useTreeStore()
const reference = useReferenceTablesStore()

const loadTypeId = ref(null)
const zoneId = ref(null)
const loadTypeSelect = ref(null)

const optionsOf = (rows) => rows.map((row) => ({ label: row.name, value: row.id }))
const loadTypeOptions = computed(() => optionsOf(reference.tables.loadTypes))
const zoneOptions = computed(() => optionsOf(reference.tables.zones))

// A chosen row can be deleted while the dialog is open; an id that no longer resolves names nothing.
const canPlace = computed(
  () => reference.loadTypeById.has(loadTypeId.value) && reference.zoneById.has(zoneId.value),
)

/** A reopened dialog starts clean, with the cursor where typing is expected (SC-004). */
watch(
  () => props.show,
  async (open) => {
    if (!open) return
    loadTypeId.value = null
    zoneId.value = null
    await nextTick()
    loadTypeSelect.value?.focus()
  },
)

/** The rows are looked up as they stand now; the engine stores copies of them (002/FR-010). */
function place({ loadTypeId: chosenLoadType, zoneId: chosenZone }) {
  const loadType = reference.loadTypeById.get(chosenLoadType)
  const zone = reference.zoneById.get(chosenZone)
  if (!loadType || !zone || !props.parentId) return
  const request = { kind: 'consumer', name: loadType.name, loadType, zone }
  try {
    emit('placed', tree.add({ parentId: props.parentId, ...request }))
  } catch (error) {
    if (!(error instanceof RuleError)) throw error
    // The request travels with the refusal: the panel holds panels, and the fix dialog needs to
    // know what to place once the user has chosen where.
    emit('refused', { error, request })
  }
}

defineExpose({ place })
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    class="add-consumer"
    title="Додати споживача"
    :bordered="false"
    @close="emit('cancel')"
  >
    <n-form label-placement="top" @submit.prevent>
      <n-form-item label="Тип навантаження">
        <!-- 41 rows at most: no virtual scroll, so every option is a real element. -->
        <n-select
          ref="loadTypeSelect"
          v-model:value="loadTypeId"
          :options="loadTypeOptions"
          :virtual-scroll="false"
          filterable
          placeholder="Почніть вводити назву"
        />
      </n-form-item>
      <n-form-item label="Зона">
        <n-select
          v-model:value="zoneId"
          :options="zoneOptions"
          :virtual-scroll="false"
          placeholder="Виберіть зону"
        />
      </n-form-item>
    </n-form>

    <template #footer>
      <div class="add-consumer-actions">
        <n-button @click="emit('cancel')">Скасувати</n-button>
        <n-button type="primary" :disabled="!canPlace" @click="place({ loadTypeId, zoneId })">
          Додати
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.add-consumer {
  width: 520px;
  max-width: 90vw;
}

.add-consumer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
