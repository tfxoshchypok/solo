// FR-038 is a boundary, not a behaviour: the editor models what is connected to what, and nothing
// about how the cable gets there. A requirement like that has no acceptance scenario to test, so
// what is testable is the absence — a node keeps only the fields its schema names.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { NodeSchema } from '@/schemas/index.js'
import * as v from 'valibot'
import { loadTypeRow, zoneRow } from '../../fixtures/tree.js'

function sourceFiles() {
  return readdirSync('src', { recursive: true })
    .map(String)
    .filter((name) => /\.(js|vue|json)$/.test(name))
    .map((name) => ({ file: `src/${name}`, text: readFileSync(`src/${name}`, 'utf8') }))
}

/**
 * Feature 001 requirements that feature 002 retires, as its spec lists them under *Relation to
 * Feature 001* (specs/002-reference-tables-consumer-fields/spec.md): the catalog and its search
 * (FR-019 – FR-022), placing from it (FR-023), renaming against it (FR-024), quantity (FR-025), the
 * catalog version (FR-033) and the stored type name (FR-034). Their tests left with the catalog.
 */
const SUPERSEDED_BY_002 = new Set([
  'FR-019',
  'FR-020',
  'FR-021',
  'FR-022',
  'FR-023',
  'FR-024',
  'FR-025',
  'FR-033',
  'FR-034',
])

/** The ids a spec defines, one per `- **FR-NNN**` line; a mention elsewhere is not one. */
function definedRequirements(path) {
  const spec = readFileSync(path, 'utf8')
  return [...spec.matchAll(/^\s*- \*\*(FR-\d{3})\*\*/gm)].map(([, id]) => id)
}

function testSources() {
  return readdirSync('tests', { recursive: true })
    .map(String)
    .filter((name) => name.endsWith('.test.js'))
    .map((name) => readFileSync(`tests/${name}`, 'utf8'))
    .join('\n')
}

/**
 * The requirement-to-test map T060 asks for, over both specs. Every requirement a spec defines has to
 * be named by at least one test, so a requirement cannot be quietly dropped in a refactor: deleting
 * the test that proves it makes this fail with the id in the message. Both specs number from 001, so
 * a test of feature 002 writes the id with a `002/` prefix and a bare id names feature 001 (research
 * R12). The ids come from the definitions, because spec 002 also mentions ids of feature 001.
 */
describe('every numbered requirement of both specs is named by a test (T060, T055)', () => {
  it('leaves no requirement of feature 001 unclaimed, cited by a bare id', () => {
    const required = definedRequirements('specs/001-electrical-load-tree-editor/spec.md').filter(
      (id) => !SUPERSEDED_BY_002.has(id),
    )
    const named = new Set(testSources().match(/(?<!\/)FR-\d{3}/g))

    expect(required.length).toBeGreaterThan(0)
    expect(required.filter((id) => !named.has(id)).sort()).toEqual([])
  })

  it('leaves no requirement of feature 002 unclaimed, cited with the 002/ prefix', () => {
    const required = definedRequirements('specs/002-reference-tables-consumer-fields/spec.md')
    const named = new Set((testSources().match(/002\/FR-\d{3}/g) ?? []).map((id) => id.slice(4)))

    expect(required.length).toBeGreaterThan(0)
    expect(required.filter((id) => !named.has(id)).sort()).toEqual([])
  })
})

describe('nothing reaches the network (FR-032)', () => {
  it('names no URL and calls no network API — the project lives on the local disk alone', () => {
    const NETWORK = [/\bfetch\s*\(/, /XMLHttpRequest/, /new WebSocket/, /\baxios\b/, /https?:\/\//]

    const hits = []
    for (const { file, text } of sourceFiles()) {
      for (const pattern of NETWORK) {
        if (pattern.test(text)) hits.push(`${file}: ${pattern}`)
      }
    }

    expect(hits).toEqual([])
  })
})

describe('the feature stops where FR-038 says it stops', () => {
  it('keeps a node at its structural fields, so a save cannot smuggle one in', () => {
    const consumer = {
      id: 'n-1',
      kind: 'consumer',
      name: 'Холодильник',
      parentId: 'n-0',
      childIds: [],
      loadType: loadTypeRow({ id: 'lt-fridge', name: 'Холодильник' }),
      zone: zoneRow({ id: 'zn-kitchen', name: 'Кухня' }),
      cableSectionMm2: 2.5,
      cableLength: 12,
    }

    // valibot drops what the schema does not name, so the field never reaches the store or the file.
    const parsed = v.parse(NodeSchema, consumer)
    expect(parsed.cableLength).toBeUndefined()
  })
})
