// The shipped reference tables against what they come from. The two tables of feature 002 are read
// against the source document (SC-001, 002/FR-002): every cell except the code column must read the
// same once converted to the stored kind — «так» → true, «ні» → false, «—» → null, a number as a
// number. The three tables of feature 003 are read against the rows the spec lists under *Reference
// Table Columns*, written out below (003/SC-001, research R15).
import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import builtin from '@/data/referenceTables.builtin.json'
import { ReferenceTablesSchema, formatIssuePath } from '@/schemas/index.js'
import { loadTypesTable, zonesTable } from '../../fixtures/sourceDocument.js'

/** Source header → stored key and kind (data-model.md). `Код` has no key: the id replaces it. */
const LOAD_TYPE_COLUMNS = {
  'Назва типу': ['name', 'text'],
  'P, кВт': ['ratedPowerKw', 'number'],
  Фазність: ['phases', 'text'],
  'Хар-ка АВ': ['breakerCurve', 'text'],
  Тривалий: ['continuous', 'yesno'],
  'cos φ': ['powerFactor', 'number'],
  Кп: ['demandFactor', 'number'],
  'Тип ПЗВ': ['rcdType', 'text'],
}
const ZONE_COLUMNS = {
  'Назва зони': ['name', 'text'],
  "ПЗВ обов'язкове": ['rcdRequired', 'yesno'],
  'Уставка витоку, мА': ['leakageMa', 'number'],
  'Мін. IP': ['minIp', 'text'],
  'Окреме ПЗВ': ['separateRcd', 'yesno'],
  'Призначення та нормативні межі': ['purpose', 'text'],
}

function stored(kind, text) {
  if (text === '—') return null
  if (kind === 'yesno') return { так: true, ні: false }[text]
  if (kind === 'number') return Number(text)
  return text
}

function compare(table, columns, rows) {
  const differences = []
  table.rows.forEach((cells, i) => {
    table.headers.forEach((header, c) => {
      if (header === 'Код') return
      const [key, kind] = columns[header]
      const expected = stored(kind, cells[c])
      const actual = rows[i]?.[key]
      if (actual !== expected) {
        differences.push(
          `${cells[0]} / ${header}: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`,
        )
      }
    })
  })
  return differences
}

it('the shipped file validates against its own schema, so a broken bundle fails the build not the user', () => {
  const result = v.safeParse(ReferenceTablesSchema, builtin)
  expect(result.success, result.issues?.map(formatIssuePath).join(', ')).toBe(true)
})

describe('the shipped reference tables are the source document (SC-001, 002/FR-002)', () => {
  it('ships the 33 load types and 8 zones of the source document, in its order', () => {
    expect(builtin.loadTypes).toHaveLength(loadTypesTable().rows.length)
    expect(builtin.zones).toHaveLength(zonesTable().rows.length)
    expect(builtin.loadTypes).toHaveLength(33)
    expect(builtin.zones).toHaveLength(8)
  })

  it('matches every load type cell except the code, with zero differences', () => {
    expect(compare(loadTypesTable(), LOAD_TYPE_COLUMNS, builtin.loadTypes)).toEqual([])
  })

  it('matches every zone cell except the code, with zero differences', () => {
    expect(compare(zonesTable(), ZONE_COLUMNS, builtin.zones)).toEqual([])
  })

  it('carries exactly the id and the mapped columns in every row — no code column', () => {
    const loadTypeKeys = ['id', ...Object.values(LOAD_TYPE_COLUMNS).map(([key]) => key)].sort()
    const zoneKeys = ['id', ...Object.values(ZONE_COLUMNS).map(([key]) => key)].sort()
    for (const row of builtin.loadTypes) expect(Object.keys(row).sort()).toEqual(loadTypeKeys)
    for (const row of builtin.zones) expect(Object.keys(row).sort()).toEqual(zoneKeys)
  })

  it('gives every row a generated id, unique in its table (002/FR-005)', () => {
    const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    for (const row of builtin.loadTypes) expect(row.id).toMatch(new RegExp(`^lt-${uuid}$`))
    for (const row of builtin.zones) expect(row.id).toMatch(new RegExp(`^zn-${uuid}$`))
    expect(new Set(builtin.loadTypes.map((row) => row.id)).size).toBe(builtin.loadTypes.length)
    expect(new Set(builtin.zones.map((row) => row.id)).size).toBe(builtin.zones.length)
  })
})

// The spec's *Reference Table Columns*, row by row and in its order (003/SC-001).
const ENCLOSURE_SIZES = [12, 13, 18, 24].flatMap((rowModularity) =>
  [1, 2, 3, 4].map((rowCount) => ({ rowModularity, rowCount })),
)
const DEVICE_WIDTHS = [
  { name: '1P', widthModules: 1 },
  { name: '1P+N', widthModules: 2 },
  { name: '2P', widthModules: 2 },
  { name: '3P', widthModules: 3 },
  { name: '4P', widthModules: 4 },
]
const INCOMING_DEVICES = [
  { name: 'Реле напруги', width1ph: 2, width3ph: 4 },
  { name: 'ОПН', width1ph: 2, width3ph: 4 },
  { name: 'Лічильник', width1ph: 6, width3ph: 8 },
  { name: 'Рубильник', width1ph: 2, width3ph: 4 },
]

/** The three tables of feature 003: expected rows, the id prefix, and the keys of data-model.md. */
const TABLES_003 = [
  ['enclosureSizes', ENCLOSURE_SIZES, 'es', ['id', 'rowModularity', 'rowCount']],
  ['deviceWidths', DEVICE_WIDTHS, 'dw', ['id', 'name', 'widthModules']],
  ['incomingDevices', INCOMING_DEVICES, 'iw', ['id', 'name', 'width1ph', 'width3ph']],
]

const withoutId = (row) => {
  const cells = { ...row }
  delete cells.id
  return cells
}

describe('the three new tables are the spec’s Reference Table Columns (003/SC-001, 003/FR-014)', () => {
  it('ships 16 enclosure sizes, 5 device widths and 4 incoming devices', () => {
    expect(builtin.enclosureSizes).toHaveLength(16)
    expect(builtin.deviceWidths).toHaveLength(5)
    expect(builtin.incomingDevices).toHaveLength(4)
  })

  for (const [table, expected] of TABLES_003) {
    it(`ships the ${table} rows of the spec, cell by cell and in its order`, () => {
      expect(builtin[table]?.map(withoutId)).toEqual(expected)
    })
  }

  it('carries exactly the keys of data-model.md in every row', () => {
    for (const [table, , , keys] of TABLES_003) {
      expect(builtin[table], table).toBeDefined()
      for (const row of builtin[table]) expect(Object.keys(row).sort(), table).toEqual(keys.sort())
    }
  })

  it('gives every row a generated id with its table’s prefix, unique in its table', () => {
    const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    for (const [table, , prefix] of TABLES_003) {
      expect(builtin[table], table).toBeDefined()
      for (const row of builtin[table]) expect(row.id).toMatch(new RegExp(`^${prefix}-${uuid}$`))
      expect(new Set(builtin[table].map((row) => row.id)).size).toBe(builtin[table].length)
    }
  })
})
