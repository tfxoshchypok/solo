// Pure operations on the reference tables — plain data in, plain data out, no I/O, no Vue, no Pinia
// (contracts/services.md). Every edit returns `produce(tables, …)` from immer: the argument is never
// touched, unchanged rows stay the same objects, and the result is frozen.
//
// The uniqueness rule lives in `src/schemas/index.js`, because `ReferenceTablesFileService` applies it
// to a file on load and the services layer does not import from a module. It is re-exported here so
// the table engine's whole surface is one import.
import { produce } from 'immer'
import { nameKey, findDuplicateName } from '@/schemas/index.js'
import { columnOf, columns } from '../config/columns.js'

export { nameKey, findDuplicateName }

/** The single refusal channel of the table engine and the cell parsers. `code` is stable; the message is shown. */
export class TableRuleError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'TableRuleError'
    this.code = code
  }
}

const ID_PREFIX = {
  loadTypes: 'lt',
  zones: 'zn',
  enclosureSizes: 'es',
  deviceWidths: 'dw',
  incomingDevices: 'iw',
}

function defaultId(table) {
  return () => `${ID_PREFIX[table]}-${crypto.randomUUID()}`
}

function rowsOf(tables, table) {
  const rows = tables[table]
  if (!Array.isArray(rows)) throw new TableRuleError('unknownTable', `Довідника «${table}» немає.`)
  return rows
}

/** A trimmed name no other row of the table already reads as — `exceptId` is the row being renamed. */
function checkedName(rows, name, exceptId) {
  const clean = typeof name === 'string' ? name.trim() : ''
  if (clean === '') throw new TableRuleError('nameRequired', 'Назва не може бути порожньою.')
  const key = nameKey(clean)
  if (rows.some((row) => row.id !== exceptId && nameKey(row.name) === key)) {
    throw new TableRuleError('nameTaken', `Назва «${clean}» уже є в цьому довіднику.`)
  }
  return clean
}

/** The value a cell of this kind may hold. The caller parses typed text first; this only guards. */
function checkedValue(kind, value) {
  if (value === null) return null
  if (kind === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    throw new TableRuleError('notANumber', 'Тут має бути число.')
  }
  if (kind === 'count') {
    if (Number.isInteger(value) && value >= 1) return value
    throw new TableRuleError('notACount', 'Тут має бути ціле число, не менше 1.')
  }
  if (kind === 'positive') {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
    throw new TableRuleError('notPositive', 'Тут має бути число, більше 0.')
  }
  if (kind === 'yesno') {
    if (typeof value === 'boolean') return value
    throw new TableRuleError('notYesNo', 'Тут можна вибрати лише «так» або «ні».')
  }
  const text = String(value).trim()
  return text === '' ? null : text
}

/**
 * A table without a name column, such as the enclosure sizes, takes no name (research R8).
 * @returns {{ tables: object, rowId: string }} the row is appended, every cell but its name empty
 */
export function addRow(tables, table, name, newId = defaultId(table)) {
  const rows = rowsOf(tables, table)
  const row = { id: newId() }
  for (const column of columns[table]) {
    row[column.key] = column.kind === 'name' ? checkedName(rows, name, null) : null
  }
  const next = produce(tables, (draft) => {
    draft[table].push(row)
  })
  return { tables: next, rowId: row.id }
}

/** `value` is already parsed — a number, a boolean, a string or null. The id is not a column. */
export function updateCell(tables, table, rowId, key, value) {
  const rows = rowsOf(tables, table)
  const column = columnOf(table, key)
  if (!column)
    throw new TableRuleError('unknownColumn', `У цьому довіднику немає колонки «${key}».`)
  const index = rows.findIndex((row) => row.id === rowId)
  if (index === -1) throw new TableRuleError('unknownRow', 'Цього рядка вже немає в довіднику.')

  const clean =
    column.kind === 'name' ? checkedName(rows, value, rowId) : checkedValue(column.kind, value)
  return produce(tables, (draft) => {
    draft[table][index][key] = clean
  })
}

export function deleteRow(tables, table, rowId) {
  const rows = rowsOf(tables, table)
  const index = rows.findIndex((row) => row.id === rowId)
  if (index === -1) throw new TableRuleError('unknownRow', 'Цього рядка вже немає в довіднику.')
  return produce(tables, (draft) => {
    draft[table].splice(index, 1)
  })
}

/** How a confirmation names a row: by its name, or an enclosure size by «12 × 2» (research R8). */
export function rowLabel(table, row) {
  if (table === 'enclosureSizes') return `${row.rowModularity ?? ''} × ${row.rowCount ?? ''}`
  return row.name
}
