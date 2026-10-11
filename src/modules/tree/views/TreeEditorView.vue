<script setup>
// The editor: the tree on the left, the properties of whatever is selected on the right, and the
// actions that change the structure along the top.
//
// Every refusal from the engine arrives here as a `RuleError`. Two of them carry a `fix`, and
// those open the dialog instead of a message: a refusal the user cannot act on is a dead end,
// and the homogeneity rule is the one rule the model will not bend on (FR-015).
import { computed, h, ref } from 'vue'
import { NButton, NDivider, NDropdown, NIcon, NSpace, NTooltip, useMessage } from 'naive-ui'
import {
  AddOutline,
  ArrowRedoOutline,
  ArrowUndoOutline,
  DocumentOutline,
  FlashOutline,
  FolderOpenOutline,
  SaveOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import TreeCanvas from '../components/TreeCanvas.vue'
import NodeInspector from '../components/NodeInspector.vue'
import StructuralFixDialog from '../components/StructuralFixDialog.vue'
import AddConsumerDialog from '../components/AddConsumerDialog.vue'
import { useTreeStore } from '../stores/tree.js'
import { RuleError, descendantIds } from '../engine/treeOps.js'
import { useConfirm } from '@/composables/useConfirm.js'
import { useKeyboardTree } from '@/composables/useKeyboardTree.js'
import { useProjectStore } from '@/stores/project.js'
import { LoadError } from '@/services/LoadError.js'

const tree = useTreeStore()
const project = useProjectStore()
const message = useMessage()
const confirm = useConfirm()
// The unsaved-changes prompt on window close is registered by `AppLayout.vue`, which stays mounted
// whichever section is open (002/FR-008, research R10).

const inspector = ref(null)
const picking = ref(false)
const pickerParentId = ref(null)

/** The refusal currently on screen, with what the user was trying to add when it happened. */
const refusal = ref(null)
const pending = ref(null)

const selected = computed(() => tree.selected)

/**
 * Where a new child goes. Selecting a consumer and pressing «Споживач» means "another one of these
 * here", so the target is the consumer's own panel — the alternative was a disabled button and a
 * trip back up the tree for every second consumer.
 */
const addTargetId = computed(() => {
  const node = selected.value
  if (!node) return null
  return node.kind === 'consumer' ? node.parentId : node.id
})
const canAddHere = computed(() => Boolean(addTargetId.value))
const canDelete = computed(() => selected.value && selected.value.kind !== 'entry')
/** Named in both tooltips, so "where will this land" never needs a guess. */
const addTargetName = computed(() => (addTargetId.value ? tree.nodes[addTargetId.value]?.name : ''))

const renderIcon = (component) => () => h(NIcon, null, { default: () => h(component) })

/** File actions live in one menu: they are not editing actions and read as noise beside them. */
const projectMenu = computed(() => [
  { key: 'new', label: 'Новий', icon: renderIcon(DocumentOutline) },
  { key: 'open', label: 'Відкрити…', icon: renderIcon(FolderOpenOutline) },
  { key: 'divider', type: 'divider' },
  {
    key: 'save',
    label: project.isDirty ? 'Зберегти' : 'Збережено',
    icon: renderIcon(SaveOutline),
    disabled: !project.isDirty,
  },
  { key: 'saveAs', label: 'Зберегти як…' },
])

function onProjectMenu(key) {
  const actions = {
    new: newProject,
    open: openProject,
    save: saveProject,
    saveAs: saveProjectAs,
  }
  actions[key]?.()
}

/**
 * Reading and writing the file. Everything below goes through the project store, which is the only
 * place that knows `ProjectFileService` exists (contracts/services.md).
 *
 * A failure is reported, never thrown at the window: a `LoadError` names the element inside the
 * file (FR-036), an `FsError` names the path.
 */
function report(error) {
  if (error instanceof LoadError) message.error(`Файл не відкрився — ${error.message}`)
  else message.error(error?.message ?? 'Не вдалося звернутися до файлу.')
}

async function confirmDiscard(title) {
  if (!project.isDirty) return true
  return confirm({
    title,
    content: 'Незбережені зміни зникнуть.',
    positiveText: 'Продовжити',
    negativeText: 'Скасувати',
  })
}

async function newProject() {
  if (await confirmDiscard('Почати новий проект?')) project.newProject()
}

/**
 * The recovery offer comes between choosing the file and loading it, so the user decides before
 * anything replaces what is on screen (FR-031, R2).
 *
 * Declining leaves the sidecar where it is rather than deleting it: the dialog also resolves
 * "no" when it is dismissed with Escape, and dropping unsaved work on an ambiguous gesture is the
 * one outcome worth avoiding. The next explicit save clears it.
 */
async function openProject() {
  if (!(await confirmDiscard('Відкрити інший проект?'))) return

  const filePath = await project.pickToOpen()
  if (!filePath) return

  try {
    const recovery = await project.findRecovery(filePath)
    if (recovery) {
      const restore = await confirm({
        title: 'Відновити незбережені зміни?',
        content: `Автозбережена копія новіша за сам файл — схоже, минулого разу програма завершилася аварійно (${new Date(recovery.modifiedAt).toLocaleString('uk-UA')}).`,
        positiveText: 'Відновити',
        negativeText: 'Відкрити файл',
      })
      if (restore) {
        await project.openRecovery(recovery.sidecarPath, filePath)
        message.success('Відновлено незбережений стан. Збережіть проект, щоб закріпити його.')
        return
      }
    }
    await project.openPath(filePath)
  } catch (error) {
    report(error)
  }
}

async function saveProject() {
  try {
    const saved = await project.save()
    if (saved) message.success(`Збережено: ${saved}`)
  } catch (error) {
    report(error)
  }
}

async function saveProjectAs() {
  try {
    const saved = await project.saveAs()
    if (saved) message.success(`Збережено: ${saved}`)
  } catch (error) {
    report(error)
  }
}

/**
 * Where every refusal lands, whatever raised it — the toolbar, the consumer picker, a keystroke or
 * a released drag. A `RuleError` with a `fix` opens the dialog; one without — the depth limit, a
 * consumer parent — is a plain message, because there is no second step to offer (FR-007, FR-015).
 *
 * `request` is what the user was trying to do, and the dialog needs it to finish the job: an add
 * carries the node to create, a move carries the node to relocate (SC-002).
 */
function surfaceRefusal({ error, request = null }) {
  if (error.fix) {
    pending.value = request
    refusal.value = error
  } else {
    message.warning(error.message)
  }
}

/** One funnel for every structural action started here. */
function attempt(action, request = null) {
  try {
    return action()
  } catch (error) {
    if (!(error instanceof RuleError)) throw error
    surfaceRefusal({ error, request })
    return null
  }
}

function addPanel() {
  const parentId = addTargetId.value
  if (!parentId) return
  const request = { kind: 'panel', name: `Щиток ${tree.nodeCount}` }
  const nodeId = attempt(() => tree.add({ parentId, ...request }), request)
  if (nodeId) tree.select(nodeId)
}

/** The picker owns the whole placement, including its own refusals (FR-021, FR-023). */
function addConsumer() {
  if (!addTargetId.value) return
  pickerParentId.value = addTargetId.value
  picking.value = true
}

function onPlaced(nodeId) {
  picking.value = false
  tree.select(nodeId)
}

/**
 * A refusal from the picker means the panel holds panels. The picker closes first, so the fix
 * dialog opens in its place rather than on top of it.
 */
function onPickerRefused(payload) {
  picking.value = false
  surfaceRefusal(payload)
}

async function remove() {
  const node = selected.value
  if (!node || node.kind === 'entry') return

  const descendants = descendantIds(tree.nodes, node.id).length
  const ok = await confirm({
    title: `Видалити «${node.name}»?`,
    content: descendants
      ? `Разом із ним зникне вкладених вузлів: ${descendants}. Дію можна скасувати через Ctrl+Z.`
      : 'Дію можна скасувати через Ctrl+Z.',
  })
  if (ok) tree.remove(node.id)
}

function onResolved(nodeId) {
  refusal.value = null
  pending.value = null
  if (nodeId) tree.select(nodeId)
}

function onCancel() {
  refusal.value = null
  pending.value = null
}

useKeyboardTree({
  onAddPanel: addPanel,
  onAddConsumer: addConsumer,
  onDelete: remove,
  onRename: () => inspector.value?.focusName(),
  onRefused: surfaceRefusal,
})
</script>

<template>
  <div class="editor">
    <header class="editor-toolbar">
      <n-space size="small">
        <n-dropdown trigger="click" :options="projectMenu" @select="onProjectMenu">
          <n-button size="small" quaternary>
            <template #icon
              ><n-icon><DocumentOutline /></n-icon
            ></template>
            Проект<span v-if="project.isDirty" class="editor-dirty"> •</span>
          </n-button>
        </n-dropdown>

        <n-divider vertical />

        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" :disabled="!canAddHere" @click="addPanel">
              <template #icon
                ><n-icon><AddOutline /></n-icon
              ></template>
              Щиток
            </n-button>
          </template>
          {{ addTargetName ? `Додати щиток у «${addTargetName}»` : 'Додати щиток' }}
        </n-tooltip>

        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" :disabled="!canAddHere" @click="addConsumer">
              <template #icon
                ><n-icon><FlashOutline /></n-icon
              ></template>
              Споживач
            </n-button>
          </template>
          {{ addTargetName ? `Додати споживача у «${addTargetName}»` : 'Додати споживача' }}
        </n-tooltip>

        <n-button size="small" :disabled="!canDelete" @click="remove">
          <template #icon
            ><n-icon><TrashOutline /></n-icon
          ></template>
          Видалити
        </n-button>
      </n-space>

      <n-space size="small">
        <n-button
          size="small"
          quaternary
          :disabled="!tree.history.canUndo"
          aria-label="Скасувати"
          @click="tree.history.undo()"
        >
          <template #icon
            ><n-icon><ArrowUndoOutline /></n-icon
          ></template>
        </n-button>
        <n-button
          size="small"
          quaternary
          :disabled="!tree.history.canRedo"
          aria-label="Повторити"
          @click="tree.history.redo()"
        >
          <template #icon
            ><n-icon><ArrowRedoOutline /></n-icon
          ></template>
        </n-button>
      </n-space>
    </header>

    <div class="editor-body">
      <TreeCanvas class="editor-canvas" @refused="surfaceRefusal" />
      <aside class="editor-inspector"><NodeInspector ref="inspector" /></aside>
    </div>

    <AddConsumerDialog
      :show="picking"
      :parent-id="pickerParentId"
      @placed="onPlaced"
      @refused="onPickerRefused"
      @cancel="picking = false"
    />

    <StructuralFixDialog
      :error="refusal"
      :pending="pending"
      @resolved="onResolved"
      @cancel="onCancel"
    />
  </div>
</template>

<style scoped>
.editor-dirty {
  opacity: 0.6;
}

.editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-gutter);
  padding: var(--app-gutter);
  border-bottom: 1px solid var(--app-border);
}

.editor-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.editor-canvas {
  flex: 1;
  min-width: 0;
  overflow: auto;
}

.editor-inspector {
  width: var(--app-inspector-width);
  flex-shrink: 0;
  border-left: 1px solid var(--app-border);
  overflow: auto;
}
</style>
