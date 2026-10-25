import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import { ReferenceTablesFileService } from '@/services/ReferenceTablesFileService.js'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { renameNode, RuleError } from '@/modules/tree/engine/treeOps.js'
import { tree, consumer } from '../../fixtures/tree.js'

beforeEach(() => {
  setActivePinia(createPinia())
})

const loadedProject = () =>
  tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [{ id: 'p1', kind: 'panel', name: 'Щиток', children: [consumer('c1')] }],
  })

describe('tree store undo history after a project load (FR-011)', () => {
  it('replaces the tree and starts with an empty history', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    expect(store.nodeCount).toBe(3)
    expect(store.history.canUndo).toBe(false)
    expect(store.history.canRedo).toBe(false)
  })

  it('undo after the first edit returns the loaded tree, not the one the store was born with', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const loadedIds = Object.keys(store.nodes).sort()

    // What a structural action does: apply through the engine, then commit the snapshot.
    store.nodes = renameNode(store.nodes, 'p1', 'Кухня')
    store.history.commit()
    expect(store.nodes.p1.name).toBe('Кухня')

    store.history.undo()
    expect(Object.keys(store.nodes).sort()).toEqual(loadedIds)
    expect(store.nodes.p1.name).toBe('Щиток')
    expect(store.nodeCount).toBe(3)
  })

  it('redo puts the edit back', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    store.nodes = renameNode(store.nodes, 'p1', 'Кухня')
    store.history.commit()
    store.history.undo()
    store.history.redo()
    expect(store.nodes.p1.name).toBe('Кухня')
  })

  it('reset does the same for a new project', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    store.reset()
    expect(store.nodeCount).toBe(1)
    store.nodes = renameNode(store.nodes, store.rootId, 'Новий ввід')
    store.history.commit()
    store.history.undo()
    expect(store.nodeCount).toBe(1)
    expect(store.nodes[store.rootId].name).toBe('Ввід')
  })
})

describe('tree store actions commit exactly one history step (FR-006, FR-011)', () => {
  const steps = (store) => store.history.undoStack.length

  it('add creates the node and commits one step', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const before = steps(store)
    const nodeId = store.add({ parentId: 'root', kind: 'panel', name: 'Другий щиток' })
    expect(store.nodes[nodeId].name).toBe('Другий щиток')
    expect(store.nodes.root.childIds).toContain(nodeId)
    expect(steps(store)).toBe(before + 1)
  })

  it('a refused add commits nothing and leaves the tree untouched', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const before = steps(store)
    const snapshot = store.nodes
    // p1 already holds a consumer, so a panel child is refused (FR-013).
    expect(() => store.add({ parentId: 'p1', kind: 'panel', name: 'Підщиток' })).toThrow(RuleError)
    expect(store.nodes).toBe(snapshot)
    expect(steps(store)).toBe(before)
  })

  it('rename changes one node and commits one step', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const before = steps(store)
    store.rename('p1', 'Кухня')
    expect(store.nodes.p1.name).toBe('Кухня')
    expect(steps(store)).toBe(before + 1)
  })

  it('remove drops the subtree, answers what went, and commits one step', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const before = steps(store)
    const removed = store.remove('p1')
    expect(removed.sort()).toEqual(['c1', 'p1'])
    expect(store.nodeCount).toBe(1)
    expect(steps(store)).toBe(before + 1)
  })

  it('remove moves the selection off a node that no longer exists', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    store.select('c1')
    store.remove('p1')
    expect(store.selectedId).toBe('root')
    expect(store.selected).toBeTruthy()
  })

  it('move re-parents the subtree and commits one step', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const second = store.add({ parentId: 'root', kind: 'panel', name: 'Другий щиток' })
    const before = steps(store)
    store.move('p1', second, 0)
    expect(store.nodes.p1.parentId).toBe(second)
    expect(store.nodes.c1.parentId).toBe('p1')
    expect(steps(store)).toBe(before + 1)
  })

  it('reorder changes sibling order and commits one step', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const second = store.add({ parentId: 'root', kind: 'panel', name: 'Другий щиток' })
    const before = steps(store)
    store.reorder(second, 0)
    expect(store.nodes.root.childIds).toEqual([second, 'p1'])
    expect(steps(store)).toBe(before + 1)
  })

  it('undo walks back one action at a time, in order', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    store.rename('p1', 'Кухня')
    store.rename('p1', 'Кухня-2')
    store.history.undo()
    expect(store.nodes.p1.name).toBe('Кухня')
    store.history.undo()
    expect(store.nodes.p1.name).toBe('Щиток')
  })
})

