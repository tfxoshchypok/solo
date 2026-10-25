// What a typed cell becomes once stored, and how a stored cell reads again. A number cell accepts a
// comma, because a Ukrainian keyboard types `0,95`; anything that is not a plain decimal is refused
// with the reason, never silently reverted (002/FR-006, research R8).
import { describe, it, expect } from 'vitest'
import {
  parseNumberCell,
  parseTextCell,
  formatCell,
  parseCell,
} from '@/modules/reference/engine/cells.js'
import { TableRuleError } from '@/modules/reference/engine/tableOps.js'

function refusalOf(fn) {
  try {
    fn()
  } catch (error) {
    return error
  }
  return null
}

describe('parseNumberCell (002/FR-006)', () => {
  it('reads a decimal with a dot or a comma', () => {
    expect(parseNumberCell('0.95')).toBe(0.95)
    expect(parseNumberCell('0,95')).toBe(0.95)
    expect(parseNumberCell('12')).toBe(12)
  })

  it('ignores surrounding spaces and keeps a sign', () => {
    expect(parseNumberCell(' 7.4 ')).toBe(7.4)
    expect(parseNumberCell('-1')).toBe(-1)
  })

  it('turns an empty cell into null', () => {
    expect(parseNumberCell('')).toBeNull()
    expect(parseNumberCell('   ')).toBeNull()
  })

  for (const text of ['abc', '1.2.3', '1,2,3', '1e3', '0x10', '7,4 кВт']) {
    it(`refuses «${text}» with a reason`, () => {
      const error = refusalOf(() => parseNumberCell(text))
      expect(error).toBeInstanceOf(TableRuleError)
      expect(error.code).toBe('notANumber')
      expect(error.message).toMatch(/[а-яіїєґ]/i)
    })
  }
})

describe('parseTextCell (002/FR-006)', () => {
  it('trims the text', () => {
    expect(parseTextCell('  1ф або 2ф ')).toBe('1ф або 2ф')
  })

  it('turns an empty or blank cell into null', () => {
    expect(parseTextCell('')).toBeNull()
    expect(parseTextCell('   ')).toBeNull()
  })
})

describe('formatCell — a stored value as the table shows it', () => {
  it('shows an empty cell as nothing, whatever its kind', () => {
    expect(formatCell('text', null)).toBe('')
    expect(formatCell('number', null)).toBe('')
    expect(formatCell('yesno', null)).toBe('')
  })

  it('shows yes and no in the source document’s words', () => {
    expect(formatCell('yesno', true)).toBe('так')
    expect(formatCell('yesno', false)).toBe('ні')
  })

  it('shows a number as written in the source document', () => {
    expect(formatCell('number', 0.3)).toBe('0.3')
    expect(formatCell('number', 12)).toBe('12')
  })

  it('shows text as it is', () => {
    expect(formatCell('text', 'IP20 / IP44')).toBe('IP20 / IP44')
    expect(formatCell('name', 'Кухня')).toBe('Кухня')
  })
})

// One parser for the table and for a consumer's copied values, by the column's kind (research R16).
describe('parseCell (002/FR-006, 002/FR-021)', () => {
  it('parses a number cell, a comma included, and refuses text', () => {
    expect(parseCell('number', '0,5')).toBe(0.5)
    expect(parseCell('number', '')).toBeNull()
    const error = refusalOf(() => parseCell('number', 'abc'))
    expect(error).toBeInstanceOf(TableRuleError)
    expect(error.code).toBe('notANumber')
  })

  it('trims a text cell and turns empty into null', () => {
    expect(parseCell('text', '  IP44 ')).toBe('IP44')
    expect(parseCell('text', '   ')).toBeNull()
  })

  it('passes a yes/no value through as the select gives it', () => {
    expect(parseCell('yesno', true)).toBe(true)
    expect(parseCell('yesno', false)).toBe(false)
    expect(parseCell('yesno', null)).toBeNull()
  })
})

// The two number kinds of the 003 tables share the number parser (003/FR-017).
describe('parseCell / formatCell for count and positive cells (003/FR-017)', () => {
  it('reads «2» in a count cell as 2, and «2,5» in a positive cell as 2.5', () => {
    expect(parseCell('count', '2')).toBe(2)
    expect(parseCell('positive', '2,5')).toBe(2.5)
  })

  it('refuses «abc» in a count cell with notANumber', () => {
    const error = refusalOf(() => parseCell('count', 'abc'))
    expect(error).toBeInstanceOf(TableRuleError)
    expect(error.code).toBe('notANumber')
  })

  it('shows 14 as «14», and an empty cell as empty', () => {
    expect(formatCell('count', 14)).toBe('14')
    expect(formatCell('count', null)).toBe('')
  })
})
