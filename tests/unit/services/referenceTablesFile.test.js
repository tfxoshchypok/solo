// The reference tables on disk: one JSON file per installation, read once at startup and rewritten
// after every accepted edit (002/FR-007, contracts/reference-tables-file.md). A file that cannot be
// used is refused whole, moved out of the way, and the shipped tables stand in for it.
//
// Everything runs over `MemoryFs`, so no test touches a real path.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setFs, MemoryFs, FsError } from '@/services/fs/index.js'
import { appDataDir, join, tmpPath } from '@/services/PathService.js'
import { LoadError } from '@/services/LoadError.js'
import {
  REFERENCE_TABLES_FILE,
  REFERENCE_TABLES_VERSION,
  ReferenceTablesFileService,
} from '@/services/ReferenceTablesFileService.js'

/** 2026-09-26 10:14:03.221 UTC — the clock a refusal stamps the kept copy with. */
const NOW = Date.UTC(2026, 8, 26, 10, 14, 3, 221)
const KEPT_AS = 'reference-tables.refused-2026-09-26T10-14-03-221Z.json'

/** MemoryFs with the knobs these tests need: a call log, a write gate, failures on demand. */
class TestFs extends MemoryFs {
  constructor(options) {
    super(options)
    this.calls = []
    this.gate = null
    this.failWrites = 0
    this.unreadable = new Set()
  }

  /** Holds every write until the returned function is called. */
  hold() {
    let release
    this.gate = new Promise((resolve) => (release = resolve))
    return () => {
      this.gate = null
      release()
    }
  }

  async readText(path) {
    if (this.unreadable.has(path)) {
      throw new FsError({ code: 'READ', path, message: `Немає доступу до ${path}.` })
    }
    return super.readText(path)
  }

  async writeText(path, text) {
    this.calls.push(['writeText', path])
    if (this.gate) await this.gate
    if (this.failWrites > 0) {
      this.failWrites -= 1
      throw new FsError({ code: 'WRITE', path, message: 'Диск заповнений.' })
    }
    return super.writeText(path, text)
  }

  async move(from, to) {
    this.calls.push(['move', from, to])
    return super.move(from, to)
  }

  async ensureDir(path) {
    this.calls.push(['ensureDir', path])
    return super.ensureDir(path)
  }
}

let fs = null
let dir = ''
let stored = ''

/** A mutable copy of the shipped tables — frozen objects clone into plain ones. */
function shipped() {
  return structuredClone(ReferenceTablesFileService.loadBuiltin())
}

async function writeStored(content) {
  await fs.ensureDir(dir)
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  await fs.writeText(stored, text)
  fs.calls = []
  return text
}

async function readStored() {
  return JSON.parse(await fs.readText(stored))
}

beforeEach(async () => {
  fs = new TestFs({ dataDir: '/memfs/data' })
  setFs(fs)
  dir = await appDataDir()
  stored = join(dir, REFERENCE_TABLES_FILE)
})

afterEach(async () => {
  await ReferenceTablesFileService.flush().catch(() => {})
  setFs(null)
})

describe('loadBuiltin — the tables as shipped (002/FR-002)', () => {
  it('hands out both tables, frozen all the way down', () => {
    const tables = ReferenceTablesFileService.loadBuiltin()
    expect(tables.loadTypes.length).toBeGreaterThan(0)
    expect(tables.zones.length).toBeGreaterThan(0)
    expect(Object.isFrozen(tables.loadTypes)).toBe(true)
    expect(Object.isFrozen(tables.zones[0])).toBe(true)
  })
})

describe('load — what the application starts with (002/FR-002, 002/FR-007)', () => {
  it('answers the shipped tables when nothing is stored, without a refusal', async () => {
    const result = await ReferenceTablesFileService.load({ now: NOW })

    expect(result.source).toBe('builtin')
    expect(result.refusal).toBeUndefined()
    expect(result.tables).toEqual(ReferenceTablesFileService.loadBuiltin())
    expect(fs.files.has(stored)).toBe(false)
  })

  it('answers the stored tables when the file is valid', async () => {
    const edited = shipped()
    edited.zones[0].name = 'Спальні та вітальні'
    edited.loadTypes[0].demandFactor = 0.5
    await writeStored({ schemaVersion: REFERENCE_TABLES_VERSION, ...edited })

    const result = await ReferenceTablesFileService.load({ now: NOW })

    expect(result.source).toBe('stored')
    expect(result.refusal).toBeUndefined()
    expect(result.tables).toEqual(edited)
  })
})

