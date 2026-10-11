// One filesystem interface, two implementations. Everything above this line — the project file
// service, the reference tables file service — talks only to this shape, which is why no test and
// no browser dev session ever touches a real file (contracts/services.md).
//
// MemoryFs imports FsError from here, so this module and MemoryFs form an import cycle. It is
// safe because FsError is only ever referenced inside a method body, never while a module
// evaluates.
import { MemoryFs } from './MemoryFs.js'
import { NeutralinoFs } from './NeutralinoFs.js'

/** @typedef {{ size:number, isFile:boolean, isDirectory:boolean, createdAt:number, modifiedAt:number }} FsStat */

export class FsError extends Error {
  constructor({ code, path, message, cause }) {
    super(message ?? `${code}: ${path}`)
    this.name = 'FsError'
    this.code = code
    this.path = path
    if (cause) this.cause = cause
  }
}

/**
 * The Neutralino window injects `NL_PORT` into any page it loads, including the Vite dev server,
 * so this is the one reliable runtime marker.
 *
 * The contract phrases the check as `typeof Neutralino !== 'undefined' && window.NL_PORT`. The
 * first half is dropped on purpose: the API arrives through the `@neutralinojs/lib` npm package,
 * which exports functions and defines no global `Neutralino`, so that half would be false inside
 * the real window and every save would land in memory.
 */
export function isNeutralinoRuntime() {
  return typeof window !== 'undefined' && Boolean(window.NL_PORT)
}

let instance = null

/** The adapter this runtime should use. Built once, on first use. */
export function getFs() {
  if (!instance) instance = isNeutralinoRuntime() ? new NeutralinoFs() : new MemoryFs()
  return instance
}

/** Replaces the adapter — the seam integration tests use to run over `MemoryFs`. */
export function setFs(fs) {
  instance = fs
}

export { MemoryFs, NeutralinoFs }
