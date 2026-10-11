// Name uniqueness inside one reference table. With the row id hidden from the user, the name is the
// only thing that tells two rows apart in a choice list, so two names that read the same are one name
// (002/FR-005, research R6).
import { describe, it, expect } from 'vitest'
import {
  nameKey,
  findDuplicateName,
  addRow,
  updateCell,
  deleteRow,
  TableRuleError,
} from '@/modules/reference/engine/tableOps.js'
import { LoadTypeSchema, ZoneSchema } from '@/schemas/index.js'
import { ReferenceTablesFileService } from '@/services/ReferenceTablesFileService.js'

describe('nameKey / findDuplicateName (002/FR-005)', () => {
  it('reads « Розетки » and «розетки» as the same name', () => {
    expect(nameKey(' Розетки ')).toBe(nameKey('розетки'))
  })

  it('keeps names that differ in more than case and surrounding spaces apart', () => {
    expect(nameKey('Розетки кухні')).not.toBe(nameKey('Розетки'))
  })

  it('points at the second of two rows whose names collide', () => {
    const rows = [
      { name: 'Суха житлова' },
      { name: 'Кухня' },
      { name: 'Вулиця' },
      { name: 'кухня' },
    ]
    expect(findDuplicateName(rows)).toBe(3)
  })

  it('answers -1 when every name is distinct', () => {
    const rows = [{ name: 'Суха житлова' }, { name: 'Кухня' }, { name: 'Вулиця' }]
    expect(findDuplicateName(rows)).toBe(-1)
    expect(findDuplicateName([])).toBe(-1)
  })
})

// Editing (002/FR-004, 002/FR-005). The shipped tables are the input: they are frozen, so an engine
// that patched its argument in place would throw here rather than pass by accident.
const shipped = () => ReferenceTablesFileService.loadBuiltin()
const byName = (rows, name) => rows.find((row) => row.name === name)

function refusalOf(fn) {
  try {
    fn()
  } catch (error) {
    return error
  }
  return null
}

describe('addRow (002/FR-004, 002/FR-005)', () => {
  it('appends a row carrying the given name, the generated id and null in every other cell', () => {
    const tables = shipped()
    const { tables: next, rowId } = addRow(tables, 'zones', ' Горище ', () => 'zn-test')

    expect(rowId).toBe('zn-test')
    expect(next.zones).toHaveLength(tables.zones.length + 1)
    const row = next.zones.at(-1)
    expect(Object.keys(row).sort()).toEqual(Object.keys(ZoneSchema.entries).sort())
    expect(row).toEqual({
      id: 'zn-test',
      name: 'Горище',
      rcdRequired: null,
      leakageMa: null,
      minIp: null,
      separateRcd: null,
      purpose: null,
    })
  })

  it('builds a load type row with every load type column', () => {
    const { tables: next } = addRow(shipped(), 'loadTypes', 'Інфрачервоний обігрівач', () => 'lt-x')
    const row = next.loadTypes.at(-1)
    expect(Object.keys(row).sort()).toEqual(Object.keys(LoadTypeSchema.entries).sort())
    expect(row.ratedPowerKw).toBeNull()
  })

  it('refuses an empty name', () => {
    for (const name of ['', '   ']) {
      const error = refusalOf(() => addRow(shipped(), 'zones', name, () => 'zn-test'))
      expect(error).toBeInstanceOf(TableRuleError)
      expect(error.code).toBe('nameRequired')
    }
  })

  it('refuses a name that reads the same as an existing row’s', () => {
    const error = refusalOf(() => addRow(shipped(), 'zones', ' кухня ', () => 'zn-test'))
    expect(error).toBeInstanceOf(TableRuleError)
    expect(error.code).toBe('nameTaken')
    expect(error.message).toMatch(/[а-яіїєґ]/i)
  })
})