describe('load — a stored file that cannot be used is refused whole (002/FR-007)', () => {
  /** Each case breaks one thing in an otherwise valid file. */
  const cases = [
    {
      title: 'a file that cannot be read',
      path: '',
      setup: async () => {
        const text = await writeStored({ schemaVersion: 1, ...shipped() })
        fs.unreadable.add(stored)
        return text
      },
    },
    {
      title: 'text that is not JSON',
      path: '',
      setup: () => writeStored('{ "schemaVersion": 1, "loadTypes": ['),
    },
    {
      title: 'another schemaVersion',
      path: 'schemaVersion',
      setup: () => writeStored({ schemaVersion: 2, ...shipped() }),
    },
    {
      title: 'text in a number column',
      path: 'loadTypes[3].powerFactor',
      setup: () => {
        const tables = shipped()
        tables.loadTypes[3].powerFactor = '0.95'
        return writeStored({ schemaVersion: 1, ...tables })
      },
    },
    {
      title: 'a name that repeats another row’s name',
      path: 'zones[5].name',
      setup: () => {
        const tables = shipped()
        tables.zones[5].name = tables.zones[1].name.toLowerCase()
        return writeStored({ schemaVersion: 1, ...tables })
      },
    },
    {
      title: 'an id that repeats another row’s id',
      path: 'loadTypes[7].id',
      setup: () => {
        const tables = shipped()
        tables.loadTypes[7].id = tables.loadTypes[2].id
        return writeStored({ schemaVersion: 1, ...tables })
      },
    },
    {
      title: 'a feature 002 file, which lacks the three new tables (003/FR-018, research R9)',
      path: 'enclosureSizes',
      setup: () => {
        const { loadTypes, zones } = shipped()
        return writeStored({ schemaVersion: 1, loadTypes, zones })
      },
    },
    {
      title: 'a device width named as another row (003/FR-018)',
      path: 'deviceWidths[3].name',
      setup: () => {
        const tables = shipped()
        tables.deviceWidths[3].name = tables.deviceWidths[1].name.toLowerCase()
        return writeStored({ schemaVersion: 1, ...tables })
      },
    },
    {
      title: 'an enclosure size with another row’s id (003/FR-018)',
      path: 'enclosureSizes[9].id',
      setup: () => {
        const tables = shipped()
        tables.enclosureSizes[9].id = tables.enclosureSizes[4].id
        return writeStored({ schemaVersion: 1, ...tables })
      },
    },
  ]

  for (const { title, path, setup } of cases) {
    it(`refuses ${title}, naming "${path}"`, async () => {
      await setup()

      const result = await ReferenceTablesFileService.load({ now: NOW })

      expect(result.source).toBe('builtin')
      expect(result.tables).toEqual(ReferenceTablesFileService.loadBuiltin())
      expect(result.refusal.error).toBeInstanceOf(LoadError)
      expect(result.refusal.error.path).toBe(path)
      if (path) expect(result.refusal.error.message).toContain(path)
      expect(result.refusal.keptAs).toBe(KEPT_AS)
    })

    it(`moves the file with ${title} aside, content intact`, async () => {
      const text = await setup()

      await ReferenceTablesFileService.load({ now: NOW })

      expect(fs.files.has(stored)).toBe(false)
      expect(await fs.readText(join(dir, KEPT_AS))).toBe(text)
    })
  }

  it('lets the next save write a clean file without touching the kept copy', async () => {
    const text = await writeStored({ schemaVersion: 2, ...shipped() })
    const { tables } = await ReferenceTablesFileService.load({ now: NOW })

    await ReferenceTablesFileService.save(tables)

    expect(await readStored()).toEqual({ schemaVersion: REFERENCE_TABLES_VERSION, ...tables })
    expect(await fs.readText(join(dir, KEPT_AS))).toBe(text)
  })
})

