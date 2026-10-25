# Phase 0 Research: Panel Properties

**Date**: 2026-10-12 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

The stack is fixed by features 001 and 002 and is not reopened here. Every decision below is about how
this feature fits into it. None adds a dependency. The code facts cited were read on 2026-10-12 at
commit `91cc467`.

---

## R1 — Where the six project properties live

**Decision**: On the root entry node, as one object `projectProperties` with all six keys always
present. `createEmptyTree` (`src/modules/tree/stores/tree.js:31-49`) creates it with every key `null`
(FR-003).

**Rationale**: FR-021 makes each change one step of the tree's undo history, and that history covers
`tree.nodes` only (`useManualRefHistory(nodes, …)`, `tree.js:58`). The same holds for the dirty flag
and autosave: `stores/project.js:86-96` watches `tree.nodes` and nothing else. On the entry node the
properties get undo, redo, the unsaved mark, autosave, recovery and the file round trip
(`denormalize` → `depthFirst` spreads every node, `ProjectFileService.js:50-60`) with no new wiring. The
spec puts the edit in the entry's properties area (FR-002), so the data sits where it is edited.

**Alternatives considered**: A top-level `properties` key next to `name` in the project file, held by
`stores/project.js`. The project name lives there today and is outside the undo history, the dirty
flag and autosave (`project.js:24`, `:86-96`). All three would have to be built for it.

---

## R2 — How the property values are encoded

**Decision**: Fixed codes in the file. The user sees Ukrainian labels.

| Key | Values | Label shown |
|---|---|---|
| `supplyPhases` | `1`, `3`, `null` | 1ф, 3ф |
| `moduleReservePct` | finite number ≥ 0, `null` | as typed |
| `separateRcdMode` | `'rcbo'`, `'mcbRcd'`, `null` | диф, автомат + ПЗВ |
| `maxLinesPerGroupRcd` | integer ≥ 1, `null` | as typed |
| `neutralBreak` | `true`, `false`, `null` | так, ні |
| `selectiveFeederRcd` | `true`, `false`, `null` | так, ні |

