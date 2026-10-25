# Implementation Plan: Panel Properties

**Branch**: `003-panel-properties` | **Date**: 2026-10-12, re-run the same day after the spec revisions | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-panel-properties/spec.md`

## Summary

This feature adds the project, panel and reference-table properties from Part 1 of
`docs/Властивості щитка — специфікація.md`.

**Project properties.** The six properties are an object on the root «Ввід» node, edited below its name
and note. Because they live in the tree, they get undo, the unsaved mark, autosave and the file round
trip without new wiring.

**Panel properties.** Every panel holds:
- its own value or `null` for each of the five overridable properties, where `null` means it inherits
  from the root at any depth;
- a copy of the incoming device widths table taken when the panel is created, with a «встановлювати»
  mark per device;
- five «купувати окремо» marks;
- a `calculated` object of nulls.

An inherited field is shown empty, with the project's value as its placeholder and the tag «з проекту».
«Скинути», or clearing the field, makes the panel inherit again. A consumer gains the `calculated` pair.

**Reference tables.** Enclosure sizes, device widths by pole count and incoming device widths join the
load types and zones, in the same «Довідники» section, store and file. Two new column kinds come with
them: a whole number ≥ 1 and a number > 0.

**File formats.** `schemaVersion` stays 1 in both files. Nothing is computed.

## Technical Context

**Language/Version**: JavaScript (ES modules), Vue 3.5 single-file components; Node.js ≥ 22.13.0 for
tooling

**Primary Dependencies**: Unchanged from feature 002: `@neutralinojs/lib` 6.9.0, `vue` 3.5.42,
`pinia` 4.0.3, `vue-router` 5.3.1, `naive-ui` 2.45.3, `valibot` 1.4.2, `immer` 11.1.18, `@vueuse/core`
14.4.0. Nothing is added or removed.

**Storage**: JSON files through the existing fs adapter. Project files are `*.eltree.json` at schema
version 1. The stored tables are `<appDataDir>/reference-tables.json`, now holding five tables. The
shipped tables are `src/data/referenceTables.builtin.json`.

**Testing**: `vitest` 5.0.0, with a `unit` project (node) and a `component` project (happy-dom);
`@vue/test-utils` 2.5.0 with real Naive UI providers; `fast-check` 4.9.0; `MemoryFs` for all file I/O.

**Target Platform**: NeutralinoJS desktop window on Linux, Windows and macOS

**Project Type**: desktop application

**Performance Goals**:
- An inherited value is computed at render time from two map lookups.
- The 500-node fixture grows by an estimated 50 KB over its 423 KB (research R14).
- The 25 shipped rows added to the tables need no virtual scrolling.

**Constraints**:
- fully offline, as feature 001 requires;
- no table edit reaches a panel's copy (FR-009);
- the project is not compared with the local tables on open;
- nothing is computed, and every calculated field stays `null` (FR-011, FR-012).

**Scale/Scope**:
- 2 new source files: `engine/panelProperties.js` and `config/properties.js` in the tree module;
- 13 changed source files, including `scripts/emit-project-schema.mjs`;
- 20 test files touched, 2 of them new.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Specify Only What Was Asked | The spec passed its compliance check before planning (`checklists/requirements.md`, *Constitution Compliance*). Principle I governs `spec.md` until this first plan generation. From here it lapses, and technical decisions are this phase's job. | PASS |
| I, applied to the plan's own output | No decision in `research.md` adds user-visible behaviour the spec lacks. The decisions that touch the screen implement stated requirements: the entry's property group (R10, FR-002); the empty inherited field with the project's value as placeholder and the «з проекту» tag (R11, FR-004, FR-005); «Скинути» (R11, FR-006); checkboxes for marks (R12, FR-009, FR-010); disabled empty calculated fields (R12, FR-011, FR-012); three more tabs (R7, FR-013); an add-row without a name for enclosure sizes (R8, FR-015, FR-017). | PASS |

**Post-design re-check** (after Phase 1): the data model, three contracts and quickstart introduce no
entity, field or screen beyond the spec. The keys added to nodes are exactly the spec's *Key Entities*
for Project, Panel and End Consumer. The widths in a panel's copy are stored because FR-009 requires
them, and they are not shown. No spec edit was made during planning. PASS.

**Re-check after the 2026-10-12 spec revisions**: three edits were made to the spec after the first
plan, each at the user's request.
- **Shipped values.** They are now listed in the spec's *Reference Table Columns*, and both FR-014 and
  the success criterion SC-001 point there. Research R7 and R15 compare the shipped rows against the
  spec, and nothing reads the source document.
- **FR-009.** The separate requirement on the incoming device copy was merged into it, and the
  references in every artifact follow.
- **Cross-feature references.** They carry their feature's prefix, as in `002/FR-007`.

None of these edits adds an entity, a field or a screen. The data model and the contracts are
unchanged, and the rationales of research R3 and R11 now cite FR-004 instead of the source document.
PASS.

## Project Structure

### Documentation (this feature)

```text
specs/003-panel-properties/
├── spec.md                         # /speckit-specify + /speckit-clarify
├── plan.md                         # this file
├── research.md                     # R1–R15
├── data-model.md                   # three tables, project properties, entry/panel/consumer node changes
├── quickstart.md                   # manual scenarios Q1–Q5, automated coverage map
├── contracts/
│   ├── project-file.md             # node fields against feature 002
│   ├── project-file.schema.json    # generated by `npm run schema:emit` during implementation
│   ├── reference-tables-file.md    # three tables against feature 002
│   └── services.md                 # schema, engine, store, component surfaces
├── checklists/requirements.md
└── tasks.md                        # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
src/
├── data/referenceTables.builtin.json          # CHANGED  + 16 enclosure sizes, 5 device widths, 4 incoming devices, ids fixed once
├── schemas/index.js                           # CHANGED  REFERENCE_TABLES, CountCell, PositiveCell, three row schemas,
│                                              #          project property schemas, entry/panel/consumer node keys
├── services/ReferenceTablesFileService.js     # CHANGED  iterates REFERENCE_TABLES; name check on NAMED_TABLES
└── modules/
    ├── reference/
    │   ├── config/columns.js                  # CHANGED  three tables, kinds count / positive, tab titles
    │   ├── engine/cells.js                    # CHANGED  parseCell / formatCell for count, positive
    │   ├── engine/tableOps.js                 # CHANGED  range checks, addRow without a name, rowLabel, id prefixes
    │   ├── components/CellEditor.vue          # CHANGED  kinds count, positive, choice; options and placeholder props
    │   ├── components/ReferenceTable.vue      # CHANGED  any of five tables; name field only where a name column exists
    │   └── views/ReferenceTablesView.vue      # CHANGED  one tab per key of tableTitles — five
    └── tree/
        ├── config/properties.js               # NEW      six properties, five accessories, calculated labels
        ├── engine/panelProperties.js          # NEW      effectiveProperty, isInherited, four setters
        ├── engine/treeOps.js                  # CHANGED  panels take the incoming device copy and empty properties;
        │                                      #          consumers gain calculated
        ├── stores/tree.js                     # CHANGED  createEmptyTree with projectProperties; rows passed on panel
        │                                      #          creation; four setters through apply()
        └── components/NodeInspector.vue       # CHANGED  entry property group; panel properties, marks, calculated;
                                               #          consumer calculated

