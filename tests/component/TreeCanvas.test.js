import { describe, it, expect, beforeEach, vi } from 'vitest'
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

  // The inspector on the right edits whatever is selected. n-tree's default treats a second click
  // on the selected row as "unselect", which empties the inspector on a gesture the user makes all
  // the time — clicking the row they are already working on. The click itself cannot be driven
  // here: the virtual list renders no rows without layout, so the test holds the prop that turns
  // the unselect off.
  it('keeps the selection when the selected row is clicked again', () => {
    const { ntree } = mountCanvas()
    expect(ntree.props('cancelable')).toBe(false)
  })

  // n-tree 2.45.3 shows a frozen snapshot of its rows while an expand/collapse animation runs, and
  // only the animation's end unfreezes it. When the collapsed key belongs to a node that was just
  // deleted, or to one with no children, it freezes without starting any animation
  // (`naive-ui/es/tree/src/Tree.mjs:461` sets the flag, `:480-482` return before the motion node).
  // Deleting expanded panels until the tree is empty and adding one hid the new panel until the
  // next add. With animation off, n-tree renders its live rows every time.
  it('renders the live rows rather than an animation snapshot that can get stuck', () => {
    const { ntree } = mountCanvas()
    expect(ntree.props('animated')).toBe(false)
  })
})

describe('TreeCanvas refuses an illegal drop while the pointer is down (FR-027)', () => {
  // n-tree's own contract (naive-ui `AllowDrop`, `es/tree/src/interface.d.ts:55-59`): the dragged
  // node is announced once, on `dragstart`, and `allowDrop` is then asked about the target alone —
  // `{ node, dropPosition, phase }`, with no `dragNode`. Passing one here hid that the canvas could
  // not tell what was being dragged, and every real drag was refused.
  const dropInto = (ntree, dragId, targetId, phase, dropPosition = 'inside') => {
    ntree.vm.$emit('dragstart', { node: { key: dragId }, event: {} })
    return ntree.props('allowDrop')({ dropPosition, node: { key: targetId }, phase })
  }

  // n-tree starts the drag without putting anything into `dataTransfer`. Chrome carries such a drag
  // anyway; WebKitGTK on Wayland — the Neutralino window on Linux — cancels it straight after
  // `dragstart`, and not one `dragover` or `drop` reaches the tree.
  it('gives the drag a payload, without which WebKitGTK on Wayland cancels it', async () => {
    const { ntree } = mountCanvas()
    const dataTransfer = { setData: vi.fn(), effectAllowed: 'uninitialized' }
    await ntree.vm.$emit('dragstart', { node: { key: 'p1' }, event: { dataTransfer } })

    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'p1')
    expect(dataTransfer.effectAllowed).toBe('move')
  })

  it('consults the same predicate in both phases, so the drag preview cannot disagree', () => {
    const { ntree } = mountCanvas()
    // p2 holds panels, so a consumer dropped inside it breaks homogeneity (FR-013).
    expect(dropInto(ntree, 'c1', 'p2', 'drag')).toBe(false)
    expect(dropInto(ntree, 'c1', 'p2', 'drop')).toBe(false)
  })

  it('allows a panel into a panel-parent', () => {
    const { ntree } = mountCanvas()
    expect(dropInto(ntree, 'p1', 'p2', 'drag')).toBe(true)
  })

  it('refuses a node dropped into its own descendant (FR-008)', () => {
    const { ntree } = mountCanvas()
    expect(dropInto(ntree, 'p2', 'p3', 'drag')).toBe(false)
  })

  it('refuses a sibling drop beside the root, which has no parent to hold it', () => {
    const { ntree } = mountCanvas()
    expect(dropInto(ntree, 'p1', 'root', 'drag', 'before')).toBe(false)
  })

  it('judges a before/after drop against the target parent, not the target', () => {
    const { ntree } = mountCanvas()
    // Dropping c1 beside p3 means landing inside p2, which holds panels — refused.
    expect(dropInto(ntree, 'c1', 'p3', 'drag', 'after')).toBe(false)
    // Dropping p1 beside p3 lands in the same p2 and is legal.
    expect(dropInto(ntree, 'p1', 'p3', 'drag', 'after')).toBe(true)
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

  // A node dropped into a collapsed panel used to vanish from view: the panel stayed shut and the
  // row the user had just carried was nowhere on screen. `add` already opens its target; a move
  // opens the new parent, and every panel above it, the same way.
  it('opens the panel that received the drop, and every panel above it', async () => {
    const { store, ntree } = mountCanvas()
    store.setExpanded(['root'])
    await ntree.vm.$emit('drop', {
      node: { key: 'p3' },
      dragNode: { key: 'p1' },
      dropPosition: 'inside',
    })
    expect(store.nodes.p1.parentId).toBe('p3')
    expect(store.expandedIds).toContain('p3')
    expect(store.expandedIds).toContain('p2')
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

  // The drop names a place in the sibling list as it stands, with the dragged node still in it;
  // the store takes the node out before it puts it back. Moving down, every place past the node
  // shifts up by one, and the node used to land one row too far.
  it('an after drop further down lands right below its target', async () => {
    const { store, ntree } = mountCanvas()
    const garage = store.add({ parentId: 'root', kind: 'panel', name: 'Гараж' })
    await ntree.vm.$emit('drop', {
      node: { key: 'p2' },
      dragNode: { key: 'p1' },
      dropPosition: 'after',
    })
    expect(store.nodes.root.childIds).toEqual(['p2', 'p1', garage])
  })

  it('a before drop further down lands right above its target', async () => {
    const { store, ntree } = mountCanvas()
    const garage = store.add({ parentId: 'root', kind: 'panel', name: 'Гараж' })
    await ntree.vm.$emit('drop', {
      node: { key: garage },
      dragNode: { key: 'p1' },
      dropPosition: 'before',
    })
    expect(store.nodes.root.childIds).toEqual(['p2', 'p1', garage])
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
