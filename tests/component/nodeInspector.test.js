// The properties area: the selected node's fields, edited where they stand rather than in a modal
// (FR-029). A consumer shows its own fields — name, cable section — on top, and below them a separate
// group with the load type and the zone it holds copies of, every copied value editable but the names
// (002/FR-021, 002/FR-022). The entry and a panel keep name and note. Every edit commits through the
// store, so one edit is one undo step.
//
// Hooks the component provides for these tests: the two groups carry `data-project-group` and
// `data-copy-group`; inside the second, the load type and the zone sit in `data-copy="loadType"` and
// `data-copy="zone"`, each row select carries `data-row-select`, each label `data-copy-label`, and each
// copied-value editor `data-cell="<column key>"`, as in the «Довідники» table.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  NConfigProvider,
  NEmpty,
  NFormItem,
  NInput,
  NInputNumber,
  NMessageProvider,
  NSelect,
} from 'naive-ui'
import NodeInspector from '@/modules/tree/components/NodeInspector.vue'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import { columns } from '@/modules/reference/config/columns.js'
import { formatCell } from '@/modules/reference/engine/cells.js'
import { ReferenceTablesFileService } from '@/services/ReferenceTablesFileService.js'
import { setFs, MemoryFs } from '@/services/fs/index.js'

let wrapper = null

beforeEach(() => {
  setActivePinia(createPinia())
  setFs(new MemoryFs({ dataDir: '/memfs/data' }))
})

afterEach(async () => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  await ReferenceTablesFileService.flush().catch(() => {})
  setFs(null)
})

function mountInspector() {
  const Harness = defineComponent({
    setup() {
      return () =>
        h(NConfigProvider, null, {
          default: () => h(NMessageProvider, null, { default: () => h(NodeInspector) }),
        })
    },
  })
  wrapper = mount(Harness, { attachTo: document.body })
}

const loadTypeNamed = (name) =>
  useReferenceTablesStore().tables.loadTypes.find((row) => row.name === name)
const zoneNamed = (name) => useReferenceTablesStore().tables.zones.find((row) => row.name === name)

/** Entry → panel → one consumer, with the consumer selected. */
function mountWithConsumer(fields = {}) {
  const tree = useTreeStore()
  const panelId = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
  const nodeId = tree.add({
    parentId: panelId,
    kind: 'consumer',
    name: 'Холодильник',
    loadType: loadTypeNamed('Холодильник / Морозильник'),
    zone: zoneNamed('Кухня'),
    ...fields,
  })
  tree.select(nodeId)
  mountInspector()
  return { tree, panelId, nodeId }
}

const labels = () => wrapper.findAllComponents(NFormItem).map((item) => item.props('label'))
const fieldUnder = (label) => {
  const item = wrapper.findAllComponents(NFormItem).find((f) => f.props('label') === label)
  expect(item, `no field «${label}»`).toBeTruthy()
  return item
}
const sectionInput = () => fieldUnder('Переріз кабелю, мм²').find('input')

const copyGroup = () => document.body.querySelector('[data-copy-group]')
const projectLabels = () =>
  wrapper
    .findAllComponents(NFormItem)
    .filter((item) => item.element.closest('[data-project-group]'))
    .map((item) => item.props('label'))
const copyLabels = () =>
  [...document.body.querySelectorAll('[data-copy-group] [data-copy-label]')].map((el) =>
    el.textContent.trim(),
  )
const rowSelect = (part) => {
  const select = wrapper
    .findAllComponents(NSelect)
    .find((s) => s.element.matches(`[data-copy="${part}"] [data-row-select]`))
  expect(select, `no row select for ${part}`).toBeTruthy()
  return select
}
/** The editor of one copied value: an input (text, number) or the root of a yes/no select. */
const copyField = (part, key) => wrapper.find(`[data-copy="${part}"] [data-cell="${key}"]`)
const copyYesNo = (part, key) =>
  wrapper
    .findAllComponents(NSelect)
    .find((s) => s.element.matches(`[data-copy="${part}"] [data-cell="${key}"]`))
/** What a copied value's editor shows: the text of an input, the value of a yes/no select. */
const shownValue = (part, column) =>
  column.kind === 'yesno'
    ? copyYesNo(part, column.key).props('value')
    : copyField(part, column.key).element.value
const editableColumns = (table) => columns[table].filter((column) => column.key !== 'name')
const clearMessages = () =>
  document.body.querySelectorAll('.n-message').forEach((el) => el.remove())
const warningShown = () => Boolean(document.body.querySelector('.n-message')?.textContent.trim())

async function commit(input, text) {
  await input.setValue(text)
  await input.trigger('blur')
  await flushPromises()
}

