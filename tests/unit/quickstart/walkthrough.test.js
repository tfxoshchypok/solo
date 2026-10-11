// The quickstart scenarios, walked in order on one project rather than probed one unit at a time.
// Each test is named after the step it performs, so a failure here points at a line in
// `specs/001-electrical-load-tree-editor/quickstart.md` instead of at an internal function.
//
// Two steps are deliberately absent: V1.10 (a tree built by keystrokes equals one built by pointer)
// lives in `tests/component/keyboardTree.test.js`, which needs a DOM to press keys into, and V3.4
// (works with the network unplugged) is proved by the source scan in `tests/unit/scope/`.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useProjectStore } from '@/stores/project.js'
import { canAccept } from '@/modules/tree/engine/homogeneity.js'
import { descendantIds, isDescendantOf, RuleError } from '@/modules/tree/engine/treeOps.js'
import { ProjectFileService } from '@/services/ProjectFileService.js'
import { LoadError } from '@/services/LoadError.js'
import { PROJECT_EXTENSION } from '@/services/PathService.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import { loadTypeRow, zoneRow } from '../../fixtures/tree.js'

const PATH = `/home/user/квартира${PROJECT_EXTENSION}`

let fs = null

beforeEach(() => {
  setActivePinia(createPinia())
  fs = new MemoryFs({ dataDir: '/memfs/data', savePath: PATH, openPath: PATH })
  setFs(fs)
})

afterEach(() => {
  ProjectFileService.cancelAutosave()
  setFs(null)
})

/** What the caller has to catch. Returns the refusal instead of letting it escape. */
function refusalFrom(action) {
  try {
    action()
  } catch (error) {
    if (error instanceof RuleError) return error
    throw error
  }
  return null
}

