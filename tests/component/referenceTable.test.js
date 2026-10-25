// The «Довідники» table on screen: the source document's columns without its code, every cell
// editable, rows added and deleted once confirmed, a refused edit shown and put back (002/FR-001,
// 002/FR-003, 002/FR-004, 002/FR-005, 002/FR-006; User Story 1, scenarios 1–6).
//
// Hooks the component provides for these tests: every cell editor carries `data-cell="<key>"`, the
// new-row name input carries `data-add-name`, and the buttons read «Додати рядок» / «Видалити рядок».
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NConfigProvider, NDialogProvider, NMessageProvider, NSelect } from 'naive-ui'
import ReferenceTable from '@/modules/reference/components/ReferenceTable.vue'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import { ReferenceTablesFileService } from '@/services/ReferenceTablesFileService.js'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { loadTypesTable, zonesTable } from '../fixtures/sourceDocument.js'

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

function mountTable(table) {
  const Harness = defineComponent({
    setup() {
      return () =>
        h(NConfigProvider, null, {
          default: () =>
            h(NDialogProvider, null, {
              default: () =>
                h(NMessageProvider, null, { default: () => h(ReferenceTable, { table }) }),
            }),
        })
    },
  })
  wrapper = mount(Harness, { attachTo: document.body })
  return useReferenceTablesStore()
}

