// The file layer: a round trip has to reproduce the tree exactly, and a broken file has to be
// refused whole with the failing element named (FR-035, FR-036, SC-005).
//
// Everything here runs over `MemoryFs`, so no test opens a dialog or touches a real path.
import process from 'node:process'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { LoadError } from '@/services/LoadError.js'
import { SCHEMA_VERSION } from '@/schemas/index.js'
import {
  AUTOSAVE_DELAY_MS,
  ProjectFileService,
  denormalize,
  normalize,
} from '@/services/ProjectFileService.js'
import builtin from '@/data/referenceTables.builtin.json'
import {
  tree,
  consumer,
  loadTypeRow,
  zoneRow,
  incomingDeviceRow,
  emptyProjectProperties,
} from '../../fixtures/tree.js'
import { GatedFs, isSidecar } from '../../fixtures/gatedFs.js'

const PATH = '/home/user/квартира.eltree.json'
const META = { name: 'Квартира на Лесі Українки' }

const fridge = loadTypeRow({
  id: 'lt-fridge',
  name: 'Холодильник',
  ratedPowerKw: 0.25,
  continuous: true,
})
const kitchen = zoneRow({ id: 'zn-kitchen', name: 'Кухня', rcdRequired: true, leakageMa: 30 })

/** Entry → one panel → one consumer: the smallest tree that exercises all three kinds. */
function sample() {
  return tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [
      {
        id: 'kitchen',
        kind: 'panel',
        name: 'Кухня',
        note: 'щиток у коридорі',
        children: [
          consumer('fridge-node', {
            name: 'Холодильник',
            loadType: fridge,
            zone: kitchen,
            cableSectionMm2: 2.5,
          }),
        ],
      },
    ],
  })
}

/** Records the write path, so a test can assert the `.tmp` → `move` sequence (FR-031). */
class RecordingFs extends MemoryFs {
  constructor(options) {
    super(options)
    this.calls = []
  }

  async writeText(path, text) {
    this.calls.push(['writeText', path])
    return super.writeText(path, text)
  }

  async move(from, to) {
    this.calls.push(['move', from, to])
    return super.move(from, to)
  }

  async remove(path) {
    this.calls.push(['remove', path])
    return super.remove(path)
  }
}

let fs = null

beforeEach(() => {
  fs = new RecordingFs({ dataDir: '/memfs/data' })
  setFs(fs)
})

afterEach(() => {
  ProjectFileService.cancelAutosave()
  setFs(null)
  vi.useRealTimers()
})

/** Writes a valid project file, optionally broken by `mutate` before it lands on disk. */
async function writeProject(path = PATH, mutate = (project) => project) {
  const project = mutate(denormalize(sample(), META))
  await fs.writeText(path, JSON.stringify(project, null, 2))
  return project
}

// The keys of a consumer in the file, and no more (002/FR-016, SC-006, 003/FR-020).
const CONSUMER_KEYS = [
  'cableSectionMm2',
  'calculated',
  'childIds',
  'id',
  'kind',
  'loadType',
  'name',
  'parentId',
  'zone',
]

/** Three consumers: a cable section, an empty one with a hand-edited copy, a row no table holds. */
function threeConsumers() {
  return tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [
      {
        id: 'kitchen',
        kind: 'panel',
        name: 'Кухня',
        children: [
          consumer('c-fridge', {
            name: 'Холодильник',
            loadType: fridge,
            zone: kitchen,
            cableSectionMm2: 2.5,
          }),
          consumer('c-oven', {
            name: 'Духова шафа',
            loadType: loadTypeRow({
              id: 'lt-oven',
              name: 'Духова шафа',
              ratedPowerKw: 3,
              demandFactor: 0.95,
            }),
            zone: kitchen,
          }),
          consumer('c-gone', {
            name: 'Інфрачервоний обігрівач',
            loadType: loadTypeRow({
              id: 'lt-from-another-installation',
              name: 'Інфрачервоний обігрівач',
            }),
            zone: zoneRow({ id: 'zn-terrace', name: 'Тераса', leakageMa: null, minIp: 'IP44' }),
          }),
        ],
      },
    ],
  })
}

