// Structural operations over the normalized node map. Plain data in, plain data out.
//
// Every mutating function returns `produce(nodes, …)` from immer, which buys two things the
// hand-written version could not: an unchanged node stays the same object, so a history snapshot
// costs a reference rather than a deep clone; and the returned map is frozen, so a stray
// `nodes[id].name = x` anywhere in the codebase throws on the spot instead of silently rewriting
// every snapshot that shares the object (R5).
import { produce } from 'immer'
import * as v from 'valibot'
import { LoadTypeSchema, ZoneSchema } from '@/schemas/index.js'
import { columnOf } from '@/modules/reference/config/columns.js'
import { canAccept, childrenKindAfter } from './homogeneity.js'

/** Panel levels allowed below the service entry (FR-007). A consumer may sit one level deeper. */
export const MAX_PANEL_DEPTH = 6

/** `fix` is the structural offer from FR-016 or FR-017 — a description, so the caller decides. */
export class RuleError extends Error {
  constructor({ code, message, fix }) {
    super(message)
    this.name = 'RuleError'
    this.code = code
    if (fix) this.fix = fix
  }
}

function newId() {
  return `n-${globalThis.crypto.randomUUID()}`
}

function require_(nodes, nodeId) {
  const node = nodes[nodeId]
  if (!node) {
    throw new RuleError({ code: 'noSuchNode', message: `Вузла ${nodeId} немає в проекті.` })
  }
  return node
}

function requireConsumer(nodes, nodeId) {
  const node = require_(nodes, nodeId)
  if (node.kind !== 'consumer') {
    throw new RuleError({
      code: 'notAConsumer',
      message: `«${node.name}» — не кінцевий споживач: тип навантаження, зона й переріз є лише в споживача.`,
    })
  }
  return node
}

// A consumer's load type and zone are both required, each as a copy of a whole row, id included
// (002/FR-010). The caller hands over the row it found in the reference store; the engine copies it,
// so a later edit of the table never reaches the consumer (002/FR-021). The row must carry an id,
// because `ConsumerNodeSchema` refuses an empty one.
const REFERENCE_REQUIRED = {
  loadType: {
    code: 'loadTypeRequired',
    message: 'Кінцевий споживач створюється з типу навантаження.',
    fix: 'Виберіть тип навантаження.',
  },
  zone: {
    code: 'zoneRequired',
    message: 'Кінцевому споживачу потрібна зона.',
    fix: 'Виберіть зону.',
  },
}

/** @returns {object} a copy of `row`, which rows being flat makes complete */
function copyOfRow(part, row) {
  if (String(row?.id ?? '').trim() === '') throw new RuleError(REFERENCE_REQUIRED[part])
  return { ...row }
}

/**
 * The fields a panel is created with, by `addNode` and `wrapChildrenInPanel` alike (003/FR-009): a
 * copy of every incoming device row, unmarked, in table order; no own values, no «купувати окремо»
 * marks and nothing calculated yet (003/FR-011). The copies are taken once, so a later edit of the
 * table never reaches the panel.
 * @param {object[]} incomingDevices the rows of the incoming device widths table
 */
function newPanelFields(incomingDevices) {
  if (!Array.isArray(incomingDevices)) {
    throw new RuleError({
      code: 'incomingDevicesRequired',
      message: 'Щиток створюється з довідника ввідних апаратів.',
    })
  }
  return {
    overrides: {
      moduleReservePct: null,
      separateRcdMode: null,
      maxLinesPerGroupRcd: null,
      neutralBreak: null,
      selectiveFeederRcd: null,
    },
    incomingDevices: incomingDevices.map((row) => ({ ...row, install: false })),
    buySeparately: {
      neutralBars: false,
      peBar: false,
      combBusbars: false,
      cableGlands: false,
      blankingPlates: false,
    },
    calculated: {
      enclosure: null,
      deviceComposition: null,
      accessoryQuantities: null,
      groupRcd: null,
      phase: null,
    },
  }
}

// Which table a copy came from, and the schema its values follow (002/FR-021 → 002/FR-006).
const COPY_PARTS = {
  loadType: { table: 'loadTypes', schema: LoadTypeSchema },
  zone: { table: 'zones', schema: ZoneSchema },
}

const COPY_VALUE_RULE = {
  number: 'число або порожньо',
  yesno: '«так», «ні» або порожньо',
  text: 'текст до 2000 символів або порожньо',
}

// ---------------------------------------------------------------- queries

/** Every node below `nodeId`, the node itself excluded (FR-010). */
export function descendantIds(nodes, nodeId) {
  const out = []
  const queue = [...(nodes[nodeId]?.childIds ?? [])]
  while (queue.length > 0) {
    const id = queue.shift()
    if (!nodes[id]) continue
    out.push(id)
    queue.push(...nodes[id].childIds)
  }
  return out
}

