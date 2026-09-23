<script setup>
// The tree itself. Everything it knows lives in the store; this component owns no state, only the
// translation between `n-tree`'s drag contract and the engine's rules.
import { computed, h } from 'vue'
import { NEmpty, NIcon, NTree } from 'naive-ui'
import { BulbOutline, GridOutline, PowerOutline } from '@vicons/ionicons5'
import { useTreeStore } from '../stores/tree.js'
import { canAccept } from '../engine/homogeneity.js'
import { isDescendantOf, RuleError } from '../engine/treeOps.js'

const tree = useTreeStore()

const emit = defineEmits(['refused'])

const data = computed(() => tree.nestedOptions)
/** A project that is only its entry node has nothing to navigate yet, so it says what to do. */
const isFresh = computed(() => tree.nodeCount === 1)
const expandedKeys = computed(() => tree.expandedIds)
const selectedKeys = computed(() => (tree.selectedId ? [tree.selectedId] : []))

/**
 * The panel the user is working inside. When a consumer is selected the row that highlights is the
 * consumer, and the panel it belongs to is what the next «Щиток»/«Споживач» press will fill — so it
 * is marked too, otherwise the target of the toolbar is invisible.
 */
const activeParentId = computed(() => tree.nodes[tree.selectedId]?.parentId ?? null)

const KIND_ICON = { entry: PowerOutline, panel: GridOutline, consumer: BulbOutline }

/** One glyph per kind: an entry, a panel and a consumer are not distinguishable by name alone. */
function renderPrefix({ option }) {
  const icon = KIND_ICON[option.kind]
  if (!icon) return null
  return h(NIcon, { class: `tree-canvas-icon tree-canvas-icon--${option.kind}` }, () => h(icon))
}

function nodeProps({ option }) {
  return {
    class: [
      'tree-canvas-node',
      `tree-canvas-node--${option.kind}`,
      option.key === activeParentId.value ? 'tree-canvas-node--branch' : '',
    ],
  }
}

/**
 * Where a drop would land: `inside` means the target becomes the parent, `before`/`after` mean the
 * target's parent does. Resolving that first is what lets one predicate answer both cases.
 */
function landingParentId(targetId, dropPosition) {
  if (dropPosition === 'inside') return targetId
  return tree.nodes[targetId]?.parentId ?? null
}

/**
 * The verdict on a hovered position: whether the drop may happen, and — when it may not but the
 * homogeneity rule offers a way out — what to offer once the pointer comes up.
 *
 * @returns {{ ok: boolean, refusal?: { error: object, request: object } }}
 */
function judgeDrop({ dropPosition, node, dragNode }) {
  const dragId = dragNode?.key
  const targetId = node?.key
  if (!dragId || !targetId || dragId === targetId) return { ok: false }

  const parentId = landingParentId(targetId, dropPosition)
  // A sibling drop beside the root has nowhere to land: the entry node has no parent (FR-002).
  if (!parentId || !tree.nodes[parentId]) return { ok: false }

  // Moving a node inside its own subtree would detach that subtree from the root (FR-008). There
  // is no fix to offer for it — the request itself is incoherent.
  if (parentId === dragId || isDescendantOf(tree.nodes, parentId, dragId)) return { ok: false }

  const dragKind = tree.nodes[dragId]?.kind
  if (!dragKind) return { ok: false }
  // Already there and staying there: reordering never changes what the parent holds.
  if (tree.nodes[dragId].parentId === parentId) return { ok: true }

  const verdict = canAccept(tree.nodes, parentId, dragKind)
  if (verdict.ok) return { ok: true }
  if (!verdict.fix) return { ok: false }
  return {
    ok: false,
    refusal: { error: verdict, request: { op: 'move', nodeId: dragId, parentId } },
  }
}

/**
 * The refusal the pointer is currently resting on, if it carries a fix. `allowDrop` is a boolean
 * contract with nowhere to put a reason, so the reason is parked here and released on `dragend`:
 * the drop still does not happen (FR-027), but the user is not left guessing (SC-002).
 */
let pendingRefusal = null

/**
 * Consulted by `n-tree` twice — once per pointer move during the drag, once at the release. Both
 * calls run the engine's own `canAccept`, so the preview the user sees and the rule the store
 * enforces cannot drift apart (FR-027, R3).
 */
