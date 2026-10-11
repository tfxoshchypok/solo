import { describe, it, expect, afterEach } from 'vitest'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import {
  appDataDir,
  applicationId,
  autosavePath,
  tmpPath,
  PROJECT_EXTENSION,
} from '@/services/PathService.js'

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
