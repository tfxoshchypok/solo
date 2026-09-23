import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NInput } from 'naive-ui'
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
  tree.select(panelId)
  wrapper = mount(AddConsumerDialog, {
    props: { show: true, parentId: panelId },
    attachTo: document.body,
  })
  return { tree, catalog, panelId }
}

describe('AddConsumerDialog places a consumer from the catalog (FR-021, FR-023)', () => {
  it('lists the whole catalog when nothing has been typed', () => {
    const { catalog } = mountDialog()
    expect(wrapper.vm.results.length).toBe(catalog.types.length)
  })

  it('narrows on a name fragment in either language', async () => {
    mountDialog()
    await wrapper.findComponent(NInput).vm.$emit('update:value', 'холод')
    expect(wrapper.vm.results[0].id).toBe('fridge')

    await wrapper.findComponent(NInput).vm.$emit('update:value', 'fridge')
    expect(wrapper.vm.results[0].id).toBe('fridge')
  })

  it('shows the category beside each result, so a name alone need not disambiguate', () => {
    mountDialog()
    const first = wrapper.vm.results[0]
    expect(wrapper.vm.categoryNameOf(first)).toBeTruthy()
  })

  it('places the chosen type as a node named after it, recording typeId and typeName', async () => {
    const { tree, panelId } = mountDialog()
    const type = tree.nodes[panelId] && wrapper.vm.results.find((t) => t.id === 'fridge')

    await wrapper.vm.place(type)

    const [childId] = tree.nodes[panelId].childIds
    expect(tree.nodes[childId]).toMatchObject({
      kind: 'consumer',
      name: 'Холодильник',
      typeId: 'fridge',
      typeName: 'Холодильник',
      quantity: 1,
    })
    expect(wrapper.emitted('placed')?.[0]?.[0]).toBe(childId)
  })

  it('renaming the placed node leaves the catalog row untouched (FR-024, US2 scenario 3)', async () => {
    const { tree, catalog, panelId } = mountDialog()
    await wrapper.vm.place(catalog.typeById('fridge'))
    const [childId] = tree.nodes[panelId].childIds

    tree.rename(childId, 'Холодильник у ніші')

    expect(tree.nodes[childId].name).toBe('Холодильник у ніші')
    expect(tree.nodes[childId].typeName).toBe('Холодильник')
    expect(catalog.typeById('fridge').name).toBe('Холодильник')
  })

  it('refuses to place into a panel that holds panels, and says so rather than throwing', async () => {
    const { tree, catalog } = mountDialog()
    const outer = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Поверх' })
    tree.add({ parentId: outer, kind: 'panel', name: 'Кімната' })
    await wrapper.setProps({ parentId: outer })

    await wrapper.vm.place(catalog.typeById('fridge'))

    expect(wrapper.emitted('refused')).toBeTruthy()
    expect(wrapper.emitted('placed')).toBeFalsy()
  })
})
