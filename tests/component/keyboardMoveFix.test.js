// Alt+Left/Right re-parents without a pointer (FR-030). When that move hits the homogeneity rule
// the composable has to hand the view the same thing the add path gets — the error *and* what was
// attempted — or the view has nothing to open the fix dialog with (SC-002).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useKeyboardTree } from '@/composables/useKeyboardTree.js'
import { tree, consumer } from '../fixtures/tree.js'

beforeEach(() => {
  setActivePinia(createPinia())
})

let wrapper = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

/**
 * root ─ kitchen ─ lamp     (holds consumers)
 *      └ spare              (empty, sits after kitchen so Alt+Right joins it to kitchen)
 */
const sample = () =>
  tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [
      { id: 'kitchen', kind: 'panel', name: 'Кухня', children: [consumer('lamp', 'lamp')] },
      { id: 'spare', kind: 'panel', name: 'Запас' },
    ],
  })

function mountKeyboard() {
  const store = useTreeStore()
  store.setTree(sample())
  const refusals = []
  const Host = defineComponent({
    setup() {
      useKeyboardTree({
        onAddPanel: () => {},
        onAddConsumer: () => {},
        onDelete: () => {},
        onRename: () => {},
        onRefused: (payload) => refusals.push(payload),
      })
      return () => h('div')
    },
  })
  wrapper = mount(Host, { attachTo: document.body })
  return { store, refusals }
}

const press = (key, modifiers = {}) =>
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, ...modifiers }))

describe('a keyboard re-parent refused by the rule carries its fix to the view (SC-002)', () => {
  it('reports the error together with the move that was attempted', () => {
    const { store, refusals } = mountKeyboard()
    store.select('spare')

    // Alt+Right joins the node to the sibling above it — kitchen, which holds consumers.
    press('ArrowRight', { altKey: true })

    expect(refusals).toHaveLength(1)
    expect(refusals[0].error.fix.kind).toBe('wrapConsumersInNewPanel')
    expect(refusals[0].request).toMatchObject({ op: 'move', nodeId: 'spare', parentId: 'kitchen' })
  })

  it('leaves the tree untouched when the move is refused', () => {
    const { store, refusals } = mountKeyboard()
    store.select('spare')
    const before = store.nodes

    press('ArrowRight', { altKey: true })

    expect(refusals).toHaveLength(1)
    expect(store.nodes).toEqual(before)
  })
})
