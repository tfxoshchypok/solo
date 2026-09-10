import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryFs } from '@/services/fs/MemoryFs.js'
import { FsError } from '@/services/fs/index.js'

describe('MemoryFs implements the fs interface', () => {
  let fs

  beforeEach(() => {
    fs = new MemoryFs()
  })

  it('writes text and reads it back', async () => {
    await fs.writeText('/data/project.eltree.json', '{"a":1}')
    expect(await fs.readText('/data/project.eltree.json')).toBe('{"a":1}')
  })

  it('overwrites on a second write', async () => {
    await fs.writeText('/x.json', 'first')
    await fs.writeText('/x.json', 'second')
    expect(await fs.readText('/x.json')).toBe('second')
  })

  it('reports existence without throwing', async () => {
    expect(await fs.exists('/x.json')).toBe(false)
    await fs.writeText('/x.json', 'hi')
    expect(await fs.exists('/x.json')).toBe(true)
  })

  it('stats a file with a size and a modification time', async () => {
    await fs.writeText('/x.json', 'hello')
    const stat = await fs.stat('/x.json')
    expect(stat.size).toBe(5)
    expect(stat.isFile).toBe(true)
    expect(typeof stat.modifiedAt).toBe('number')
  })

  it('advances modifiedAt on rewrite, which is what recovery compares (FR-031)', async () => {
    await fs.writeText('/x.json', 'a')
    const first = (await fs.stat('/x.json')).modifiedAt
    fs.advanceClock(10)
    await fs.writeText('/x.json', 'b')
    expect((await fs.stat('/x.json')).modifiedAt).toBeGreaterThan(first)
  })

  it('moves a file, which is the atomic-replace half of the save sequence', async () => {
    await fs.writeText('/x.json.tmp', 'payload')
    await fs.move('/x.json.tmp', '/x.json')
    expect(await fs.exists('/x.json.tmp')).toBe(false)
    expect(await fs.readText('/x.json')).toBe('payload')
  })

  it('move replaces an existing destination', async () => {
    await fs.writeText('/x.json', 'old')
    await fs.writeText('/x.json.tmp', 'new')
    await fs.move('/x.json.tmp', '/x.json')
    expect(await fs.readText('/x.json')).toBe('new')
  })

  it('removes a file', async () => {
    await fs.writeText('/x.json', 'bye')
    await fs.remove('/x.json')
    expect(await fs.exists('/x.json')).toBe(false)
  })

  it('ensureDir is idempotent and makes the directory exist', async () => {
    await fs.ensureDir('/data/eltree')
    await fs.ensureDir('/data/eltree')
    expect(await fs.exists('/data/eltree')).toBe(true)
    expect((await fs.stat('/data/eltree')).isDirectory).toBe(true)
  })

  it('answers a preset data directory, so PathService never calls the platform', async () => {
    expect(await fs.dataDir()).toBe('/memfs/data')
    expect(await new MemoryFs({ dataDir: '/tmp/whatever' }).dataDir()).toBe('/tmp/whatever')
  })
})

describe('MemoryFs on a path that does not exist', () => {
  let fs

  beforeEach(() => {
    fs = new MemoryFs()
  })

  it('throws FsError with a NOT_FOUND code from readText', async () => {
    await expect(fs.readText('/missing.json')).rejects.toThrow(FsError)
    await expect(fs.readText('/missing.json')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      path: '/missing.json',
    })
  })

  it('throws from stat, move and remove alike', async () => {
    await expect(fs.stat('/missing.json')).rejects.toThrow(FsError)
    await expect(fs.move('/missing.json', '/other.json')).rejects.toThrow(FsError)
    await expect(fs.remove('/missing.json')).rejects.toThrow(FsError)
  })

  it('answers exists() with false rather than throwing', async () => {
    await expect(fs.exists('/missing.json')).resolves.toBe(false)
  })
})

describe('MemoryFs native dialogs', () => {
  it('returns the preset path so a test never opens a dialog', async () => {
    const fs = new MemoryFs({
      openPath: '/preset/open.eltree.json',
      savePath: '/preset/save.eltree.json',
    })
    expect(await fs.showOpenDialog({ title: 'Відкрити' })).toBe('/preset/open.eltree.json')
    expect(await fs.showSaveDialog({ title: 'Зберегти' })).toBe('/preset/save.eltree.json')
  })

  it('returns null when nothing is preset, which is a cancelled dialog', async () => {
    const fs = new MemoryFs()
    expect(await fs.showOpenDialog({})).toBeNull()
    expect(await fs.showSaveDialog({})).toBeNull()
  })
})