// Both walks below climb `parentId`. `ProjectSchema` checks shape, not acyclicity, so a hand-edited
// or truncated file can name two nodes as each other's parent — and an unguarded climb then spins
// forever with the window frozen and nothing logged. A visited set turns that into a refusal.
function refuseCycle(nodeId) {
  throw new RuleError({
    code: 'corruptTree',
    message: `Вузол «${nodeId}» опинився сам у себе серед предків — файл проєкту пошкоджений.`,
    fix: 'Відкрийте останню справну версію проєкту.',
  })
}

/** The service entry is depth 0. */
export function depthOf(nodes, nodeId) {
  let depth = 0
  let cursor = nodes[nodeId]
  const seen = new Set()
  while (cursor && cursor.parentId !== null && cursor.parentId !== undefined) {
    if (seen.has(cursor.id)) refuseCycle(cursor.id)
    seen.add(cursor.id)
    cursor = nodes[cursor.parentId]
    depth += 1
  }
  return depth
}

/** Strict: a node is not a descendant of itself (FR-008). */
export function isDescendantOf(nodes, nodeId, ancestorId) {
  if (nodeId === ancestorId) return false
  let cursor = nodes[nodeId]
  const seen = new Set()
  while (cursor && cursor.parentId !== null && cursor.parentId !== undefined) {
    if (cursor.parentId === ancestorId) return true
    if (seen.has(cursor.id)) refuseCycle(cursor.id)
    seen.add(cursor.id)
    cursor = nodes[cursor.parentId]
  }
  return false
}

/** How many panel levels the sub-tree adds below `nodeId` itself. A leaf answers 0. */
function panelHeightOf(nodes, nodeId) {
  const base = depthOf(nodes, nodeId)
  let height = 0
  for (const id of descendantIds(nodes, nodeId)) {
    if (nodes[id].kind === 'consumer') continue
    height = Math.max(height, depthOf(nodes, id) - base)
  }
  return height
}

function refuseDepth(landingDepth) {
  throw new RuleError({
    code: 'depthLimit',
    message:
      `Глибше не можна: під вводом допускається ${MAX_PANEL_DEPTH} рівнів щитків, ` +
      `а цей щиток став би ${landingDepth}-м.`,
  })
}

// ---------------------------------------------------------------- mutations

/** Keeps the stored `childrenKind` equal to what the children actually are (FR-018). */
function refreshChildrenKind(draft, parentId) {
  const parent = draft[parentId]
  if (!parent || parent.kind === 'consumer') return
  parent.childrenKind = childrenKindAfter(draft, parentId)
}

/**
 * @returns {{ nodes: object, nodeId: string }}
 * @throws {RuleError} homogeneity (FR-015), depth (FR-007), a consumer with no load type or no zone
 *   (002/FR-010), a panel with no incoming device rows (003/FR-009), or the entry's protections
 *   (FR-002)
 */
export function addNode(nodes, { parentId, kind, name, loadType, zone, incomingDevices }) {
  require_(nodes, parentId)

  const verdict = canAccept(nodes, parentId, kind)
  if (!verdict.ok) {
    throw new RuleError({ code: verdict.code, message: verdict.message, fix: verdict.fix })
  }

  // The three guards below all defend the same thing: a node the engine accepts must be a node
  // `ProjectSchema` accepts. Without them the map holds something that looks fine on screen and
  // fails at save time, which is the worst moment to learn about it.
  if (String(name ?? '').trim() === '') {
    throw new RuleError({
      code: 'nameRequired',
      message: 'Вузол не може бути без назви.',
      fix: 'Введіть назву.',
    })
  }

  const copies =
    kind === 'consumer'
      ? { loadType: copyOfRow('loadType', loadType), zone: copyOfRow('zone', zone) }
      : newPanelFields(incomingDevices)

  const landingDepth = depthOf(nodes, parentId) + 1
  if (kind === 'panel' && landingDepth > MAX_PANEL_DEPTH) refuseDepth(landingDepth)

  const nodeId = newId()
  const next = produce(nodes, (draft) => {
    draft[nodeId] =
      kind === 'consumer'
        ? {
            id: nodeId,
            kind,
            name,
            parentId,
            childIds: [],
            loadType: copies.loadType,
            zone: copies.zone,
            cableSectionMm2: null,
            calculated: { groupRcd: null, phase: null },
          }
        : { id: nodeId, kind, name, parentId, childIds: [], childrenKind: 'undecided', ...copies }
    draft[parentId].childIds.push(nodeId)
    refreshChildrenKind(draft, parentId)
  })
  return { nodes: next, nodeId }
}

