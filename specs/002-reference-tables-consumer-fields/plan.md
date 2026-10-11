# Implementation Plan: Reference Tables and Consumer Fields

**Branch**: `002-reference-tables-consumer-fields` | **Date**: 2026-09-26, revised 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-reference-tables-consumer-fields/spec.md`

## Summary

Two editable reference tables from the source document (`specs/docs/002-spozhyvachi-dovidnyk-tz.md`)
— 33 load types and 8 zones — get their own section, «Довідники», next to «Дерево». They ship as a
bundled JSON file, and every accepted cell edit, added row or deleted row is written at once, atomically,
to one JSON file in the application's data directory. Rows carry a generated id the user never sees;
names are required and unique per table.

A consumer node becomes `{ name, loadType, zone, cableSectionMm2 }` besides its place in the tree, where
`loadType` and `zone` are whole copies of the chosen rows, ids included (revision 2026-10-03). The
consumer works with its copy until the user chooses a row again; each copied value except the two names
is editable on that consumer, in a separate, tinted group of the properties area.
The feature 001 catalog (87 types), its search and `fuse.js` are removed; the project file keeps
schema version 1, since the application is not in test use yet. The unsaved-changes prompt on window close moves from
the tree view to the app shell so it works from either section. Nothing is computed from any value.

## Technical Context

**Language/Version**: JavaScript (ES modules), Vue 3.5 single-file components; Node.js ≥ 22.13.0 for
tooling

**Primary Dependencies**: unchanged from feature 001 — `@neutralinojs/lib` 6.9.0, `vue` 3.5.42,
`pinia` 4.0.3, `vue-router` 5.3.1, `naive-ui` 2.45.3, `valibot` 1.4.2, `immer` 11.1.18, `@vueuse/core`
14.4.0. Removed: `fuse.js` 7.5.0. Added: none

**Storage**: JSON files through the existing fs adapter (`src/services/fs/`): project files
`*.eltree.json` at schema version 1; `<appDataDir>/reference-tables.json`; shipped tables bundled as
`src/data/referenceTables.builtin.json`

**Testing**: `vitest` 5.0.0 — `unit` project (node) and `component` project (happy-dom);
`@vue/test-utils` 2.5.0 with real Naive UI providers; `fast-check` 4.9.0; `MemoryFs` for all file I/O

**Target Platform**: NeutralinoJS desktop window on Linux, Windows and macOS

**Project Type**: desktop application

**Performance Goals**: an accepted edit is on disk before the next one starts (serialized writes of a
~10 KB file); 41 rows render without virtual scrolling; switching sections shows no perceptible delay;
the 500-node tree of feature 001 stays navigable with its file grown from 158 KB to 423 KB by the
copies (research R15)

**Constraints**: fully offline (001 FR-032); reference tables stored as JSON (FR-007); generated row ids
never reach the screen (FR-005); no table edit reaches a consumer (FR-010); nothing computed from
reference values or the cable cross-section (FR-020)

**Scale/Scope**: 33 + 8 shipped rows, user additions in the tens; one new module of 8 files
(`modules/reference/`), 3 new files beside it (`LoadError.js`, `ReferenceTablesFileService.js`,
`referenceTables.builtin.json`), 12 changed and 3 removed source files; about 35 test files touched

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Specify Only What Was Asked | The spec passed its compliance check before planning (`checklists/requirements.md`, *Constitution Compliance*). Principle I governs `spec.md` until this first plan generation; from here it lapses, and technical decisions are this phase's job. | PASS |
| I, applied to the plan's own output | No decision in `research.md` adds user-visible behaviour the spec lacks. The decisions that touch the screen only implement stated requirements: comma as a decimal separator (R8, FR-006), commit on blur/Enter (R7, clarified "at once"), the select that shows the copied name (R14, FR-005 + FR-015), the two groups of the properties area (R17, FR-022). | PASS |

**Post-design re-check** (after Phase 1): the data model, three contracts and quickstart introduce no
entity, field or screen beyond the spec. The one spec edit made during planning adds feature 001 FR-024
to the *Relation to Feature 001* table, where it was missing; it retires nothing the table did not
already retire. PASS.

**Re-check after the 2026-10-03 revision**: the copies on the consumer (R15), the copied-value editing
(R16) and the two-group properties area (R17) trace to FR-010, FR-014, FR-015, FR-021, FR-022 and the
clarification session of 2026-10-03. The one component added, `CellEditor.vue`, is moved out of
`ReferenceTable.vue`, not new behaviour. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/002-reference-tables-consumer-fields/
├── spec.md                         # /speckit-specify + /speckit-clarify
├── plan.md                         # this file
├── research.md                     # R1–R17
├── data-model.md                   # tables, rows, consumer node with copied rows, project
├── quickstart.md                   # manual scenarios Q1–Q5, automated coverage map
├── contracts/
│   ├── reference-tables-file.md    # file shape, load stages, refusal, writes
│   ├── project-file.md             # consumer fields against feature 001
│   ├── project-file.schema.json    # generated by `npm run schema:emit` during implementation
│   └── services.md                 # engine, service, store, component surfaces
├── checklists/requirements.md
└── tasks.md                        # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
src/
├── main.js                                   # CHANGED  app.use(ReferenceModule, { router }) after TreeModule
├── data/
│   ├── catalog.builtin.json                  # REMOVED
│   └── referenceTables.builtin.json          # NEW      33 load types + 8 zones, ids fixed once
├── schemas/index.js                          # CHANGED  consumer { loadType: LoadTypeSchema, zone: ZoneSchema, cableSectionMm2 }, reference schemas; catalog schemas removed
├── services/
│   ├── CatalogFileService.js                 # REMOVED
│   ├── LoadError.js                          # NEW      moved out of ProjectFileService
│   ├── ProjectFileService.js                 # CHANGED  no catalogVersion; doc comment on unchecked copies
│   ├── ReferenceTablesFileService.js         # NEW      load / refuse + move aside / serialized atomic save / flush
│   └── closeGuard.js                         # CHANGED  flush also awaits the reference tables writes
├── stores/project.js                         # CHANGED  catalog store and catalogVersion removed
├── components/AppLayout.vue                  # CHANGED  «Довідники» menu entry, startup load + refusal message, exit decision
└── modules/
    ├── tree/
    │   ├── engine/treeOps.js                 # CHANGED  consumer with copied rows, setConsumerLoadType/Zone(row), setConsumerCopyValue, setCableSection; setQuantity removed
    │   ├── stores/catalog.js                 # REMOVED
    │   ├── stores/tree.js                    # CHANGED  add() request with rows, setLoadType/setZone find the row, setCopyValue, setCableSection
    │   ├── components/AddConsumerDialog.vue  # REWRITTEN load type + zone selects; request carries both rows
    │   ├── components/NodeInspector.vue      # CHANGED  project group + tinted reference group (research R17)
    │   ├── components/StructuralFixDialog.vue# CHANGED  pending request shape (doc comment)
    │   └── views/TreeEditorView.vue          # CHANGED  exit decision moved out
    └── reference/                            # NEW module
        ├── index.js                          # ReferenceModule: route /reference, name 'reference'
        ├── config/columns.js                 # per table: key, source-document header, kind
        ├── engine/cells.js                   # parseNumberCell, parseTextCell, formatCell, parseCell
        ├── engine/tableOps.js                # addRow, updateCell, deleteRow, nameKey, findDuplicateName
        ├── stores/referenceTables.js         # useReferenceTablesStore
        ├── components/CellEditor.vue         # per-kind cell editor, shared with NodeInspector (research R17)
        ├── components/ReferenceTable.vue     # n-data-table with CellEditor cells
        └── views/ReferenceTablesView.vue     # n-tabs: «Типи навантажень», «Зони»

scripts/emit-project-schema.mjs               # CHANGED  output → specs/002-…/contracts/project-file.schema.json

tests/
├── fixtures/tree.js                          # CHANGED  consumer(id, { loadType, zone, cableSectionMm2 }) with whole test rows
├── fixtures/tree-500.eltree.json             # REGENERATED with copies of the shipped rows
├── unit/
│   ├── data/referenceTablesBuiltin.test.js   # NEW      SC-001 against the source document's markdown tables
│   ├── reference/cells.test.js               # NEW
│   ├── reference/tableOps.test.js            # NEW
│   ├── services/referenceTablesFile.test.js  # NEW
│   ├── catalog/                              # REMOVED  search.test.js, coverage.test.js
│   └── …                                     # CHANGED  schemas, treeOps, tree store, projectFile, project store,
│                                             #          closeGuard, pathService, contracts/projectSchema,
│                                             #          quickstart/walkthrough, scope/boundaries (T060), performance
└── component/
    ├── referenceTable.test.js                # NEW
    ├── referenceNavigation.test.js           # NEW      section switch keeps the project; exit prompt from /reference
    ├── missingReference.test.js              # NEW      a file whose rows are missing or different locally keeps its values
    ├── categoryFilter.test.js, missingType.test.js   # REMOVED
    └── addConsumer, nodeInspector, editorToolbar, fixDialogMove, …   # CHANGED
```

`README.md` sections «Структура» and «Файл проекту» are updated to the new files and the consumer
fields, and the spec link gains `specs/002-reference-tables-consumer-fields/`.

**Structure Decision**: The reference tables are a second Vue Plugin module, `modules/reference/`,
because they bring a route and a screen of their own — the rule the tree module follows. The module
owns the tables' state and pure operations (`stores/`, `engine/`). The tree module and
`AppLayout.vue` import from it — the store, `engine/cells.js`, `config/columns.js` and
`components/CellEditor.vue` — and nothing in `modules/reference/` imports from the tree, so the
dependency runs one way. File I/O stays in `src/services/`,
beside `ProjectFileService.js`, because `closeGuard.js` has to flush it and the services layer never
imports a module. Schemas stay in the single `src/schemas/index.js` (001 R6). The skill's Dexie layer
is not used: the project has no database, and the spec asks for JSON (FR-007).

## Complexity Tracking

No constitution violations to justify.