describe('updateCell (002/FR-004, 002/FR-005, 002/FR-006)', () => {
  it('changes exactly the one cell and leaves every other row untouched', () => {
    const tables = shipped()
    const kitchen = byName(tables.zones, 'Кухня')

    const next = updateCell(tables, 'zones', kitchen.id, 'leakageMa', 10)

    expect(byName(next.zones, 'Кухня')).toEqual({ ...kitchen, leakageMa: 10 })
    next.zones.forEach((row, i) => {
      if (row.id !== kitchen.id) expect(row).toBe(tables.zones[i])
    })
    expect(next.loadTypes).toBe(tables.loadTypes)
  })

  it('stores a new name trimmed', () => {
    const tables = shipped()
    const kitchen = byName(tables.zones, 'Кухня')
    const next = updateCell(tables, 'zones', kitchen.id, 'name', '  Кухня-їдальня ')
    expect(next.zones.find((row) => row.id === kitchen.id).name).toBe('Кухня-їдальня')
  })

  it('lets a row keep its own name in another case', () => {
    const tables = shipped()
    const kitchen = byName(tables.zones, 'Кухня')
    const next = updateCell(tables, 'zones', kitchen.id, 'name', 'кухня')
    expect(next.zones.find((row) => row.id === kitchen.id).name).toBe('кухня')
  })

  it('refuses to clear a name', () => {
    const tables = shipped()
    const kitchen = byName(tables.zones, 'Кухня')
    for (const name of ['', '  ', null]) {
      const error = refusalOf(() => updateCell(tables, 'zones', kitchen.id, 'name', name))
      expect(error).toBeInstanceOf(TableRuleError)
      expect(error.code).toBe('nameRequired')
    }
  })

  it('refuses another row’s name', () => {
    const tables = shipped()
    const kitchen = byName(tables.zones, 'Кухня')
    const error = refusalOf(() =>
      updateCell(tables, 'zones', kitchen.id, 'name', 'технічне приміщення'),
    )
    expect(error.code).toBe('nameTaken')
  })

  it('refuses the id and any key the table does not have', () => {
    const tables = shipped()
    const kitchen = byName(tables.zones, 'Кухня')
    for (const key of ['id', 'code', 'ratedPowerKw']) {
      const error = refusalOf(() => updateCell(tables, 'zones', kitchen.id, key, 'x'))
      expect(error).toBeInstanceOf(TableRuleError)
      expect(error.code).toBe('unknownColumn')
    }
  })

  it('refuses a row that is not in the table', () => {
    const error = refusalOf(() => updateCell(shipped(), 'zones', 'zn-absent', 'leakageMa', 10))
    expect(error.code).toBe('unknownRow')
  })

  it('refuses a value of the wrong kind, so only parsed values reach the table', () => {
    const tables = shipped()
    const hob = byName(tables.loadTypes, 'Варильна поверхня')
    expect(
      refusalOf(() => updateCell(tables, 'loadTypes', hob.id, 'powerFactor', '0.95')).code,
    ).toBe('notANumber')
    expect(refusalOf(() => updateCell(tables, 'loadTypes', hob.id, 'continuous', 'так')).code).toBe(
      'notYesNo',
    )
  })

  it('accepts null in any cell but the name', () => {
    const tables = shipped()
    const hob = byName(tables.loadTypes, 'Варильна поверхня')
    let next = updateCell(tables, 'loadTypes', hob.id, 'powerFactor', null)
    next = updateCell(next, 'loadTypes', hob.id, 'continuous', null)
    next = updateCell(next, 'loadTypes', hob.id, 'phases', null)
    const row = next.loadTypes.find((r) => r.id === hob.id)
    expect([row.powerFactor, row.continuous, row.phases]).toEqual([null, null, null])
  })
})

describe('deleteRow (002/FR-004)', () => {
  it('removes the row and keeps the rest in order', () => {
    const tables = shipped()
    const ups = byName(tables.zones, 'Лінія гарантованого живлення')

    const next = deleteRow(tables, 'zones', ups.id)

    expect(next.zones).toEqual(tables.zones.filter((row) => row.id !== ups.id))
  })

  it('refuses a row that is not in the table', () => {
    expect(refusalOf(() => deleteRow(shipped(), 'zones', 'zn-absent')).code).toBe('unknownRow')
  })
})

describe('every edit returns new frozen tables and leaves its argument alone', () => {
  it('holds for addRow, updateCell and deleteRow', () => {
    const tables = shipped()
    const before = structuredClone(tables)
    const kitchen = byName(tables.zones, 'Кухня')

    const results = [
      addRow(tables, 'zones', 'Горище', () => 'zn-test').tables,
      updateCell(tables, 'zones', kitchen.id, 'leakageMa', 10),
      deleteRow(tables, 'zones', kitchen.id),
    ]

    for (const next of results) {
      expect(next).not.toBe(tables)
      expect(Object.isFrozen(next.zones)).toBe(true)
      expect(Object.isFrozen(next.zones[0])).toBe(true)
    }
    expect(tables).toEqual(before)
  })
})
