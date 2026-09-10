import { describe, it, expect, afterEach } from 'vitest'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import {
  appDataDir,
  applicationId,
  autosavePath,
  tmpPath,
  PROJECT_EXTENSION,
} from '@/services/PathService.js'
import { CatalogFileService } from '@/services/CatalogFileService.js'

afterEach(() => {
  setFs(null)
})

describe('PathService asks the fs adapter for the data directory', () => {
  it('never reaches the platform, so a test resolves instead of hanging (contracts/services.md)', async () => {
    setFs(new MemoryFs({ dataDir: '/memfs/data' }))
    expect(await appDataDir()).toBe(`/memfs/data/${applicationId()}`)
  }, 1500)

  it('derives the sidecar and tmp paths from the project path', () => {
    const project = `/home/user/квартира${PROJECT_EXTENSION}`
    expect(autosavePath(project)).toBe(`${project}.autosave.json`)
    expect(tmpPath(project)).toBe(`${project}.tmp`)
  })
})

describe('CatalogFileService', () => {
  it('reads the bundled catalog without touching the filesystem (FR-022)', () => {
    // No `setFs` here on purpose: a call that reached the adapter would throw, not hang.
    const catalog = CatalogFileService.loadBuiltin()
    expect(catalog.types.length).toBeGreaterThan(0)
    expect(catalog.categories.length).toBeGreaterThan(0)
  })

  it('hands out a deeply frozen catalog, so no caller can edit the shared arrays', () => {
    const catalog = CatalogFileService.loadBuiltin()
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.types)).toBe(true)
    expect(Object.isFrozen(catalog.types[0])).toBe(true)
    expect(() => catalog.types.push({ id: 'x' })).toThrow(TypeError)
  })
})
