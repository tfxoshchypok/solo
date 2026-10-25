// The reference tables on disk: one JSON file per installation (002/FR-007,
// contracts/reference-tables-file.md).
//
// Two rules shape everything here. A stored file is accepted whole or refused whole: a refusal moves
// the file aside, untouched, and the tables as shipped stand in for it, so the user can repair it by
// hand and nothing is lost. And every accepted edit is written at once, through `<path>.tmp` moved
// onto the target, one write after another — two quick edits never race on the same temporary file,
// and the file always ends as the last state saved (research R4, R5).
import * as v from 'valibot'
import { freeze } from 'immer'
import builtinTables from '@/data/referenceTables.builtin.json'
import {
  NAMED_TABLES,
  REFERENCE_TABLES,
  ReferenceTablesSchema,
  findDuplicateName,
  formatIssuePath,
} from '@/schemas/index.js'
import { getFs } from './fs/index.js'
import { LoadError } from './LoadError.js'
import { appDataDir, join, tmpPath } from './PathService.js'

export const REFERENCE_TABLES_FILE = 'reference-tables.json'
export const REFERENCE_TABLES_VERSION = 1

/** The runtime shape: every table, without the file's `schemaVersion` (data-model.md). */
function tablesOf(file) {
  return Object.fromEntries(REFERENCE_TABLES.map((table) => [table, file[table]]))
}

function serialize(tables) {
  const file = { schemaVersion: REFERENCE_TABLES_VERSION, ...tablesOf(tables) }
  return `${JSON.stringify(file, null, 2)}\n`
}

async function storedPath() {
  return join(await appDataDir(), REFERENCE_TABLES_FILE)
}

/** `reference-tables.refused-2026-09-26T10-14-03-221Z.json` — the name carries no `:` for Windows. */
function keptName(now) {
  return `reference-tables.refused-${new Date(now).toISOString().replace(/[:.]/g, '-')}.json`
}

function refuse(details) {
  throw new LoadError(details)
}

// ---------------------------------------------------------------- load stages

async function readStored(fs, path) {
  try {
    return await fs.readText(path)
  } catch (cause) {
    return refuse({ path: '', message: `файл не читається (${cause.message})`, cause })
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch (cause) {
    return refuse({ path: '', message: 'файл не є JSON', cause })
  }
}

function checkVersion(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    refuse({ path: '', expected: 'object', received: typeof raw, message: 'файл не є довідниками' })
  }
  if (raw.schemaVersion !== REFERENCE_TABLES_VERSION) {
    refuse({
      path: 'schemaVersion',
      expected: REFERENCE_TABLES_VERSION,
      received: raw.schemaVersion,
      message: `schemaVersion: файл записаний у версії ${raw.schemaVersion}, а ця збірка читає версію ${REFERENCE_TABLES_VERSION}`,
    })
  }
}

function checkFields(raw) {
  const result = v.safeParse(ReferenceTablesSchema, raw)
  if (result.success) return result.output
  const issue = result.issues[0]
  const path = formatIssuePath(issue)
  return refuse({
    path,
    expected: issue.expected,
    received: issue.received,
    message: `${path}: очікується ${issue.expected}, отримано ${issue.received}`,
  })
}

/** Ids and names, each unique within its own table; the second occurrence is the one named. */
function checkUnique(file) {
  for (const table of REFERENCE_TABLES) {
    const rows = file[table]
    const ids = new Set()
    rows.forEach((row, i) => {
      if (ids.has(row.id)) {
        refuse({
          path: `${table}[${i}].id`,
          message: `${table}[${i}].id: ідентифікатор повторюється`,
        })
      }
      ids.add(row.id)
    })
    if (!NAMED_TABLES.includes(table)) continue
    const duplicate = findDuplicateName(rows)
    if (duplicate !== -1) {
      const path = `${table}[${duplicate}].name`
      refuse({ path, message: `${path}: назва повторюється` })
    }
  }
}

/** @returns {Promise<string|null>} the kept copy's file name, or null if the move itself failed */
async function moveAside(fs, path, now) {
  const kept = keptName(now)
  try {
    await fs.move(path, join(await appDataDir(), kept))
    return kept
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- writes

/** The tail of the write chain. A failed write is caught here, so it never blocks the next one. */
let queue = Promise.resolve()

async function write(tables) {
  const fs = getFs()
  const dir = await appDataDir()
  const path = join(dir, REFERENCE_TABLES_FILE)
  const tmp = tmpPath(path)
  await fs.ensureDir(dir)
  await fs.writeText(tmp, serialize(tables))
  await fs.move(tmp, path)
}

/** @returns {{ loadTypes: object[], zones: object[] }} the bundled tables, frozen all the way down */
function loadBuiltin() {
  return freeze(tablesOf(builtinTables), true)
}

export const ReferenceTablesFileService = {
  loadBuiltin,

  /**
   * The tables the application starts with. No stored file is not a refusal: it is a fresh install.
   * @param {{ now?: number }} [options] the clock the kept copy's name is stamped with
   * @returns {Promise<{ tables: object, source: 'builtin'|'stored', refusal?: { error: LoadError, keptAs: string|null } }>}
   */
  async load({ now = Date.now() } = {}) {
    const fs = getFs()
    const path = await storedPath()
    if (!(await fs.exists(path))) return { tables: loadBuiltin(), source: 'builtin' }

    try {
      const raw = parseJson(await readStored(fs, path))
      checkVersion(raw)
      const file = checkFields(raw)
      checkUnique(file)
      return { tables: freeze(tablesOf(file), true), source: 'stored' }
    } catch (error) {
      if (!(error instanceof LoadError)) throw error
      const keptAs = await moveAside(fs, path, now)
      return { tables: loadBuiltin(), source: 'builtin', refusal: { error, keptAs } }
    }
  },

  /**
   * Writes the whole next state after the previous write has finished.
   * @returns {Promise<void>} rejects when this write fails; the chain carries on regardless
   */
  save(tables) {
    const run = queue.then(() => write(tables))
    queue = run.catch(() => {})
    return run
  },

  /** @returns {Promise<void>} resolves once no write is pending — the window-close path awaits it */
  flush() {
    return queue
  },
}