scripts/emit-project-schema.mjs                # CHANGED  output → specs/003-panel-properties/contracts/project-file.schema.json

tests/
├── fixtures/tree.js                           # CHANGED  panel and entry builders with the new keys; incomingDeviceRow
├── fixtures/tree-500.eltree.json              # REGENERATED
├── unit/
│   ├── engine/panelProperties.test.js         # NEW
│   └── …                                      # CHANGED  schemas, treeOps, tree store, wrapAndMove, projectFile,
│                                              #          referenceTablesFile, referenceTables store, cells, tableOps,
│                                              #          referenceTablesBuiltin, contracts/projectSchema,
│                                              #          scope/boundaries (spec 003, prefix 003/), quickstart/walkthrough
└── component/
    ├── panelProperties.test.js                # NEW      entry and panel groups, «з проекту», «Скинути», marks, calculated
    └── nodeInspector, referenceTable, referenceNavigation   # CHANGED
```

`README.md` sections «Структура» and «Файл проекту» are updated to the new fields and files, and the
spec links gain `specs/003-panel-properties/`.

**Structure Decision**: No new module is added.
- **Tree module.** The project and panel properties are node data, so they belong to `modules/tree/`. A
  new engine file, `panelProperties.js`, keeps the inheritance and the four setters out of
  `treeOps.js`, which already holds about 450 lines. A new `config/properties.js` holds the labels the
  inspector shows, as `modules/reference/config/columns.js` does for the tables.
- **Reference module.** The three tables extend `modules/reference/` in place.
- **Dependencies.** They run one way, as in 002. The tree imports the reference store, `cells.js`,
  `columns.js` and `CellEditor.vue`, and nothing in `modules/reference/` imports from the tree. The
  services import only `src/schemas/index.js`, which is why `REFERENCE_TABLES` is defined there.

## Complexity Tracking

No constitution violations to justify.
