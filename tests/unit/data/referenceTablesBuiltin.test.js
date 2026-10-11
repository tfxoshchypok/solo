// The shipped reference tables against the source document they come from (SC-001, 002/FR-002).
// The document is the oracle: every cell except the code column must read the same once converted
// to the stored kind — «так» → true, «ні» → false, «—» → null, a number as a number.
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

describe('the shipped reference tables are the source document (SC-001, 002/FR-002)', () => {
  it('validates against its own schema, so a broken bundle fails the build not the user', () => {
    const result = v.safeParse(ReferenceTablesSchema, builtin)
    expect(result.success, result.issues?.map(formatIssuePath).join(', ')).toBe(true)
  })

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