describe('tree store carries the note through (FR-012)', () => {
  it('setNote commits one step and undo takes the note back off', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const before = store.history.undoStack.length
    store.setNote('p1', 'другий поверх')
    expect(store.nodes.p1.note).toBe('другий поверх')
    expect(store.history.undoStack.length).toBe(before + 1)
    store.history.undo()
    expect(store.nodes.p1.note).toBeUndefined()
  })
})

describe('tree store applies the structural fix as one undo step (FR-016)', () => {
  const kitchenWithConsumers = () =>
    tree({
      id: 'root',
      kind: 'entry',
      name: 'Ввід',
      children: [
        {
          id: 'p1',
          kind: 'panel',
          name: 'Кухня',
          children: [consumer('c1'), consumer('c2')],
        },
      ],
    })

  it('wraps the existing consumers in a new panel and adds the requested panel beside it', () => {
    const store = useTreeStore()
    store.setTree(kitchenWithConsumers())
    const before = store.history.undoStack.length

    const nodeId = store.wrapConsumersAndAdd({
      parentId: 'p1',
      panelName: 'Освітлення',
      pending: { kind: 'panel', name: 'Розетки' },
    })

    // p1 now holds two panels, and both consumers moved into the first of them.
    const wrapped = store.nodes.p1.childIds
    expect(wrapped).toHaveLength(2)
    const [wrapId] = wrapped
    expect(store.nodes[wrapId].name).toBe('Освітлення')
    expect([...store.nodes[wrapId].childIds].sort()).toEqual(['c1', 'c2'])
    expect(store.nodes.c1.parentId).toBe(wrapId)
    expect(store.nodes[nodeId].name).toBe('Розетки')
    expect(store.nodes.p1.childrenKind).toBe('panels')

    // Three engine operations, one confirmation, one undo step.
    expect(store.history.undoStack.length).toBe(before + 1)
  })

  it('one undo puts the kitchen back exactly as it was', () => {
    const store = useTreeStore()
    store.setTree(kitchenWithConsumers())
    const before = store.nodes

    store.wrapConsumersAndAdd({
      parentId: 'p1',
      panelName: 'Освітлення',
      pending: { kind: 'panel', name: 'Розетки' },
    })
    store.history.undo()

    expect(store.nodes.p1.childIds).toEqual(before.p1.childIds)
    expect(store.nodes.c1.parentId).toBe('p1')
    expect(store.nodeCount).toBe(4)
  })
})

