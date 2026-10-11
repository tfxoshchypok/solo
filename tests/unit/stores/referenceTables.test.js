// The store both sections read the reference tables through. The tree module resolves a consumer's
// load type and zone here, and the «Довідники» section edits the same object (contracts/services.md).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { appDataDir, join } from '@/services/PathService.js'
import { LoadError } from '@/services/LoadError.js'
import {
  REFERENCE_TABLES_FILE,
  ReferenceTablesFileService,
} from '@/services/ReferenceTablesFileService.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import { TableRuleError } from '@/modules/reference/engine/tableOps.js'

let fs = null

beforeEach(() => {
  setActivePinia(createPinia())
  fs = new MemoryFs({ dataDir: '/memfs/data' })
  setFs(fs)
})

afterEach(async () => {
  await ReferenceTablesFileService.flush().catch(() => {})
  setFs(null)
})

describe('load (002/FR-007)', () => {
  it('holds the shipped tables before load() is called, so nothing waits on an empty list', () => {
    const store = useReferenceTablesStore()
    expect(store.tables).toEqual(ReferenceTablesFileService.loadBuiltin())
  })

  it('exposes the shipped tables, frozen, when nothing is stored', async () => {
    const store = useReferenceTablesStore()
    await store.load()

    expect(store.tables).toEqual(ReferenceTablesFileService.loadBuiltin())
    expect(Object.isFrozen(store.tables.loadTypes[0])).toBe(true)
    expect(Object.isFrozen(store.tables.zones)).toBe(true)
    expect(store.refusal).toBeNull()
  })

  it('resolves every row by its id', async () => {
    const store = useReferenceTablesStore()
    await store.load()

    for (const row of store.tables.loadTypes) expect(store.loadTypeById.get(row.id)).toEqual(row)
    for (const row of store.tables.zones) expect(store.zoneById.get(row.id)).toEqual(row)
    expect(store.loadTypeById.get('lt-absent')).toBeUndefined()
  })

  it('keeps the refusal of a stored file that cannot be used, next to the shipped tables', async () => {
    const dir = await appDataDir()
    await fs.ensureDir(dir)
    await fs.writeText(join(dir, REFERENCE_TABLES_FILE), '{ not json')

    const store = useReferenceTablesStore()
    await store.load()

    expect(store.tables).toEqual(ReferenceTablesFileService.loadBuiltin())
    expect(store.refusal.error).toBeInstanceOf(LoadError)
    expect(store.refusal.keptAs).toMatch(/^reference-tables\.refused-.+\.json$/)
  })
})

// Editing through the store (002/FR-004, 002/FR-007, SC-002). Each action parses the input by its
// column's kind, applies the engine and writes the whole next state at once.
async function storedFile() {
  await ReferenceTablesFileService.flush()
  const path = join(await appDataDir(), REFERENCE_TABLES_FILE)
  return (await fs.exists(path)) ? JSON.parse(await fs.readText(path)) : null
}

const byName = (rows, name) => rows.find((row) => row.name === name)

describe('edits (002/FR-004, 002/FR-007)', () => {
  it('addRow appends the row, answers its id, and writes it to disk', async () => {
    const store = useReferenceTablesStore()
    const rowId = await store.addRow('zones', 'Горище')

    expect(rowId).toMatch(/^zn-/)
    expect(store.tables.zones.at(-1)).toMatchObject({ id: rowId, name: 'Горище', leakageMa: null })
    expect((await storedFile()).zones.at(-1)).toEqual(store.tables.zones.at(-1))
  })

  it('updateCell parses the input by the column’s kind before storing it', async () => {
    const store = useReferenceTablesStore()
    const kitchen = byName(store.tables.loadTypes, 'Розетки кухні (робоча зона)')

    await store.updateCell('loadTypes', kitchen.id, 'demandFactor', '0,5')
    await store.updateCell('loadTypes', kitchen.id, 'phases', '  1ф або 2ф ')
    await store.updateCell('loadTypes', kitchen.id, 'rcdType', '')
    await store.updateCell('loadTypes', kitchen.id, 'continuous', true)

    const row = store.loadTypeById.get(kitchen.id)
    expect(row).toMatchObject({
      demandFactor: 0.5,
      phases: '1ф або 2ф',
      rcdType: null,
      continuous: true,
    })
    expect(byName((await storedFile()).loadTypes, 'Розетки кухні (робоча зона)')).toEqual(row)
  })

  it('deleteRow removes the row from the tables and from disk', async () => {
    const store = useReferenceTablesStore()
    const ups = byName(store.tables.zones, 'Лінія гарантованого живлення')

    await store.deleteRow('zones', ups.id)

    expect(store.zoneById.has(ups.id)).toBe(false)
    expect((await storedFile()).zones.map((row) => row.id)).not.toContain(ups.id)
  })

  it('leaves the tables and the disk alone when an edit is refused', async () => {
    const store = useReferenceTablesStore()
    const before = store.tables
    const kitchen = byName(store.tables.zones, 'Кухня')

    await expect(store.updateCell('zones', kitchen.id, 'name', '')).rejects.toBeInstanceOf(
      TableRuleError,
    )
    await expect(store.updateCell('zones', kitchen.id, 'leakageMa', 'abc')).rejects.toBeInstanceOf(
      TableRuleError,
    )
    await expect(store.addRow('zones', 'кухня')).rejects.toBeInstanceOf(TableRuleError)

    expect(store.tables).toBe(before)
    expect(await storedFile()).toBeNull()
  })

  it('finds every edit again after a restart (SC-002)', async () => {
    const first = useReferenceTablesStore()
    const kitchen = byName(first.tables.loadTypes, 'Розетки кухні (робоча зона)')
    const ups = byName(first.tables.zones, 'Лінія гарантованого живлення')
    await first.updateCell('loadTypes', kitchen.id, 'demandFactor', '0,5')
    const rowId = await first.addRow('loadTypes', 'Інфрачервоний обігрівач')
    await first.deleteRow('zones', ups.id)
    await ReferenceTablesFileService.flush()

    setActivePinia(createPinia())
    const second = useReferenceTablesStore()
    await second.load()

    expect(second.tables).toEqual(first.tables)
    expect(second.loadTypeById.get(kitchen.id).demandFactor).toBe(0.5)
    expect(second.loadTypeById.get(rowId).name).toBe('Інфрачервоний обігрівач')
    expect(second.zoneById.has(ups.id)).toBe(false)
  })
})
