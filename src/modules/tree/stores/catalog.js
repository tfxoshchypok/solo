// The bundled catalog, read once at startup. It supplies a consumer's name and its category and
// nothing else (FR-020), and nothing writes it back — the file ships inside the build (FR-022).
// It lives under the tree module because the add-consumer dialog is its only reader.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import Fuse from 'fuse.js'
import { CatalogFileService } from '@/services/CatalogFileService.js'

/**
 * One index over the Ukrainian name, the English name and the category name. A user typing
 * `fridge` and a user typing `холод` have to reach the same row, which a single-field substring
 * match cannot do — and neither can survive the first typo (R8, FR-021).
 *
 * Pure on purpose: the store holds the index as a `computed`, but the two functions below take it
 * as an argument, so the search is testable without Pinia.
 */
export function buildIndex(types, categories = []) {
  const categoryName = new Map(categories.map((c) => [c.id, `${c.name} ${c.nameEn}`]))
  const items = types.map((type) => ({
    ...type,
    categoryName: categoryName.get(type.categoryId) ?? '',
  }))
  const fuse = new Fuse(items, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'nameEn', weight: 2 },
      { name: 'categoryName', weight: 1 },
    ],
    threshold: 0.4,
    // Without this a match late in the string scores as if it were a mismatch, which breaks a
    // fragment search over two-word names.
    ignoreLocation: true,
    minMatchCharLength: 2,
  })
  return { fuse, items }
}

/**
 * @param {string} query a name fragment in either language; empty lists everything
 * @param {string|null} categoryId narrows the result, so browsing is the same code path
 * @returns {object[]} catalog types, best match first
 */
export function search(index, query, categoryId = null) {
  const trimmed = String(query ?? '').trim()
  const found = trimmed === '' ? index.items : index.fuse.search(trimmed).map((hit) => hit.item)
  return categoryId ? found.filter((type) => type.categoryId === categoryId) : found
}

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

  /** Rebuilt by reactivity when the catalog changes, which is never at runtime — but free. */
  const searchIndex = computed(() => buildIndex(types.value, categories.value))

  const typeIndex = computed(() => new Map(types.value.map((type) => [type.id, type])))
  const categoryIndex = computed(() => new Map(categories.value.map((c) => [c.id, c])))

  function typeById(id) {
    return typeIndex.value.get(id)
  }

  function categoryById(id) {
    return categoryIndex.value.get(id)
  }

  /** The store's own entry point into the pure search above. */
  function find(query, categoryId = null) {
    return search(searchIndex.value, query, categoryId)
  }

  return {
    catalog,
    catalogVersion,
    types,
    categories,
    typeIndex,
    typeById,
    categoryById,
    searchIndex,
    find,
  }
})
