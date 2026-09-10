// Where the app's files live. A project is wherever the user put it, and the sidecar and temp
// paths are derived from it.
//
// The data directory comes from the fs adapter, not from `@neutralinojs/lib` directly: outside a
// Neutralino window the library queues every call until a WebSocket that is never opened, so a
// direct `os.getPath` here would hang each test and each browser dev session (contracts/services.md).
import { getFs } from './fs/index.js'

/** Matches `applicationId` in neutralino.config.json. */
export const APPLICATION_ID = 'ua.eltree.editor'
export const PROJECT_EXTENSION = '.eltree.json'

/** The Neutralino runtime injects NL_APPID; outside it the configured id is the fallback. */
export function applicationId() {
  return (typeof window !== 'undefined' && window.NL_APPID) || APPLICATION_ID
}

/** Joins with `/`, which every platform Neutralino targets accepts. */
export function join(...parts) {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== '')
    .map((part, index) =>
      index === 0
        ? String(part).replace(/[/\\]+$/, '')
        : String(part).replace(/^[/\\]+|[/\\]+$/g, ''),
    )
    .join('/')
}

export function basename(path) {
  return String(path).split(/[/\\]/).pop() ?? ''
}

export function dirname(path) {
  const parts = String(path).split(/[/\\]/)
  parts.pop()
  return parts.join('/')
}

/** `<data dir>` joined with the application id — where an unsaved project's sidecar lives (R2). */
export async function appDataDir() {
  return join(await getFs().dataDir(), applicationId())
}

export function autosavePath(projectPath) {
  return `${projectPath}.autosave.json`
}

/** `<path>.tmp` — written first, then moved onto the project file. */
export function tmpPath(path) {
  return `${path}.tmp`
}

/** The default filename a save dialog offers for a project called `name`. */
export function projectFileName(name) {
  const safe = String(name ?? 'project')
    .trim()
    .replace(/[/\\:*?"<>|]/g, '-')
  return `${safe || 'project'}${PROJECT_EXTENSION}`
}
