// The normalized tree, the selection, and the undo/redo handle.
//
// The store calls engines and reads the reference tables store, to find the row a consumer copies
// (002/FR-010); it never touches the filesystem. Structural
// change goes through treeOps, which returns a new frozen map, so `commit()` on the history handle
// costs a reference rather than a deep clone — that is why `clone: false` is correct here (R5).
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import { freeze } from 'immer'
import { childrenKindAfter } from '../engine/homogeneity.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import {
  addNode,
  moveNode,
  removeNode,
  renameNode,
  reorderSibling,
  setNote as setNoteOn,
  setConsumerLoadType,
  setConsumerZone,
  setConsumerCopyValue,
  setCableSection as setCableSectionOn,
  wrapChildrenInPanel,
} from '../engine/treeOps.js'
import {
  setBuySeparately as setBuySeparatelyOn,
  setIncomingDeviceMark as setIncomingDeviceMarkOn,
  setPanelOverride as setPanelOverrideOn,
  setProjectProperty as setProjectPropertyOn,
} from '../engine/panelProperties.js'

/** Steps of undo history kept. 100 snapshots of a 500-node map is a few megabytes (R5). */
export const HISTORY_CAPACITY = 100

/** A new project is exactly one node of kind `entry` (FR-002), its properties empty (003/FR-003). */
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
          projectProperties: {
            supplyPhases: null,
            moduleReservePct: null,
            separateRcdMode: null,
            maxLinesPerGroupRcd: null,
            neutralBreak: null,
            selectiveFeederRcd: null,
          },
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

  /**
   * Every structural action has the same three beats: call the engine, take the map it returns,
   * commit one history step. A `RuleError` escapes before the assignment, so a refused action
   * leaves both the tree and the history exactly as they were — which is what lets the UI catch
   * it and offer the fix without first undoing anything (FR-011, FR-015).
   */
  function apply(nextNodes) {
    nodes.value = nextNodes
    history.commit()
  }

  /** The rows a new panel copies, as the table stands at this moment (003/FR-009). */
  function incomingDeviceRows() {
    return useReferenceTablesStore().tables.incomingDevices
  }

  function add({ parentId, kind, name, loadType, zone }) {
    const { nodes: next, nodeId } = addNode(nodes.value, {
      parentId,
      kind,
      name,
      loadType,
      zone,
      incomingDevices: incomingDeviceRows(),
    })
    apply(next)
    // The parent opens whatever was added: a new panel is a place the user is about to fill, and a
    // new consumer is a row they need to see to rename it.
    expandTo(parentId)
    return nodeId
  }

  function rename(nodeId, name) {
    apply(renameNode(nodes.value, nodeId, name))
  }

  function setNote(nodeId, note) {
    apply(setNoteOn(nodes.value, nodeId, note))
  }

  /** The row as it stands in the table at this moment; the engine copies it (002/FR-014). */
  function setLoadType(nodeId, loadTypeId) {
    const { loadTypeById } = useReferenceTablesStore()
    apply(setConsumerLoadType(nodes.value, nodeId, loadTypeById.get(loadTypeId)))
  }

  function setZone(nodeId, zoneId) {
    const { zoneById } = useReferenceTablesStore()
    apply(setConsumerZone(nodes.value, nodeId, zoneById.get(zoneId)))
  }

  /** One value of the consumer's copy; the reference tables are never touched (002/FR-021). */
  function setCopyValue(nodeId, part, key, value) {
    apply(setConsumerCopyValue(nodes.value, nodeId, part, key, value))
  }

  function setCableSection(nodeId, mm2) {
    apply(setCableSectionOn(nodes.value, nodeId, mm2))
  }

  /** One project property, set or cleared with `null`; one undo step (003/FR-002, 003/FR-021). */
  function setProjectProperty(key, value) {
    apply(setProjectPropertyOn(nodes.value, rootId.value, key, value))
  }

  /** A panel's own value, set or reset with `null`; one undo step (003/FR-006, 003/FR-021). */
  function setPanelOverride(nodeId, key, value) {
    apply(setPanelOverrideOn(nodes.value, nodeId, key, value))
  }

  /** One «встановлювати» mark of a panel; one undo step (003/FR-010, 003/FR-021). */
  function setIncomingDeviceMark(nodeId, deviceId, install) {
    apply(setIncomingDeviceMarkOn(nodes.value, nodeId, deviceId, install))
  }

  /** One «купувати окремо» mark of a panel; one undo step (003/FR-010, 003/FR-021). */
  function setBuySeparately(nodeId, key, checked) {
    apply(setBuySeparatelyOn(nodes.value, nodeId, key, checked))
  }

  /** @returns {string[]} the ids that went, which the confirmation counted beforehand (FR-010) */
  function remove(nodeId) {
    const parentId = nodes.value[nodeId]?.parentId ?? rootId.value
    const { nodes: next, removedIds } = removeNode(nodes.value, nodeId)
    apply(next)
    // Selecting a node that no longer exists leaves the inspector bound to nothing.
    const gone = new Set([nodeId, ...removedIds])
    if (gone.has(selectedId.value)) selectedId.value = next[parentId] ? parentId : rootId.value
    expandedIds.value = expandedIds.value.filter((id) => !gone.has(id))
    return removedIds
  }

  /**
   * The fix FR-016 offers: the panel already holds consumers, the user asked for a sub-panel, so
   * the consumers move into a new sub-panel of their own and the requested one lands beside them.
   *
   * Three engine calls, one `commit`. The user pressed one button, so one undo has to take all of
   * it back — committing per call would leave them pressing undo three times to reverse a single
   * confirmation, with two of the intermediate states being trees they never asked for.
   *
   * @returns {string} the id of the node the user originally wanted to add
   */
  function wrapConsumersAndAdd({ parentId, panelName, pending }) {
    // Chained through a local, never through `nodes.value`: the store must not hold an
    // intermediate tree at any point, or a reactive reader would render one.
    const rows = incomingDeviceRows()
    const wrap = wrapChildrenInPanel(nodes.value, parentId, panelName, rows)
    const added = addNode(wrap.nodes, { parentId, ...pending, incomingDevices: rows })

    apply(added.nodes)
    expandedIds.value = [...new Set([...expandedIds.value, parentId, wrap.nodeId])]
    return added.nodeId
  }

  /**
   * The same fix as `wrapConsumersAndAdd`, for a node that is already in the tree. A user who
   * drags a panel onto a consumer-holding panel, or presses Alt+Right into one, is refused by the
   * same rule and deserves the same one-button way out (SC-002).
   *
   * Two engine calls, one `commit`, for the reason spelled out above: one confirmation has to
   * cost one undo.
   *
   * @returns {string} the id of the node that was moved, which is the one the caller selected
   */
  function wrapConsumersAndMove({ parentId, panelName, nodeId, index }) {
    const wrap = wrapChildrenInPanel(nodes.value, parentId, panelName, incomingDeviceRows())
    const at = index ?? wrap.nodes[parentId].childIds.length
    // Throws before `apply`, so a refused move leaves the wrap unapplied too — the tree never
    // holds the intermediate state where the consumers moved but the node did not arrive.
    const next = moveNode(wrap.nodes, nodeId, parentId, at)

    apply(next)
    expandedIds.value = [...new Set([...expandedIds.value, parentId, wrap.nodeId])]
    return nodeId
  }

  function move(nodeId, newParentId, index = 0) {
    apply(moveNode(nodes.value, nodeId, newParentId, index))
    // Same reason as `add`: a node carried into a collapsed panel would otherwise vanish from view.
    expandTo(newParentId)
  }

  function reorder(nodeId, index) {
    apply(reorderSibling(nodes.value, nodeId, index))
  }

  function setExpanded(ids) {
    expandedIds.value = [...ids]
  }

  /**
   * Opens every ancestor of `nodeId`, the node itself included, so a node the code just touched is
   * actually on screen. Adding a consumer to a collapsed panel used to leave it invisible: the
   * selection moved to a row nobody could see.
   */
  function expandTo(nodeId) {
    const chain = []
    const seen = new Set()
    let current = nodeId
    while (current && nodes.value[current] && !seen.has(current)) {
      seen.add(current)
      chain.push(current)
      current = nodes.value[current].parentId
    }
    if (chain.length === 0) return
    expandedIds.value = [...new Set([...expandedIds.value, ...chain])]
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
    expandTo,
    add,
    rename,
    setNote,
    setLoadType,
    setZone,
    setCopyValue,
    setCableSection,
    setProjectProperty,
    setPanelOverride,
    setIncomingDeviceMark,
    setBuySeparately,
    wrapConsumersAndAdd,
    wrapConsumersAndMove,
    remove,
    move,
    reorder,
  }
})