describe('V1 — Build the tree (User Story 1)', () => {
  it('V1.1 — a new project is one entry node that cannot be deleted or given a sibling (FR-002)', () => {
    const tree = useTreeStore()

    expect(tree.nodeCount).toBe(1)
    expect(tree.root.kind).toBe('entry')
    expect(refusalFrom(() => tree.remove(tree.rootId)).code).toBe('rootProtected')
    // There is no parent to add a sibling under: the entry node's parentId is null.
    expect(
      refusalFrom(() => tree.add({ parentId: null, kind: 'panel', name: 'Другий ввід' })),
    ).not.toBeNull()
  })

  it('V1.2 — a panel holding panels offers no consumer (FR-013)', () => {
    const tree = useTreeStore()
    const floor = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Поверх' })
    tree.add({ parentId: floor, kind: 'panel', name: 'Кухня' })
    tree.add({ parentId: floor, kind: 'panel', name: 'Спальня' })

    expect(tree.nodes[floor].childrenKind).toBe('panels')
    expect(canAccept(tree.nodes, floor, 'consumer').ok).toBe(false)
    expect(canAccept(tree.nodes, floor, 'panel').ok).toBe(true)
  })

  it('V1.3 — a consumer into a panel of panels is refused, offering the child panels (FR-015, FR-017)', () => {
    const tree = useTreeStore()
    const floor = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Поверх' })
    const kitchen = tree.add({ parentId: floor, kind: 'panel', name: 'Кухня' })
    const before = tree.nodes

    const refusal = refusalFrom(() =>
      tree.add({
        parentId: floor,
        kind: 'consumer',
        name: 'Холодильник',
        loadType: loadTypeRow(),
        zone: zoneRow(),
      }),
    )

    expect(refusal.code).toBe('parentHoldsPanels')
    expect(refusal.fix.kind).toBe('placeUnderChildPanel')
    expect(refusal.fix.candidatePanelIds).toContain(kitchen)
    expect(tree.nodes).toBe(before)
  })

  it('V1.4 — a sub-panel into a panel of consumers is refused, offering the wrap (FR-016, SC-002)', () => {
    const tree = useTreeStore()
    const kitchen = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    tree.add({
      parentId: kitchen,
      kind: 'consumer',
      name: 'Холодильник',
      loadType: loadTypeRow(),
      zone: zoneRow(),
    })

    const refusal = refusalFrom(() =>
      tree.add({ parentId: kitchen, kind: 'panel', name: 'Розетки' }),
    )
    expect(refusal.fix.kind).toBe('wrapConsumersInNewPanel')

    // The fix itself: one confirmation, one undo step, and the consumers end up in a sub-panel.
    const steps = tree.history.undoStack.length
    const added = tree.wrapConsumersAndAdd({
      parentId: kitchen,
      panelName: 'Освітлення',
      pending: { kind: 'panel', name: 'Розетки' },
    })
    expect(tree.nodes[kitchen].childrenKind).toBe('panels')
    expect(tree.nodes[added].name).toBe('Розетки')
    expect(tree.history.undoStack.length).toBe(steps + 1)
  })

  it('V1.5 — a 12-node subtree moves whole, every relationship intact (FR-009)', () => {
    const tree = useTreeStore()
    const source = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    for (let i = 0; i < 11; i += 1) {
      tree.add({
        parentId: source,
        kind: 'consumer',
        name: `Споживач ${i}`,
        loadType: loadTypeRow(),
        zone: zoneRow(),
      })
    }
    const target = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Гараж' })
    const subtree = [source, ...descendantIds(tree.nodes, source)]
    expect(subtree).toHaveLength(12)

    tree.move(source, target, 0)

    expect(tree.nodes[source].parentId).toBe(target)
    expect([source, ...descendantIds(tree.nodes, source)]).toEqual(subtree)
    for (const id of descendantIds(tree.nodes, source)) {
      expect(tree.nodes[id].parentId).toBe(source)
    }
  })

  it('V1.6 — a drop into the node’s own subtree is refused while the pointer is down (FR-008, FR-027)', () => {
    const tree = useTreeStore()
    const floor = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Поверх' })
    const kitchen = tree.add({ parentId: floor, kind: 'panel', name: 'Кухня' })
    const before = tree.nodes

    // What `allowDrop` asks during the drag, before any drop happens.
    expect(isDescendantOf(tree.nodes, kitchen, floor)).toBe(true)
    // And what the store answers if the widget were ever bypassed.
    expect(refusalFrom(() => tree.move(floor, kitchen, 0)).code).toBe('cycle')
    expect(tree.nodes).toBe(before)
  })

  it('V1.7 — deleting a panel names how many nodes go with it, before they go (FR-010)', () => {
    const tree = useTreeStore()
    const floor = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Поверх' })
    const kitchen = tree.add({ parentId: floor, kind: 'panel', name: 'Кухня' })
    tree.add({
      parentId: kitchen,
      kind: 'consumer',
      name: 'Холодильник',
      loadType: loadTypeRow(),
      zone: zoneRow(),
    })

    // The number the confirmation shows is the descendants, read while they are still there;
    // what `remove` hands back afterwards is those plus the node itself, for the selection to use.
    expect(descendantIds(tree.nodes, floor)).toHaveLength(2)
    expect(tree.remove(floor)).toHaveLength(3)
    expect(tree.nodeCount).toBe(1)
  })

  it('V1.8 — undo returns the exact previous state, redo goes forward again (FR-011)', () => {
    const tree = useTreeStore()
    const floor = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Поверх' })
    const withPanel = tree.nodes
    tree.remove(floor)
    const afterDelete = tree.nodes

    tree.history.undo()
    expect(tree.nodes).toEqual(withPanel)

    tree.history.redo()
    expect(tree.nodes).toEqual(afterDelete)
  })

  it('V1.9 — a panel that loses its last child accepts either kind again (FR-018)', () => {
    const tree = useTreeStore()
    const kitchen = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    const fridge = tree.add({
      parentId: kitchen,
      kind: 'consumer',
      name: 'Холодильник',
      loadType: loadTypeRow(),
      zone: zoneRow(),
    })
    expect(tree.nodes[kitchen].childrenKind).toBe('consumers')

    tree.remove(fridge)

    expect(tree.nodes[kitchen].childrenKind).toBe('undecided')
    expect(canAccept(tree.nodes, kitchen, 'panel').ok).toBe(true)
    expect(canAccept(tree.nodes, kitchen, 'consumer').ok).toBe(true)
  })

  it('V1.11 — nesting past six panel levels is refused with the depth named (FR-007)', () => {
    const tree = useTreeStore()
    let parentId = tree.rootId
    for (let level = 1; level <= 6; level += 1) {
      parentId = tree.add({ parentId, kind: 'panel', name: `Рівень ${level}` })
    }

    const refusal = refusalFrom(() => tree.add({ parentId, kind: 'panel', name: 'Рівень 7' }))

    expect(refusal.code).toBe('depthLimit')
    expect(refusal.message).toContain('7')
  })
})

