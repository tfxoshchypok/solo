// A consumer comes into being from a load type and a zone (002/FR-012): the dialog offers both
// tables as selects, and the new node is named after the load type it was created from.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NButton, NFormItem, NSelect } from 'naive-ui'
import AddConsumerDialog from '@/modules/tree/components/AddConsumerDialog.vue'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import { ReferenceTablesFileService } from '@/services/ReferenceTablesFileService.js'
import { setFs, MemoryFs } from '@/services/fs/index.js'

beforeEach(() => {
  setActivePinia(createPinia())
  setFs(new MemoryFs({ dataDir: '/memfs/data' }))
})

let wrapper = null
afterEach(async () => {
  wrapper?.unmount()
  wrapper = null
  await ReferenceTablesFileService.flush().catch(() => {})
  setFs(null)
})

function mountDialog(stubs = {}) {
  const tree = useTreeStore()
  const reference = useReferenceTablesStore()
  const panelId = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
  tree.select(panelId)
  wrapper = mount(AddConsumerDialog, {
    props: { show: true, parentId: panelId },
    attachTo: document.body,
    global: { stubs },
  })
  return { tree, reference, panelId }
}

// Under happy-dom the modal's focus trap (`trap-focus`) keeps an open select's menu from rendering:
// with the trap off, all 33 options render. The search test therefore swaps the modal for a plain
// shell that renders the same content and footer; the select and its filtering stay real.
const ModalShell = defineComponent({
  setup(_, { slots }) {
    return () => h('div', [slots.default?.(), slots.footer?.()])
  },
})

/** The select under the form label the user reads, «Тип навантаження» or «Зона». */
function selectUnder(label) {
  const item = wrapper.findAllComponents(NFormItem).find((f) => f.props('label') === label)
  expect(item, `no field «${label}»`).toBeTruthy()
  return item.findComponent(NSelect)
}

function addButton() {
  const button = wrapper.findAllComponents(NButton).find((b) => b.text() === 'Додати')
  expect(button, 'no «Додати» button').toBeTruthy()
  return button
}

const rowNamed = (rows, name) => rows.find((row) => row.name === name)

describe('AddConsumerDialog asks for a load type and a zone (002/FR-012, 002/FR-013)', () => {
  it('keeps «Додати» disabled until both are chosen', async () => {
    const { reference } = mountDialog()
    expect(addButton().props('disabled')).toBe(true)

    await selectUnder('Тип навантаження').vm.$emit('update:value', reference.tables.loadTypes[0].id)
    expect(addButton().props('disabled')).toBe(true)

    await selectUnder('Зона').vm.$emit('update:value', reference.tables.zones[0].id)
    expect(addButton().props('disabled')).toBe(false)
  })

  it('offers every row of each table, by name', () => {
    const { reference } = mountDialog()
    const labels = (label) =>
      selectUnder(label)
        .props('options')
        .map((option) => option.label)

    expect(labels('Тип навантаження')).toEqual(reference.tables.loadTypes.map((row) => row.name))
    expect(labels('Зона')).toEqual(reference.tables.zones.map((row) => row.name))
  })

  it('narrows the load types to those whose name contains what was typed', async () => {
    const { reference } = mountDialog({ Modal: ModalShell })
    const select = selectUnder('Тип навантаження')
    expect(select.props('filterable')).toBe(true)

    await select.find('.n-base-selection').trigger('click')
    const input = select.find('input.n-base-selection-input')
    input.element.value = 'роз'
    await input.trigger('input')
    await flushPromises()

    const shown = [...document.body.querySelectorAll('.n-base-select-option')].map((el) =>
      el.textContent.trim(),
    )
    const expected = reference.tables.loadTypes
      .map((row) => row.name)
      .filter((name) => name.toLowerCase().includes('роз'))
    expect(expected.length).toBeGreaterThan(0)
    expect(shown).toEqual(expected)
  })

  it('creates a consumer named after the load type, holding copies of both rows and an empty cable section', async () => {
    const { tree, reference, panelId } = mountDialog()
    const sockets = rowNamed(reference.tables.loadTypes, 'Розетки кухні (робоча зона)')
    const kitchen = rowNamed(reference.tables.zones, 'Кухня')

    await selectUnder('Тип навантаження').vm.$emit('update:value', sockets.id)
    await selectUnder('Зона').vm.$emit('update:value', kitchen.id)
    await addButton().trigger('click')

    const [childId] = tree.nodes[panelId].childIds
    expect(tree.nodes[childId]).toEqual({
      id: childId,
      kind: 'consumer',
      name: 'Розетки кухні (робоча зона)',
      parentId: panelId,
      childIds: [],
      loadType: sockets,
      zone: kitchen,
      cableSectionMm2: null,
      calculated: { groupRcd: null, phase: null },
    })
    expect(wrapper.emitted('placed')?.[0]?.[0]).toBe(childId)
  })

  it('refuses to place into a panel that holds panels, handing on the request with both rows', async () => {
    const { tree, reference } = mountDialog()
    const outer = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Поверх' })
    tree.add({ parentId: outer, kind: 'panel', name: 'Кімната' })
    await wrapper.setProps({ parentId: outer })
    const oven = rowNamed(reference.tables.loadTypes, 'Духова шафа')
    const kitchen = rowNamed(reference.tables.zones, 'Кухня')

    await wrapper.vm.place({ loadTypeId: oven.id, zoneId: kitchen.id })

    expect(wrapper.emitted('placed')).toBeFalsy()
    const [{ request }] = wrapper.emitted('refused')[0]
    expect(request).toEqual({
      kind: 'consumer',
      name: 'Духова шафа',
      loadType: oven,
      zone: kitchen,
    })
  })

  it('offers nothing and stays disabled while the load types table is empty', async () => {
    const { reference } = mountDialog()
    for (const row of [...reference.tables.loadTypes]) {
      await reference.deleteRow('loadTypes', row.id)
    }
    await flushPromises()

    await selectUnder('Зона').vm.$emit('update:value', reference.tables.zones[0].id)

    expect(selectUnder('Тип навантаження').props('options')).toEqual([])
    expect(addButton().props('disabled')).toBe(true)
  })
})
