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

// ---------------------------------------------------------------- reference tables (feature 002)

// Every row carries every key; an empty cell is `null`, never absent and never '' (data-model.md).
// Name uniqueness spans a whole table, so it is not a per-row schema: `findDuplicateName` below
// checks it, and the loader and the table editor both call it.
const NumberCell = v.nullable(v.pipe(v.number(), v.finite()))
const YesNoCell = v.nullable(v.boolean())
const TextCell = v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(2000)))

/** A row of the load types table (002/FR-001). `name` is the node `Name`: a consumer takes it. */
export const LoadTypeSchema = v.object({
  id: Id,
  name: Name,
  ratedPowerKw: NumberCell,
  phases: TextCell,
  breakerCurve: TextCell,
  continuous: YesNoCell,
  powerFactor: NumberCell,
  demandFactor: NumberCell,
  rcdType: TextCell,
})

/** A row of the zones table (002/FR-001). */
export const ZoneSchema = v.object({
  id: Id,
  name: Name,
  rcdRequired: YesNoCell,
  leakageMa: NumberCell,
  minIp: TextCell,
  separateRcd: YesNoCell,
  purpose: TextCell,
})

// ---------------------------------------------------------------- reference tables (feature 003)

// Two more cell kinds (research R7): `count` is a whole number ≥ 1, `positive` a number > 0.
const CountCell = v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))
const PositiveCell = v.nullable(v.pipe(v.number(), v.finite(), v.gtValue(0)))

/** A row of «Типорозміри корпусів» (003/FR-015). No name column, and equal rows are allowed (R8). */
export const EnclosureSizeSchema = v.object({
  id: Id,
  rowModularity: CountCell,
  rowCount: CountCell,
})

/** A row of «Ширина апаратів за полюсністю, модулів» (003/FR-013). */
export const DeviceWidthSchema = v.object({
  id: Id,
  name: Name,
  widthModules: PositiveCell,
})

/** A row of «Ширина опційних ввідних апаратів, модулів» (003/FR-013). */
export const IncomingDeviceWidthSchema = v.object({
  id: Id,
  name: Name,
  width1ph: PositiveCell,
  width3ph: PositiveCell,
})

// ---------------------------------------------------------------- panel properties (feature 003)

/**
 * One nullable schema per project property (003/FR-001). `null` is an empty property on the entry
 * and an inherited one in a panel's `overrides` (003/FR-004).
 */
export const PROJECT_PROPERTY_SCHEMAS = {
  supplyPhases: v.nullable(v.picklist([1, 3])),
  moduleReservePct: v.nullable(v.pipe(v.number(), v.finite(), v.minValue(0))),
  separateRcdMode: v.nullable(v.picklist(['rcbo', 'mcbRcd'])),
  maxLinesPerGroupRcd: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
  neutralBreak: v.nullable(v.boolean()),
  selectiveFeederRcd: v.nullable(v.boolean()),
}

/** All six on the entry, every key present (003/FR-003). */
export const ProjectPropertiesSchema = v.object(PROJECT_PROPERTY_SCHEMAS)

/** A panel's own values: the five that may be overridden, `supplyPhases` not among them (003/FR-004). */
export const PanelOverridesSchema = v.object(
  Object.fromEntries(
    Object.entries(PROJECT_PROPERTY_SCHEMAS).filter(([key]) => key !== 'supplyPhases'),
  ),
)

/** A whole copy of an incoming device row, taken when the panel is created, plus its mark (003/FR-009). */
export const IncomingDeviceCopySchema = v.object({
  ...IncomingDeviceWidthSchema.entries,
  install: v.boolean(),
})

/** The «купувати окремо» marks, each `true` or `false` — never empty (003/FR-009). */
export const BuySeparatelySchema = v.object({
  neutralBars: v.boolean(),
  peBar: v.boolean(),
  combBusbars: v.boolean(),
  cableGlands: v.boolean(),
  blankingPlates: v.boolean(),
})

// Nothing in this feature computes a value, so each calculated field is `null` (research R6).
const PanelCalculatedSchema = v.object({
  enclosure: v.null(),
  deviceComposition: v.null(),
  accessoryQuantities: v.null(),
  groupRcd: v.null(),
  phase: v.null(),
})
const ConsumerCalculatedSchema = v.object({
  groupRcd: v.null(),
  phase: v.null(),
})