Each rule is one valibot schema in `src/schemas/index.js`, and the entry and the panel use the same
schemas (FR-006 refers to FR-002's value kinds). Yes/no is a boolean, as the reference tables already
store it (002 data model, *Cell rules*).

**Rationale**: The calculation of the source document's Part 2 will branch on these values. A code
does not change when a label is reworded, and a phase count is a number in the formulas.

---

## R3 — A panel's own values and inheritance

**Decision**: Every panel carries `overrides`, an object with the five overridable keys, all present.
`null` means the panel inherits, and any other value is the panel's own value. The value shown is never
stored. It is computed when shown as `panel.overrides[key] ?? root.projectProperties[key]`, by one pure
function `effectiveProperty(nodes, rootId, panelId, key)`. That function reads the root and never the
parent panel (FR-008). A reset writes `null` back.

**Rationale**:
- FR-004 gives a panel two states per property: it holds no value of its own and inherits, or it holds
  its own value. An empty own value therefore *is* inheritance, so one nullable field holds both states,
  and no separate "inherits" flag can disagree with it.
- An own value equal to the project's is still non-null, so it stays the panel's own and does not follow
  the project (FR-007, User Story 2, scenario 4).
- `??` keeps `false` («ні») as an own value.

**Alternatives considered**: `{ inherits: boolean, value }` per key. It has two fields for one state,
and they could hold "inherits" together with a stale value.

---

## R4 — The copy of the incoming devices on a panel

**Decision**: Every panel carries `incomingDevices`, an array copied when the panel is created. It holds
every row of the incoming device widths table in table order, each row as `{ ...row, install: false }`:

```json
{ "id": "iw-…", "name": "Лічильник", "width1ph": 6, "width3ph": 8, "install": false }
```

Panels are created in exactly two places:
- `addNode` (`treeOps.js:173-219`);
- `wrapChildrenInPanel` (`treeOps.js:382-420`).

Both take the rows as an argument. The tree store supplies them from
`useReferenceTablesStore().tables.incomingDevices` in `add`, `wrapConsumersAndAdd` and
`wrapConsumersAndMove`, the same way `setLoadType` finds its row today (`tree.js:142-150`). A mark is
addressed by the copied row's `id`.

The copy is never compared with the local table: on load, on display, or when the table is edited
(FR-009). A node is never duplicated and never changes kind (001/FR-003, 001/FR-006), so these two creation
paths are the only moments a copy is taken.

**Rationale**:
- The 2026-10-11 clarification chose a copy, as for the load types and zones of feature 002. That
  includes the `id`, which records the source row (002 research R15).
- Rows are flat, so a spread is a full copy, and immer's `produce` freezes it with the node.
- Keeping the widths makes the copy whole, as FR-009 asks ("the device name and its 1ф and 3ф widths").

**Alternatives considered**: Marks keyed by device name, with the table read when shown. The
clarification rejects this, because a renamed or deleted row would change an existing panel and a file
opened elsewhere.

---

## R5 — The «купувати окремо» marks

**Decision**: `buySeparately: { neutralBars, peBar, combBusbars, cableGlands, blankingPlates }`. All five
are booleans and `false` on a new panel.

**Rationale**:
- The source document lists exactly these five accessories, with no table behind them and the default
  «за замовчуванням знята».
- Fixed keys need no copy.

---

## R6 — The calculated fields

**Decision**: One object per node, `calculated`, holding every calculated field as `null`:

- every panel: `{ enclosure, deviceComposition, accessoryQuantities, groupRcd, phase }`;
- every consumer: `{ groupRcd, phase }`.

A panel always carries the line pair. The inspector shows the pair only when the panel's parent is a
panel (FR-012). Each field's schema is `v.null()`: nothing in this feature writes a value, and Part 2
will widen the schemas when it does. That needs no version change (R14).

**Rationale**:
- One key marks everything inside it as computed, so Part 2 can replace a node's results in one write.
- Holding the line pair on every panel means no data has to change when a panel is moved between the
  entry and another panel. Three operations re-parent or create panels: `moveNode`,
  `wrapChildrenInPanel` and `addNode`.
- FR-020 asks the file to hold the fields of every node that shows them. A top-level panel that also
  holds a null pair meets that.

**Alternatives considered**: The line pair present only while the parent is a panel. All three
operations would then add or drop keys, and `checkStructure` would need a rule tying the keys to the
parent's kind.

---

## R7 — The three new tables

**Decision**: Three keys join `loadTypes` and `zones` in the one tables object and in the one stored
file:

| Key | Id prefix | Columns (`config/columns.js`) |
|---|---|---|
| `enclosureSizes` | `es-` | `rowModularity` «Модульність ряду» `count`; `rowCount` «Кількість рядів» `count` |
| `deviceWidths` | `dw-` | `name` «Полюсність» `name`; `widthModules` «Модулів» `positive` |
| `incomingDevices` | `iw-` | `name` «Апарат» `name`; `width1ph` «1ф» `positive`; `width3ph` «3ф» `positive` |

The column kinds are kept as they are (`name | text | number | yesno`), and two new ones are added:
- `count`, a whole number ≥ 1;
- `positive`, a number > 0.

Each new kind is wired in four places:
- **Parser.** `parseCell` sends both to `parseNumberCell`. That function already accepts a decimal comma
  and refuses text with its reason (`cells.js:6-19`).
- **Table check.** `checkedValue` (`tableOps.js:47-59`) adds the range checks: «Тут має бути ціле число,
  не менше 1.» and «Тут має бути число, більше 0.»
- **Schemas.** `src/schemas/index.js` gets `CountCell = v.nullable(v.pipe(v.number(), v.integer(),
  v.minValue(1)))` and `PositiveCell = v.nullable(v.pipe(v.number(), v.finite(), v.gtValue(0)))`.
- **Display.** `CellEditor` renders both as the number input it already has.

An empty cell stays `null`, as in every 002 table (FR-017: only name cells must be filled).

The hard-coded table lists are replaced by one list, `REFERENCE_TABLES`, in `src/schemas/index.js`. The
services import schemas, never modules (002 contract `services.md`, `nameKey`). The places that
hard-code the list today:
- `ReferenceTablesFileService.js:21-32` (`tablesOf` and the serializer);
- `ReferenceTablesFileService.js:93-112` (`checkUnique`);
- `tableOps.js:23` (`ID_PREFIX`);
- `ReferenceTable.vue:21` (the prop validator);
- `ReferenceTablesView.vue:11-18` (the tabs).

A test asserts that the keys of `config/columns.js` equal `REFERENCE_TABLES`.

**Rationale**:
- The 2026-10-11 clarification fixed the value kinds.
- The validation is already driven by each column's kind (`updateCell` → `checkedValue`), so a kind per
  rule reaches the table, the parser and the schema without a per-table branch.

**Shipped rows**: `src/data/referenceTables.builtin.json` gains the rows listed in the spec's
*Reference Table Columns*:
- 16 enclosure sizes, ordered 12×1, 12×2, … 24×4;
- 5 device widths;
- 4 incoming devices.

Their ids are generated once and committed, as for the 41 rows of 002 (002 R3).

---

## R8 — A table without a name column

**Decision**: Enclosure sizes have no name column (FR-015).
- **Adding.** `addRow(tables, table, name, newId)` takes a name only for a table that has a name
  column. For enclosure sizes it appends a row of `null`s, and `ReferenceTable.vue` shows only the
  «Додати рядок» button, without the name field (`:108-117`).
- **Deleting.** The delete confirmation names a row by its name, or for an enclosure size by
  `<rowModularity> × <rowCount>`.
- **Load checks.** On load, ids stay unique in every table. The name check (`findDuplicateName`) runs
  only on tables that have a name column.

**Rationale**:
- FR-017 makes only name cells required and unique.
- An enclosure size is told apart by its two numbers. Two equal rows break no rule the spec states.

---

## R9 — The stored tables file grows

**Decision**: `ReferenceTablesSchema` requires all five arrays. `REFERENCE_TABLES_VERSION` stays `1`. A
stored file written by feature 002 lacks the three new keys, so at the next start it goes through the
existing refusal:
- it is refused as a whole, with the path `enclosureSizes` named;
- it is moved aside as `reference-tables.refused-<timestamp>.json`;
- the application continues with the five tables as shipped (002 R5).

Nothing merges or migrates it.

**Rationale**: The application is not in test use, and its file formats are whatever they are at that
point. Intermediate formats get no treatment of their own (the user, 2026-10-03, on feature 002 R13).
Edits of the load types and zones made before this feature stay readable in the kept copy.

---

## R10 — The project properties in the entry's properties area

**Decision**: For the entry, `NodeInspector.vue` renders the six properties below «Назва» and
«Нотатка» (`:180-210`). They sit in a group captioned «Властивості проекту», one `n-form-item` each,
with the label on top as for name and note:

| Property | Editor |
|---|---|
| Фазність вводу | `CellEditor` kind `choice`, options 1ф / 3ф, clearable |
| Резерв модулів, % | `CellEditor` kind `number` |
| Виконання окремого ПЗВ | `CellEditor` kind `choice`, options диф / автомат + ПЗВ, clearable |
| Макс. ліній на групове ПЗВ | `CellEditor` kind `number` |
| Розрив нейтралі | `CellEditor` kind `yesno` |
| Селективне ПЗВ на лінії живлення підщитка | `CellEditor` kind `yesno` |

**Commit and refusal.**
- The labels, keys, kinds, choice options and the *overridable* flag of the six properties are one list,
  `src/modules/tree/config/properties.js`.
- A commit parses with `parseCell` and calls `tree.setProjectProperty(key, value)`.
- The engine validates the value against the property's schema (R2). A value the schema refuses throws
  `RuleError('badProjectProperty')`, whose message names the property and its rule, e.g. «Макс. ліній
  на групове ПЗВ: тут має бути ціле число, не менше 1, або порожньо.»
- The inspector shows it with `message.warning` and the editor reverts. This is the path a refused
  copied value takes today (`NodeInspector.vue:125-150`; `CellEditor.vue:32-37` drops its draft before
  emitting).

**`CellEditor` gains** (it already serves the table and the consumer's copy):
- a `choice` kind, a clearable `NSelect` over an `options` prop, which emits on change like `yesno`;
- a `placeholder` prop, needed by R11.

**Rationale**:
- FR-002 places the properties and requires refusal with the reason, keeping the previous value.
- One editor keeps the commit-on-blur rule and the clearable selects identical across the table, the
  consumer and the entry (002 R17).

---

## R11 — The panel's five properties

**Decision**: Below the panel's «Назва» and «Нотатка» sits a group «Властивості щитка» with the five
overridable properties, using the same editors as R10. Each field is bound to the panel's own value,
`overrides[key]`.

**Inherited property** (`overrides[key]` is `null`):
- the editor is empty, and its placeholder is the project's current value as a label, e.g. «20», «так»
  or «диф»;
- the label row carries an `NTag` «з проекту» (size `small`, `:bordered="false"`, as the kind tag at
  `NodeInspector.vue:175-177`);
- when the project's value is empty too, the placeholder is empty and the tag stays.

**Own value:**
- the editor shows it and there is no tag;
- the label row carries a text button «Скинути».

**Editing:**
- Committing any value on an inherited field sets it as the panel's own, even a value equal to the
  project's.
- Clearing an own value, or pressing «Скинути», calls `tree.setPanelOverride(id, key, null)`, and the
  panel inherits again.

**Rationale**:
- This shows FR-004 literally: the panel's field *is* empty when it inherits, and the project's value
  shows through it with the mark (FR-005).
- Binding to the own value means any committed value becomes own. User Story 2, scenario 4 can then be
  reached directly, which binding to the shown value would prevent: `CellEditor` emits only when the
  text differs from its `value` (`CellEditor.vue:32-37`).
- «Скинути» is the reset of FR-006. Clearing is the same action, because a panel with no own value
  inherits (FR-004).

**Alternatives considered**: The project's value as the field's own text, with the tag beside it. A
value typed equal to the project's would then emit nothing and could never become an own value.

---

## R12 — Marks and calculated fields in the properties area

**Decision**: After «Властивості щитка» a panel shows:
- **«Встановлювати».** One `NCheckbox` per row of its `incomingDevices` copy, in copy order, labelled
  with the copied name. A change calls `tree.setIncomingDeviceMark(id, deviceId, checked)`.
- **«Купувати окремо».** Five `NCheckbox`es: «N-шини», «PE-шина», «Гребінчасті шини», «Кабельні
  вводи», «Заглушки». A change calls `tree.setBuySeparately(id, key, checked)`.
- **«Розрахунок».** Disabled, empty `NInput`s: «Корпус», «Склад апаратів», «Кількість комплектуючих».
  When the parent is a panel, «Групове ПЗВ» and «Фаза» follow.

A consumer gets the same «Розрахунок» group with «Групове ПЗВ» and «Фаза», after its copy group.

**Rationale**:
- FR-009 and FR-010 call for marks that are set and cleared, so a checkbox is the native control.
  `NCheckbox` is part of `naive-ui` 2.45.3, which is already installed.
- FR-011 and FR-012 call for fields that hold no value and cannot be edited. A disabled input shows the
  field and its emptiness at once.
- The copy's widths are not shown: the spec asks for marks named after the device.

---

## R13 — Undo and redo

**Decision**: Four new setters on the tree store, each committing one history step through the
existing `apply()` (`tree.js:119-122`):
- `setProjectProperty`;
- `setPanelOverride` (a `null` value is the reset);
- `setIncomingDeviceMark`;
- `setBuySeparately`.

The engine throws a `RuleError` before `apply` on a refused value, so a refusal leaves no step. A panel
created by `add` or by a wrap takes its copy inside the same `produce`, so creating it stays one step.
Reference table edits remain outside the tree's history (002 R9).

**Rationale**: FR-021, and the pattern every inspector edit already follows.

---

## R14 — Project file format

**Decision**: `SCHEMA_VERSION` stays `1`, and the version-1 shape changes:
- the entry gains `projectProperties`;
- a panel gains `overrides`, `incomingDevices`, `buySeparately` and `calculated`;
- a consumer gains `calculated`.

All of them are required keys. A file written by feature 002 is refused at `checkFields` with the path
of the first missing key, and gets no treatment of its own (R9, same reason).

Three files follow the change:
- `tests/fixtures/tree-500.eltree.json` is regenerated in the new shape;
- `scripts/emit-project-schema.mjs` writes to `specs/003-panel-properties/contracts/project-file.schema.json`;
- `tests/unit/contracts/projectSchema.test.js` follows that path.

**Estimated cost**: about 600 bytes per panel for the copy and marks, and about 70 bytes per consumer
for `calculated`. The 500-node fixture has 469 consumers, so its other 31 nodes are the entry and 30
panels, and it grows by roughly 50 KB over its 423 KB.

**Measured** (T019): the regenerated fixture is 512,044 bytes against 433,566 before, so it grows by
78,478 bytes, about 77 KB. The estimate was low: Prettier writes every key of the copy and the marks on
its own line, which adds the indentation to each of them.

---

## R15 — Tests: the shipped values and the requirement guard

**Decision**:
- **The shipped values are checked against the spec.** `tests/unit/data/referenceTablesBuiltin.test.js`
  compares the bundled rows cell by cell with expected rows written out in the test, taken from the
  spec's *Reference Table Columns* (SC-001). No document outside the spec is read, and
  `tests/fixtures/sourceDocument.js` is not changed.
- **The requirement guard covers spec 003.** `tests/unit/scope/boundaries.test.js:56-74` today reads
  only specs 001 and 002. It also reads spec 003, and its requirements are cited as `003/FR-NNN`, as 002
  research R12 did for `002/`.
- **The exact key sets change.** These tests pin the consumer's exact key set and now include
  `calculated`:
  - `CONSUMER_KEYS` in `treeOps.test.js:372` and `:585-597`;
  - `CONSUMER_KEYS` in `projectFile.test.js:100` and `:165`;
  - the consumer key list in `schemas.test.js:165`.

  The panel's full key set gets the same kind of test.

**Rationale**:
- The spec lists every shipped value, so the spec is the reference (the user, 2026-10-12).
- Overlapping numbers across three specs need the prefix to say which feature a test proves.
