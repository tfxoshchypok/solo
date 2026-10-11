// The project file: read it, write it, and keep a sidecar so a crash costs at most 400 ms of work.
//
// Two rules shape everything here. A file is accepted whole or refused whole — `load` throws
// before it returns anything, so no caller can apply half a project (FR-036). And a save never
// writes over the live file: it writes `<path>.tmp` and moves that onto the target, which on one
// filesystem is the closest thing to an atomic replace the platform offers (FR-031, R2).
import * as v from 'valibot'
import { ProjectSchema, SCHEMA_VERSION, formatIssuePath } from '@/schemas/index.js'
import { getFs } from './fs/index.js'
import { LoadError } from './LoadError.js'
import { appDataDir, autosavePath, join, tmpPath } from './PathService.js'

/** How long the editor stays quiet before the sidecar is rewritten (R2). */
export const AUTOSAVE_DELAY_MS = 400

/** Where a never-saved project's sidecar waits, since it has no path of its own yet. */
export const UNSAVED_SIDECAR_NAME = 'unsaved.autosave.json'

function fail(details) {
  throw new LoadError(details)
}

function serialize(project) {
  return `${JSON.stringify(project, null, 2)}\n`
}

// ---------------------------------------------------------------- normalize / denormalize

/**
 * File → store. The array becomes the map `stores/tree.js` holds; sibling order stays in
 * `childIds`, so nothing depends on array position (data-model.md *Runtime shape*).
 * @returns {{ rootId: string, nodes: object }}
 */
export function normalize(project) {
  const nodes = {}
  for (const node of project.nodes) nodes[node.id] = { ...node }
  return { rootId: project.rootId, nodes }
}

/**
 * Store → file. Depth-first from the root, so the array reads in the order the tree is drawn and
 * a diff of two saves shows the change rather than a reshuffle.
 *
 * A node the root cannot reach is still written. It would make the file unloadable, which is the
 * point: losing a subtree silently is worse than a save the next `load` refuses out loud.
 *
 * @param {{ rootId: string, nodes: object }} tree
 * @param {{ name?: string, createdAt?: string }} meta
 */
export function denormalize({ rootId, nodes }, meta = {}) {
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    name: meta.name ?? 'Новий проект',
    createdAt: meta.createdAt ?? now,
    modifiedAt: now,
    rootId,
    nodes: depthFirst(nodes, rootId),
  }
}

function depthFirst(nodes, rootId) {
  const out = []
  const seen = new Set()
  const walk = (id) => {
    const node = nodes[id]
    if (!node || seen.has(id)) return
    seen.add(id)
    out.push({ ...node })
    for (const childId of node.childIds) walk(childId)
  }
  walk(rootId)
  for (const [id, node] of Object.entries(nodes)) {
    if (!seen.has(id)) out.push({ ...node })
  }
  return out
}

// ---------------------------------------------------------------- load

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch (error) {
    fail({
      path: '',
      message: `Файл не є коректним JSON: ${error.message}`,
      cause: error,
    })
  }
}

function checkSchemaVersion(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    fail({ path: '', expected: 'object', received: typeof raw, message: 'Файл не є проєктом.' })
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    fail({
      path: 'schemaVersion',
      expected: SCHEMA_VERSION,
      received: raw.schemaVersion,
      message: `schemaVersion: файл записаний у версії ${raw.schemaVersion}, а ця збірка читає версію ${SCHEMA_VERSION}.`,
    })
  }
}

/** Every per-field rule at once. The first issue names the element the user has to go fix. */
function checkFields(raw) {
  const result = v.safeParse(ProjectSchema, raw)
  if (result.success) return result.output

  const issue = result.issues[0]
  const path = formatIssuePath(issue)
  return fail({
    path,
    expected: issue.expected,
    received: issue.received,
    message: `${path}: очікується ${issue.expected}, отримано ${issue.received}`,
  })
}

