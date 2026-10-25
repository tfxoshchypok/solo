// The column config and the schemas name the same tables: `REFERENCE_TABLES` is the list the file
// service iterates, `columns` the one the «Довідники» section edits (research R7).
import { describe, it, expect } from 'vitest'
import { columns } from '@/modules/reference/config/columns.js'
import { NAMED_TABLES, REFERENCE_TABLES } from '@/schemas/index.js'

describe('the column config covers every reference table (003/FR-013, 003/FR-016)', () => {
  it('has a column list for exactly the tables of REFERENCE_TABLES, in their order', () => {
    expect(Object.keys(columns)).toEqual(REFERENCE_TABLES)
  })

  it('gives every table of NAMED_TABLES a name column, and enclosureSizes none', () => {
    for (const table of NAMED_TABLES) {
      expect(
        columns[table].some((column) => column.key === 'name'),
        table,
      ).toBe(true)
    }
    expect(columns.enclosureSizes.some((column) => column.key === 'name')).toBe(false)
  })
})
