import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { renameNode } from '@/modules/tree/engine/treeOps.js'
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