function allowDrop(args) {
  const verdict = judgeDrop(args)
  // Only the drag phase tracks where the pointer is; the release phase asks about the same
  // position and would just re-confirm what the last move already recorded.
  if (args.phase === 'drag') pendingRefusal = verdict.refusal ?? null
  return verdict.ok
}

/** The pointer left the tree: whatever it was resting on is no longer what the user chose. */
function onDragLeave(event) {
  if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return
  pendingRefusal = null
}

/** The release. A drop that happened cleared this already; one that did not offers its fix. */
function onDragEnd() {
  const refusal = pendingRefusal
  pendingRefusal = null
  if (refusal) emit('refused', refusal)
}

/**
 * `n-tree` has already asked `allowDrop` by the time this fires, but the store is the authority:
 * a rule the widget did not consult still refuses here, and the refusal reaches the view rather
 * than the widget, which has no way to show it.
 */
function onDrop({ node, dragNode, dropPosition }) {
  const dragId = dragNode?.key
  const targetId = node?.key
  const parentId = landingParentId(targetId, dropPosition)
  pendingRefusal = null
  if (!dragId || !parentId) return

  try {
    if (dropPosition === 'inside') {
      tree.move(dragId, parentId, tree.nodes[parentId].childIds.length)
      return
    }
    const siblings = tree.nodes[parentId].childIds
    const at = siblings.indexOf(targetId)
    const index = dropPosition === 'before' ? at : at + 1
    if (tree.nodes[dragId].parentId === parentId) tree.reorder(dragId, index)
    else tree.move(dragId, parentId, index)
  } catch (error) {
    if (!(error instanceof RuleError)) throw error
    emit('refused', { error, request: { op: 'move', nodeId: dragId, parentId } })
  }
}
</script>

<template>
  <div class="tree-canvas" @dragleave="onDragLeave" @dragend="onDragEnd">
    <n-tree
      block-line
      virtual-scroll
      draggable
      :class="['tree-canvas-tree', { 'tree-canvas-tree--grow': !isFresh }]"
      :data="data"
      :expanded-keys="expandedKeys"
      :selected-keys="selectedKeys"
      :allow-drop="allowDrop"
      :node-props="nodeProps"
      :render-prefix="renderPrefix"
      @drop="onDrop"
      @update:expanded-keys="tree.setExpanded"
      @update:selected-keys="(keys) => tree.select(keys[0] ?? null)"
    />

    <n-empty v-if="isFresh" size="small" class="tree-canvas-empty" description="Проект порожній">
      <template #extra>
        Додайте перший щиток — кнопка «Щиток» угорі або клавіша Insert. Шифт+Insert ставить
        споживача.
      </template>
    </n-empty>
  </div>
</template>

<style scoped>
.tree-canvas {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--app-gutter);
}

/* `virtualScroll` measures its own container, so the tree needs a definite height whenever there
   is anything to scroll. A project that is only its entry node does not — there the tree shrinks
   to its one row and leaves the hint below it. */
.tree-canvas-tree {
  flex: 0 0 auto;
}

.tree-canvas-tree--grow {
  flex: 1 1 auto;
  min-height: 0;
}

/* One guide line per indent level, so a consumer reads as belonging to the panel above it rather
   than as a row that happens to start further right. `:deep` is required: the indent spans are
   n-tree's own markup, which scoped styles would not reach. */
.tree-canvas :deep(.n-tree-node-indent) {
  position: relative;
}

.tree-canvas :deep(.n-tree-node-indent)::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  border-left: 1px solid var(--tree-guide);
}

/* The panel the toolbar would add into. A tinted row rather than a border, so it does not compete
   with the selection ring on the selected row. */
.tree-canvas :deep(.tree-canvas-node--branch .n-tree-node-content) {
  background-color: var(--tree-branch-bg);
  box-shadow: inset 2px 0 0 var(--tree-branch-border);
  border-radius: 3px;
}

.tree-canvas :deep(.tree-canvas-icon) {
  margin-right: 6px;
  opacity: 0.75;
  vertical-align: -2px;
}

/* Sits under the lone entry node rather than replacing it: the root is still the drop target. */
.tree-canvas-empty {
  margin-top: var(--app-gutter);
  padding: var(--app-gutter);
  border: 1px dashed var(--app-border);
  border-radius: 6px;
}
</style>
