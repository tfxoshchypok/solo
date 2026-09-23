// A project written against an older catalog names a type this build no longer ships. That is not
// an error state: the node carries its own `typeName` and the tree reads unchanged (FR-034,
// quickstart V3.2).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NTree } from 'naive-ui'
import TreeCanvas from '@/modules/tree/components/TreeCanvas.vue'
import NodeInspector from '@/modules/tree/components/NodeInspector.vue'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useCatalogStore } from '@/modules/tree/stores/catalog.js'
import { useProjectStore } from '@/stores/project.js'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { SCHEMA_VERSION } from '@/schemas/index.js'

const PATH = '/home/user/старий-проект.eltree.json'
const GONE = 'type-from-2019'

/** The same file the 2019 build would have written: a type id no current catalog row answers. */
const oldProject = {
  schemaVersion: SCHEMA_VERSION,
  catalogVersion: '2019.01.1',
  name: 'Квартира 2019',
  createdAt: '2019-01-04T09:00:00.000Z',
  modifiedAt: '2019-01-04T09:00:00.000Z',
  rootId: 'root',
  nodes: [
    {
      id: 'root',
      kind: 'entry',
      name: 'Ввід',
      parentId: null,
      childIds: ['kitchen'],
      childrenKind: 'panels',
    },
    {
      id: 'kitchen',
      kind: 'panel',
      name: 'Кухня',
      parentId: 'root',
      childIds: ['old-node'],
      childrenKind: 'consumers',
    },
    {
      id: 'old-node',
      kind: 'consumer',
      name: 'Холодильник',
      parentId: 'kitchen',
      childIds: [],
      typeId: GONE,
      typeName: 'Холодильник побутовий',
      quantity: 1,
    },
  ],
}

let fs = null

beforeEach(async () => {
  setActivePinia(createPinia())
  fs = new MemoryFs({ dataDir: '/memfs/data' })
  setFs(fs)
  await fs.writeText(PATH, JSON.stringify(oldProject))
})

afterEach(() => {
  setFs(null)
})

describe('a type the catalog no longer ships (FR-034)', () => {
  it('loads the project without complaining about the missing type', async () => {
    const project = useProjectStore()
    const catalog = useCatalogStore()

    await project.openPath(PATH)

    expect(catalog.typeById(GONE)).toBeUndefined()
    expect(useTreeStore().nodes['old-node'].typeId).toBe(GONE)
  })

  it('renders the node in the tree under its own name', async () => {
    const project = useProjectStore()
    await project.openPath(PATH)

    const wrapper = mount(TreeCanvas)
    const data = wrapper.findComponent(NTree).props('data')
    expect(data[0].children[0].children[0].label).toBe('Холодильник')
    wrapper.unmount()
  })

  it('shows the stored typeName in the inspector, not a blank or an id', async () => {
    const project = useProjectStore()
    const tree = useTreeStore()
    await project.openPath(PATH)
    tree.select('old-node')

    const wrapper = mount(NodeInspector)
    expect(wrapper.text()).toContain('Холодильник побутовий')
    expect(wrapper.text()).not.toContain(GONE)
    wrapper.unmount()
  })
})
