// The properties area: the selected node's fields, edited where they stand rather than in a modal
// (FR-029). Name, note and quantity each commit through the store, so one edit is one undo step.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NEmpty, NInput, NInputNumber } from 'naive-ui'
import NodeInspector from '@/modules/tree/components/NodeInspector.vue'
import { useTreeStore } from '@/modules/tree/stores/tree.js'

let wrapper = null

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

/** Entry → panel → one consumer, with the consumer selected. */
function mountWithConsumer() {
  const tree = useTreeStore()
  const panelId = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
  const nodeId = tree.add({
    parentId: panelId,
    kind: 'consumer',
    name: 'Холодильник',
    typeId: 'fridge',
    typeName: 'Холодильник',
  })
  tree.select(nodeId)
  wrapper = mount(NodeInspector)
  return { tree, panelId, nodeId }
}

describe('NodeInspector edits the selected node in place (FR-029)', () => {
  it('shows nothing to edit when nothing is selected', () => {
    const tree = useTreeStore()
    tree.select(null)
    wrapper = mount(NodeInspector)

    expect(wrapper.findComponent(NEmpty).exists()).toBe(true)
  })

  it('renames on commit, touching that node alone (FR-006, FR-024)', async () => {
    const { tree, panelId, nodeId } = mountWithConsumer()
    const panelBefore = tree.nodes[panelId]

    await wrapper.findAllComponents(NInput)[0].vm.$emit('change', 'Холодильник у ніші')

    expect(tree.nodes[nodeId].name).toBe('Холодильник у ніші')
    expect(tree.nodes[nodeId].typeName).toBe('Холодильник')
    expect(tree.nodes[panelId]).toBe(panelBefore)
  })

  it('ignores a blank name instead of writing one the schema would reject', async () => {
    const { tree, nodeId } = mountWithConsumer()

    await wrapper.findAllComponents(NInput)[0].vm.$emit('change', '   ')

    expect(tree.nodes[nodeId].name).toBe('Холодильник')
  })

  it('keeps a note on the node, up to the length the schema allows (FR-012)', async () => {
    const { tree, nodeId } = mountWithConsumer()
    const inputs = wrapper.findAllComponents(NInput)

    // The note commits on `change` for the same reason the name does: one edit, one undo step.
    await inputs[inputs.length - 1].vm.$emit('change', 'окрема лінія')

    expect(tree.nodes[nodeId].note).toBe('окрема лінія')
  })

  it('sets a quantity of eight on one node rather than making eight siblings (FR-025)', async () => {
    const { tree, panelId, nodeId } = mountWithConsumer()

    await wrapper.findComponent(NInputNumber).vm.$emit('update:value', 8)

    expect(tree.nodes[nodeId].quantity).toBe(8)
    expect(tree.nodes[panelId].childIds).toHaveLength(1)
  })

  it('commits one undo step per edit, not one per keystroke (FR-011)', async () => {
    const { tree } = mountWithConsumer()
    const before = tree.history.undoStack.length

    await wrapper.findAllComponents(NInput)[0].vm.$emit('change', 'Морозильник')

    expect(tree.history.undoStack.length).toBe(before + 1)
  })
})

// The fields are controlled inputs: naive-ui shows exactly what `value` holds and emits
// `update:value` per keystroke. Binding `value` straight to the store meant the store never moved
// while typing, so nothing the user typed ever appeared — the field looked frozen. The tests above
// missed it because they emit `change` with a finished string, skipping the typing entirely.
describe('NodeInspector accepts typing before the edit is committed (FR-029)', () => {
  it('shows the characters as they are typed into the name', async () => {
    const { tree, nodeId } = mountWithConsumer()
    const input = wrapper.findAllComponents(NInput)[0]

    await input.vm.$emit('update:value', 'Холодильник у ніші')

    expect(input.props('value')).toBe('Холодильник у ніші')
    // Still one undo step per edit: nothing reaches the store until the field is committed.
    expect(tree.nodes[nodeId].name).toBe('Холодильник')
  })

  it('shows the characters as they are typed into the note', async () => {
    const { tree, nodeId } = mountWithConsumer()
    const inputs = wrapper.findAllComponents(NInput)
    const noteInput = inputs[inputs.length - 1]

    await noteInput.vm.$emit('update:value', 'окрема лінія')

    expect(noteInput.props('value')).toBe('окрема лінія')
    expect(tree.nodes[nodeId].note ?? '').toBe('')
  })

  it('commits what was typed, not what the store still held', async () => {
    const { tree, nodeId } = mountWithConsumer()
    const input = wrapper.findAllComponents(NInput)[0]

    await input.vm.$emit('update:value', 'Морозильник')
    await input.vm.$emit('change', 'Морозильник')

    expect(tree.nodes[nodeId].name).toBe('Морозильник')
  })

  it('follows the selection instead of carrying a half-typed name to the next node', async () => {
    const { tree, panelId } = mountWithConsumer()
    const input = wrapper.findAllComponents(NInput)[0]
    await input.vm.$emit('update:value', 'недописане')

    tree.select(panelId)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAllComponents(NInput)[0].props('value')).toBe('Кухня')
  })

  it('picks up a name changed underneath it, such as by undo', async () => {
    const { tree, nodeId } = mountWithConsumer()
    tree.rename(nodeId, 'Морозильник')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAllComponents(NInput)[0].props('value')).toBe('Морозильник')

    tree.history.undo()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAllComponents(NInput)[0].props('value')).toBe('Холодильник')
  })
})
