import { FsError } from './index.js'

/**
 * The filesystem interface over a Map. Used by the test suite and by `npm run dev` in a plain
 * browser, where there is no Neutralino runtime to talk to.
 */
export class MemoryFs {
  /**
   * @param {{ openPath?: string|null, savePath?: string|null, dataDir?: string, now?: number }} options
   *   `openPath` and `savePath` are what the native dialogs return, so a test never opens one.
   *   `dataDir` is what the platform data directory answers, so `PathService` never opens one either.
   */
  constructor({ openPath = null, savePath = null, dataDir = '/memfs/data', now = 0 } = {}) {
    this.files = new Map()
    this.dirs = new Set()
    this.openPath = openPath
    this.savePath = savePath
    this.dataRoot = dataDir
    this.clock = now
  }

  /** Moves the fake clock, so a test can make a sidecar provably newer (FR-031). */
  advanceClock(ms = 1) {
    this.clock += ms
  }

  tick() {
    this.clock += 1
    return this.clock
  }

  missing(path) {
    return new FsError({ code: 'NOT_FOUND', path, message: `Шляху ${path} не існує.` })
  }

  async readText(path) {
    const file = this.files.get(path)
    if (!file) throw this.missing(path)
    return file.text
  }

  async writeText(path, text) {
    const existing = this.files.get(path)
    this.files.set(path, {
      text: String(text),
      createdAt: existing?.createdAt ?? this.tick(),
      modifiedAt: this.tick(),
    })
  }

  async exists(path) {
    return this.files.has(path) || this.dirs.has(path)
  }

  /** @returns {Promise<import('./index.js').FsStat>} */
  async stat(path) {
    const file = this.files.get(path)
    if (file) {
      return {
        size: new TextEncoder().encode(file.text).length,
        isFile: true,
        isDirectory: false,
        createdAt: file.createdAt,
        modifiedAt: file.modifiedAt,
      }
    }
    if (this.dirs.has(path)) {
      return { size: 0, isFile: false, isDirectory: true, createdAt: 0, modifiedAt: 0 }
    }
    throw this.missing(path)
  }

  async move(from, to) {
    const file = this.files.get(from)
    if (!file) throw this.missing(from)
    this.files.set(to, { ...file, modifiedAt: this.tick() })
    this.files.delete(from)
  }

  async remove(path) {
    if (this.files.delete(path)) return
    if (this.dirs.delete(path)) return
    throw this.missing(path)
  }

  async ensureDir(path) {
    this.dirs.add(path)
  }

  /** The preset stand-in for `os.getPath('data')`. */
  async dataDir() {
    return this.dataRoot
  }

  async showOpenDialog() {
    return this.openPath
  }

  async showSaveDialog() {
    return this.savePath
  }
}
