// The properties of «Ввід» and the values a panel inherits from them, in the inspector (003/FR-001 …
// 003/FR-008). The entry edits the six project properties; a panel shows the five overridable ones
// empty, with the project's value as the placeholder and the mark «з проекту» (research R10, R11).
//
// Hooks the component provides for these tests: the entry's group carries `data-project-properties`
// and the panel's `data-panel-properties`; each field is an `NFormItem` whose `label` is the
// property's label and which carries `data-property="<key>"`; the mark is an element with
// `data-inherited` inside the field, and «Скинути» one with `data-reset`.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NCheckbox, NConfigProvider, NFormItem, NMessageProvider, NSelect } from 'naive-ui'
import NodeInspector from '@/modules/tree/components/NodeInspector.vue'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import { ReferenceTablesFileService } from '@/services/ReferenceTablesFileService.js'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { tree as buildTree, consumer } from '../fixtures/tree.js'

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

/** data-model.md *Project properties*, in its order. */
const PROPERTIES = [
  ['supplyPhases', 'Фазність вводу'],
  ['moduleReservePct', 'Резерв модулів, %'],
  ['separateRcdMode', 'Виконання окремого ПЗВ'],
  ['maxLinesPerGroupRcd', 'Макс. ліній на групове ПЗВ'],
  ['neutralBreak', 'Розрив нейтралі'],
  ['selectiveFeederRcd', 'Селективне ПЗВ на лінії живлення підщитка'],
]
const SIX_LABELS = PROPERTIES.map(([, label]) => label)
const OVERRIDABLE = PROPERTIES.filter(([key]) => key !== 'supplyPhases')
/** The properties edited with a select — a choice or yes/no; the other two are number inputs. */
const SELECTS = ['supplyPhases', 'separateRcdMode', 'neutralBreak', 'selectiveFeederRcd']

const labels = () => wrapper.findAllComponents(NFormItem).map((item) => item.props('label'))
const fieldsIn = (group) =>
  wrapper.findAllComponents(NFormItem).filter((item) => item.element.closest(`[data-${group}]`))
const groupLabels = (group) => fieldsIn(group).map((item) => item.props('label'))
const field = (group, key) => {
  const item = fieldsIn(group).find((f) => f.element.matches(`[data-property="${key}"]`))
  expect(item, `no field ${key} in ${group}`).toBeTruthy()
  return item
}
const input = (group, key) => field(group, key).find('input')
const select = (group, key) => field(group, key).findComponent(NSelect)
/** The grey text an empty editor shows; '' when it shows none. */
const placeholderOf = (group, key) =>
  field(group, key)
    .element.querySelector('.n-input__placeholder, .n-base-selection-placeholder__inner')
    ?.textContent.trim() ?? ''
const inheritedMark = (key) =>
  field('panel-properties', key).element.querySelector('[data-inherited]')?.textContent.trim()
const resetButton = (key) => field('panel-properties', key).element.querySelector('[data-reset]')

function expectEmpty(group, key) {
  if (SELECTS.includes(key)) expect(select(group, key).props('value'), key).toBeNull()
  else expect(input(group, key).element.value, key).toBe('')
}

/** Chooses the option shown as `label`, as a click in the dropdown would. */
async function choose(group, key, label) {
  const target = select(group, key)
  const option = target.props('options').find((o) => o.label === label)
  expect(option, `no option «${label}» for ${key}`).toBeTruthy()
  target.vm.$emit('update:value', option.value)
  await flushPromises()
}

async function commit(element, text) {
  await element.setValue(text)
  await element.trigger('blur')
  await flushPromises()
}

const clearMessages = () =>
  document.body.querySelectorAll('.n-message').forEach((el) => el.remove())
const warningText = () => document.body.querySelector('.n-message')?.textContent.trim() ?? ''

async function show(tree, nodeId) {
  tree.select(nodeId)
  await flushPromises()
}