/** @returns {{ nodes: object, removedIds: string[] }} */
export function removeNode(nodes, nodeId) {
  const node = require_(nodes, nodeId)
  if (node.parentId === null || node.parentId === undefined) {
    throw new RuleError({
      code: 'rootProtected',
      message: 'Ввід видалити не можна — це корінь проекту.',
    })
  }

  const removedIds = [nodeId, ...descendantIds(nodes, nodeId)]
  const next = produce(nodes, (draft) => {
    const parent = draft[node.parentId]
    parent.childIds = parent.childIds.filter((id) => id !== nodeId)
    for (const id of removedIds) delete draft[id]
    refreshChildrenKind(draft, node.parentId)
  })
  return { nodes: next, removedIds }
}

/** Moves the node with its whole sub-tree (FR-009). @returns {object} nodes */
export function moveNode(nodes, nodeId, newParentId, index = 0) {
  const node = require_(nodes, nodeId)
  require_(nodes, newParentId)

  if (node.parentId === null || node.parentId === undefined) {
    throw new RuleError({ code: 'rootProtected', message: 'Ввід не переміщується.' })
  }
  if (nodeId === newParentId || isDescendantOf(nodes, newParentId, nodeId)) {
    throw new RuleError({
      code: 'cycle',
      message: `«${node.name}» не можна перенести всередину власного піддерева.`,
    })
  }

  const sameParent = node.parentId === newParentId
  if (!sameParent) {
    const verdict = canAccept(nodes, newParentId, node.kind)
    if (!verdict.ok) {
      throw new RuleError({ code: verdict.code, message: verdict.message, fix: verdict.fix })
    }
  }

  const landingDepth = depthOf(nodes, newParentId) + 1
  const deepest = landingDepth + panelHeightOf(nodes, nodeId)
  if (node.kind !== 'consumer' && deepest > MAX_PANEL_DEPTH) refuseDepth(deepest)

  return produce(nodes, (draft) => {
    const oldParent = draft[node.parentId]
    oldParent.childIds = oldParent.childIds.filter((id) => id !== nodeId)
    const target = draft[newParentId]
    target.childIds.splice(Math.max(0, Math.min(index, target.childIds.length)), 0, nodeId)
    draft[nodeId].parentId = newParentId
    refreshChildrenKind(draft, node.parentId)
    refreshChildrenKind(draft, newParentId)
  })
}

/** Reorders among siblings without changing the parent (FR-006). @returns {object} nodes */
export function reorderSibling(nodes, nodeId, index) {
  const node = require_(nodes, nodeId)
  if (node.parentId === null || node.parentId === undefined) return nodes
  return produce(nodes, (draft) => {
    const siblings = draft[node.parentId].childIds
    const from = siblings.indexOf(nodeId)
    // A stale drop callback can name a node the parent has already stopped listing. Guarding is
    // not cosmetic: splice(-1, 1) removes the *last* sibling, so the no-op would silently drop
    // an unrelated sub-tree and leave it orphaned in the map.
    if (from === -1) return
    siblings.splice(from, 1)
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, nodeId)
  })
}

/**
 * Replaces the consumer's load type copy with a fresh copy of `loadType`, values changed by hand
 * included, even when it is the row the copy came from (002/FR-014). The name follows the new row
 * only while it still equals the copied load type name, so a name the user typed stays.
 * @returns {object} nodes
 */
export function setConsumerLoadType(nodes, nodeId, loadType) {
  const node = requireConsumer(nodes, nodeId)
  const copy = copyOfRow('loadType', loadType)
  const follows = node.name === node.loadType.name
  return produce(nodes, (draft) => {
    draft[nodeId].loadType = copy
    if (follows) draft[nodeId].name = copy.name
  })
}

/** Replaces the consumer's zone copy with a fresh copy of `zone`; the name stays. @returns {object} nodes */
export function setConsumerZone(nodes, nodeId, zone) {
  requireConsumer(nodes, nodeId)
  const copy = copyOfRow('zone', zone)
  return produce(nodes, (draft) => {
    draft[nodeId].zone = copy
  })
}

/**
 * Sets one value of the consumer's copy, `part` being `'loadType'` or `'zone'`; the table and every
 * other consumer stay as they were (002/FR-021). `value` is already parsed, as the table's cells are.
 * The id and the name are locked: only choosing a row changes them, and 002/FR-014 renames a
 * consumer by comparing its name with the copied name.
 * @returns {object} nodes
 * @throws {RuleError} `copyKeyLocked`, `unknownColumn`, or `badCopyValue` naming the column's header
 */
