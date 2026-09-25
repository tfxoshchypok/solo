// FR-027 keeps the drag preview honest: a drop that breaks homogeneity stays refused while the
// pointer is down. SC-002 asks for more than a refusal — every block has to come with the
// one-step fix. Those meet when the user releases anyway: the drop does not happen, and the fix
// dialog opens for the move they attempted.
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
 * root ─ kitchen ─ lamp      (holds consumers — refuses a panel, fix: wrap the consumers)
 *      ├ floor ─ bedroom     (holds panels — refuses a consumer, fix: place under bedroom)
 *      └ spare               (empty — accepts either kind)
 */
const sample = () =>
  tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [
      { id: 'kitchen', kind: 'panel', name: 'Кухня', children: [consumer('lamp', 'lamp')] },
      {
        id: 'floor',
        kind: 'panel',
        name: 'Поверх',
        children: [{ id: 'bedroom', kind: 'panel', name: 'Спальня' }],
      },
      { id: 'spare', kind: 'panel', name: 'Запас' },
    ],
  })

function mountCanvas() {
  const store = useTreeStore()
  store.setTree(sample())
  const wrapper = mount(TreeCanvas, { attachTo: document.body })
  return { store, wrapper, ntree: wrapper.findComponent(NTree) }
}

/**
 * n-tree's own contract (naive-ui `AllowDrop`, `es/tree/src/interface.d.ts:55-59`): the dragged node
 * is announced once, on `dragstart`, and every `allowDrop` after that names the target alone.
 */
const startDrag = (ntree, dragId) =>
  ntree.vm.$emit('dragstart', { node: { key: dragId }, event: {} })

const hover = (ntree, targetId, dropPosition = 'inside') =>
  ntree.props('allowDrop')({ dropPosition, node: { key: targetId }, phase: 'drag' })

describe('a refused drag still offers its fix once the pointer is released (SC-002, FR-027)', () => {
  it('keeps refusing the drop itself, so the preview never promises a move that cannot happen', () => {
    const { ntree } = mountCanvas()
    startDrag(ntree, 'spare')
    expect(hover(ntree, 'kitchen')).toBe(false)
    startDrag(ntree, 'lamp')
    expect(hover(ntree, 'floor')).toBe(false)
  })

  it('emits the refusal with its fix when the user releases over the refused panel', async () => {
    const { wrapper, ntree } = mountCanvas()
    startDrag(ntree, 'spare')
    hover(ntree, 'kitchen')
    await wrapper.trigger('dragend')

    const [payload] = wrapper.emitted('refused')[0]
    expect(payload.error.fix.kind).toBe('wrapConsumersInNewPanel')
    expect(payload.request).toMatchObject({ op: 'move', nodeId: 'spare', parentId: 'kitchen' })
  })

  it('offers the sub-panel fix when a consumer is dragged onto a panel holding panels', async () => {
    const { wrapper, ntree } = mountCanvas()
    startDrag(ntree, 'lamp')
    hover(ntree, 'floor')
    await wrapper.trigger('dragend')

    const [payload] = wrapper.emitted('refused')[0]
    expect(payload.error.fix.kind).toBe('placeUnderChildPanel')
    expect(payload.error.fix.candidatePanelIds).toEqual(['bedroom'])
  })

  it('says nothing when the pointer last rested somewhere the drop was legal', async () => {
    const { wrapper, ntree } = mountCanvas()
    startDrag(ntree, 'spare')
    hover(ntree, 'kitchen')
    // The user thought better of it and moved onto an empty panel, which accepts anything.
    hover(ntree, 'spare')
    hover(ntree, 'bedroom')
    await wrapper.trigger('dragend')

    expect(wrapper.emitted('refused')).toBeUndefined()
  })

  it('says nothing when the pointer left the tree before the release', async () => {
    const { wrapper, ntree } = mountCanvas()
    startDrag(ntree, 'spare')
    hover(ntree, 'kitchen')
    await wrapper.trigger('dragleave', { relatedTarget: document.body })
    await wrapper.trigger('dragend')

    expect(wrapper.emitted('refused')).toBeUndefined()
  })

  it('says nothing for a refusal no fix can resolve, such as a node dropped into itself', async () => {
    const { wrapper, ntree } = mountCanvas()
    startDrag(ntree, 'floor')
    hover(ntree, 'bedroom')
    await wrapper.trigger('dragend')

    expect(wrapper.emitted('refused')).toBeUndefined()
  })
})
