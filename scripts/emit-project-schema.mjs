// Emits the JSON Schema form of `ProjectSchema` next to the contract that describes it.
//
// The contract is prose and the schema is code; keeping a generated file between them means a
// field added in `src/schemas/index.js` shows up in the contract folder on the next run instead of
// being documented from memory (R6). `tests/unit/contracts/projectSchema.test.js` fails when the
// committed file falls behind, so the run is not optional.
//
//   npm run schema:emit
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toJsonSchema } from '@valibot/to-json-schema'
import { ProjectSchema } from '../src/schemas/index.js'

const here = dirname(fileURLToPath(import.meta.url))
export const OUTPUT_PATH = resolve(
  here,
  '../specs/002-reference-tables-consumer-fields/contracts/project-file.schema.json',
)

/**
 * `variant` has no direct JSON Schema counterpart, so the converter reports it and would stop.
 * `errorMode: 'ignore'` lets it emit the `anyOf` it already produces for the three node kinds,
 * which is the shape a reader needs.
 */
export function buildJsonSchema() {
  // No `$schema` of our own: the converter stamps the draft it actually targets.
  return {
    $id: 'https://eltree.local/schemas/project-file.schema.json',
    title: 'Electrical consumer tree project file (.eltree.json)',
    ...toJsonSchema(ProjectSchema, { errorMode: 'ignore' }),
  }
}

export function serialize(schema) {
  return `${JSON.stringify(schema, null, 2)}\n`
}

// Only when run directly — the test above imports the two functions instead.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, serialize(buildJsonSchema()), 'utf8')
  console.log(`Записано ${OUTPUT_PATH}`)
}