describe('a round trip reproduces the tree (FR-035, SC-005)', () => {
  it('reproduces three consumers exactly, copies, empty cells and an empty cable section included (002/FR-016, 002/FR-019)', async () => {
    const before = threeConsumers()

    await ProjectFileService.save(denormalize(before, META), PATH)
    const { project } = await ProjectFileService.load(PATH)

    expect(normalize(project).nodes).toEqual(before.nodes)
    const written = JSON.parse(await fs.readText(PATH))
    const consumers = written.nodes.filter((node) => node.kind === 'consumer')
    expect(consumers).toHaveLength(3)
    for (const node of consumers) {
      expect(Object.keys(node).sort(), node.id).toEqual(CONSUMER_KEYS)
    }
    const oven = consumers.find((node) => node.id === 'c-oven')
    expect(oven).toHaveProperty('cableSectionMm2', null)
    expect(oven.loadType.demandFactor).toBe(0.95)
    const gone = consumers.find((node) => node.id === 'c-gone')
    expect(gone.zone).toHaveProperty('leakageMa', null)
    expect(gone.loadType.id).toBe('lt-from-another-installation')
  })

  it('returns the same nodes, names, notes and consumer fields it was given (002/FR-019)', async () => {
    const before = sample()

    await ProjectFileService.save(denormalize(before, META), PATH)
    const { project } = await ProjectFileService.load(PATH)
    const after = normalize(project)

    expect(after.rootId).toBe(before.rootId)
    expect(after.nodes).toEqual(before.nodes)
    expect(after.nodes['fridge-node'].cableSectionMm2).toBe(2.5)
    expect(after.nodes.kitchen.note).toBe('щиток у коридорі')
  })

  it('denormalizes into a flat array in depth-first order, never a keyed object', async () => {
    const file = denormalize(sample(), META)

    expect(Array.isArray(file.nodes)).toBe(true)
    expect(file.nodes.map((node) => node.id)).toEqual(['root', 'kitchen', 'fridge-node'])
    expect(file.schemaVersion).toBe(SCHEMA_VERSION)
    expect(file).not.toHaveProperty('catalogVersion')
  })

  it('writes through a .tmp and moves it onto the target, so a crash cannot truncate it (FR-031)', async () => {
    await ProjectFileService.save(denormalize(sample(), META), PATH)

    expect(fs.calls).toEqual([
      ['writeText', `${PATH}.tmp`],
      ['move', `${PATH}.tmp`, PATH],
    ])
    expect(await fs.exists(`${PATH}.tmp`)).toBe(false)
  })

  it('rewrites modifiedAt on every save and keeps createdAt', async () => {
    const first = await ProjectFileService.save(denormalize(sample(), META), PATH)
    const second = await ProjectFileService.save({ ...first, modifiedAt: first.modifiedAt }, PATH, {
      createdAt: first.createdAt,
    })

    expect(second.createdAt).toBe(first.createdAt)
    expect(Date.parse(second.modifiedAt)).toBeGreaterThanOrEqual(Date.parse(first.createdAt))
  })
})

