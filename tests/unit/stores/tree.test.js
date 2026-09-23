import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
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
    children: [{ id: 'p1', kind: 'panel', name: 'Щиток', children: [consumer('c1', 'lamp')] }],
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
          children: [consumer('c1', 'lamp'), consumer('c2', 'socket')],
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

describe('tree store carries the quantity through (FR-025)', () => {
  it('setQuantity commits one step and undo takes it back', () => {
    const store = useTreeStore()
    store.setTree(loadedProject())
    const before = store.history.undoStack.length
    store.setQuantity('c1', 8)
    expect(store.nodes.c1.quantity).toBe(8)
    expect(store.history.undoStack.length).toBe(before + 1)
    store.history.undo()
    expect(store.nodes.c1.quantity).toBe(1)
  })
})
