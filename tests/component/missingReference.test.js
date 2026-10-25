// A project file from another installation: its consumers hold copies of rows the local tables lack,
// or hold with other values. Opened through the project file service, it shows the file's names and
// values — never the local rows, never a mark (002/FR-015, 002/FR-018; User Story 3 scenarios 2–3).
// A panel of such a file shows the incoming devices of its own copy, with their marks (003/FR-009).
//
// The inspector hooks are the ones `nodeInspector.test.js` describes: `data-copy="loadType" | "zone"`,
// `data-row-select` on each row select, `data-cell="<column key>"` on each copied-value editor.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NCheckbox, NConfigProvider, NMessageProvider, NSelect } from 'naive-ui'
import NodeInspector from '@/modules/tree/components/NodeInspector.vue'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useProjectStore } from '@/stores/project.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import { denormalize } from '@/services/ProjectFileService.js'
import { ReferenceTablesFileService } from '@/services/ReferenceTablesFileService.js'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import {
  tree as buildTree,
  consumer,
  incomingDeviceRow,
  loadTypeRow,
  zoneRow,
} from '../fixtures/tree.js'

const PATH = '/home/user/від-колеги.eltree.json'

let fs = null
let wrapper = null

beforeEach(() => {
  setActivePinia(createPinia())
  fs = new MemoryFs({ dataDir: '/memfs/data' })
  setFs(fs)
})

afterEach(async () => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  await ReferenceTablesFileService.flush().catch(() => {})
  setFs(null)
})

const Harness = defineComponent({
  setup() {
    return () =>
      h(NConfigProvider, null, {
        default: () => h(NMessageProvider, null, { default: () => h(NodeInspector) }),
      })
  },
})

/** Writes a file whose one consumer holds `fields` and whose panel holds `panel`, opens it, and shows
 * that consumer. */
async function openFileWith(fields, panel = {}) {
  const file = denormalize(
    buildTree({
      id: 'root',
      kind: 'entry',
      name: 'Ввід',
      children: [
        {
          id: 'kitchen',
          kind: 'panel',
          name: 'Кухня',
          ...panel,
          children: [consumer('c1', { name: 'Розетки фартуха', ...fields })],
        },
      ],
    }),
    { name: 'Квартира колеги' },
  )
  await fs.writeText(PATH, JSON.stringify(file, null, 2))
  await useProjectStore().openPath(PATH)
  const tree = useTreeStore()
  tree.select('c1')
  wrapper = mount(Harness, { attachTo: document.body })
  await flushPromises()
  return tree
}

const rowSelect = (part) => {
  const select = wrapper
    .findAllComponents(NSelect)
    .find((s) => s.element.matches(`[data-copy="${part}"] [data-row-select]`))
  expect(select, `no row select for ${part}`).toBeTruthy()
  return select
}
const copyField = (part, key) => wrapper.find(`[data-copy="${part}"] [data-cell="${key}"]`)

describe('a file from another installation opens with its own values (002/FR-015, 002/FR-018)', () => {
  it('shows the file’s names and values for rows the local tables lack, with no mark (scenario 2)', async () => {
    const heater = loadTypeRow({
      id: 'lt-from-another-installation',
      name: 'Інфрачервоний обігрівач',
      ratedPowerKw: 1.2,
      phases: '1ф',
    })
    const terrace = zoneRow({
      id: 'zn-from-another-installation',
      name: 'Тераса',
      leakageMa: 30,
      minIp: 'IP44',
    })

    const tree = await openFileWith({ loadType: heater, zone: terrace })

    expect(tree.nodes.c1.loadType).toEqual(heater)
    expect(tree.nodes.c1.zone).toEqual(terrace)
    expect(rowSelect('loadType').text()).toContain('Інфрачервоний обігрівач')
    expect(rowSelect('zone').text()).toContain('Тераса')
    expect(copyField('loadType', 'ratedPowerKw').element.value).toBe('1.2')
    expect(copyField('zone', 'minIp').element.value).toBe('IP44')
    expect(document.body.textContent).not.toContain('Відсутній у довіднику')
    expect(document.body.textContent).not.toMatch(/\b(lt|zn)-/)
  })

  it('shows the file’s values for rows the local tables hold with other values (scenario 3)', async () => {
    const reference = useReferenceTablesStore()
    const localSockets = reference.tables.loadTypes.find(
      (row) => row.name === 'Розетки кухні (робоча зона)',
    )
    const localKitchen = reference.tables.zones.find((row) => row.name === 'Кухня')
    const fileSockets = { ...localSockets, name: 'Розетки кухні', demandFactor: 0.5 }
    const fileKitchen = { ...localKitchen, leakageMa: 10 }

    const tree = await openFileWith({ loadType: fileSockets, zone: fileKitchen })

    expect(tree.nodes.c1.loadType).toEqual(fileSockets)
    expect(rowSelect('loadType').text()).toContain('Розетки кухні')
    expect(rowSelect('loadType').text()).not.toContain('(робоча зона)')
    expect(copyField('loadType', 'demandFactor').element.value).toBe('0.5')
    expect(copyField('zone', 'leakageMa').element.value).toBe('10')
    expect(reference.tables.loadTypes.find((row) => row.id === localSockets.id)).toEqual(
      localSockets,
    )
  })
})

describe('a panel from another installation keeps its incoming devices (003/FR-009)', () => {
  it('shows a device the local table lacks, with its mark', async () => {
    const switcher = incomingDeviceRow({
      id: 'iw-from-another-installation',
      name: 'Перемикач мережа-генератор',
    })
    const local = useReferenceTablesStore().tables.incomingDevices
    expect(local.some((row) => row.name === switcher.name)).toBe(false)

    const tree = await openFileWith({}, { incomingDevices: [{ ...switcher, install: true }] })
    tree.select('kitchen')
    await flushPromises()

    const marks = wrapper
      .findAllComponents(NCheckbox)
      .filter((box) => box.element.closest('[data-install-marks]'))
    expect(marks.map((box) => box.text().trim())).toEqual(['Перемикач мережа-генератор'])
    expect(marks[0].props('checked')).toBe(true)
  })
})
