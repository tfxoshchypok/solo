// The bundled catalog, read once at startup. It supplies a consumer's name and its category and
// nothing else (FR-020), and nothing writes it back — the file ships inside the build (FR-022).
// It lives under the tree module because the add-consumer dialog is its only reader.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { CatalogFileService } from '@/services/CatalogFileService.js'

export const useCatalogStore = defineStore('catalog', () => {
  const catalog = ref(CatalogFileService.loadBuiltin())

  /** The catalog version a project records when it is saved (contracts/project-file.md). */
  const catalogVersion = computed(() => catalog.value.catalogVersion)

  const types = computed(() => catalog.value.types)
  const categories = computed(() =>
    [...catalog.value.categories].sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'uk'),
    ),
  )

  const typeIndex = computed(() => new Map(types.value.map((type) => [type.id, type])))
  const categoryIndex = computed(() => new Map(categories.value.map((c) => [c.id, c])))

  function typeById(id) {
    return typeIndex.value.get(id)
  }

  function categoryById(id) {
    return categoryIndex.value.get(id)
  }

  return { catalog, catalogVersion, types, categories, typeIndex, typeById, categoryById }
})