describe('entry (003/FR-001, 003/FR-002, 003/FR-003)', () => {
  const stored = (key) => {
    const tree = useTreeStore()
    return tree.nodes[tree.rootId].projectProperties[key]
  }

  it('shows the six properties of a new project below «Назва» and «Нотатка», in order, all empty', async () => {
    useTreeStore().reset()
    mountInspector()
    await flushPromises()

    expect(labels()).toEqual(['Назва', 'Нотатка', ...SIX_LABELS])
    expect(groupLabels('project-properties')).toEqual(SIX_LABELS)
    for (const [key] of PROPERTIES) {
      expectEmpty('project-properties', key)
      expect(placeholderOf('project-properties', key), key).toBe('')
    }
  })

  it('stores 3ф as 3, and a cleared choice as null', async () => {
    mountInspector()

    await choose('project-properties', 'supplyPhases', '3ф')
    expect(stored('supplyPhases')).toBe(3)
    expect(select('project-properties', 'supplyPhases').props('value')).toBe(3)

    select('project-properties', 'supplyPhases').vm.$emit('update:value', null)
    await flushPromises()
    expect(stored('supplyPhases')).toBeNull()
  })

  it('reads «2,5» in «Резерв модулів, %» as 2.5', async () => {
    mountInspector()

    await commit(input('project-properties', 'moduleReservePct'), '2,5')

    expect(stored('moduleReservePct')).toBe(2.5)
  })

  it('refuses -5 in the reserve with its rule, and shows the stored value again', async () => {
    mountInspector()
    await commit(input('project-properties', 'moduleReservePct'), '20')
    clearMessages()

    await commit(input('project-properties', 'moduleReservePct'), '-5')

    expect(warningText()).toContain(
      'Резерв модулів, %: тут має бути число, не менше 0, або порожньо.',
    )
    expect(stored('moduleReservePct')).toBe(20)
    expect(input('project-properties', 'moduleReservePct').element.value).toBe('20')
  })

  it('refuses 0 and 2,5 in the line limit with its rule, and shows the stored value again', async () => {
    mountInspector()
    await commit(input('project-properties', 'maxLinesPerGroupRcd'), '4')

    for (const bad of ['0', '2,5']) {
      clearMessages()
      await commit(input('project-properties', 'maxLinesPerGroupRcd'), bad)

      expect(warningText(), bad).toContain(
        'Макс. ліній на групове ПЗВ: тут має бути ціле число, не менше 1, або порожньо.',
      )
      expect(stored('maxLinesPerGroupRcd'), bad).toBe(4)
      expect(input('project-properties', 'maxLinesPerGroupRcd').element.value, bad).toBe('4')
    }
  })

  it('stores «так» in «Розрив нейтралі» as true', async () => {
    mountInspector()

    await choose('project-properties', 'neutralBreak', 'так')

    expect(stored('neutralBreak')).toBe(true)
  })
})

describe('panel shows inherited values (003/FR-005, 003/FR-007, 003/FR-008, 003/SC-003)', () => {
  /** Entry → «Гараж» → «Майстерня», with three of the five project values set. */
  function mountProject() {
    const tree = useTreeStore()
    tree.setTree(
      buildTree({
        id: 'root',
        kind: 'entry',
        name: 'Ввід',
        projectProperties: { moduleReservePct: 20, separateRcdMode: 'rcbo', neutralBreak: true },
        children: [
          {
            id: 'garage',
            kind: 'panel',
            name: 'Гараж',
            children: [{ id: 'shop', kind: 'panel', name: 'Майстерня', children: [] }],
          },
        ],
      }),
    )
    mountInspector()
    return tree
  }

  it('shows the five overridable properties on a panel and a sub-panel, without «Фазність вводу» (scenario 2)', async () => {
    const tree = mountProject()

    for (const nodeId of ['garage', 'shop']) {
      await show(tree, nodeId)
      expect(groupLabels('panel-properties'), nodeId).toEqual(OVERRIDABLE.map(([, label]) => label))
      expect(document.body.querySelector('[data-project-properties]'), nodeId).toBeNull()
    }
  })

  it('leaves each empty, with the project’s value as the placeholder and the mark «з проекту»', async () => {
    const tree = mountProject()
    const placeholders = {
      moduleReservePct: '20',
      separateRcdMode: 'диф',
      maxLinesPerGroupRcd: '',
      neutralBreak: 'так',
      selectiveFeederRcd: '',
    }

    for (const nodeId of ['garage', 'shop']) {
      await show(tree, nodeId)
      for (const [key] of OVERRIDABLE) {
        expectEmpty('panel-properties', key)
        expect(placeholderOf('panel-properties', key), `${nodeId} ${key}`).toBe(placeholders[key])
        expect(inheritedMark(key), `${nodeId} ${key}`).toBe('з проекту')
      }
    }
  })

  it('follows the project: a reserve of 25 shows on both, and a cleared one leaves both empty and marked (scenarios 4, 5)', async () => {
    const tree = mountProject()

    tree.setProjectProperty('moduleReservePct', 25)
    for (const nodeId of ['garage', 'shop']) {
      await show(tree, nodeId)
      expect(placeholderOf('panel-properties', 'moduleReservePct'), nodeId).toBe('25')
      expect(inheritedMark('moduleReservePct'), nodeId).toBe('з проекту')
    }

    tree.setProjectProperty('moduleReservePct', null)
    for (const nodeId of ['garage', 'shop']) {
      await show(tree, nodeId)
      expectEmpty('panel-properties', 'moduleReservePct')
      expect(placeholderOf('panel-properties', 'moduleReservePct'), nodeId).toBe('')
      expect(inheritedMark('moduleReservePct'), nodeId).toBe('з проекту')
    }
  })
})