describe('V3 — Save, reopen, survive (User Story 3)', () => {
  /** The tree V3 works on: two panels, one with a note and two consumers, one cable section set. */
  function buildProject() {
    const tree = useTreeStore()
    const kitchen = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    tree.setNote(kitchen, 'щиток у коридорі')
    const sockets = tree.add({
      parentId: kitchen,
      kind: 'consumer',
      name: 'Розетки фартуха кухні',
      loadType: loadTypeRow(),
      zone: zoneRow(),
    })
    tree.setCableSection(sockets, 2.5)
    tree.add({
      parentId: kitchen,
      kind: 'consumer',
      name: 'Холодильник',
      loadType: loadTypeRow(),
      zone: zoneRow(),
    })
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Гараж' })
    return tree
  }

  it('V3.1 — save, close, reopen: every consumer field and every note identical (FR-035, 002/FR-019)', async () => {
    const project = useProjectStore()
    const tree = buildProject()
    const before = tree.nodes

    await project.saveAs()
    project.newProject()
    expect(tree.nodeCount).toBe(1)

    await project.openPath(PATH)

    expect(tree.nodes).toEqual(before)
    expect(Object.values(tree.nodes).map((n) => n.cableSectionMm2)).toEqual(
      expect.arrayContaining([2.5, null]),
    )
    expect(project.isDirty).toBe(false)
    expect(project.fileName).toBe(`квартира${PROJECT_EXTENSION}`)
  })

  it('V3.2 — a file whose rows are missing or different locally opens with its own values (002/FR-018)', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    const local = useReferenceTablesStore().tables.loadTypes.find(
      (row) => row.name === 'Розетки кухні (робоча зона)',
    )
    const edited = { ...local, name: 'Розетки кухні', demandFactor: 0.6 }
    const kitchen = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    const boiler = tree.add({
      parentId: kitchen,
      kind: 'consumer',
      name: 'Бойлер 2019',
      loadType: loadTypeRow({ id: 'lt-from-another-installation', name: 'Бойлер' }),
      zone: zoneRow({ id: 'zn-from-another-installation', name: 'Котельня' }),
    })
    const sockets = tree.add({
      parentId: kitchen,
      kind: 'consumer',
      name: 'Розетки кухні',
      loadType: edited,
      zone: zoneRow(),
    })
    await project.saveAs()
    project.newProject()

    await project.openPath(PATH)

    expect(tree.nodes[boiler].name).toBe('Бойлер 2019')
    expect(tree.nodes[boiler].loadType.id).toBe('lt-from-another-installation')
    expect(tree.nodes[sockets].loadType).toEqual(edited)
  })

  it('V3.3 — a truncated file is refused whole, naming the element, project untouched (FR-036)', async () => {
    const project = useProjectStore()
    const tree = buildProject()
    await project.saveAs()
    const before = tree.nodes

    // Truncated by hand, the way a half-finished copy or a full disk leaves it.
    const whole = await fs.readText(PATH)
    await fs.writeText('/home/user/обрізаний.eltree.json', whole.slice(0, whole.length / 2))

    const error = await project.openPath('/home/user/обрізаний.eltree.json').catch((e) => e)

    expect(error).toBeInstanceOf(LoadError)
    expect(error.message).toContain('JSON')
    expect(tree.nodes).toBe(before)
    expect(project.path).toBe(PATH)
  })

  it('V3.5 — work lost to a crash is offered back on the next open (FR-031)', async () => {
    const project = useProjectStore()
    const tree = buildProject()
    await project.saveAs()

    // The edit that never reached the file, then the sidecar the timer would have written.
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Підвал' })
    await ProjectFileService.flushAutosave()
    const beforeCrash = tree.nodes

    // The crash: the window is gone, every store with it. The disk is all that survives.
    setActivePinia(createPinia())
    const reopened = useProjectStore()
    const reopenedTree = useTreeStore()

    const recovery = await reopened.findRecovery(PATH)
    expect(recovery).not.toBeNull()

    await reopened.openRecovery(recovery.sidecarPath, PATH)

    expect(reopenedTree.nodes).toEqual(beforeCrash)
    expect(reopened.isDirty).toBe(true)

    // Saving it confirms the recovery and clears the sidecar, so the next open offers nothing.
    await reopened.save()
    expect(await reopened.findRecovery(PATH)).toBe(null)
  })
})

describe('V4 — Scale', () => {
  it('V4 — the 500-node fixture opens and stays navigable (FR-037, SC-006)', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    await fs.writeText(PATH, readFileSync('tests/fixtures/tree-500.eltree.json', 'utf8'))

    await project.openPath(PATH)

    expect(tree.nodeCount).toBe(500)
    // Expanding everything and reading what the widget renders costs one pass over the map.
    tree.setExpanded(Object.keys(tree.nodes).filter((id) => tree.nodes[id].kind !== 'consumer'))
    expect(tree.nestedOptions[0].children).toHaveLength(6)
    expect(tree.nestedOptions[0].children[0].children[0].children).toHaveLength(20)
  })
})
