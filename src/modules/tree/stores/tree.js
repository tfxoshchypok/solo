// The normalized tree, the selection, and the undo/redo handle.
//
// The store calls engines and reads the catalog store; it never touches the filesystem. Structural
// change goes through treeOps, which returns a new frozen map, so `commit()` on the history handle
// costs a reference rather than a deep clone — that is why `clone: false` is correct here (R5).
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import { freeze } from 'immer'
import { childrenKindAfter } from '../engine/homogeneity.js'

/** Steps of undo history kept. 100 snapshots of a 500-node map is a few megabytes (R5). */
export const HISTORY_CAPACITY = 100

/** A new project is exactly one node of kind `entry` (FR-002). */
export function createEmptyTree(name = 'Ввід') {
  const rootId = `n-${globalThis.crypto.randomUUID()}`
  return {
    rootId,
    nodes: freeze(
      {
        [rootId]: {
          id: rootId,
          kind: 'entry',
          name,
          parentId: null,
          childIds: [],
          childrenKind: 'undecided',
        },
      },
      true,
    ),
  }
}

export const useTreeStore = defineStore('tree', () => {
  const initial = createEmptyTree()
  const nodes = ref(initial.nodes)
  const rootId = ref(initial.rootId)
  const selectedId = ref(initial.rootId)
  const expandedIds = ref([initial.rootId])

  const history = useManualRefHistory(nodes, { capacity: HISTORY_CAPACITY, clone: false })

  const root = computed(() => nodes.value[rootId.value])
  const selected = computed(() => (selectedId.value ? nodes.value[selectedId.value] : null))
  const nodeCount = computed(() => Object.keys(nodes.value).length)

  /**
   * The nested array `n-tree` wants. `children` is derived here and never stored, so `childIds`
   * stays the single source of sibling order.
   */
  const nestedOptions = computed(() => {
    const build = (id) => {
      const node = nodes.value[id]
      if (!node) return null
      const option = {
        key: node.id,
        label: node.name,
        kind: node.kind,
        node,
      }
      if (node.kind === 'consumer') {
        option.isLeaf = true
      } else {
        option.isLeaf = false
        option.childrenKind = childrenKindAfter(nodes.value, node.id)
        option.children = node.childIds.map(build).filter(Boolean)
      }
      return option
    }
    const built = build(rootId.value)
    return built ? [built] : []
  })

  /** Replaces the whole tree — used by project load and by "new project". */
  function setTree({ nodes: nextNodes, rootId: nextRootId }) {
    nodes.value = freeze(nextNodes, true)
    rootId.value = nextRootId
    selectedId.value = nextRootId
    expandedIds.value = [nextRootId]
    // `commit()` before `clear()`, and in that order: `clear()` empties both stacks but leaves the
    // handle's `last` snapshot pointing at the tree from before the load, so the next commit would
    // push that one onto the undo stack and the first undo would throw the loaded project away.
    // `commit()` re-reads the source into `last`, `clear()` then drops the entry it just pushed.
    history.commit()
    history.clear()
  }

  function reset() {
    setTree(createEmptyTree())
  }

  function select(nodeId) {
    selectedId.value = nodeId
  }

  function setExpanded(ids) {
    expandedIds.value = [...ids]
  }

  return {
    nodes,
    rootId,
    selectedId,
    expandedIds,
    root,
    selected,
    nodeCount,
    nestedOptions,
    history,
    setTree,
    reset,
    select,
    setExpanded,
  }
})
