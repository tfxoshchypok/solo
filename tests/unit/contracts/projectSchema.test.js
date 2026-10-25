// The generated JSON Schema in contracts/ has to match the valibot schema the code validates
// against. Without this the two drift the moment a field is added and nobody re-runs the script
// (R6, T056).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildJsonSchema, serialize, OUTPUT_PATH } from '../../../scripts/emit-project-schema.mjs'

describe('contracts/project-file.schema.json', () => {
  it('is the feature 003 contract', () => {
    expect(OUTPUT_PATH.replaceAll('\\', '/')).toMatch(
      /specs\/003-panel-properties\/contracts\/project-file\.schema\.json$/,
    )
  })

  it('is what `npm run schema:emit` produces right now', () => {
    const committed = readFileSync(OUTPUT_PATH, 'utf8')
    expect(committed).toBe(serialize(buildJsonSchema()))
  })

  it('carries the fields the contract promises a reader', () => {
    const schema = buildJsonSchema()
    expect(Object.keys(schema.properties)).toEqual([
      'schemaVersion',
      'name',
      'createdAt',
      'modifiedAt',
      'rootId',
      'nodes',
    ])
    // Three node kinds, no more: entry, panel, consumer (FR-003).
    expect(schema.properties.nodes.items.oneOf).toHaveLength(3)
  })
})