const rows = () => wrapper.findAll('tbody tr')
const nameOf = (tr) => tr.find('input[data-cell="name"]').element.value
const rowNamed = (name) => rows().find((tr) => nameOf(tr) === name)
const cellOf = (tr, key) => tr.find(`[data-cell="${key}"]`)
const button = (text) => wrapper.findAll('button').find((b) => b.text().includes(text))
const warningShown = () => Boolean(document.body.querySelector('.n-message')?.textContent.trim())
const dialog = () => document.body.querySelector('.n-dialog')
const dialogButton = (text) =>
  [...(dialog()?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === text)
const deleteButtonOf = (tr) => tr.find('button[aria-label="Видалити рядок"]')

async function commit(input, text) {
  await input.setValue(text)
  await input.trigger('blur')
  await flushPromises()
}

function selectIn(tr, key) {
  return wrapper
    .findAllComponents(NSelect)
    .find((s) => s.element.closest('tr') === tr.element && s.attributes('data-cell') === key)
}

describe('what the table shows (002/FR-001, 002/FR-003; scenario 1)', () => {
  it('titles the load types columns with the source document’s headers, without «Код»', () => {
    mountTable('loadTypes')
    const titles = wrapper
      .findAll('thead th')
      .map((th) => th.text().trim())
      .filter(Boolean)
    expect(titles).toEqual(loadTypesTable().headers.filter((header) => header !== 'Код'))
  })

  it('titles the zones columns with the source document’s headers, without «Код»', () => {
    mountTable('zones')
    const titles = wrapper
      .findAll('thead th')
      .map((th) => th.text().trim())
      .filter(Boolean)
    expect(titles).toEqual(zonesTable().headers.filter((header) => header !== 'Код'))
  })

  it('shows every shipped row: 33 load types, 8 zones', () => {
    mountTable('loadTypes')
    expect(rows()).toHaveLength(33)
    wrapper.unmount()
    mountTable('zones')
    expect(rows()).toHaveLength(8)
    expect(rows().map(nameOf)).toEqual(zonesTable().rows.map((cells) => cells[1]))
  })

  it('puts no row id anywhere on the page (002/FR-005)', () => {
    mountTable('loadTypes')
    expect(document.body.innerHTML).not.toMatch(/\b(lt|zn)-[0-9a-f]{8}-/)
  })
})

describe('editing a cell (002/FR-004, 002/FR-006; scenario 2)', () => {
  it('stores «0,5» typed into «Кп» as 0.5 once the field is left', async () => {
    const store = mountTable('loadTypes')
    const kitchen = rowNamed('Розетки кухні (робоча зона)')

    await commit(cellOf(kitchen, 'demandFactor'), '0,5')

    const row = store.tables.loadTypes.find((r) => r.name === 'Розетки кухні (робоча зона)')
    expect(row.demandFactor).toBe(0.5)
    expect(cellOf(rowNamed('Розетки кухні (робоча зона)'), 'demandFactor').element.value).toBe(
      '0.5',
    )
  })

  it('offers «так» and «ні» in a yes/no cell, and clears it to empty', async () => {
    const store = mountTable('loadTypes')
    const fridge = rowNamed('Холодильник / Морозильник')
    const select = selectIn(fridge, 'continuous')

    expect(select.props('options').map((option) => option.label)).toEqual(['так', 'ні'])
    expect(select.props('clearable')).toBe(true)

    select.vm.$emit('update:value', false)
    await flushPromises()
    expect(
      store.tables.loadTypes.find((r) => r.name === 'Холодильник / Морозильник').continuous,
    ).toBe(false)

    select.vm.$emit('update:value', null)
    await flushPromises()
    expect(
      store.tables.loadTypes.find((r) => r.name === 'Холодильник / Морозильник').continuous,
    ).toBe(null)
  })
})

describe('a refused edit is shown and put back (002/FR-005, 002/FR-006; scenarios 5–6)', () => {
  it('refuses a cleared name', async () => {
    const store = mountTable('zones')
    const before = store.tables

    await commit(cellOf(rowNamed('Кухня'), 'name'), '')

    expect(warningShown()).toBe(true)
    expect(rowNamed('Кухня')).toBeDefined()
    expect(store.tables).toBe(before)
  })

  it('refuses another row’s name in another case', async () => {
    const store = mountTable('loadTypes')
    const before = store.tables

    await commit(cellOf(rowNamed('Розетки житлових кімнат'), 'name'), 'освітлення загальне')

    expect(warningShown()).toBe(true)
    expect(rowNamed('Розетки житлових кімнат')).toBeDefined()
    expect(store.tables).toBe(before)
  })

  it('refuses «abc» in «P, кВт»', async () => {
    const store = mountTable('loadTypes')
    const before = store.tables

    await commit(cellOf(rowNamed('Розетки житлових кімнат'), 'ratedPowerKw'), 'abc')

    expect(warningShown()).toBe(true)
    expect(cellOf(rowNamed('Розетки житлових кімнат'), 'ratedPowerKw').element.value).toBe('2')
    expect(store.tables).toBe(before)
  })
})

describe('adding and deleting rows (002/FR-004; scenarios 3–4)', () => {
  it('adds a row from the name field and «Додати рядок»', async () => {
    const store = mountTable('zones')

    await wrapper.find('input[data-add-name]').setValue('Горище')
    await button('Додати рядок').trigger('click')
    await flushPromises()

    expect(rows()).toHaveLength(9)
    expect(nameOf(rows().at(-1))).toBe('Горище')
    expect(store.tables.zones.at(-1)).toMatchObject({ name: 'Горище', leakageMa: null })
    expect(wrapper.find('input[data-add-name]').element.value).toBe('')
  })

  it('refuses to add a row whose name is already taken', async () => {
    mountTable('zones')

    await wrapper.find('input[data-add-name]').setValue('кухня')
    await button('Додати рядок').trigger('click')
    await flushPromises()

    expect(warningShown()).toBe(true)
    expect(rows()).toHaveLength(8)
  })

  it('asks before deleting a row with its «Видалити рядок» button, naming the row, and deletes it once confirmed', async () => {
    const store = mountTable('zones')

    await deleteButtonOf(rowNamed('Лінія гарантованого живлення')).trigger('click')
    await flushPromises()

    expect(dialog()?.textContent).toContain('Видалити рядок?')
    expect(dialog().textContent).toContain('«Лінія гарантованого живлення»')
    expect(rows()).toHaveLength(8)
    expect(store.tables.zones.map((r) => r.name)).toContain('Лінія гарантованого живлення')

    dialogButton('Видалити').click()
    await flushPromises()

    expect(rows()).toHaveLength(7)
    expect(rowNamed('Лінія гарантованого живлення')).toBeUndefined()
    expect(store.tables.zones.map((r) => r.name)).not.toContain('Лінія гарантованого живлення')
  })

  it('keeps the row and writes nothing when the deletion is cancelled', async () => {
    const store = mountTable('zones')
    const before = store.tables

    await deleteButtonOf(rowNamed('Лінія гарантованого живлення')).trigger('click')
    await flushPromises()
    dialogButton('Скасувати').click()
    await flushPromises()

    expect(rows()).toHaveLength(8)
    expect(store.tables).toBe(before)
  })
})

describe('the three 003 tables (003/FR-013, 003/FR-016, 003/FR-017; User Story 4, scenarios 1–4)', () => {
  const headers = () =>
    wrapper
      .findAll('thead th')
      .map((th) => th.text().trim())
      .filter(Boolean)

  describe('enclosure sizes', () => {
    it('shows «Модульність ряду» and «Кількість рядів», with 16 rows', () => {
      mountTable('enclosureSizes')
      expect(headers()).toEqual(['Модульність ряду', 'Кількість рядів'])
      expect(rows()).toHaveLength(16)
    })

    it('has no name field, and «Додати рядок» appends an empty row', async () => {
      const store = mountTable('enclosureSizes')
      expect(wrapper.find('input[data-add-name]').exists()).toBe(false)

      await button('Додати рядок').trigger('click')
      await flushPromises()

      expect(rows()).toHaveLength(17)
      expect(store.tables.enclosureSizes.at(-1)).toMatchObject({
        rowModularity: null,
        rowCount: null,
      })
      expect(cellOf(rows().at(-1), 'rowModularity').element.value).toBe('')
      expect(cellOf(rows().at(-1), 'rowCount').element.value).toBe('')
    })

    it('refuses 0 in «Кількість рядів» with a warning, and puts the stored value back', async () => {
      const store = mountTable('enclosureSizes')
      const before = store.tables

      await commit(cellOf(rows()[0], 'rowCount'), '0')

      expect(warningShown()).toBe(true)
      expect(cellOf(rows()[0], 'rowCount').element.value).toBe('1')
      expect(store.tables).toBe(before)
    })

    it('asks before deleting a row, naming it «12 × 1»', async () => {
      mountTable('enclosureSizes')

      await deleteButtonOf(rows()[0]).trigger('click')
      await flushPromises()

      expect(dialog()?.textContent).toContain('«12 × 1»')
    })
  })

  it('shows the device widths with «Полюсність» and «Модулів», with 5 rows', () => {
    mountTable('deviceWidths')
    expect(headers()).toEqual(['Полюсність', 'Модулів'])
    expect(rows()).toHaveLength(5)
  })

  it('shows the incoming devices with «Апарат», «1ф» and «3ф», with 4 rows, and refuses 0 in «1ф»', async () => {
    const store = mountTable('incomingDevices')
    expect(headers()).toEqual(['Апарат', '1ф', '3ф'])
    expect(rows()).toHaveLength(4)
    const before = store.tables

    await commit(cellOf(rowNamed('Реле напруги'), 'width1ph'), '0')

    expect(warningShown()).toBe(true)
    expect(cellOf(rowNamed('Реле напруги'), 'width1ph').element.value).toBe('2')
    expect(store.tables).toBe(before)
  })

  it('puts no row id of the three tables anywhere on the page', () => {
    for (const table of ['enclosureSizes', 'deviceWidths', 'incomingDevices']) {
      mountTable(table)
      expect(document.body.innerHTML, table).not.toMatch(/\b(es|dw|iw)-[0-9a-f]{8}/)
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })
})