/**
 * What the schema cannot see: the tree has to be a tree. Every `parentId` and every `childIds`
 * entry resolves, the two agree, there is exactly one root, `childrenKind` matches the children
 * actually present, and climbing `parentId` from anywhere reaches the root without repeating a
 * node (contracts/project-file.md).
 */
function checkStructure(project) {
  const indexOf = new Map()
  project.nodes.forEach((node, index) => {
    if (indexOf.has(node.id)) {
      fail({
        path: `nodes[${index}].id`,
        message: `nodes[${index}].id: ідентифікатор «${node.id}» трапляється у файлі двічі.`,
      })
    }
    indexOf.set(node.id, index)
  })

  const nodeById = (id) => (indexOf.has(id) ? project.nodes[indexOf.get(id)] : null)

  const roots = project.nodes.filter((node) => node.parentId === null)
  if (roots.length === 0) {
    fail({ path: 'nodes', message: 'nodes: у файлі немає кореневого вузла «Ввід».' })
  }
  if (roots.length > 1) {
    const extra = roots[1]
    fail({
      path: `nodes[${indexOf.get(extra.id)}].parentId`,
      message: `nodes[${indexOf.get(extra.id)}].parentId: у файлі два корені — «${roots[0].id}» і «${extra.id}».`,
    })
  }

  const root = nodeById(project.rootId)
  if (!root || root.kind !== 'entry' || root.parentId !== null) {
    fail({
      path: 'rootId',
      received: project.rootId,
      message: `rootId: «${project.rootId}» не називає кореневий вузол «Ввід».`,
    })
  }

  // Four passes rather than one, because the order decides which element the user is sent to.
  // A node whose own `parentId` is wrong is named before the parent that merely lists it, and a
  // `childrenKind` is only worth reporting once the children it describes are known to resolve.
  project.nodes.forEach((node, index) => {
    if (node.parentId === null) return
    const parent = nodeById(node.parentId)
    if (!parent) {
      fail({
        path: `nodes[${index}].parentId`,
        received: node.parentId,
        message: `nodes[${index}].parentId: «${node.name}» посилається на вузол «${node.parentId}», якого у файлі немає.`,
      })
    }
    if (!parent.childIds.includes(node.id)) {
      fail({
        path: `nodes[${index}].parentId`,
        received: node.parentId,
        message: `nodes[${index}].parentId: «${node.name}» вважає батьком «${parent.name}», а той не має його серед дітей.`,
      })
    }
  })

  project.nodes.forEach((node, index) => {
    node.childIds.forEach((childId, position) => {
      const child = nodeById(childId)
      if (!child) {
        fail({
          path: `nodes[${index}].childIds[${position}]`,
          received: childId,
          message: `nodes[${index}].childIds[${position}]: «${node.name}» перелічує дитину «${childId}», якої у файлі немає.`,
        })
      }
      if (child.parentId !== node.id) {
        fail({
          path: `nodes[${index}].childIds[${position}]`,
          received: childId,
          message: `nodes[${index}].childIds[${position}]: «${child.name}» перелічений у «${node.name}», але батьком вважає інший вузол.`,
        })
      }
    })
  })

  project.nodes.forEach((node, index) => {
    if (node.kind === 'consumer') return
    const kinds = new Set(node.childIds.map((id) => nodeById(id).kind))
    if (kinds.size > 1) {
      fail({
        path: `nodes[${index}].childIds`,
        message: `nodes[${index}].childIds: «${node.name}» тримає одночасно щитки і споживачів, чого правило однорідності не допускає.`,
      })
    }
    const actual = kinds.size === 0 ? 'undecided' : kinds.has('consumer') ? 'consumers' : 'panels'
    if (node.childrenKind !== actual) {
      fail({
        path: `nodes[${index}].childrenKind`,
        expected: actual,
        received: node.childrenKind,
        message: `nodes[${index}].childrenKind: у «${node.name}» записано «${node.childrenKind}», а насправді там «${actual}».`,
      })
    }
  })

  project.nodes.forEach((node, index) => {
    const seen = new Set([node.id])
    let current = node
    while (current.parentId !== null) {
      const parent = nodeById(current.parentId)
      if (seen.has(parent.id)) {
        fail({
          path: `nodes[${index}].parentId`,
          message: `nodes[${index}].parentId: «${node.name}» опинився сам у себе серед предків — у файлі замкнене коло.`,
        })
      }
      seen.add(parent.id)
      current = parent
    }
    if (current.id !== project.rootId) {
      fail({
        path: `nodes[${index}].parentId`,
        message: `nodes[${index}].parentId: «${node.name}» не з'єднаний із вводом.`,
      })
    }
  })
}

