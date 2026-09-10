// One schema library for two jobs: vee-validate on the node inspector, and validation of a
// `.eltree.json` on load. Both need the same answer to "is this a legal node", so there is one
// definition (R6).
import * as v from 'valibot'

/** The project file format version. A reader that does not know the value refuses the file. */
export const SCHEMA_VERSION = 1

const Id = v.pipe(v.string(), v.minLength(1))
const Name = v.pipe(v.string(), v.minLength(1), v.maxLength(120))
const Note = v.pipe(v.string(), v.maxLength(2000))

export const ChildrenKindSchema = v.picklist(['undecided', 'panels', 'consumers'])

// ---------------------------------------------------------------- nodes (FR-003)

const sharedNodeFields = {
  id: Id,
  name: Name,
  note: v.optional(Note),
}

/** The unique root (FR-002). It carries `childrenKind` and obeys homogeneity like a panel (FR-014). */
export const EntryNodeSchema = v.object({
  ...sharedNodeFields,
  kind: v.literal('entry'),
  parentId: v.null(),
  childIds: v.array(Id),
  childrenKind: ChildrenKindSchema,
})

export const PanelNodeSchema = v.object({
  ...sharedNodeFields,
  kind: v.literal('panel'),
  parentId: Id,
  childIds: v.array(Id),
  childrenKind: ChildrenKindSchema,
})

/** A leaf that can never have children (FR-004). */
export const ConsumerNodeSchema = v.object({
  ...sharedNodeFields,
  kind: v.literal('consumer'),
  parentId: Id,
  childIds: v.pipe(v.array(Id), v.maxLength(0)),
  typeId: Id,
  /** The type's display name as it was when the node was placed, so a dropped type still reads. */
  typeName: Name,
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export const NodeSchema = v.variant('kind', [EntryNodeSchema, PanelNodeSchema, ConsumerNodeSchema])

// ---------------------------------------------------------------- catalog

/** A catalog row supplies a consumer's name and its category, and nothing else (FR-020). */
export const ConsumerTypeSchema = v.object({
  id: Id,
  name: Name,
  nameEn: v.pipe(v.string(), v.minLength(1)),
  categoryId: Id,
})

export const CategorySchema = v.object({
  id: Id,
  name: Name,
  nameEn: v.string(),
  order: v.pipe(v.number(), v.integer()),
})

export const CatalogSchema = v.object({
  catalogVersion: v.nullable(v.string()),
  categories: v.array(CategorySchema),
  types: v.array(ConsumerTypeSchema),
})

// ---------------------------------------------------------------- project file

export const ProjectSchema = v.object({
  schemaVersion: v.pipe(v.number(), v.integer()),
  catalogVersion: v.string(),
  name: Name,
  createdAt: v.string(),
  modifiedAt: v.string(),
  rootId: Id,
  nodes: v.array(NodeSchema),
})

// ---------------------------------------------------------------- issue paths

/**
 * Renders a valibot issue path the way FR-036 asks for it: `nodes[42].quantity`.
 * valibot's own `getDotPath` gives `nodes.42.quantity`, which does not name an array element.
 * @param {import('valibot').BaseIssue<unknown>} issue
 * @returns {string}
 */
export function formatIssuePath(issue) {
  const path = issue?.path
  if (!path || path.length === 0) return ''
  return path.reduce((acc, item) => {
    if (typeof item.key === 'number') return `${acc}[${item.key}]`
    return acc === '' ? String(item.key) : `${acc}.${item.key}`
  }, '')
}