describe('load refuses a broken file whole and names the element (FR-036)', () => {
  it('refuses unparseable JSON with the parser talking', async () => {
    await fs.writeText(PATH, '{"schemaVersion": 1, "nodes": [')

    await expect(ProjectFileService.load(PATH)).rejects.toBeInstanceOf(LoadError)
  })

  it('names the failing field the way FR-036 asks: nodes[2].cableSectionMm2', async () => {
    await writeProject(PATH, (project) => {
      project.nodes[2].cableSectionMm2 = '2.5'
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error).toBeInstanceOf(LoadError)
    expect(error.path).toBe('nodes[2].cableSectionMm2')
    expect(error.message).toContain('nodes[2].cableSectionMm2')
    expect(error.received).toBeTruthy()
  })

  it('refuses a schemaVersion it does not know rather than guessing', async () => {
    await writeProject(PATH, (project) => ({ ...project, schemaVersion: 99 }))

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error).toBeInstanceOf(LoadError)
    expect(error.path).toBe('schemaVersion')
    expect(error.received).toBe(99)
  })

  it('refuses a consumer with no zone, which the zone being required forbids (002/FR-010)', async () => {
    await writeProject(PATH, (project) => {
      delete project.nodes[2].zone
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error.path).toBe('nodes[2].zone')
  })

  it('refuses a copied value its column would refuse, naming it (002/FR-010)', async () => {
    await writeProject(PATH, (project) => {
      // A new copy, not an assignment into it: the copy is the module's shared `fridge` row.
      project.nodes[2].loadType = { ...project.nodes[2].loadType, powerFactor: '0.95' }
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error).toBeInstanceOf(LoadError)
    expect(error.path).toBe('nodes[2].loadType.powerFactor')
  })
})

describe('structural validation beyond the schema (contracts/project-file.md)', () => {
  it('refuses a parentId that resolves to nothing', async () => {
    await writeProject(PATH, (project) => {
      project.nodes[1].parentId = 'n-ghost'
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error).toBeInstanceOf(LoadError)
    expect(error.path).toBe('nodes[1].parentId')
  })

  it('refuses a childIds entry that resolves to nothing', async () => {
    await writeProject(PATH, (project) => {
      project.nodes[1].childIds = [...project.nodes[1].childIds, 'n-ghost']
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error.path).toContain('nodes[1].childIds')
  })

  it('refuses parentId and childIds that disagree with each other', async () => {
    await writeProject(PATH, (project) => {
      project.nodes[1].childIds = []
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error).toBeInstanceOf(LoadError)
    expect(error.path).toBe('nodes[2].parentId')
  })

  it('refuses a childrenKind that contradicts the children actually present', async () => {
    await writeProject(PATH, (project) => {
      project.nodes[1].childrenKind = 'panels'
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error.path).toBe('nodes[1].childrenKind')
  })

  it('refuses a second root', async () => {
    await writeProject(PATH, (project) => {
      project.nodes.push({
        id: 'root-2',
        kind: 'entry',
        name: 'Другий ввід',
        parentId: null,
        childIds: [],
        childrenKind: 'undecided',
        projectProperties: emptyProjectProperties(),
      })
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error).toBeInstanceOf(LoadError)
    expect(error.message).toContain('root-2')
  })

  it('refuses a rootId that names a node which is not the entry', async () => {
    await writeProject(PATH, (project) => ({ ...project, rootId: 'kitchen' }))

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error.path).toBe('rootId')
  })

  it('refuses a cycle instead of walking it forever', async () => {
    await writeProject(PATH, (project) => {
      // kitchen becomes its own grandparent: root no longer reaches it, and the climb loops.
      project.nodes[0].childIds = []
      project.nodes[1].parentId = 'fridge-node'
      project.nodes[2].childIds = ['kitchen']
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error).toBeInstanceOf(LoadError)
  })

  it('opens copies of rows the local tables lack, or hold with other values, as the file has them (002/FR-018)', async () => {
    const localKitchen = builtin.zones.find((row) => row.name === 'Кухня')
    const fromFile = {
      loadType: loadTypeRow({
        id: 'lt-from-another-installation',
        name: 'Холодильник із морозилкою',
        ratedPowerKw: 0.4,
      }),
      zone: { ...localKitchen, leakageMa: 10, minIp: 'IP44' },
    }
    await writeProject(PATH, (project) => {
      Object.assign(project.nodes[2], fromFile)
      return project
    })

    const { project } = await ProjectFileService.load(PATH)
    expect(project.nodes[2].loadType).toEqual(fromFile.loadType)
    expect(project.nodes[2].zone).toEqual(fromFile.zone)
    expect(project.nodes[2].zone.leakageMa).not.toBe(localKitchen.leakageMa)
    expect(project.nodes[2].name).toBe('Холодильник')
  })
})

describe('the file keeps the project properties, the panel keys and the calculated fields (003/FR-019, 003/FR-020, 003/FR-009, 003/SC-004)', () => {
  const relay = incomingDeviceRow({ id: 'iw-relay', name: 'Реле напруги' })
  const ups = incomingDeviceRow({ id: 'iw-ups', name: 'Блок АВР', width1ph: 3, width3ph: 5 })
  const meter = incomingDeviceRow({ id: 'iw-meter', name: 'Лічильник', width1ph: 6, width3ph: 8 })

  /** Entry → main panel → sub-panel → consumers, each 003 key partly set and partly empty. */
  function propertiesProject() {
    return tree({
      id: 'root',
      kind: 'entry',
      name: 'Ввід',
      projectProperties: { supplyPhases: 3, moduleReservePct: 20, separateRcdMode: 'rcbo' },
      children: [
        {
          id: 'main',
          kind: 'panel',
          name: 'Головний',
          overrides: { moduleReservePct: 40, neutralBreak: true },
          incomingDevices: [
            { ...relay, install: true },
            { ...ups, install: false },
            { ...meter, install: false },
          ],
          buySeparately: { combBusbars: true, blankingPlates: true },
          children: [
            {
              id: 'garage',
              kind: 'panel',
              name: 'Гараж',
              children: [
                consumer('gate', { name: 'Ворота', loadType: fridge, zone: kitchen }),
                consumer('lamp', { name: 'Світильник', zone: kitchen }),
              ],
            },
          ],
        },
      ],
    })
  }

  it('reopens every node with every field deep-equal, the empty ones included', async () => {
    const before = propertiesProject()

    await ProjectFileService.save(denormalize(before, META), PATH)
    const { project } = await ProjectFileService.load(PATH)

    expect(normalize(project).nodes).toEqual(before.nodes)
    const written = JSON.parse(await fs.readText(PATH))
    expect(written.nodes[0].projectProperties).toHaveProperty('maxLinesPerGroupRcd', null)
    expect(written.nodes[1].overrides).toHaveProperty('separateRcdMode', null)
    expect(written.nodes[1].calculated).toHaveProperty('enclosure', null)
    expect(written.nodes[3].calculated).toEqual({ groupRcd: null, phase: null })
  })

  it('opens a panel’s copy as the file has it, whatever the local table holds', async () => {
    const localMeter = builtin.incomingDevices.find((row) => row.name === 'Лічильник')
    const copy = [
      { ...ups, install: true },
      { ...localMeter, width1ph: 5, width3ph: 7, install: true },
    ]
    await writeProject(PATH, (project) => {
      project.nodes[1].incomingDevices = copy
      return project
    })

    const { project } = await ProjectFileService.load(PATH)
    expect(project.nodes[1].incomingDevices).toEqual(copy)
    expect(project.nodes[1].incomingDevices[1].width1ph).not.toBe(localMeter.width1ph)
  })

  it('refuses a file whose entry has no project properties, naming the key', async () => {
    await writeProject(PATH, (project) => {
      delete project.nodes[0].projectProperties
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error).toBeInstanceOf(LoadError)
    expect(error.path).toBe('nodes[0].projectProperties')
  })
})

describe('autosave sidecar (FR-031, R2)', () => {
  it('writes nothing until the debounce window has passed, then writes once', async () => {
    vi.useFakeTimers()
    const sidecar = `${PATH}.autosave.json`

    ProjectFileService.scheduleAutosave(denormalize(sample(), META), PATH)
    ProjectFileService.scheduleAutosave(denormalize(sample(), META), PATH)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1)
    expect(await fs.exists(sidecar)).toBe(false)

    vi.advanceTimersByTime(1)
    await ProjectFileService.autosaveSettled()
    expect(await fs.exists(sidecar)).toBe(true)
  })

  it('puts the sidecar of a never-saved project in the application data directory', async () => {
    await ProjectFileService.scheduleAutosave(denormalize(sample(), META), null)
    const sidecarPath = await ProjectFileService.flushAutosave()

    expect(sidecarPath.startsWith('/memfs/data/')).toBe(true)
    expect(await fs.exists(sidecarPath)).toBe(true)
  })

  it('offers the sidecar when it is newer than the project file', async () => {
    await ProjectFileService.save(denormalize(sample(), META), PATH)
    ProjectFileService.scheduleAutosave(denormalize(sample(), META), PATH)
    await ProjectFileService.flushAutosave()

    const recovery = await ProjectFileService.findRecovery(PATH)
    expect(recovery.sidecarPath).toBe(`${PATH}.autosave.json`)
  })

  it('offers nothing when the project file is the newer of the two', async () => {
    ProjectFileService.scheduleAutosave(denormalize(sample(), META), PATH)
    await ProjectFileService.flushAutosave()
    await ProjectFileService.save(denormalize(sample(), META), PATH)

    expect(await ProjectFileService.findRecovery(PATH)).toBe(null)
  })

  it('an explicit save removes the sidecar, so the next open offers nothing', async () => {
    ProjectFileService.scheduleAutosave(denormalize(sample(), META), PATH)
    await ProjectFileService.flushAutosave()
    expect(await fs.exists(`${PATH}.autosave.json`)).toBe(true)

    await ProjectFileService.save(denormalize(sample(), META), PATH)
    expect(await fs.exists(`${PATH}.autosave.json`)).toBe(false)
  })

  // SAVE-03: the copy written last may belong to a project the editor has already left.
  it('saving one project leaves the copy of another, even the one written last', async () => {
    const other = '/home/user/дача.eltree.json'
    ProjectFileService.scheduleAutosave(denormalize(sample(), META), PATH)
    await ProjectFileService.flushAutosave()

    await ProjectFileService.save(denormalize(sample(), META), other)

    expect(await fs.exists(`${PATH}.autosave.json`)).toBe(true)
  })

  it('discardRecovery drops the sidecar and never throws when there is none', async () => {
    ProjectFileService.scheduleAutosave(denormalize(sample(), META), PATH)
    await ProjectFileService.flushAutosave()

    await ProjectFileService.discardRecovery(PATH)
    expect(await fs.exists(`${PATH}.autosave.json`)).toBe(false)
    await expect(ProjectFileService.discardRecovery(PATH)).resolves.toBeUndefined()
  })

  it('loads a sidecar the same way it loads a project, so recovery is one code path', async () => {
    ProjectFileService.scheduleAutosave(denormalize(sample(), META), PATH)
    const sidecarPath = await ProjectFileService.flushAutosave()

    const { project } = await ProjectFileService.load(sidecarPath)
    expect(normalize(project).nodes).toEqual(sample().nodes)
  })
})

// SAVE-02: a write the timer has already started is no longer in the queue. Everything that waits on
// autosave — the close guard, an explicit save, the next write — has to see it anyway.
describe('autosave writes run one at a time, and a flush waits for them (SAVE-02)', () => {
  const sidecar = `${PATH}.autosave.json`
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
  const state = (name) => denormalize(sample(), { name })
  const sidecarName = async () => JSON.parse(await fs.readText(sidecar)).name

  /** Lets the debounce fire and returns once its write has started and is being held. */
  async function startHeldWrite(name) {
    const { release, reached } = fs.hold(isSidecar)
    ProjectFileService.scheduleAutosave(state(name), PATH)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    await reached
    return release
  }

  beforeEach(() => {
    fs = new GatedFs({ dataDir: '/memfs/data' })
    setFs(fs)
    vi.useFakeTimers()
  })

  it('a flush does not resolve while a started write is still running', async () => {
    const release = await startHeldWrite('перший стан')
    vi.useRealTimers()

    let flushed = false
    const flushing = ProjectFileService.flushAutosave().then(() => {
      flushed = true
    })
    await settle()
    expect(flushed).toBe(false)

    release()
    await flushing
    expect(await sidecarName()).toBe('перший стан')
  })

  it('a newer state queued behind a running write lands after it, never under it', async () => {
    const release = await startHeldWrite('перший стан')
    ProjectFileService.scheduleAutosave(state('другий стан'), PATH)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    vi.useRealTimers()
    await settle()

    release()
    await settle()
    await ProjectFileService.flushAutosave()
    expect(await sidecarName()).toBe('другий стан')
  })

  it('a flush resolves at once when nothing is queued or running', async () => {
    vi.useRealTimers()

    let flushed = false
    ProjectFileService.flushAutosave().then(() => {
      flushed = true
    })
    await settle()
    expect(flushed).toBe(true)
  })

  it('a failed write is reported rather than left unhandled, and the next one still runs', async () => {
    const reported = []
    const unregister = ProjectFileService.setAutosaveErrorHandler((error) => reported.push(error))
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      vi.spyOn(fs, 'writeText').mockRejectedValueOnce(new Error('диск заповнений'))
      ProjectFileService.scheduleAutosave(state('перший стан'), PATH)
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
      vi.useRealTimers()
      await settle()

      expect(unhandled).not.toHaveBeenCalled()
      expect(reported.map((error) => error.message)).toEqual(['диск заповнений'])

      ProjectFileService.scheduleAutosave(state('другий стан'), PATH)
      await ProjectFileService.flushAutosave()
      expect(await sidecarName()).toBe('другий стан')
    } finally {
      process.off('unhandledRejection', unhandled)
      unregister()
    }
  })

  // The save removes the sidecar, but a write that started before it lands afterwards and puts back
  // a copy newer than the file: the next open would offer work that is already saved.
  it('an explicit save while a sidecar write runs leaves no sidecar behind', async () => {
    const release = await startHeldWrite('стан до збереження')
    vi.useRealTimers()

    const saving = ProjectFileService.save(state('збережений стан'), PATH)
    await settle()
    release()
    await saving
    await settle()

    expect(await fs.exists(sidecar)).toBe(false)
    expect(await ProjectFileService.findRecovery(PATH)).toBe(null)
  })
})