/**
 * Parse, then the schema, then the tree itself. A failure at any stage throws `LoadError` and
 * nothing is returned, which is what keeps a broken file from reaching the store (FR-035, FR-036).
 *
 * A consumer's `loadType` and `zone` copies are deliberately never compared with the local reference
 * tables: a project from another installation opens with its own values, even when no local row
 * holds the copied id or a row holds other values, and nothing is shown as absent (002/FR-018).
 *
 * @param {string} path
 * @returns {Promise<{ project: object }>}
 */
export async function load(path) {
  const text = await getFs().readText(path)
  const raw = parseJson(text)
  checkSchemaVersion(raw)
  const project = checkFields(raw)
  checkStructure(project)
  return { project }
}

// ---------------------------------------------------------------- save

/**
 * `.tmp` first, then one `move`. The previous file stands until the move completes, so a crash
 * mid-write leaves the last good project intact rather than a truncated one (FR-031).
 *
 * It waits its turn behind any sidecar write already running, so that write cannot land after the
 * sidecars are dropped and leave a copy newer than the file (SAVE-02).
 *
 * The sidecars dropped are this file's and the one the project kept under its previous path — the
 * unsaved one in the data directory when `previousPath` is null. Nobody else's: the sidecar written
 * last may belong to a project the editor has already left (SAVE-03).
 *
 * @param {object} project
 * @param {string} path
 * @param {{ previousPath?: string|null }} [options] where the project lived before this save
 * @returns {Promise<object>} the project as it was written, with the fresh `modifiedAt`
 */
export function save(project, path, { previousPath = path } = {}) {
  cancelAutosave()
  return enqueue(async () => {
    const fs = getFs()
    const payload = {
      ...project,
      schemaVersion: SCHEMA_VERSION,
      modifiedAt: new Date().toISOString(),
    }
    const tmp = tmpPath(path)
    await fs.writeText(tmp, serialize(payload))
    await fs.move(tmp, path)
    // An edit made while this write ran was queued under the old path. Written there, after the
    // old copy is dropped below, it would come back as a copy of a project that has moved on.
    if (queued && queued.path === previousPath) queued = { ...queued, path }
    await dropSidecars(path, previousPath)
    return payload
  })
}

// ---------------------------------------------------------------- autosave sidecar

let timer = null
let queued = null
let autosaveErrorHandler = null

/**
 * Sidecar writes, saves and sidecar removals run on this chain one after another, so an older
 * state never lands over a newer one and a removal never races the write it removes (SAVE-02).
 * A failed step does not stop the chain; its caller gets the rejection.
 */
let chain = Promise.resolve()

function enqueue(task) {
  const run = chain.then(task)
  chain = run.catch(() => {})
  return run
}

async function unsavedSidecarPath() {
  return join(await appDataDir(), UNSAVED_SIDECAR_NAME)
}

async function sidecarPathFor(path) {
  return path ? autosavePath(path) : unsavedSidecarPath()
}

async function writeQueued() {
  if (!queued) return null
  const { project, path } = queued
  queued = null

  const fs = getFs()
  const sidecarPath = await sidecarPathFor(path)
  if (!path) await fs.ensureDir(await appDataDir())
  await fs.writeText(sidecarPath, serialize(project))
  return sidecarPath
}

