import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NTree } from 'naive-ui'
import TreeCanvas from '@/modules/tree/components/TreeCanvas.vue'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { tree, consumer } from '../fixtures/tree.js'

beforeEach(() => {
  setActivePinia(createPinia())
})

/**
 * root ─ p1 ─ c1        (a panel holding consumers)
 *      └ p2 ─ p3        (a panel holding panels)
 */
const twoBranches = () =>
  tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [
      { id: 'p1', kind: 'panel', name: 'Кухня', children: [consumer('c1', 'lamp')] },
      {
        id: 'p2',
        kind: 'panel',
        name: 'Поверх',
        children: [{ id: 'p3', kind: 'panel', name: 'Спальня' }],
      },
    ],
  })

function mountCanvas() {
  const store = useTreeStore()
  store.setTree(twoBranches())
  const wrapper = mount(TreeCanvas)
  return { store, wrapper, ntree: wrapper.findComponent(NTree) }
}

describe('TreeCanvas hands n-tree what the store holds (FR-026, FR-028)', () => {
  it('renders the nested options built by the store', () => {
    const { ntree } = mountCanvas()
    const data = ntree.props('data')
    expect(data).toHaveLength(1)
    expect(data[0].key).toBe('root')
    expect(data[0].children.map((c) => c.label)).toEqual(['Кухня', 'Поверх'])
  })

  it('binds expansion and selection to the store rather than keeping its own copy', async () => {
    const { store, ntree } = mountCanvas()
    store.select('p1')
    store.setExpanded(['root', 'p2'])
    await ntree.vm.$nextTick()
    expect(ntree.props('selectedKeys')).toEqual(['p1'])
    expect(ntree.props('expandedKeys')).toEqual(['root', 'p2'])
  })

  it('turns virtual scrolling on, which is what keeps 500 nodes navigable (FR-037)', () => {
    const { ntree } = mountCanvas()
    expect(ntree.props('virtualScroll')).toBe(true)
    expect(ntree.props('draggable')).toBe(true)
  })
})

describe('TreeCanvas refuses an illegal drop while the pointer is down (FR-027)', () => {
  const dropInto = (allowDrop, dragId, targetId, phase, dropPosition = 'inside') =>
    allowDrop({
      dropPosition,
      node: { key: targetId },
      dragNode: { key: dragId },
      phase,
    })

  it('consults the same predicate in both phases, so the drag preview cannot disagree', () => {
    const { ntree } = mountCanvas()
    const allowDrop = ntree.props('allowDrop')
    // p2 holds panels, so a consumer dropped inside it breaks homogeneity (FR-013).
    expect(dropInto(allowDrop, 'c1', 'p2', 'drag')).toBe(false)
    expect(dropInto(allowDrop, 'c1', 'p2', 'drop')).toBe(false)
  })

  it('allows a panel into a panel-parent', () => {
    const { ntree } = mountCanvas()
    expect(dropInto(ntree.props('allowDrop'), 'p1', 'p2', 'drag')).toBe(true)
  })

  it('refuses a node dropped into its own descendant (FR-008)', () => {
    const { ntree } = mountCanvas()
    expect(dropInto(ntree.props('allowDrop'), 'p2', 'p3', 'drag')).toBe(false)
  })

  it('refuses a sibling drop beside the root, which has no parent to hold it', () => {
    const { ntree } = mountCanvas()
    expect(dropInto(ntree.props('allowDrop'), 'p1', 'root', 'drag', 'before')).toBe(false)
  })

  it('judges a before/after drop against the target parent, not the target', () => {
    const { ntree } = mountCanvas()
    const allowDrop = ntree.props('allowDrop')
    // Dropping c1 beside p3 means landing inside p2, which holds panels — refused.
    expect(dropInto(allowDrop, 'c1', 'p3', 'drag', 'after')).toBe(false)
    // Dropping p1 beside p3 lands in the same p2 and is legal.
    expect(dropInto(allowDrop, 'p1', 'p3', 'drag', 'after')).toBe(true)
  })
})

describe('TreeCanvas applies a drop through the store (FR-006, FR-009)', () => {
  it('an inside drop re-parents the whole subtree', async () => {
    const { store, ntree } = mountCanvas()
    await ntree.vm.$emit('drop', {
      node: { key: 'p2' },
      dragNode: { key: 'p1' },
      dropPosition: 'inside',
    })
    expect(store.nodes.p1.parentId).toBe('p2')
    expect(store.nodes.c1.parentId).toBe('p1')
  })

  it('a before drop reorders among siblings without changing the parent', async () => {
    const { store, ntree } = mountCanvas()
    await ntree.vm.$emit('drop', {
      node: { key: 'p1' },
      dragNode: { key: 'p2' },
      dropPosition: 'before',
    })
    expect(store.nodes.root.childIds).toEqual(['p2', 'p1'])
    expect(store.nodes.p2.parentId).toBe('root')
  })

  it('a refused drop leaves the tree untouched instead of throwing at the widget', async () => {
    const { store, ntree } = mountCanvas()
    const before = store.nodes
    await ntree.vm.$emit('drop', {
      node: { key: 'p2' },
      dragNode: { key: 'c1' },
      dropPosition: 'inside',
    })
    expect(store.nodes).toBe(before)
  })
})
