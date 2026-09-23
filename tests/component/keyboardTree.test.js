import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useKeyboardTree } from '@/composables/useKeyboardTree.js'

beforeEach(() => {
  setActivePinia(createPinia())
})

let wrapper = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

/** Records the actions that need UI (a name, a confirmation) instead of performing them. */
function mountKeyboard() {
  const calls = { addPanel: 0, addConsumer: 0, remove: 0, rename: 0 }
  const Host = defineComponent({
    setup() {
      useKeyboardTree({
        onAddPanel: () => (calls.addPanel += 1),
        onAddConsumer: () => (calls.addConsumer += 1),
        onDelete: () => (calls.remove += 1),
        onRename: () => (calls.rename += 1),
      })
      return () => h('div')
    },
  })
  wrapper = mount(Host, { attachTo: document.body })
  return calls
}

const press = (key, modifiers = {}) =>
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, ...modifiers }))

describe('useKeyboardTree reaches every editing action without a pointer (FR-030)', () => {
  it('routes the actions that need UI to the view rather than guessing', () => {
    const calls = mountKeyboard()
    press('Insert')
    press('Insert', { shiftKey: true })
    press('Delete')
    press('F2')
    expect(calls).toEqual({ addPanel: 1, addConsumer: 1, remove: 1, rename: 1 })
  })

  it('undoes and redoes with Ctrl+Z and Ctrl+Shift+Z (FR-011)', () => {
    const store = useTreeStore()
    mountKeyboard()
    store.rename(store.rootId, 'Головний ввід')
    expect(store.nodes[store.rootId].name).toBe('Головний ввід')

    press('z', { ctrlKey: true })
    expect(store.nodes[store.rootId].name).toBe('Ввід')

    press('z', { ctrlKey: true, shiftKey: true })
    expect(store.nodes[store.rootId].name).toBe('Головний ввід')
  })

  it('reorders among siblings with Alt+Up and Alt+Down (FR-006)', () => {
    const store = useTreeStore()
    mountKeyboard()
    const first = store.add({ parentId: store.rootId, kind: 'panel', name: 'Перший' })
    const second = store.add({ parentId: store.rootId, kind: 'panel', name: 'Другий' })
    expect(store.nodes[store.rootId].childIds).toEqual([first, second])

    store.select(second)
    press('ArrowUp', { altKey: true })
    expect(store.nodes[store.rootId].childIds).toEqual([second, first])

    press('ArrowDown', { altKey: true })
    expect(store.nodes[store.rootId].childIds).toEqual([first, second])
  })

  it('promotes a node to its grandparent with Alt+Left (FR-009)', () => {
    const store = useTreeStore()
    mountKeyboard()
    const outer = store.add({ parentId: store.rootId, kind: 'panel', name: 'Поверх' })
    const inner = store.add({ parentId: outer, kind: 'panel', name: 'Кімната' })

    store.select(inner)
    press('ArrowLeft', { altKey: true })
    expect(store.nodes[inner].parentId).toBe(store.rootId)
  })

  it('stays inert while a text field has focus, so typing a name is not an edit command', () => {
    const store = useTreeStore()
    const calls = mountKeyboard()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    expect(calls.remove).toBe(0)

    input.remove()
    void store
  })

  it('builds the same tree by keystrokes as by store calls (US1 scenario 9)', () => {
    const store = useTreeStore()
    mountKeyboard()

    // By hand: two panels, the second moved to the front.
    const a = store.add({ parentId: store.rootId, kind: 'panel', name: 'A' })
    const b = store.add({ parentId: store.rootId, kind: 'panel', name: 'B' })
    store.select(b)
    press('ArrowUp', { altKey: true })
    const byKeyboard = store.nodes[store.rootId].childIds

    // The same sequence through the store alone.
    store.reset()
    const a2 = store.add({ parentId: store.rootId, kind: 'panel', name: 'A' })
    const b2 = store.add({ parentId: store.rootId, kind: 'panel', name: 'B' })
    store.reorder(b2, 0)
    const byStore = store.nodes[store.rootId].childIds

    expect(byKeyboard.map((id) => (id === a ? 'A' : 'B'))).toEqual(
      byStore.map((id) => (id === a2 ? 'A' : 'B')),
    )
  })
})
