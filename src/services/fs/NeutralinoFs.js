import { filesystem, os } from '@neutralinojs/lib'
import { FsError } from './index.js'

/** `getStats` on a path that does not exist throws this — it is the existence check (R1). */
const NO_PATH = 'NE_FS_NOPATHE'

function wrap(error, path) {
  if (error instanceof FsError) return error
  return new FsError({
    code: error?.code ?? 'FS_ERROR',
    path,
    message: error?.message ?? `Помилка файлової системи на ${path}.`,
    cause: error,
  })
}

/** The real filesystem and the native dialogs, behind the same interface as MemoryFs. */
export class NeutralinoFs {
  async readText(path) {
    try {
      return await filesystem.readFile(path)
    } catch (error) {
      throw wrap(error, path)
    }
  }

  async writeText(path, text) {
    try {
      await filesystem.writeFile(path, String(text))
    } catch (error) {
      throw wrap(error, path)
    }
  }

  async exists(path) {
    try {
      await filesystem.getStats(path)
      return true
    } catch (error) {
      if (error?.code === NO_PATH) return false
      throw wrap(error, path)
    }
  }

  /** @returns {Promise<import('./index.js').FsStat>} */
  async stat(path) {
    try {
      const stats = await filesystem.getStats(path)
      return {
        size: stats.size,
        isFile: stats.isFile,
        isDirectory: stats.isDirectory,
        createdAt: stats.createdAt,
        modifiedAt: stats.modifiedAt,
      }
    } catch (error) {
      throw wrap(error, path)
    }
  }

  /** On one filesystem this replaces in a single step — the atomic half of the save (FR-031). */
  async move(from, to) {
    try {
      await filesystem.move(from, to)
    } catch (error) {
      throw wrap(error, from)
    }
  }

  async remove(path) {
    try {
      await filesystem.remove(path)
    } catch (error) {
      throw wrap(error, path)
    }
  }

  async ensureDir(path) {
    if (await this.exists(path)) return
    try {
      await filesystem.createDirectory(path)
    } catch (error) {
      throw wrap(error, path)
    }
  }

  /** The platform data directory — the one path the app does not derive from a user choice. */
  async dataDir() {
    try {
      return await os.getPath('data')
    } catch (error) {
      throw wrap(error, 'data')
    }
  }

  /** @returns {Promise<string|null>} null when the user cancelled */
  async showOpenDialog({ title = 'Відкрити', filters, defaultPath } = {}) {
    const picked = await os.showOpenDialog(title, {
      filters,
      defaultPath,
      multiSelections: false,
    })
    return picked?.[0] ?? null
  }

  /** @returns {Promise<string|null>} null when the user cancelled */
  async showSaveDialog({ title = 'Зберегти', filters, defaultPath } = {}) {
    const picked = await os.showSaveDialog(title, { filters, defaultPath })
    return picked || null
  }
}
