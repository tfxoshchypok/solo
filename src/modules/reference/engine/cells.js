// Typed text → stored cell, and stored cell → the text a table shows. A number accepts a comma as
// its decimal separator, because a Ukrainian keyboard types `0,95`; anything else that is not a plain
// decimal is refused with the reason rather than silently reverted (002/FR-006, research R8).
import { TableRuleError } from './tableOps.js'

const DECIMAL = /^-?\d+([.,]\d+)?$/

/** @returns {number|null} */
export function parseNumberCell(text) {
  const trimmed = String(text ?? '').trim()
  if (trimmed === '') return null
  if (!DECIMAL.test(trimmed)) {
    throw new TableRuleError(
      'notANumber',
      `«${trimmed}» — не число. Введіть число, наприклад 0.95 або 0,95.`,
    )
  }
  return Number(trimmed.replace(',', '.'))
}

/** @returns {string|null} */
export function parseTextCell(text) {
  const trimmed = String(text ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Text typed into a cell becomes the value its kind stores; anything already parsed passes through.
 * The table and the consumer's copy both parse here, so they refuse the same input (research R16).
 * @param {'name'|'text'|'number'|'yesno'|undefined} kind
 */
export function parseCell(kind, input) {
  if (typeof input !== 'string') return input
  if (kind === 'number') return parseNumberCell(input)
  if (kind === 'text') return parseTextCell(input)
  return input
}

/** @param {'name'|'text'|'number'|'yesno'} kind */
export function formatCell(kind, value) {
  if (value === null || value === undefined) return ''
  if (kind === 'yesno') return value ? 'так' : 'ні'
  return String(value)
}
