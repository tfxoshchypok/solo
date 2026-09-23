// FR-038 is a boundary, not a behaviour: the editor models what is connected to what, and nothing
// about how the cable gets there. A requirement like that has no acceptance scenario to test, so
// what is testable is the absence — no module, and no catalog row, carries the fields that would
// mean someone started modelling a route, a length, a cross-section, a conduit, a terminal or a
// position on a floor plan.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import catalog from '@/data/catalog.builtin.json'
import { CatalogSchema, NodeSchema } from '@/schemas/index.js'
import * as v from 'valibot'

/**
 * Ukrainian and English both, because half the strings in this codebase are Ukrainian. `route` on
 * its own is deliberately absent — `vue-router` uses it everywhere and would match every view;
 * only the cable sense is looked for.
 */
const OUT_OF_SCOPE = [
  /\bcables?\b/i,
  /\bconduits?\b/i,
  /cross-?section/i,
  /cable-?(route|length|run)/i,
  /floor-?plan/i,
  /\bterminals?\b/i,
  /кабел/i,
  /переріз/i,
  /гофр/i,
  /план\s+поверх/i,
  /клем/i,
]

function sourceFiles() {
  return readdirSync('src', { recursive: true })
    .map(String)
    .filter((name) => /\.(js|vue|json)$/.test(name))
    .map((name) => ({ file: `src/${name}`, text: readFileSync(`src/${name}`, 'utf8') }))
}

/**
 * The requirement-to-test map T060 asks for. Every requirement the spec numbers has to be named by
 * at least one test, so a requirement cannot be quietly dropped in a refactor: deleting the test
 * that proves it makes this fail with the id in the message.
 */
describe('every numbered requirement is named by a test (T060)', () => {
  it('leaves no FR from spec.md unclaimed', () => {
    const spec = readFileSync('specs/001-electrical-load-tree-editor/spec.md', 'utf8')
    const required = new Set(spec.match(/FR-\d{3}/g))

    const named = new Set()
    for (const name of readdirSync('tests', { recursive: true }).map(String)) {
      if (!name.endsWith('.test.js')) continue
      for (const id of readFileSync(`tests/${name}`, 'utf8').match(/FR-\d{3}/g) ?? []) {
        named.add(id)
      }
    }

    expect([...required].filter((id) => !named.has(id)).sort()).toEqual([])
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

  it('reads the catalog from the bundle rather than from anywhere else (FR-022)', () => {
    const service = readFileSync('src/services/CatalogFileService.js', 'utf8')
    expect(service).toContain("import builtinCatalog from '@/data/catalog.builtin.json'")
    expect(service).not.toContain('getFs')
  })
})

describe('the feature stops where FR-038 says it stops', () => {
  it('mentions no cable route, length, cross-section, conduit, terminal or floor plan', () => {
    const hits = []
    for (const { file, text } of sourceFiles()) {
      for (const pattern of OUT_OF_SCOPE) {
        if (pattern.test(text)) hits.push(`${file}: ${pattern}`)
      }
    }

    expect(hits).toEqual([])
  })

  it('keeps the catalog row at four fields — nothing about how the load is fed (FR-020)', () => {
    expect(v.safeParse(CatalogSchema, catalog).success).toBe(true)

    const extra = new Set()
    for (const type of catalog.types) {
      for (const key of Object.keys(type)) {
        if (!['id', 'name', 'nameEn', 'categoryId'].includes(key)) extra.add(key)
      }
    }
    expect([...extra]).toEqual([])
  })

  it('keeps a node at its structural fields, so a save cannot smuggle one in', () => {
    const consumer = {
      id: 'n-1',
      kind: 'consumer',
      name: 'Холодильник',
      parentId: 'n-0',
      childIds: [],
      typeId: 'fridge',
      typeName: 'Холодильник',
      quantity: 1,
      cableCrossSection: 2.5,
    }

    // valibot drops what the schema does not name, so the field never reaches the store or the file.
    const parsed = v.parse(NodeSchema, consumer)
    expect(parsed.cableCrossSection).toBeUndefined()
  })
})