describe('tree store edits the consumer fields, one undo step each (002/FR-014, 002/FR-021)', () => {
  // The reference store holds the shipped tables from the moment it exists, so no load() is needed.
  const loadTypeNamed = (name) =>
    useReferenceTablesStore().tables.loadTypes.find((r) => r.name === name)
  const zoneNamed = (name) => useReferenceTablesStore().tables.zones.find((r) => r.name === name)

  const kitchenWith = (fields) =>
    tree({
      id: 'root',
      kind: 'entry',
      name: 'Ввід',
      children: [{ id: 'p1', kind: 'panel', name: 'Кухня', children: [consumer('c1', fields)] }],
    })

  it('setLoadType copies the row it finds and renames a consumer still named after its load type; one undo restores both', () => {
    const oven = loadTypeNamed('Духова шафа')
    const microwave = loadTypeNamed('Мікрохвильова піч')
    const store = useTreeStore()
    store.setTree(kitchenWith({ name: 'Духова шафа', loadType: oven }))
    const before = store.history.undoStack.length

    store.setLoadType('c1', microwave.id)
    expect(store.nodes.c1.loadType).toEqual(microwave)
    expect(store.nodes.c1.name).toBe('Мікрохвильова піч')
    expect(store.history.undoStack.length).toBe(before + 1)

    store.history.undo()
    expect(store.nodes.c1.loadType).toEqual(oven)
    expect(store.nodes.c1.name).toBe('Духова шафа')
  })

  it('setZone, setCopyValue and setCableSection each commit one step that undo takes back', () => {
    const kitchen = zoneNamed('Кухня')
    const store = useTreeStore()
    store.setTree(kitchenWith({}))
    const before = store.history.undoStack.length

    store.setZone('c1', kitchen.id)
    expect(store.nodes.c1.zone).toEqual(kitchen)
    store.setCopyValue('c1', 'zone', 'leakageMa', 10)
    expect(store.nodes.c1.zone.leakageMa).toBe(10)
    store.setCableSection('c1', 2.5)
    expect(store.nodes.c1.cableSectionMm2).toBe(2.5)
    expect(store.history.undoStack.length).toBe(before + 3)

    store.history.undo()
    expect(store.nodes.c1.cableSectionMm2).toBeNull()
    store.history.undo()
    expect(store.nodes.c1.zone).toEqual(kitchen)
    store.history.undo()
    expect(store.nodes.c1.zone.id).toBe('zn-test')
  })

  it('setCopyValue changes this consumer only, never the table row it was copied from', () => {
    const sockets = loadTypeNamed('Розетки кухні (робоча зона)')
    const store = useTreeStore()
    store.setTree(
      tree({
        id: 'root',
        kind: 'entry',
        name: 'Ввід',
        children: [
          {
            id: 'p1',
            kind: 'panel',
            name: 'Кухня',
            children: [
              consumer('c1', { loadType: sockets }),
              consumer('c2', { loadType: sockets }),
            ],
          },
        ],
      }),
    )

    store.setCopyValue('c1', 'loadType', 'demandFactor', 0.6)
    expect(store.nodes.c1.loadType.demandFactor).toBe(0.6)
    expect(store.nodes.c2.loadType.demandFactor).toBe(sockets.demandFactor)
    expect(loadTypeNamed('Розетки кухні (робоча зона)').demandFactor).toBe(sockets.demandFactor)
  })

  it('an edit in the reference tables changes no consumer (SC-007)', async () => {
    setFs(new MemoryFs({ dataDir: '/memfs/data' }))
    try {
      const reference = useReferenceTablesStore()
      const sockets = loadTypeNamed('Розетки кухні (робоча зона)')
      const store = useTreeStore()
      store.setTree(kitchenWith({ name: sockets.name, loadType: sockets }))
      const copied = store.nodes.c1

      await reference.updateCell('loadTypes', sockets.id, 'demandFactor', '0,5')
      await reference.updateCell('loadTypes', sockets.id, 'name', 'Розетки кухні')
      expect(loadTypeNamed('Розетки кухні').demandFactor).toBe(0.5)

      expect(store.nodes.c1).toBe(copied)
      expect(store.nodes.c1.loadType).toEqual(sockets)
    } finally {
      await ReferenceTablesFileService.flush().catch(() => {})
      setFs(null)
    }
  })
})

describe('the tree store gives new nodes the 003 keys (003/FR-003, 003/FR-009)', () => {
  const steps = (store) => store.history.undoStack.length
  /** The shipped incoming device rows as a new panel copies them: each marked not to install. */
  const shippedCopies = () => {
    const rows = useReferenceTablesStore().tables.incomingDevices
    expect(rows).toHaveLength(4)
    return rows.map((row) => ({ ...row, install: false }))
  }

  it('reset gives the entry all six project properties, empty', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    store.reset()
    expect(store.nodes[store.rootId].projectProperties).toEqual({
      supplyPhases: null,
      moduleReservePct: null,
      separateRcdMode: null,
      maxLinesPerGroupRcd: null,
      neutralBreak: null,
      selectiveFeederRcd: null,
    })
  })

  it('add gives a new panel a copy of the reference store’s incoming device rows, in one step', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const before = steps(store)
    const nodeId = store.add({ parentId: 'root', kind: 'panel', name: 'Гараж' })
    expect(store.nodes[nodeId].incomingDevices).toEqual(shippedCopies())
    expect(steps(store)).toBe(before + 1)
  })

  it('wrapConsumersAndAdd gives both new panels the same copy, in one step', () => {
    const store = useTreeStore()
    store.setTree(
      tree({
        id: 'root',
        kind: 'entry',
        name: 'Ввід',
        children: [{ id: 'p1', kind: 'panel', name: 'Кухня', children: [consumer('c1')] }],
      }),
    )
    const before = steps(store)
    const nodeId = store.wrapConsumersAndAdd({
      parentId: 'p1',
      panelName: 'Освітлення',
      pending: { kind: 'panel', name: 'Розетки' },
    })
    const wrapId = store.nodes.p1.childIds.find((id) => id !== nodeId)
    expect(store.nodes[wrapId].incomingDevices).toEqual(shippedCopies())
    expect(store.nodes[nodeId].incomingDevices).toEqual(shippedCopies())
    expect(steps(store)).toBe(before + 1)
  })
})

