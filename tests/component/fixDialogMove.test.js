// The fix dialog was built for the add path, where `pending` describes a node that does not exist
// yet. A block reached by moving carries an existing node instead, and the same two fixes have to
// resolve it (SC-002).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StructuralFixDialog from '@/modules/tree/components/StructuralFixDialog.vue'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { tree, consumer, loadTypeRow, zoneRow } from '../fixtures/tree.js'

beforeEach(() => {
  setActivePinia(createPinia())
})

let wrapper = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

const sample = () =>
  tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [
      { id: 'kitchen', kind: 'panel', name: 'Кухня', children: [consumer('lamp')] },
      {
        id: 'floor',
        kind: 'panel',
        name: 'Поверх',
        children: [{ id: 'bedroom', kind: 'panel', name: 'Спальня' }],
      },
      { id: 'spare', kind: 'panel', name: 'Запас' },
    ],
  })

function mountDialog(error, pending) {
  const store = useTreeStore()
  store.setTree(sample())
  wrapper = mount(StructuralFixDialog, {
    props: { error, pending },
    attachTo: document.body,
  })
  return store
}

describe('StructuralFixDialog resolves a move, not only an add (SC-002)', () => {
  it('wraps the existing consumers and moves the dragged panel in beside them', async () => {
    const store = mountDialog(
      {
        message: 'Кухня вже містить споживачів.',
        fix: { kind: 'wrapConsumersInNewPanel', parentId: 'kitchen', consumerIds: ['lamp'] },
      },
      { op: 'move', nodeId: 'spare', parentId: 'kitchen' },
    )

    wrapper.vm.panelName = 'Освітлення'
    await wrapper.vm.apply()

    expect(store.nodes.spare.parentId).toBe('kitchen')
    const wrapperId = store.nodes.kitchen.childIds.find((id) => id !== 'spare')
    expect(store.nodes[wrapperId].childIds).toEqual(['lamp'])
    // The moved node is the one the caller asked about, not a newly created one.
    expect(wrapper.emitted('resolved')[0][0]).toBe('spare')
  })

  it('moves the consumer under the chosen sub-panel instead of creating a second one', async () => {
    const store = mountDialog(
      {
        message: 'Поверх уже містить щитки.',
        fix: { kind: 'placeUnderChildPanel', parentId: 'floor', candidatePanelIds: ['bedroom'] },
      },
      { op: 'move', nodeId: 'lamp', parentId: 'floor' },
    )
    const countBefore = Object.keys(store.nodes).length

    await wrapper.vm.apply()

    expect(store.nodes.lamp.parentId).toBe('bedroom')
    expect(Object.keys(store.nodes)).toHaveLength(countBefore)
    expect(wrapper.emitted('resolved')[0][0]).toBe('lamp')
  })

  it('still adds a new node when the pending request is an add', async () => {
    const store = mountDialog(
      {
        message: 'Поверх уже містить щитки.',
        fix: { kind: 'placeUnderChildPanel', parentId: 'floor', candidatePanelIds: ['bedroom'] },
      },
      { kind: 'consumer', name: 'Торшер', loadType: loadTypeRow(), zone: zoneRow() },
    )
    const countBefore = Object.keys(store.nodes).length

    await wrapper.vm.apply()

    expect(Object.keys(store.nodes)).toHaveLength(countBefore + 1)
    expect(store.nodes[wrapper.emitted('resolved')[0][0]].parentId).toBe('bedroom')
  })
})
