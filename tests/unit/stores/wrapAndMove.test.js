// SC-002 promises a one-confirmation fix behind *every* homogeneity block. The add path already
// has `wrapConsumersAndAdd`; a block reached by moving an existing node needs the same thing for
// a node that is already in the tree.
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { RuleError } from '@/modules/tree/engine/treeOps.js'
import { tree, consumer } from '../../fixtures/tree.js'

beforeEach(() => {
  setActivePinia(createPinia())
})

/**
 * root ─ kitchen ─ lamp      (a panel holding consumers — refuses a panel child)
 *      └ floor               (the panel the user drags onto kitchen)
 */
function twoBranches() {
  return tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [
      { id: 'kitchen', kind: 'panel', name: 'Кухня', children: [consumer('lamp', 'lamp')] },
      { id: 'floor', kind: 'panel', name: 'Поверх' },
    ],
  })
}

describe('wrapConsumersAndMove resolves a move-time block in one step (SC-002, FR-016)', () => {
  it('moves the existing consumers into the new sub-panel and the dragged panel beside it', () => {
    const store = useTreeStore()
    store.setTree(twoBranches())

    store.wrapConsumersAndMove({ parentId: 'kitchen', panelName: 'Освітлення', nodeId: 'floor' })

    const kitchen = store.nodes.kitchen
    expect(kitchen.childIds).toContain('floor')
    // The lamp is no longer a direct child: it went into the wrapper panel.
    expect(kitchen.childIds).not.toContain('lamp')

    const wrapperId = kitchen.childIds.find((id) => id !== 'floor')
    expect(store.nodes[wrapperId].name).toBe('Освітлення')
    expect(store.nodes[wrapperId].childIds).toEqual(['lamp'])
    expect(store.nodes.lamp.parentId).toBe(wrapperId)
  })

  it('commits exactly one history step, so one undo takes the whole fix back', () => {
    const store = useTreeStore()
    store.setTree(twoBranches())
    const before = store.nodes

    store.wrapConsumersAndMove({ parentId: 'kitchen', panelName: 'Освітлення', nodeId: 'floor' })
    store.history.undo()

    expect(store.nodes).toEqual(before)
  })

  it('refuses to move a node into its own subtree, leaving the tree untouched', () => {
    const store = useTreeStore()
    store.setTree(twoBranches())
    const before = store.nodes

    expect(() =>
      store.wrapConsumersAndMove({ parentId: 'kitchen', panelName: 'Група', nodeId: 'root' }),
    ).toThrow(RuleError)
    expect(store.nodes).toEqual(before)
  })
})