describe('panel own value (003/FR-005, 003/FR-006, 003/FR-007, 003/SC-003)', () => {
  /** Entry → «Гараж» → «Майстерня», and «Кухня» beside «Гараж»; the project's reserve is 20, its
   * neutral break «ні». */
  function mountProject() {
    const tree = useTreeStore()
    tree.setTree(
      buildTree({
        id: 'root',
        kind: 'entry',
        name: 'Ввід',
        projectProperties: { moduleReservePct: 20, neutralBreak: false },
        children: [
          {
            id: 'garage',
            kind: 'panel',
            name: 'Гараж',
            children: [{ id: 'shop', kind: 'panel', name: 'Майстерня', children: [] }],
          },
          { id: 'kitchen', kind: 'panel', name: 'Кухня', children: [] },
        ],
      }),
    )
    mountInspector()
    return tree
  }

  const reserve = () => input('panel-properties', 'moduleReservePct')

  /** A field holding the panel's own value: no mark, and «Скинути» beside it. */
  function expectOwn(key) {
    expect(inheritedMark(key), key).toBeUndefined()
    expect(resetButton(key), key).not.toBeNull()
  }

  /** A field that inherits: empty, the project's value in grey, the mark, and no «Скинути». */
  function expectInherits(key, placeholder) {
    expectEmpty('panel-properties', key)
    expect(placeholderOf('panel-properties', key), key).toBe(placeholder)
    expect(inheritedMark(key), key).toBe('з проекту')
    expect(resetButton(key), key).toBeNull()
  }

  it('takes 40 typed into a panel’s reserve as its own, with «Скинути» and no mark; another panel is unchanged (scenario 1)', async () => {
    const tree = mountProject()
    await show(tree, 'garage')

    await commit(reserve(), '40')

    expect(tree.nodes.garage.overrides.moduleReservePct).toBe(40)
    expect(reserve().element.value).toBe('40')
    expectOwn('moduleReservePct')

    await show(tree, 'kitchen')
    expectInherits('moduleReservePct', '20')
  })

  it('keeps 40 when the project’s reserve changes (scenario 2)', async () => {
    const tree = mountProject()
    await show(tree, 'garage')
    await commit(reserve(), '40')

    tree.setProjectProperty('moduleReservePct', 25)
    await flushPromises()

    expect(reserve().element.value).toBe('40')
    expectOwn('moduleReservePct')
  })

  it('«Скинути» empties the field and shows the project’s value in grey with the mark (scenario 3)', async () => {
    const tree = mountProject()
    await show(tree, 'garage')
    await commit(reserve(), '40')

    resetButton('moduleReservePct').click()
    await flushPromises()

    expect(tree.nodes.garage.overrides.moduleReservePct).toBeNull()
    expectInherits('moduleReservePct', '20')
  })

  it('clearing an own value does what «Скинути» does', async () => {
    const tree = mountProject()
    await show(tree, 'garage')
    await commit(reserve(), '40')
    expect(tree.nodes.garage.overrides.moduleReservePct).toBe(40)

    await commit(reserve(), '')

    expect(tree.nodes.garage.overrides.moduleReservePct).toBeNull()
    expectInherits('moduleReservePct', '20')
  })

  it('takes a value typed equal to the project’s as the panel’s own, with no mark', async () => {
    const tree = mountProject()
    await show(tree, 'garage')

    await commit(reserve(), '20')

    expect(tree.nodes.garage.overrides.moduleReservePct).toBe(20)
    expect(reserve().element.value).toBe('20')
    expectOwn('moduleReservePct')
  })

  it('an own «так» on «Розрив нейтралі», once cleared, inherits the project’s «ні» again', async () => {
    const tree = mountProject()
    await show(tree, 'garage')

    await choose('panel-properties', 'neutralBreak', 'так')

    expect(tree.nodes.garage.overrides.neutralBreak).toBe(true)
    expect(select('panel-properties', 'neutralBreak').props('value')).toBe(true)
    expectOwn('neutralBreak')

    select('panel-properties', 'neutralBreak').vm.$emit('update:value', null)
    await flushPromises()

    expect(tree.nodes.garage.overrides.neutralBreak).toBeNull()
    expectInherits('neutralBreak', 'ні')
  })

  it('refuses -5 and «abc» in a panel’s reserve with the reason, and shows its own 40 again', async () => {
    const tree = mountProject()
    await show(tree, 'garage')
    await commit(reserve(), '40')

    for (const [bad, reason] of [
      ['-5', 'Резерв модулів, %: тут має бути число, не менше 0, або порожньо.'],
      ['abc', '«abc» — не число. Введіть число, наприклад 0.95 або 0,95.'],
    ]) {
      clearMessages()
      await commit(reserve(), bad)

      expect(warningText(), bad).toContain(reason)
      expect(tree.nodes.garage.overrides.moduleReservePct, bad).toBe(40)
      expect(reserve().element.value, bad).toBe('40')
    }
  })

  it('shows the project’s value on a sub-panel under a panel with its own (scenario 5)', async () => {
    const tree = mountProject()
    await show(tree, 'garage')
    await commit(reserve(), '40')
    expect(tree.nodes.garage.overrides.moduleReservePct).toBe(40)

    await show(tree, 'shop')

    expectInherits('moduleReservePct', '20')
  })
})