describe('NodeInspector edits the selected node in place (FR-029)', () => {
  it('shows nothing to edit when nothing is selected', () => {
    const tree = useTreeStore()
    tree.select(null)
    mountInspector()

    expect(wrapper.findComponent(NEmpty).exists()).toBe(true)
  })

  it('renames on commit, touching that node alone (FR-006)', async () => {
    const { tree, panelId, nodeId } = mountWithConsumer()
    const panelBefore = tree.nodes[panelId]

    await wrapper.findAllComponents(NInput)[0].vm.$emit('change', 'Холодильник у ніші')

    expect(tree.nodes[nodeId].name).toBe('Холодильник у ніші')
    expect(tree.nodes[panelId]).toBe(panelBefore)
  })

  it('ignores a blank name instead of writing one the schema would reject', async () => {
    const { tree, nodeId } = mountWithConsumer()

    await wrapper.findAllComponents(NInput)[0].vm.$emit('change', '   ')

    expect(tree.nodes[nodeId].name).toBe('Холодильник')
  })

  it('keeps a note on a panel, up to the length the schema allows (FR-012)', async () => {
    const { tree, panelId } = mountWithConsumer()
    tree.select(panelId)
    await flushPromises()
    const inputs = wrapper.findAllComponents(NInput)

    // The note commits on `change` for the same reason the name does: one edit, one undo step.
    await inputs[inputs.length - 1].vm.$emit('change', 'окрема лінія')

    expect(tree.nodes[panelId].note).toBe('окрема лінія')
  })

  it('commits one undo step per edit, not one per keystroke (FR-011)', async () => {
    const { tree } = mountWithConsumer()
    const before = tree.history.undoStack.length

    await wrapper.findAllComponents(NInput)[0].vm.$emit('change', 'Морозильник')

    expect(tree.history.undoStack.length).toBe(before + 1)
  })
})