describe('tree store setProjectProperty is one undo step (003/FR-021, US1 scenario 5)', () => {
  const steps = (store) => store.history.undoStack.length
  const reserve = (store) => store.nodes[store.rootId].projectProperties.moduleReservePct

  it('commits one step', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const before = steps(store)

    store.setProjectProperty('moduleReservePct', 20)

    expect(reserve(store)).toBe(20)
    expect(steps(store)).toBe(before + 1)
  })

  it('adds no step for a refused value, and keeps the stored one', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    store.setProjectProperty('moduleReservePct', 20)
    const before = steps(store)

    expect(() => store.setProjectProperty('moduleReservePct', -5)).toThrow(RuleError)

    expect(reserve(store)).toBe(20)
    expect(steps(store)).toBe(before)
  })

  it('undo brings a cleared value back and redo clears it again', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    store.setProjectProperty('moduleReservePct', 25)
    store.setProjectProperty('moduleReservePct', null)

    store.history.undo()
    expect(reserve(store)).toBe(25)
    store.history.redo()
    expect(reserve(store)).toBeNull()
  })
})

describe('tree store setPanelOverride is one undo step (003/FR-021, US2 scenario 3)', () => {
  const steps = (store) => store.history.undoStack.length
  const own = (store) => store.nodes.p1.overrides.moduleReservePct

  it('commits one step', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const before = steps(store)

    store.setPanelOverride('p1', 'moduleReservePct', 40)

    expect(own(store)).toBe(40)
    expect(steps(store)).toBe(before + 1)
  })

  it('undo after a reset brings the own value back', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    store.setPanelOverride('p1', 'moduleReservePct', 40)
    store.setPanelOverride('p1', 'moduleReservePct', null)

    store.history.undo()

    expect(own(store)).toBe(40)
  })
})

describe('tree store marks (003/FR-009, 003/FR-021, 003/SC-006, US3 scenarios 4–5)', () => {
  const steps = (store) => store.history.undoStack.length
  const names = (rows) => rows.map((row) => row.name)

  it('each mark change is one undo step', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const floorId = store.add({ parentId: 'root', kind: 'panel', name: 'Поверх 1' })
    const deviceId = store.nodes[floorId].incomingDevices[0].id
    const before = steps(store)

    store.setIncomingDeviceMark(floorId, deviceId, true)
    store.setBuySeparately(floorId, 'blankingPlates', true)
    expect(steps(store)).toBe(before + 2)

    store.history.undo()
    expect(store.nodes[floorId].buySeparately.blankingPlates).toBe(false)
    expect(store.nodes[floorId].incomingDevices[0].install).toBe(true)
    store.history.undo()
    expect(store.nodes[floorId].incomingDevices[0].install).toBe(false)
  })

  describe('after edits of the incoming devices table', () => {
    /** Adds «Перемикач мережа-генератор», renames and widens «Лічильник», then deletes it. */
    async function editTable() {
      const reference = useReferenceTablesStore()
      const meter = reference.tables.incomingDevices.find((row) => row.name === 'Лічильник')
      await reference.addRow('incomingDevices', 'Перемикач мережа-генератор')
      await reference.updateCell('incomingDevices', meter.id, 'name', 'Лічильник двотарифний')
      await reference.updateCell('incomingDevices', meter.id, 'width1ph', '3')
      await reference.deleteRow('incomingDevices', meter.id)
    }

    beforeEach(() => {
      setFs(new MemoryFs({ dataDir: '/memfs/data' }))
    })

    afterEach(async () => {
      await ReferenceTablesFileService.flush().catch(() => {})
      setFs(null)
    })

    it('an existing panel keeps its copy as it was', async () => {
      const store = useTreeStore()
      store.setTree(loadedProject())
      const floorId = store.add({ parentId: 'root', kind: 'panel', name: 'Поверх 1' })
      store.setIncomingDeviceMark(floorId, store.nodes[floorId].incomingDevices[2].id, true)
      const copied = structuredClone(store.nodes[floorId].incomingDevices)

      await editTable()

      expect(store.nodes[floorId].incomingDevices).toEqual(copied)
    })

    it('a panel added afterwards copies the table as it now is', async () => {
      const store = useTreeStore()
      store.setTree(loadedProject())

      await editTable()
      const floorId = store.add({ parentId: 'root', kind: 'panel', name: 'Поверх 2' })

      expect(names(store.nodes[floorId].incomingDevices)).toEqual([
        'Реле напруги',
        'ОПН',
        'Рубильник',
        'Перемикач мережа-генератор',
      ])
      expect(store.nodes[floorId].incomingDevices).toEqual(
        useReferenceTablesStore().tables.incomingDevices.map((row) => ({ ...row, install: false })),
      )
    })
  })
})