describe('marks (003/FR-009, 003/FR-010)', () => {
  const ACCESSORY_LABELS = ['N-шини', 'PE-шина', 'Гребінчасті шини', 'Кабельні вводи', 'Заглушки']
  const NOTHING_BOUGHT = {
    neutralBars: false,
    peBar: false,
    combBusbars: false,
    cableGlands: false,
    blankingPlates: false,
  }

  const boxesIn = (group) =>
    wrapper.findAllComponents(NCheckbox).filter((box) => box.element.closest(`[data-${group}]`))
  const boxLabels = (group) => boxesIn(group).map((box) => box.text().trim())
  const boxStates = (group) => boxesIn(group).map((box) => box.props('checked'))
  const box = (group, attribute, value) => {
    const found = boxesIn(group).find((b) => b.element.matches(`[data-${attribute}="${value}"]`))
    expect(found, `no ${attribute} ${value} in ${group}`).toBeTruthy()
    return found
  }

  async function tick(target, checked) {
    target.vm.$emit('update:checked', checked)
    await flushPromises()
  }

  /** An entry with «Поверх 1» and «Поверх 2», both added now, so both copy the shipped devices. */
  async function mountFloors() {
    const tree = useTreeStore()
    tree.setTree(buildTree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] }))
    const first = tree.add({ parentId: 'root', kind: 'panel', name: 'Поверх 1' })
    const second = tree.add({ parentId: 'root', kind: 'panel', name: 'Поверх 2' })
    mountInspector()
    await show(tree, first)
    return { tree, first, second }
  }

  it('shows a new panel’s copied devices in copy order and the five accessories, all unchecked', async () => {
    const { tree, first } = await mountFloors()
    const copied = tree.nodes[first].incomingDevices

    expect(copied).toHaveLength(4)
    expect(boxLabels('install-marks')).toEqual(copied.map((device) => device.name))
    expect(boxLabels('buy-marks')).toEqual(ACCESSORY_LABELS)
    expect([...boxStates('install-marks'), ...boxStates('buy-marks')]).toEqual(Array(9).fill(false))
  })

  it('checking marks changes only those marks of that panel, and a second one keeps the first', async () => {
    const { tree, first, second } = await mountFloors()
    const [relay, , meter] = tree.nodes[first].incomingDevices

    await tick(box('install-marks', 'device', relay.id), true)
    await tick(box('install-marks', 'device', meter.id), true)
    await tick(box('buy-marks', 'accessory', 'peBar'), true)
    await tick(box('buy-marks', 'accessory', 'combBusbars'), true)

    expect(tree.nodes[first].incomingDevices.map((device) => device.install)).toEqual([
      true,
      false,
      true,
      false,
    ])
    expect(tree.nodes[first].buySeparately).toEqual({
      ...NOTHING_BOUGHT,
      peBar: true,
      combBusbars: true,
    })
    expect(boxStates('install-marks')).toEqual([true, false, true, false])
    expect(boxStates('buy-marks')).toEqual([false, true, true, false, false])
    expect(tree.nodes[second].incomingDevices.every((device) => !device.install)).toBe(true)
    expect(tree.nodes[second].buySeparately).toEqual(NOTHING_BOUGHT)
  })

  it('keeps the panel’s label after the device row is renamed, then deleted, in the table', async () => {
    const { tree, first } = await mountFloors()
    const reference = useReferenceTablesStore()
    const labels = tree.nodes[first].incomingDevices.map((device) => device.name)
    const meter = reference.tables.incomingDevices.find((row) => row.name === 'Лічильник')

    await reference.updateCell('incomingDevices', meter.id, 'name', 'Лічильник двотарифний')
    await flushPromises()
    expect(boxLabels('install-marks')).toEqual(labels)

    await reference.deleteRow('incomingDevices', meter.id)
    await flushPromises()
    expect(boxLabels('install-marks')).toEqual(labels)
  })
})

