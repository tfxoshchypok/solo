// Autosave is debounced at 400 ms (R2), which leaves a window where a confirmed structural change
// exists only in a pending timer. FR-031 forbids losing it, so the sidecar is written on the way
// out: the app asks Neutralino not to close the process itself, flushes, and then exits.
//
// A dirty project is asked about first. The flush only protects work until the next launch; an
// explicit save or an explicit "don't save" is what the user actually means when closing.
import { app, events } from '@neutralinojs/lib'
import { ProjectFileService } from './ProjectFileService.js'
import { ReferenceTablesFileService } from './ReferenceTablesFileService.js'
import { isNeutralinoRuntime } from './fs/index.js'

/** How long the sidecar gets before the window is allowed to go regardless. */
const FLUSH_TIMEOUT_MS = 2000

/**
 * Turns the answer to "save before closing?" into a verdict: true lets the window close.
 *
 * A save that the user backs out of at the file dialog, or one that fails, keeps the window open:
 * closing then would throw away the very work they were trying to keep. Choosing not to save drops
 * the autosave sidecar, or the next launch would offer to recover what they just declined.
 *
 * @param {{
 *   isDirty: () => boolean,
 *   prompt: () => Promise<'save'|'discard'|'cancel'>,
 *   save: () => Promise<string|null>,
 *   discard: () => unknown,
 * }} effects
 * @returns {Promise<boolean>}
 */
export async function decideExit({ isDirty, prompt, save, discard }) {
  if (!isDirty()) return true

  const answer = await prompt()
  if (answer === 'save') {
    try {
      return Boolean(await save())
    } catch {
      return false
    }
  }
  if (answer === 'discard') {
    await discard()
    return true
  }
  return false
}

/**
 * The handler itself, with its effects injected — that is the whole reason this is a factory:
 * the guard is testable without a window to close.
 *
 * Neither a failure nor a hang may trap the user. `exitProcessOnClose` is off so that this
 * handler gets its turn, which means it is now the only thing that closes the window: a write
 * that throws, or one that never comes back, must still end in `exit`. Losing the sidecar is a
 * bad outcome; a window with no way to shut it is a worse one.
 *
 * `beforeExit` may keep the window open by resolving false; the autosave timer is then left alone,
 * because the session goes on. If the decision itself throws, the window closes anyway — the same
 * rule as above: no failure may trap the user.
 *
 * @param {{
 *   flush: () => unknown,
 *   exit: () => unknown,
 *   beforeExit?: () => boolean|Promise<boolean>,
 *   timeoutMs?: number,
 * }} effects
 */
export function createCloseHandler({
  flush,
  exit,
  beforeExit = () => true,
  timeoutMs = FLUSH_TIMEOUT_MS,
}) {
  return async function onWindowClose() {
    let go
    try {
      go = await beforeExit()
    } catch {
      go = true
    }
    if (!go) return

    let timer = null
    try {
      await Promise.race([
        flush(),
        new Promise((resolve) => {
          timer = setTimeout(resolve, timeoutMs)
        }),
      ])
    } catch {
      // Nothing to report to: the window is already going away.
    } finally {
      if (timer) clearTimeout(timer)
    }
    await exit()
  }
}

/**
 * Every write that may still be in flight when the window closes: the project's debounced autosave
 * sidecar, and the reference tables file, which is written after every accepted edit (research R4).
 * @returns {Promise<unknown>}
 */
export function flushPendingWrites() {
  return Promise.all([ProjectFileService.flushAutosave(), ReferenceTablesFileService.flush()])
}

/**
 * Set by the app shell once it is on screen: the prompt needs a mounted dialog provider, and the shell
 * stays mounted whichever section is open, so closing from «Довідники» still asks (002/FR-008).
 */
let exitDecision = null

/**
 * @param {() => Promise<boolean>} decide
 * @returns {() => void} unregisters it, so an unmounted view is never asked
 */
export function setExitDecision(decide) {
  exitDecision = decide
  return () => {
    if (exitDecision === decide) exitDecision = null
  }
}

/**
 * Registers the guard with the running window. A no-op in a plain browser, where there is neither
 * a `windowClose` event nor a process to exit.
 *
 * @returns {(() => Promise<void>)|null} the handler, so a caller can invoke it directly
 */
export function installCloseGuard() {
  if (!isNeutralinoRuntime()) return null

  const handler = createCloseHandler({
    beforeExit: () => (exitDecision ? exitDecision() : true),
    flush: flushPendingWrites,
    exit: () => app.exit(),
  })
  events.on('windowClose', handler)
  return handler
}