describe('a consumer shows its own fields, then its copied rows as a group of their own (002/FR-009, 002/FR-022; User Story 2 scenario 3)', () => {
  it('shows name and cable section on top, and nothing else of the consumer’s own', () => {
    mountWithConsumer()

    expect(projectLabels()).toEqual(['Назва', 'Переріз кабелю, мм²'])
    expect(wrapper.findComponent(NInputNumber).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Кількість')
    expect(wrapper.text()).not.toContain('Нотатка')
  })

  it('shows below it a group captioned as copied from the reference tables: the load type with its values, then the zone with its values', () => {
    mountWithConsumer()

    expect(copyGroup()).not.toBeNull()
    const groups = [...document.body.querySelectorAll('[data-project-group], [data-copy-group]')]
    expect(groups.map((g) => (g.hasAttribute('data-project-group') ? 'project' : 'copy'))).toEqual([
      'project',
      'copy',
    ])
    expect(copyGroup().textContent).toContain('З довідника')
    expect(copyLabels()).toEqual([
      'Тип навантаження',
      ...editableColumns('loadTypes').map((column) => column.header),
      'Зона',
      ...editableColumns('zones').map((column) => column.header),
    ])
  })

  it('shows the entry and a panel with name and note, and no copied group', async () => {
    const { tree, panelId } = mountWithConsumer()

    tree.select(panelId)
    await flushPromises()
    expect(labels()).toEqual(['Назва', 'Нотатка'])
    expect(copyGroup()).toBeNull()

    tree.select(tree.rootId)
    await flushPromises()
    expect(labels()).toEqual(['Назва', 'Нотатка'])
  })

  it('shows the copied names in the row selects and every copied value in its column’s format (002/FR-015)', () => {
    const fridge = loadTypeNamed('Холодильник / Морозильник')
    const kitchen = zoneNamed('Кухня')
    mountWithConsumer()

    expect(rowSelect('loadType').text()).toContain('Холодильник / Морозильник')
    expect(rowSelect('zone').text()).toContain('Кухня')
    for (const [part, table, row] of [
      ['loadType', 'loadTypes', fridge],
      ['zone', 'zones', kitchen],
    ]) {
      for (const column of editableColumns(table)) {
        const expected =
          column.kind === 'yesno' ? row[column.key] : formatCell(column.kind, row[column.key])
        expect(shownValue(part, column), `${part}.${column.key}`).toBe(expected)
      }
    }
  })

  it('offers no editor for the two copied names, which change only by choosing a row (002/FR-021)', () => {
    mountWithConsumer()

    expect(document.body.querySelector('[data-copy-group] [data-cell="name"]')).toBeNull()
  })
})

describe('the cable section takes an empty value or a positive number (002/FR-011; scenario 4)', () => {
  it('stores 2,5 as 2.5 and an empty field as null', async () => {
    const { tree, nodeId } = mountWithConsumer()

    await commit(sectionInput(), '2,5')
    expect(tree.nodes[nodeId].cableSectionMm2).toBe(2.5)

    await commit(sectionInput(), '')
    expect(tree.nodes[nodeId].cableSectionMm2).toBeNull()
  })

  it('refuses 0, a negative number and text, showing why and putting the stored value back', async () => {
    const { tree, nodeId } = mountWithConsumer()
    await commit(sectionInput(), '2.5')

    for (const bad of ['0', '-1', 'abc']) {
      document.body.querySelectorAll('.n-message').forEach((el) => el.remove())
      await commit(sectionInput(), bad)

      expect(warningShown(), bad).toBe(true)
      expect(tree.nodes[nodeId].cableSectionMm2).toBe(2.5)
      expect(sectionInput().element.value).toBe('2.5')
    }
  })
})

describe('the consumer keeps its copy whatever happens to the row (002/FR-010, 002/FR-015)', () => {
  it('still shows the copied name after the row is renamed in the table, and keeps its own name (scenario 5)', async () => {
    const sockets = loadTypeNamed('Розетки кухні (робоча зона)')
    const { tree, nodeId } = mountWithConsumer({ name: 'Розетки фартуха', loadType: sockets })

    await useReferenceTablesStore().updateCell('loadTypes', sockets.id, 'name', 'Розетки кухонні')
    await flushPromises()

    expect(rowSelect('loadType').text()).toContain('Розетки кухні (робоча зона)')
    expect(
      rowSelect('loadType')
        .props('options')
        .map((o) => o.label),
    ).toContain('Розетки кухонні')
    expect(tree.nodes[nodeId].loadType).toEqual(sockets)
    expect(tree.nodes[nodeId].name).toBe('Розетки фартуха')
  })

  it('still shows the copy after the row is deleted, with no mark and no id (scenario 6)', async () => {
    const disposer = loadTypeNamed('Подрібнювач відходів (диспоузер)')
    const { tree, nodeId } = mountWithConsumer({ loadType: disposer })

    await useReferenceTablesStore().deleteRow('loadTypes', disposer.id)
    await flushPromises()

    expect(rowSelect('loadType').text()).toContain('Подрібнювач відходів (диспоузер)')
    expect(copyField('loadType', 'ratedPowerKw').element.value).toBe('0.8')
    expect(document.body.textContent).not.toContain('Відсутній у довіднику')
    expect(document.body.textContent).not.toMatch(/\b(lt|zn)-[0-9a-f]{8}/)
    expect(tree.nodes[nodeId].loadType).toEqual(disposer)
  })
})

describe('choosing a row copies it afresh (002/FR-014)', () => {
  it('renames a consumer still named after its load type when another load type is chosen (scenario 7)', async () => {
    const oven = loadTypeNamed('Духова шафа')
    const microwave = loadTypeNamed('Мікрохвильова піч')
    const { tree, nodeId } = mountWithConsumer({ name: 'Духова шафа', loadType: oven })

    await rowSelect('loadType').vm.$emit('update:value', microwave.id)

    expect(tree.nodes[nodeId].loadType).toEqual(microwave)
    expect(tree.nodes[nodeId].name).toBe('Мікрохвильова піч')
  })

  it('keeps a name the user typed when the load type changes (scenario 7)', async () => {
    const microwave = loadTypeNamed('Мікрохвильова піч')
    const { tree, nodeId } = mountWithConsumer({ name: 'Розетки фартуха кухні' })

    await rowSelect('loadType').vm.$emit('update:value', microwave.id)

    expect(tree.nodes[nodeId].loadType).toEqual(microwave)
    expect(tree.nodes[nodeId].name).toBe('Розетки фартуха кухні')
  })

  it('copies the zone chosen in its select', async () => {
    const wet = zoneNamed('Волога (санвузли)')
    const { tree, nodeId } = mountWithConsumer()

    await rowSelect('zone').vm.$emit('update:value', wet.id)

    expect(tree.nodes[nodeId].zone).toEqual(wet)
  })

  it('takes the row’s current values when the same row is chosen again, replacing a hand edit (scenario 8)', async () => {
    const sockets = loadTypeNamed('Розетки кухні (робоча зона)')
    const { tree, nodeId } = mountWithConsumer({ name: sockets.name, loadType: sockets })
    await commit(copyField('loadType', 'powerFactor'), '0,9')
    expect(tree.nodes[nodeId].loadType.powerFactor).toBe(0.9)

    await useReferenceTablesStore().updateCell('loadTypes', sockets.id, 'demandFactor', '0,5')
    await flushPromises()
    expect(copyField('loadType', 'demandFactor').element.value).toBe('0.4')

    await rowSelect('loadType').vm.$emit('update:value', sockets.id)
    await flushPromises()

    expect(tree.nodes[nodeId].loadType).toEqual(loadTypeNamed(sockets.name))
    expect(copyField('loadType', 'demandFactor').element.value).toBe('0.5')
    expect(copyField('loadType', 'powerFactor').element.value).toBe('0.95')
  })
})

describe('a copied value is edited on this consumer only (002/FR-021; scenario 9)', () => {
  it('changes the demand factor of this consumer, not the table’s row or another consumer', async () => {
    const sockets = loadTypeNamed('Розетки кухні (робоча зона)')
    const { tree, panelId, nodeId } = mountWithConsumer({ loadType: sockets })
    const otherId = tree.add({
      parentId: panelId,
      kind: 'consumer',
      name: 'Розетки острова',
      loadType: sockets,
      zone: zoneNamed('Кухня'),
    })
    tree.select(nodeId)
    await flushPromises()

    await commit(copyField('loadType', 'demandFactor'), '0,6')

    expect(tree.nodes[nodeId].loadType.demandFactor).toBe(0.6)
    expect(tree.nodes[otherId].loadType.demandFactor).toBe(0.4)
    expect(loadTypeNamed(sockets.name).demandFactor).toBe(0.4)
  })

  it('refuses text in a number column, showing why and putting the copied value back', async () => {
    const sockets = loadTypeNamed('Розетки кухні (робоча зона)')
    const { tree, nodeId } = mountWithConsumer({ loadType: sockets })
    clearMessages()

    await commit(copyField('loadType', 'ratedPowerKw'), 'abc')

    expect(warningShown()).toBe(true)
    expect(tree.nodes[nodeId].loadType.ratedPowerKw).toBe(3.5)
    expect(copyField('loadType', 'ratedPowerKw').element.value).toBe('3.5')
  })

  it('sets a text value and a yes/no value of the zone', async () => {
    const { tree, nodeId } = mountWithConsumer()

    await commit(copyField('zone', 'minIp'), 'IP44')
    await copyYesNo('zone', 'rcdRequired').vm.$emit('update:value', false)
    await flushPromises()

    expect(tree.nodes[nodeId].zone.minIp).toBe('IP44')
    expect(tree.nodes[nodeId].zone.rcdRequired).toBe(false)
  })
})

// The fields are controlled inputs: naive-ui shows exactly what `value` holds and emits
// `update:value` per keystroke. Binding `value` straight to the store meant the store never moved
// while typing, so nothing the user typed ever appeared — the field looked frozen. The tests above
// missed it because they emit `change` with a finished string, skipping the typing entirely.
describe('NodeInspector accepts typing before the edit is committed (FR-029)', () => {
  it('shows the characters as they are typed into the name', async () => {
    const { tree, nodeId } = mountWithConsumer()
    const input = wrapper.findAllComponents(NInput)[0]

    await input.vm.$emit('update:value', 'Холодильник у ніші')

    expect(input.props('value')).toBe('Холодильник у ніші')
    // Still one undo step per edit: nothing reaches the store until the field is committed.
    expect(tree.nodes[nodeId].name).toBe('Холодильник')
  })

  it('shows the characters as they are typed into a panel’s note', async () => {
    const { tree, panelId } = mountWithConsumer()
    tree.select(panelId)
    await flushPromises()
    const inputs = wrapper.findAllComponents(NInput)
    const noteInput = inputs[inputs.length - 1]

    await noteInput.vm.$emit('update:value', 'окрема лінія')

    expect(noteInput.props('value')).toBe('окрема лінія')
    expect(tree.nodes[panelId].note ?? '').toBe('')
  })

  it('commits what was typed, not what the store still held', async () => {
    const { tree, nodeId } = mountWithConsumer()
    const input = wrapper.findAllComponents(NInput)[0]

    await input.vm.$emit('update:value', 'Морозильник')
    await input.vm.$emit('change', 'Морозильник')

    expect(tree.nodes[nodeId].name).toBe('Морозильник')
  })

  it('follows the selection instead of carrying a half-typed name to the next node', async () => {
    const { tree, panelId } = mountWithConsumer()
    const input = wrapper.findAllComponents(NInput)[0]
    await input.vm.$emit('update:value', 'недописане')

    tree.select(panelId)
    await flushPromises()

    expect(wrapper.findAllComponents(NInput)[0].props('value')).toBe('Кухня')
  })

  it('picks up a name changed underneath it, such as by undo', async () => {
    const { tree, nodeId } = mountWithConsumer()
    tree.rename(nodeId, 'Морозильник')
    await flushPromises()
    expect(wrapper.findAllComponents(NInput)[0].props('value')).toBe('Морозильник')

    tree.history.undo()
    await flushPromises()

    expect(wrapper.findAllComponents(NInput)[0].props('value')).toBe('Холодильник')
  })
})