describe('calculated fields (003/FR-011, 003/FR-012, 003/SC-005)', () => {
  const PANEL_FIELDS = ['Корпус', 'Склад апаратів', 'Кількість комплектуючих']
  const LINE_FIELDS = ['Групове ПЗВ', 'Фаза']

  /** Entry → «Гараж» → «Майстерня» → «c1», and «Кухня» beside «Гараж». */
  function mountProject() {
    const tree = useTreeStore()
    tree.setTree(
      buildTree({
        id: 'root',
        kind: 'entry',
        name: 'Ввід',
        children: [
          {
            id: 'garage',
            kind: 'panel',
            name: 'Гараж',
            children: [{ id: 'shop', kind: 'panel', name: 'Майстерня', children: [consumer('c1')] }],
          },
          { id: 'kitchen', kind: 'panel', name: 'Кухня', children: [] },
        ],
      }),
    )
    mountInspector()
    return tree
  }

  it('shows the enclosure, the device composition and the accessory quantities on a panel under the entry, without the line pair', async () => {
    const tree = mountProject()
    await show(tree, 'garage')

    expect(groupLabels('calculated')).toEqual(PANEL_FIELDS)
  })

  it('shows all five on a panel under a panel', async () => {
    const tree = mountProject()
    await show(tree, 'shop')

    expect(groupLabels('calculated')).toEqual([...PANEL_FIELDS, ...LINE_FIELDS])
  })

  it('shows the group RCD and the phase on a consumer', async () => {
    const tree = mountProject()
    await show(tree, 'c1')

    expect(groupLabels('calculated')).toEqual(LINE_FIELDS)
  })

  it('keeps every one of them empty and disabled', async () => {
    const tree = mountProject()

    for (const nodeId of ['garage', 'shop', 'c1']) {
      await show(tree, nodeId)
      const inputs = fieldsIn('calculated').map((item) => item.find('input'))
      expect(inputs.length, nodeId).toBeGreaterThan(0)
      for (const input of inputs) {
        expect(input.element.value, nodeId).toBe('')
        expect(input.element.disabled, nodeId).toBe(true)
      }
    }
  })

  it('shows the line pair once the selected top-level panel is moved under another panel, and leaves its calculated values as they were', async () => {
    const tree = mountProject()
    await show(tree, 'kitchen')
    expect(groupLabels('calculated')).toEqual(PANEL_FIELDS)
    const before = tree.nodes.kitchen.calculated

    // Alt+→ and a drag both move the selected node and keep it selected.
    tree.move('kitchen', 'garage', 0)
    await flushPromises()

    expect(groupLabels('calculated')).toEqual([...PANEL_FIELDS, ...LINE_FIELDS])
    expect(tree.nodes.kitchen.calculated).toEqual(before)
  })
})
