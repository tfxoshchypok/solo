<script setup>
// Picking a type is how a consumer comes into being (FR-023), so this dialog is the whole of the
// catalog's presence in the product: a search box, a category filter, and a list. There is no
// catalog screen — a list you browse without placing anything would be a reference book, and the
// user came here to build a tree.
import { computed, nextTick, ref, watch } from 'vue'
import { NEmpty, NInput, NModal, NScrollbar, NSelect, NTag, NText } from 'naive-ui'
import { useTreeStore } from '../stores/tree.js'
import { useCatalogStore } from '../stores/catalog.js'
import { RuleError } from '../engine/treeOps.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  /** The panel the consumer will hang under. */
  parentId: { type: String, default: null },
})

const emit = defineEmits(['placed', 'refused', 'cancel'])

const tree = useTreeStore()
const catalog = useCatalogStore()

const query = ref('')
const categoryId = ref(null)
const searchInput = ref(null)

const categoryOptions = computed(() => [
  { label: 'Усі категорії', value: null },
  ...catalog.categories.map((c) => ({ label: c.name, value: c.id })),
])

const results = computed(() => catalog.find(query.value, categoryId.value))

function categoryNameOf(type) {
  return catalog.categoryById(type?.categoryId)?.name ?? ''
}

/** A reopened dialog starts clean, with the cursor where typing is expected (SC-004). */
watch(
  () => props.show,
  async (open) => {
    if (!open) return
    query.value = ''
    categoryId.value = null
    await nextTick()
    searchInput.value?.focus()
  },
)

function place(type) {
  if (!type || !props.parentId) return
  // The node is named after the type and can be renamed afterwards; `typeName` keeps the original
  // so the file still reads if the type later leaves the catalog (FR-024, FR-034).
  const request = {
    kind: 'consumer',
    name: type.name,
    typeId: type.id,
    typeName: type.name,
  }
  try {
    emit('placed', tree.add({ parentId: props.parentId, ...request }))
  } catch (error) {
    if (!(error instanceof RuleError)) throw error
    // The request travels with the refusal: the panel holds panels, and the fix dialog needs to
    // know what to place once the user has chosen where.
    emit('refused', { error, request })
  }
}

defineExpose({ results, place, categoryNameOf })
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
    <div class="add-consumer-filters">
      <n-input
        ref="searchInput"
        v-model:value="query"
        placeholder="Назва українською або англійською"
        clearable
      />
      <n-select v-model:value="categoryId" :options="categoryOptions" class="add-consumer-cat" />
    </div>

    <n-scrollbar class="add-consumer-list">
      <n-empty v-if="results.length === 0" size="small" description="Нічого не знайдено" />
      <button
        v-for="type in results"
        :key="type.id"
        type="button"
        class="add-consumer-row"
        @click="place(type)"
      >
        <span class="app-ellipsis">{{ type.name }}</span>
        <n-tag size="small" :bordered="false">{{ categoryNameOf(type) }}</n-tag>
      </button>
    </n-scrollbar>

    <template #footer>
      <n-text depth="3">Знайдено типів: {{ results.length }}</n-text>
    </template>
  </n-modal>
</template>

<style scoped>
.add-consumer {
  width: 520px;
  max-width: 90vw;
}

.add-consumer-filters {
  display: flex;
  gap: 8px;
  margin-bottom: var(--app-gutter);
}

.add-consumer-cat {
  width: 200px;
  flex-shrink: 0;
}

.add-consumer-list {
  max-height: 320px;
}

.add-consumer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.add-consumer-row:hover,
.add-consumer-row:focus-visible {
  background: var(--app-bg-subtle);
}
</style>
