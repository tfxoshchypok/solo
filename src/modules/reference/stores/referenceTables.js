// The reference tables as both sections see them. The tree finds the row a user picks for a consumer
// through `loadTypeById` / `zoneById` and copies it; a consumer is never shown through these maps
// (002/FR-010). The «Довідники» section edits the same object (contracts/services.md). The tables are
// frozen: an edit replaces them whole, never patches them.
//
// Every edit has the same three beats: parse the input by its column's kind, apply the engine, then
// write the whole next state. A `TableRuleError` escapes before the assignment, so a refused edit
// leaves both the tables and the disk exactly as they were (002/FR-005, 002/FR-006).
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { ReferenceTablesFileService } from '@/services/ReferenceTablesFileService.js'
import { columnOf } from '../config/columns.js'
import { parseCell } from '../engine/cells.js'
import {
  addRow as addRowTo,
  deleteRow as deleteRowFrom,
  updateCell as updateCellIn,
} from '../engine/tableOps.js'

function byId(rows) {
  return new Map(rows.map((row) => [row.id, row]))
}

export const useReferenceTablesStore = defineStore('referenceTables', () => {
  /** The shipped tables until `load()` answers, so a picker never opens on an empty list. */
  const tables = shallowRef(ReferenceTablesFileService.loadBuiltin())

  /** The startup refusal of a stored file — `{ error, keptAs }` — or null (002/FR-007). */
  const refusal = shallowRef(null)

  const loadTypeById = computed(() => byId(tables.value.loadTypes))
  const zoneById = computed(() => byId(tables.value.zones))

  /** Reads the stored file once, at startup. A refused file is kept here for the shell to report. */
  async function load() {
    const result = await ReferenceTablesFileService.load()
    tables.value = result.tables
    refusal.value = result.refusal ?? null
  }

  /** Rejects with the write's error when the disk refuses; the in-memory edit stays (research R4). */
  function persist(next) {
    tables.value = next
    return ReferenceTablesFileService.save(next)
  }

  /** @returns {Promise<string>} the new row's id */
  async function addRow(table, name) {
    const { tables: next, rowId } = addRowTo(tables.value, table, name)
    await persist(next)
    return rowId
  }

  /** @param {string|boolean|number|null} input typed text, or the value a select already chose */
  async function updateCell(table, rowId, key, input) {
    const value = parseCell(columnOf(table, key)?.kind, input)
    await persist(updateCellIn(tables.value, table, rowId, key, value))
  }

  async function deleteRow(table, rowId) {
    await persist(deleteRowFrom(tables.value, table, rowId))
  }

  return { tables, refusal, loadTypeById, zoneById, load, addRow, updateCell, deleteRow }
})
