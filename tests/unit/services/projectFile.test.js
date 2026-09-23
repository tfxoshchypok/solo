// The file layer: a round trip has to reproduce the tree exactly, and a broken file has to be
// refused whole with the failing element named (FR-033, FR-035, FR-036, SC-005).
//
// Everything here runs over `MemoryFs`, so no test opens a dialog or touches a real path.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { SCHEMA_VERSION } from '@/schemas/index.js'
import {
  AUTOSAVE_DELAY_MS,
  LoadError,
  ProjectFileService,
  denormalize,
  normalize,
} from '@/services/ProjectFileService.js'
import { tree, consumer } from '../../fixtures/tree.js'

const PATH = '/home/user/квартира.eltree.json'
const META = { name: 'Квартира на Лесі Українки', catalogVersion: '2026.09.1' }

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
          consumer('fridge-node', 'fridge', {
            name: 'Холодильник',
            typeName: 'Холодильник',
            quantity: 2,
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

describe('a round trip reproduces the tree (FR-033, FR-035, SC-005)', () => {
  it('returns the same nodes, names, notes and quantities it was given', async () => {
    const before = sample()

    await ProjectFileService.save(denormalize(before, META), PATH)
    const { project } = await ProjectFileService.load(PATH)
    const after = normalize(project)

    expect(after.rootId).toBe(before.rootId)
    expect(after.nodes).toEqual(before.nodes)
    expect(after.nodes['fridge-node'].quantity).toBe(2)
    expect(after.nodes.kitchen.note).toBe('щиток у коридорі')
  })

  it('denormalizes into a flat array in depth-first order, never a keyed object', async () => {
    const file = denormalize(sample(), META)

    expect(Array.isArray(file.nodes)).toBe(true)
    expect(file.nodes.map((node) => node.id)).toEqual(['root', 'kitchen', 'fridge-node'])
    expect(file.schemaVersion).toBe(SCHEMA_VERSION)
    expect(file.catalogVersion).toBe(META.catalogVersion)
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

  it('names the failing field the way FR-036 asks: nodes[2].quantity', async () => {
    await writeProject(PATH, (project) => {
      project.nodes[2].quantity = '2'
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error).toBeInstanceOf(LoadError)
    expect(error.path).toBe('nodes[2].quantity')
    expect(error.message).toContain('nodes[2].quantity')
    expect(error.received).toBeTruthy()
  })

  it('refuses a schemaVersion it does not know rather than guessing', async () => {
    await writeProject(PATH, (project) => ({ ...project, schemaVersion: 99 }))

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error).toBeInstanceOf(LoadError)
    expect(error.path).toBe('schemaVersion')
    expect(error.received).toBe(99)
  })

  it('refuses a consumer with no typeName, which an older writer could have produced', async () => {
    await writeProject(PATH, (project) => {
      delete project.nodes[2].typeName
      return project
    })

    const error = await ProjectFileService.load(PATH).catch((e) => e)
    expect(error.path).toBe('nodes[2].typeName')
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

  it('accepts a typeId the current catalog no longer ships — that is not a failure (FR-034)', async () => {
    await writeProject(PATH, (project) => {
      project.nodes[2].typeId = 'type-from-2019'
      return project
    })

    const { project } = await ProjectFileService.load(PATH)
    expect(project.nodes[2].typeName).toBe('Холодильник')
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