describe('save — every accepted edit, at once (002/FR-007, research R4)', () => {
  it('creates the data directory and writes through a .tmp file moved into place', async () => {
    await ReferenceTablesFileService.save(shipped())

    expect(fs.calls).toEqual([
      ['ensureDir', dir],
      ['writeText', tmpPath(stored)],
      ['move', tmpPath(stored), stored],
    ])
    expect(await readStored()).toEqual({ schemaVersion: REFERENCE_TABLES_VERSION, ...shipped() })
  })

  it('leaves the second of two saves on disk when neither was awaited', async () => {
    const first = shipped()
    first.zones[0].name = 'Перший стан'
    const second = shipped()
    second.zones[0].name = 'Другий стан'

    await Promise.all([
      ReferenceTablesFileService.save(first),
      ReferenceTablesFileService.save(second),
    ])

    expect((await readStored()).zones[0].name).toBe('Другий стан')
    expect(fs.files.has(tmpPath(stored))).toBe(false)
  })

  it('flush resolves only once the pending write is on disk', async () => {
    const release = fs.hold()
    const saving = ReferenceTablesFileService.save(shipped())
    let flushed = false
    const flushing = ReferenceTablesFileService.flush().then(() => {
      flushed = true
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(flushed).toBe(false)

    release()
    await Promise.all([saving, flushing])
    expect(flushed).toBe(true)
    expect(fs.files.has(stored)).toBe(true)
  })

  it('flush resolves at once when nothing is pending', async () => {
    await expect(ReferenceTablesFileService.flush()).resolves.toBeUndefined()
  })

  it('rejects a failed write, and the next save still lands', async () => {
    fs.failWrites = 1
    const failed = shipped()
    failed.zones[0].name = 'Не записано'
    const next = shipped()
    next.zones[0].name = 'Записано'

    await expect(ReferenceTablesFileService.save(failed)).rejects.toBeInstanceOf(FsError)
    await ReferenceTablesFileService.save(next)

    expect((await readStored()).zones[0].name).toBe('Записано')
  })
})

describe('the stored set holds all five tables (003/FR-018)', () => {
  const FIVE = ['loadTypes', 'zones', 'enclosureSizes', 'deviceWidths', 'incomingDevices']

  it('loads a stored file with all five tables', async () => {
    const edited = shipped()
    edited.enclosureSizes[0].rowCount = 2
    edited.deviceWidths[0].widthModules = 1.5
    edited.incomingDevices[2].width1ph = 5
    await writeStored({ schemaVersion: REFERENCE_TABLES_VERSION, ...edited })

    const result = await ReferenceTablesFileService.load({ now: NOW })

    expect(result.source).toBe('stored')
    expect(result.refusal).toBeUndefined()
    expect(Object.keys(result.tables).sort()).toEqual([...FIVE].sort())
    expect(result.tables).toEqual(edited)
  })

  it('accepts two enclosure sizes of equal values, which have no name to repeat (research R8)', async () => {
    const tables = shipped()
    tables.enclosureSizes[2] = { ...tables.enclosureSizes[1] }
    tables.enclosureSizes[2].id = 'es-00000000-0000-4000-8000-000000000002'
    expect(tables.enclosureSizes[1]).toMatchObject({ rowModularity: 12, rowCount: 2 })
    expect(tables.enclosureSizes[2]).toMatchObject({ rowModularity: 12, rowCount: 2 })
    await writeStored({ schemaVersion: REFERENCE_TABLES_VERSION, ...tables })

    const result = await ReferenceTablesFileService.load({ now: NOW })

    expect(result.source).toBe('stored')
    expect(result.tables).toEqual(tables)
  })

  it('writes all five arrays on save', async () => {
    await ReferenceTablesFileService.save(shipped())

    const file = await readStored()
    expect(Object.keys(file).sort()).toEqual(['schemaVersion', ...FIVE].sort())
    for (const table of FIVE) expect(file[table], table).toEqual(shipped()[table])
  })
})
