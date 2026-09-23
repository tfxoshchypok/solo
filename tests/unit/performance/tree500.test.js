// 500 nodes is the floor FR-037 sets, and SC-006 asks for no perceptible delay while navigating
// them. The budgets below are deliberately loose — they are a regression guard, not a benchmark:
// an accidental O(n²) in `nestedOptions` or in the store's actions blows past them by an order of
// magnitude, while ordinary machine-to-machine variation does not.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useProjectStore } from '@/stores/project.js'
import { ProjectFileService, normalize } from '@/services/ProjectFileService.js'

const FIXTURE = 'tests/fixtures/tree-500.eltree.json'
const PATH = '/home/user/багатоповерхівка.eltree.json'

/** Wall-clock milliseconds for one call, beside whatever the call returned. */
function ms(action) {
  const started = performance.now()
  const result = action()
  return { elapsed: performance.now() - started, result }
}

let fs = null

beforeEach(async () => {
  setActivePinia(createPinia())
  fs = new MemoryFs({ dataDir: '/memfs/data', savePath: PATH })
  setFs(fs)
  await fs.writeText(PATH, readFileSync(FIXTURE, 'utf8'))
})

afterEach(() => {
  ProjectFileService.cancelAutosave()
  setFs(null)
})

describe('the 500-node fixture is a legal project (FR-037)', () => {
  it('passes the schema and the structural checks like any other file', async () => {
    const { project } = await ProjectFileService.load(PATH)

    expect(project.nodes).toHaveLength(500)
    expect(project.nodes.filter((node) => node.kind === 'panel')).toHaveLength(30)
    expect(project.nodes.filter((node) => node.kind === 'consumer')).toHaveLength(469)
  })

  it('stays within the six-panel depth limit the editor enforces (FR-007)', async () => {
    const { project } = await ProjectFileService.load(PATH)
    const byId = new Map(project.nodes.map((node) => [node.id, node]))

    const depthOf = (node) => {
      let depth = 0
      let current = node
      while (current.parentId !== null) {
        current = byId.get(current.parentId)
        depth += 1
      }
      return depth
    }
    const deepestPanel = Math.max(
      ...project.nodes.filter((node) => node.kind !== 'consumer').map(depthOf),
    )
    expect(deepestPanel).toBeLessThanOrEqual(6)
  })
})

describe('navigating 500 nodes stays responsive (SC-006, quickstart V4)', () => {
  it('opens the file — parse, validate, normalize — in well under a second', async () => {
    const project = useProjectStore()
    const started = performance.now()
    await project.openPath(PATH)
    const elapsed = performance.now() - started

    expect(useTreeStore().nodeCount).toBe(500)
    expect(elapsed).toBeLessThan(500)
  })

  it('builds the nested options n-tree renders in one pass', async () => {
    const tree = useTreeStore()
    const { project } = await ProjectFileService.load(PATH)
    tree.setTree(normalize(project))

    const { elapsed, result } = ms(() => tree.nestedOptions)
    expect(result[0].children).toHaveLength(6)
    expect(elapsed).toBeLessThan(100)
  })

  it('expands every panel and rebuilds the options without a stall', async () => {
    const tree = useTreeStore()
    const { project } = await ProjectFileService.load(PATH)
    tree.setTree(normalize(project))
    const panelIds = project.nodes.filter((node) => node.kind !== 'consumer').map((n) => n.id)

    const { elapsed } = ms(() => {
      tree.setExpanded(panelIds)
      return tree.nestedOptions
    })
    // 30 panels plus the entry node itself.
    expect(tree.expandedIds).toHaveLength(31)
    expect(elapsed).toBeLessThan(100)
  })

  it('selects a hundred different nodes without recomputing the whole tree each time', async () => {
    const tree = useTreeStore()
    const { project } = await ProjectFileService.load(PATH)
    tree.setTree(normalize(project))
    const ids = project.nodes.slice(0, 100).map((node) => node.id)

    const { elapsed } = ms(() => {
      for (const id of ids) tree.select(id)
      return tree.selected
    })
    expect(elapsed).toBeLessThan(50)
  })

  it('moves a whole subtree between panels in a single frame budget (FR-009)', async () => {
    const tree = useTreeStore()
    const { project } = await ProjectFileService.load(PATH)
    tree.setTree(normalize(project))

    const { elapsed } = ms(() => tree.move('n-f1r1', 'n-f6', 0))
    expect(tree.nodes['n-f1r1'].parentId).toBe('n-f6')
    expect(elapsed).toBeLessThan(50)
  })
})
