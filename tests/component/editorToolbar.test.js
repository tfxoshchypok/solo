// The toolbar's two decisions: where a new child lands, and which file actions are offered.
// Both were reported from the running app — a consumer selected used to disable «Споживач», and a
// consumer added to a collapsed panel used to land somewhere the user could not see.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NConfigProvider, NDialogProvider, NMessageProvider } from 'naive-ui'
import TreeEditorView from '@/modules/tree/views/TreeEditorView.vue'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useProjectStore } from '@/stores/project.js'
import { ProjectFileService } from '@/services/ProjectFileService.js'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { loadTypeRow, zoneRow } from '../fixtures/tree.js'

/** The view calls `useMessage` and `useDialog`, which need their providers above them. */
const Harness = defineComponent({
  setup() {
    return () =>
      h(NConfigProvider, null, {
        default: () =>
          h(NDialogProvider, null, {
            default: () => h(NMessageProvider, null, { default: () => h(TreeEditorView) }),
          }),
      })
  },
})

let wrapper = null

beforeEach(() => {
  setActivePinia(createPinia())
  setFs(new MemoryFs({ dataDir: '/memfs/data' }))
})

afterEach(() => {
  ProjectFileService.cancelAutosave()
  setFs(null)
  wrapper?.unmount()
  wrapper = null
})

function mountEditor() {
  const tree = useTreeStore()
  const project = useProjectStore()
  wrapper = mount(Harness, { attachTo: document.body })
  return { tree, project, editor: wrapper.findComponent(TreeEditorView).vm }
}

describe('where a new child lands', () => {
  it('adds into the selected panel', () => {
    const { tree, editor } = mountEditor()
    const kitchen = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    tree.select(kitchen)

    expect(editor.addTargetId).toBe(kitchen)
    expect(editor.canAddHere).toBe(true)
    expect(editor.addTargetName).toBe('Кухня')
  })

  it('adds beside the selected consumer, into its own panel', () => {
    const { tree, editor } = mountEditor()
    const kitchen = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    const fridge = tree.add({
      parentId: kitchen,
      kind: 'consumer',
      name: 'Холодильник',
      loadType: loadTypeRow(),
      zone: zoneRow(),
    })
    tree.select(fridge)

    // The button stays live: "another one of these here" is the common next action.
    expect(editor.canAddHere).toBe(true)
    expect(editor.addTargetId).toBe(kitchen)
  })

  it('opens the picker on the panel, not on the consumer that was selected', async () => {
    const { tree, editor } = mountEditor()
    const kitchen = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    const fridge = tree.add({
      parentId: kitchen,
      kind: 'consumer',
      name: 'Холодильник',
      loadType: loadTypeRow(),
      zone: zoneRow(),
    })
    tree.select(fridge)

    editor.addConsumer()
    await wrapper.vm.$nextTick()

    expect(editor.picking).toBe(true)
    expect(editor.pickerParentId).toBe(kitchen)
  })
})

describe('a node that was just added is visible', () => {
  it('opens the panel that received the consumer, and every panel above it', () => {
    const { tree } = mountEditor()
    const floor = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Поверх' })
    const kitchen = tree.add({ parentId: floor, kind: 'panel', name: 'Кухня' })
    tree.setExpanded([tree.rootId])
    expect(tree.expandedIds).not.toContain(kitchen)

    const fridge = tree.add({
      parentId: kitchen,
      kind: 'consumer',
      name: 'Холодильник',
      loadType: loadTypeRow(),
      zone: zoneRow(),
    })

    expect(tree.expandedIds).toContain(kitchen)
    expect(tree.expandedIds).toContain(floor)
    expect(tree.nodes[fridge].parentId).toBe(kitchen)
  })
})

describe('the project menu', () => {
  it('offers Save only when there is something to save', () => {
    const { tree, project, editor } = mountEditor()
    const saveItem = () => editor.projectMenu.find((item) => item.key === 'save')

    expect(project.isDirty).toBe(false)
    expect(saveItem().disabled).toBe(true)

    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })

    expect(saveItem().disabled).toBe(false)
    expect(saveItem().label).toBe('Зберегти')
  })

  it('keeps all four file actions behind one trigger', () => {
    const { editor } = mountEditor()
    expect(editor.projectMenu.filter((item) => item.type !== 'divider').map((i) => i.key)).toEqual([
      'new',
      'open',
      'save',
      'saveAs',
    ])
  })
})