// ---------------------------------------------------------------- nodes (FR-003)

const sharedNodeFields = {
  id: Id,
  name: Name,
}

/** The unique root (FR-002). It carries `childrenKind` and obeys homogeneity like a panel (FR-014). */
export const EntryNodeSchema = v.object({
  ...sharedNodeFields,
  note: v.optional(Note),
  kind: v.literal('entry'),
  parentId: v.null(),
  childIds: v.array(Id),
  childrenKind: ChildrenKindSchema,
  projectProperties: ProjectPropertiesSchema,
})

export const PanelNodeSchema = v.object({
  ...sharedNodeFields,
  note: v.optional(Note),
  kind: v.literal('panel'),
  parentId: Id,
  childIds: v.array(Id),
  childrenKind: ChildrenKindSchema,
  overrides: PanelOverridesSchema,
  incomingDevices: v.array(IncomingDeviceCopySchema),
  buySeparately: BuySeparatelySchema,
  calculated: PanelCalculatedSchema,
})

/**
 * A leaf that can never have children (FR-004), carrying exactly the field list of 002/FR-009. The
 * load type and the zone are whole copies of the rows the user chose, ids included (002/FR-010): a
 * copied value follows its row's schema (002/FR-021), and neither copy is compared with the local
 * tables (002/FR-018). `cableSectionMm2` is nullable, not optional: the key is always there.
 */
export const ConsumerNodeSchema = v.object({
  ...sharedNodeFields,
  kind: v.literal('consumer'),
  parentId: Id,
  childIds: v.pipe(v.array(Id), v.maxLength(0)),
  loadType: LoadTypeSchema,
  zone: ZoneSchema,
  cableSectionMm2: v.nullable(v.pipe(v.number(), v.finite(), v.gtValue(0))),
  calculated: ConsumerCalculatedSchema,
})

export const NodeSchema = v.variant('kind', [EntryNodeSchema, PanelNodeSchema, ConsumerNodeSchema])

// ---------------------------------------------------------------- reference tables file

/**
 * `reference-tables.json` and the bundled `referenceTables.builtin.json` (002/FR-007). A file
 * without one of the five arrays is refused whole (003/FR-018).
 */
export const ReferenceTablesSchema = v.object({
  schemaVersion: v.literal(1),
  loadTypes: v.array(LoadTypeSchema),
  zones: v.array(ZoneSchema),
  enclosureSizes: v.array(EnclosureSizeSchema),
  deviceWidths: v.array(DeviceWidthSchema),
  incomingDevices: v.array(IncomingDeviceWidthSchema),
})

/** Every reference table, in the order the file stores them and the «Довідники» section shows them. */
export const REFERENCE_TABLES = [
  'loadTypes',
  'zones',
  'enclosureSizes',
  'deviceWidths',
  'incomingDevices',
]

/** The tables whose rows carry a `name`, unique within the table (002/FR-005, 003/FR-017). */
export const NAMED_TABLES = ['loadTypes', 'zones', 'deviceWidths', 'incomingDevices']

/**
 * The key two row names are compared by. With the row id hidden from the user (002/FR-005), the name
 * is the only thing that tells rows apart in a choice list, so «Розетки» and « розетки » are one name.
 * @param {string} name
 * @returns {string}
 */
export function nameKey(name) {
  return String(name).trim().toLocaleLowerCase('uk')
}

/**
 * @param {{ name: string }[]} rows
 * @returns {number} the index of the first row whose name repeats an earlier one, or -1
 */
export function findDuplicateName(rows) {
  const seen = new Set()
  for (let i = 0; i < rows.length; i += 1) {
    const key = nameKey(rows[i].name)
    if (seen.has(key)) return i
    seen.add(key)
  }
  return -1
}

// ---------------------------------------------------------------- project file

export const ProjectSchema = v.object({
  schemaVersion: v.pipe(v.number(), v.integer()),
  name: Name,
  createdAt: v.string(),
  modifiedAt: v.string(),
  rootId: Id,
  nodes: v.array(NodeSchema),
})

// ---------------------------------------------------------------- issue paths

/**
 * Renders a valibot issue path the way FR-036 asks for it: `nodes[42].zone.leakageMa`.
 * valibot's own `getDotPath` gives `nodes.42.zone.leakageMa`, which does not name an array element.
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