/**
 * Debounced at 400 ms: the editor writes a sidecar once the user pauses, not on every keystroke.
 * The latest call wins, so a burst of edits costs one write. Nobody awaits the timer's write, so a
 * failure goes to the handler the shell registered instead of becoming an unhandled rejection.
 */
export function scheduleAutosave(project, path) {
  queued = { project, path }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    enqueue(writeQueued).catch((error) => autosaveErrorHandler?.(error))
  }, AUTOSAVE_DELAY_MS)
}

/**
 * @param {(error: Error) => void} handler told about every sidecar write the timer could not make
 * @returns {() => void} unregisters it
 */
export function setAutosaveErrorHandler(handler) {
  autosaveErrorHandler = handler
  return () => {
    if (autosaveErrorHandler === handler) autosaveErrorHandler = null
  }
}

/** Resolves once every write already started has landed — the seam a test waits on. */
export function autosaveSettled() {
  return chain
}

/**
 * Writes the queued state now, without waiting out the debounce, and resolves only after any write
 * already running has landed too — the window-close path relies on that (SAVE-02).
 * @returns the sidecar path, or null when nothing was queued
 */
export function flushAutosave() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  return enqueue(writeQueued)
}

export function cancelAutosave() {
  if (timer) clearTimeout(timer)
  timer = null
  queued = null
}

async function dropSidecars(path, previousPath) {
  const fs = getFs()
  const paths = new Set([autosavePath(path), await sidecarPathFor(previousPath)])
  for (const sidecarPath of paths) {
    if (await fs.exists(sidecarPath)) await fs.remove(sidecarPath)
  }
}

/**
 * A sidecar newer than the project file is unsaved work a crash left behind (FR-031). A project
 * that was never saved has no file to compare against, so the sidecar alone is the offer.
 *
 * @returns {Promise<{ sidecarPath: string, modifiedAt: number }|null>}
 */
export async function findRecovery(path) {
  const fs = getFs()
  const sidecarPath = await sidecarPathFor(path)
  if (!(await fs.exists(sidecarPath))) return null

  const sidecar = await fs.stat(sidecarPath)
  if (path && (await fs.exists(path))) {
    const file = await fs.stat(path)
    if (sidecar.modifiedAt <= file.modifiedAt) return null
  }
  return { sidecarPath, modifiedAt: sidecar.modifiedAt }
}

/** Behind any sidecar write already running, or that write would put the sidecar back. */
export function discardRecovery(path) {
  return enqueue(async () => {
    const fs = getFs()
    const sidecarPath = await sidecarPathFor(path)
    if (await fs.exists(sidecarPath)) await fs.remove(sidecarPath)
  })
}

/** `unsaved.refused-2026-10-11T10-14-03-221Z.json` — the name carries no `:` for Windows. */
function refusedName(now) {
  return `unsaved.refused-${new Date(now).toISOString().replace(/[:.]/g, '-')}.json`
}

/**
 * Moves a copy that cannot be loaded out of the autosave's way: left where it is, the next edit
 * would write over it, and it is kept for the user to recover by hand (RECOVERY-01).
 *
 * @param {string} sidecarPath
 * @param {{ now?: number }} [options] the clock the kept copy's name is stamped with
 * @returns {Promise<string|null>} where it went, or null when it could not be moved
 */
export async function setAsideRecovery(sidecarPath, { now = Date.now() } = {}) {
  const keptAs = join(await appDataDir(), refusedName(now))
  try {
    await getFs().move(sidecarPath, keptAs)
    return keptAs
  } catch {
    return null
  }
}

export const ProjectFileService = {
  load,
  save,
  scheduleAutosave,
  flushAutosave,
  autosaveSettled,
  cancelAutosave,
  setAutosaveErrorHandler,
  findRecovery,
  discardRecovery,
  setAsideRecovery,
}
