// Every editing action reachable from the keyboard (FR-030).
//
// The split matters: what the store can do alone — undo, redo, reorder, promote — happens here;
// what needs a name typed or a deletion confirmed is handed back to the view as a callback. A
// composable that opened its own dialogs would be a second, invisible UI.
//
// `onKeyStroke` from VueUse handles listener teardown through `tryOnScopeDispose`, which is the
// part worth not writing again.
import { onKeyStroke } from '@vueuse/core'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { RuleError } from '@/modules/tree/engine/treeOps.js'

/** Typing a name must not delete the node being named. */
function isTextEntry(target) {
  if (!target) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable === true
}

export function useKeyboardTree({
  onAddPanel = () => {},
  onAddConsumer = () => {},
  onDelete = () => {},
  onRename = () => {},
  onRefused = () => {},
} = {}) {
  const tree = useTreeStore()

  /**
   * A refusal from a keystroke is reported, never thrown: there is no call site to catch it. The
   * report carries what was attempted alongside the error, because the view needs both to offer
   * the structural fix rather than only naming the rule (SC-002).
   */
  function attempt(action, request = null) {
    try {
      action()
    } catch (error) {
      if (!(error instanceof RuleError)) throw error
      onRefused({ error, request })
    }
  }

  function siblingsOf(nodeId) {
    const parentId = tree.nodes[nodeId]?.parentId
    if (!parentId) return null
    return { parentId, ids: tree.nodes[parentId].childIds }
  }

  function bind(keys, handler) {
    onKeyStroke(keys, (event) => {
      if (isTextEntry(event.target)) return
      event.preventDefault()
      handler(event)
    })
  }

  bind(['z', 'Z'], (event) => {
    if (!event.ctrlKey && !event.metaKey) return
    if (event.shiftKey) tree.history.redo()
    else tree.history.undo()
  })

  bind(['y', 'Y'], (event) => {
    if (event.ctrlKey || event.metaKey) tree.history.redo()
  })

  bind('Insert', (event) => (event.shiftKey ? onAddConsumer() : onAddPanel()))
  bind('Delete', () => onDelete())
  bind('F2', () => onRename())

  // Alt keeps the arrows for navigation, which `n-tree` already handles.
  bind('ArrowUp', (event) => {
    if (!event.altKey) return
    const siblings = siblingsOf(tree.selectedId)
    if (!siblings) return
    const at = siblings.ids.indexOf(tree.selectedId)
    if (at > 0) attempt(() => tree.reorder(tree.selectedId, at - 1))
  })

  bind('ArrowDown', (event) => {
    if (!event.altKey) return
    const siblings = siblingsOf(tree.selectedId)
    if (!siblings) return
    const at = siblings.ids.indexOf(tree.selectedId)
    if (at !== -1 && at < siblings.ids.length - 1)
      attempt(() => tree.reorder(tree.selectedId, at + 1))
  })

  /** Out one level: the node becomes a sibling of its former parent. */
  bind('ArrowLeft', (event) => {
    if (!event.altKey) return
    const nodeId = tree.selectedId
    const parentId = tree.nodes[nodeId]?.parentId
    const grandparentId = parentId ? tree.nodes[parentId]?.parentId : null
    if (!grandparentId) return
    const at = tree.nodes[grandparentId].childIds.indexOf(parentId)
    attempt(() => tree.move(nodeId, grandparentId, at + 1), {
      op: 'move',
      nodeId,
      parentId: grandparentId,
    })
  })

  /** In one level: the node joins the sibling above it. */
  bind('ArrowRight', (event) => {
    if (!event.altKey) return
    const nodeId = tree.selectedId
    const siblings = siblingsOf(nodeId)
    if (!siblings) return
    const at = siblings.ids.indexOf(nodeId)
    if (at <= 0) return
    const newParentId = siblings.ids[at - 1]
    attempt(() => tree.move(nodeId, newParentId, tree.nodes[newParentId].childIds.length), {
      op: 'move',
      nodeId,
      parentId: newParentId,
    })
  })
}