export function setConsumerCopyValue(nodes, nodeId, part, key, value) {
  const node = requireConsumer(nodes, nodeId)
  if (key === 'id' || key === 'name') {
    throw new RuleError({
      code: 'copyKeyLocked',
      message: 'Назва з довідника змінюється лише вибором іншого рядка.',
      fix: 'Виберіть рядок у списку.',
    })
  }
  const column = columnOf(COPY_PARTS[part]?.table, key)
  if (!column) {
    throw new RuleError({ code: 'unknownColumn', message: `У цьому рядку немає колонки «${key}».` })
  }
  const next = { ...node[part], [key]: value }
  if (!v.safeParse(COPY_PARTS[part].schema, next).success) {
    throw new RuleError({
      code: 'badCopyValue',
      message: `«${column.header}»: тут має бути ${COPY_VALUE_RULE[column.kind]}.`,
    })
  }
  return produce(nodes, (draft) => {
    draft[nodeId][part][key] = value
  })
}

/**
 * The actual conductor cross-section of the installed cable, in mm² (002/FR-011): empty (`null`)
 * until the cable is laid, otherwise a finite number above zero. Stored as given — nothing is
 * computed from it (002/FR-020).
 * @returns {object} nodes
 */
export function setCableSection(nodes, nodeId, mm2) {
  requireConsumer(nodes, nodeId)
  if (mm2 !== null && !(typeof mm2 === 'number' && Number.isFinite(mm2) && mm2 > 0)) {
    throw new RuleError({
      code: 'badCableSection',
      message: 'Переріз кабелю — число більше нуля, у мм², або порожньо.',
      fix: 'Введіть, наприклад, 2,5 або залиште поле порожнім.',
    })
  }
  return produce(nodes, (draft) => {
    draft[nodeId].cableSectionMm2 = mm2
  })
}

/**
 * The one legal way out of `consumers` into `panels`: a new panel takes the consumers with it, so
 * the parent never holds a mixture even for an instant. This is the fix FR-016 offers, and it
 * lives here rather than in the store because the intermediate state — a panel holding both kinds
 * — is illegal, and only the engine may construct it inside a single `produce` where nobody can
 * observe it.
 *
 * The new panel is built as `addNode` builds one, with a copy of `incomingDevices` (003/FR-009).
 *
 * @returns {{ nodes: object, nodeId: string }} the map and the id of the panel that was created
 */
export function wrapChildrenInPanel(nodes, parentId, panelName, incomingDevices) {
  const parent = require_(nodes, parentId)

  if (childrenKindAfter(nodes, parentId) !== 'consumers') {
    throw new RuleError({
      code: 'nothingToWrap',
      message: `«${parent.name}» не містить споживачів, тож переносити нічого.`,
      fix: null,
    })
  }
  if (String(panelName ?? '').trim() === '') {
    throw new RuleError({
      code: 'nameRequired',
      message: 'Новий щиток не може бути без назви.',
      fix: 'Введіть назву.',
    })
  }
  const panelFields = newPanelFields(incomingDevices)

  // The wrap pushes every consumer one level down, so the deepest one has to stay within reach.
  const landingDepth = depthOf(nodes, parentId) + 1
  if (landingDepth > MAX_PANEL_DEPTH) refuseDepth(landingDepth)

  const nodeId = newId()
  const moved = [...parent.childIds]
  const next = produce(nodes, (draft) => {
    draft[nodeId] = {
      id: nodeId,
      kind: 'panel',
      name: String(panelName).trim(),
      parentId,
      childIds: moved,
      childrenKind: 'consumers',
      ...panelFields,
    }
    draft[parentId].childIds = [nodeId]
    draft[parentId].childrenKind = 'panels'
    for (const childId of moved) draft[childId].parentId = nodeId
  })
  return { nodes: next, nodeId }
}

/**
 * A free-text note on the entry or a panel (FR-012). A consumer has none: its field list is
 * name, load type, zone and cable section (002/FR-009). An empty note deletes the field instead of
 * storing `''`: the schema marks `note` optional, so an absent note and a blank one would
 * otherwise be two spellings of the same thing in every saved file.
 * @returns {object} nodes
 */
export function setNote(nodes, nodeId, note) {
  const node = require_(nodes, nodeId)
  if (node.kind === 'consumer') {
    throw new RuleError({
      code: 'noteOnConsumer',
      message: `«${node.name}» — кінцевий споживач, нотатки в нього немає.`,
    })
  }
  const trimmed = String(note ?? '').trim()
  return produce(nodes, (draft) => {
    if (trimmed === '') delete draft[nodeId].note
    else draft[nodeId].note = trimmed
  })
}

/** @returns {object} nodes */
export function renameNode(nodes, nodeId, name) {
  require_(nodes, nodeId)
  return produce(nodes, (draft) => {
    draft[nodeId].name = name
  })
}
