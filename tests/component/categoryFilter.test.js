// FR-021 asks for both ways of finding a type: by name fragment and by category. The fragment is
// covered; this drives the category select through the component, so a broken binding between it
// and the store's `find` cannot pass the suite.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NInput, NSelect } from 'naive-ui'
import AddConsumerDialog from '@/modules/tree/components/AddConsumerDialog.vue'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useCatalogStore } from '@/modules/tree/stores/catalog.js'

beforeEach(() => {
  setActivePinia(createPinia())
})

let wrapper = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function mountDialog() {
  const tree = useTreeStore()
  const catalog = useCatalogStore()
  const panelId = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
  wrapper = mount(AddConsumerDialog, {
    props: { show: true, parentId: panelId },
    attachTo: document.body,
  })
  return { catalog }
}

const pickCategory = (id) => wrapper.findComponent(NSelect).vm.$emit('update:value', id)

describe('AddConsumerDialog filters by category, not only by name (FR-021)', () => {
  it('offers every catalog category plus an "all" option', () => {
    const { catalog } = mountDialog()
    const options = wrapper.findComponent(NSelect).props('options')
    expect(options).toHaveLength(catalog.categories.length + 1)
  })

  it('narrows the results to the chosen category', async () => {
    const { catalog } = mountDialog()
    await pickCategory('lighting')

    const shown = wrapper.vm.results
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(catalog.types.length)
    expect(shown.every((type) => type.categoryId === 'lighting')).toBe(true)
  })

  it('composes the category with the search field rather than replacing it', async () => {
    mountDialog()
    await wrapper.findComponent(NInput).vm.$emit('update:value', 'холод')
    await pickCategory('lighting')

    // The fridge matches the text but not the category, so the two filters intersect.
    expect(wrapper.vm.results.every((type) => type.categoryId === 'lighting')).toBe(true)
    expect(wrapper.vm.results.some((type) => type.id === 'fridge')).toBe(false)
  })

  it('returns to the whole catalog when the category is cleared', async () => {
    const { catalog } = mountDialog()
    await pickCategory('lighting')
    await pickCategory(null)
    expect(wrapper.vm.results).toHaveLength(catalog.types.length)
  })
})
