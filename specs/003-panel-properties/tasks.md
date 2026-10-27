# Tasks: Panel Properties

**Date**: 2026-10-12 | **Input**: Design documents from `/specs/003-panel-properties/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: included and written first. Each phase has three stops:

1. **Outline stop.** Give a short description of the phase's tests: the file and what each test
   checks, with no code. Wait for the user.
2. **Red checkpoint.** Write the tests, run the suite and show the failures. Wait for the user's review
   and an explicit go.
3. **Implementation**, ending at the **green checkpoint**.

**Requirement citations**: tests for this feature cite requirements in their `describe` or `it` titles
as `003/FR-012` or `003/SC-006`. A bare `FR-012` still means feature 001 and `002/FR-012` feature 002
(research R15).

Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
`[P]` means the task can run in parallel: it touches a different file and depends on no unfinished
task.

---

## Phase 1: Setup

- [X] T001 Add `REFERENCE_TABLES = ['loadTypes', 'zones']` and `NAMED_TABLES = ['loadTypes', 'zones']`
  to `src/schemas/index.js`, beside `nameKey` (`:107-123`). Replace each hard-coded table list with them,
  with no behaviour change (research R7):
  - `tablesOf` and the serializer in `src/services/ReferenceTablesFileService.js:21-32`;
  - the `for (const table of ['loadTypes', 'zones'])` loop of `checkUnique` (`:93-112`), where the name
    check runs over `NAMED_TABLES` and the id check over `REFERENCE_TABLES`;
  - the `table` prop validator of `src/modules/reference/components/ReferenceTable.vue:21`;
  - the two hard-coded `n-tab-pane`s of `src/modules/reference/views/ReferenceTablesView.vue:11-18`,
    replaced by a `v-for` over `Object.keys(tableTitles)`. A table gets its tab once it has a title,
    which for the three new tables is T050, after their cells are parsed and checked.

**Checkpoint**: `npx vitest run` is green and `npx eslint .` is clean. The behaviour is unchanged.

---

## Phase 2: Foundational — the new data shapes

**Purpose**: Build every new key that later phases rely on:
- the three tables' data, file and store;
- the entry's `projectProperties`;
- the panel's `overrides`, `incomingDevices` copy, `buySeparately` and `calculated`;
- the consumer's `calculated`.

All of it is in the schemas, created by the engine and kept by the project file. Every user story needs
this phase green first.

### Tests first

- [X] T002 Extend the builders in `tests/fixtures/tree.js` to the new node shape (data-model.md):
  - **Entry.** It gets `projectProperties` with all six keys `null`, overridable through the spec's
    `projectProperties`.
  - **Panel.** It gets:
    - `overrides` with all five keys `null`;
    - `incomingDevices` defaulting to `[]`;
    - `buySeparately` with all five keys `false`;
    - `calculated` with all five keys `null`.

    Each one is overridable through the spec.
  - **Consumer.** `consumer()` gains `calculated: { groupRcd: null, phase: null }`.
  - **New helper.** Export `incomingDeviceRow({ id = 'iw-test', name = 'Тестовий апарат', width1ph = 2,
    width3ph = 4 } = {})`.
  - **`panelChain`.** It builds panels the same way.
- [X] T003 Move the node literals that bypass the builders to the new shape. Find them with
  `grep -rn "kind: '\(entry\|panel\|consumer\)'" tests`. Known sites:
  - `tests/unit/engine/homogeneity.test.js:171-172`;
  - `tests/unit/quickstart/walkthrough.test.js`;
  - `tests/component/editorToolbar.test.js`;
  - `tests/component/fixDialogMove.test.js`;
  - `tests/unit/stores/project.test.js`;
  - the consumer in `tests/unit/scope/boundaries.test.js` 'keeps a node at its structural fields…'.
- [X] T004 [P] In `tests/unit/schemas.test.js`, add `describe('003 reference rows (003/FR-015, 003/FR-017)')`:
  - Rows of `EnclosureSizeSchema`, `DeviceWidthSchema` and `IncomingDeviceWidthSchema` with `null` in
    every cell but `id` and `name` are accepted.
  - Refused:
    - `0`, `1.5` and `-1` in `rowCount`;
    - `0` and `-1` in `width1ph`;
    - a missing key;
    - `name: ''` in a device width.
  - `ReferenceTablesSchema` refuses a file without `enclosureSizes`, with the path `enclosureSizes`
    (research R9).
- [X] T005 [P] In `tests/unit/schemas.test.js`, add `describe('003 node keys (003/FR-001, 003/FR-004, 003/FR-009, 003/FR-011, 003/FR-012)')`:
  - **Entry.** `projectProperties` is required, with six keys.
    - Each key accepts `null` and a value of its kind (data-model.md, *Project properties*).
    - Refused: `supplyPhases: 2`, `moduleReservePct: -5`, `maxLinesPerGroupRcd: 0` and `2.5`,
      `separateRcdMode: 'x'`, `neutralBreak: 'так'`.
  - **Panel.** `overrides` is required with the five keys, and `supplyPhases` is not among them (it is
    dropped). `incomingDevices` is required: an item without `install`, or with `install: 'так'`, is
    refused. `buySeparately` is required with five booleans. `calculated` is required with five
    `null`s, and `enclosure: {}` is refused.
  - **Consumer.** `calculated` is required, `{ groupRcd: null, phase: null }`, and `phase: 'L1'` is
    refused.
  - **Output keys.** The exact output key sets of the entry, the panel and the consumer. Update the
    consumer key list at `:165`.
- [X] T006 [P] Rewrite `tests/unit/data/referenceTablesBuiltin.test.js` for five tables (003/SC-001,
  003/FR-014):
  - The bundled file passes `ReferenceTablesSchema`.
  - `enclosureSizes`, `deviceWidths` and `incomingDevices` hold exactly the rows of the spec's
    *Reference Table Columns*, in order. Write the expected rows out in the test:
    - 16 `{ rowModularity, rowCount }` from 12×1 to 24×4;
    - 1P 1, 1P+N 2, 2P 2, 3P 3, 4P 4;
    - Реле напруги 2/4, ОПН 2/4, Лічильник 6/8, Рубильник 2/4.
  - Every row has exactly the keys of data-model.md.
  - The ids match `/^es-[0-9a-f-]{36}$/`, `/^dw-…/` and `/^iw-…/` and are unique.
  - The 002 checks of `loadTypes` and `zones` stay as they are.
  - No document outside the spec is read (research R15).
- [X] T007 [P] In `tests/unit/services/referenceTablesFile.test.js` (003/FR-018):
  - a stored file with all five tables loads with `source: 'stored'`;
  - a 002 file without the three new keys is refused with the path `enclosureSizes` and moved aside to
    `reference-tables.refused-<stamp>.json` (research R9);
  - a duplicate name in `deviceWidths` is refused with the path `deviceWidths[<i>].name`;
  - a duplicate id in `enclosureSizes` is refused;
  - two enclosure rows `12 × 2` with different ids are accepted;
  - `save` writes all five arrays.
- [X] T008 [P] In `tests/unit/reference/columns.test.js` (new): the keys of `columns` in
  `src/modules/reference/config/columns.js` equal `REFERENCE_TABLES`. Every table in `NAMED_TABLES` has
  a `name` column, and `enclosureSizes` has none.
- [X] T009 [P] In `tests/unit/engine/treeOps.test.js` (003/FR-009, 003/FR-011, 003/FR-012):
  - **`addNode` for a panel with `incomingDevices: [rowA, rowB]`.**
    - It copies both rows as `{ ...row, install: false }`. The copies are equal by value, never the
      caller's objects, and in the same order.
    - `overrides`, `buySeparately` and `calculated` are all empty.
    - The panel's exact key set is checked; it was `toMatchObject` at `:61-67`.
    - `incomingDevices: []` gives a panel with no marks.
    - A missing `incomingDevices` is refused with `incomingDevicesRequired`.
  - **`addNode` for a consumer.** It adds `calculated: { groupRcd: null, phase: null }`. Update
    `CONSUMER_KEYS` (`:372`, `:585-597`) and the full consumer literal (`:76-97`).
  - **`wrapChildrenInPanel(nodes, parentId, name, rows)`.** It builds the new panel the same way.
  - **Unchanged.** The existing property tests still hold.
- [X] T010 [P] In `tests/unit/stores/tree.test.js` and `tests/unit/stores/wrapAndMove.test.js`
  (003/FR-003, 003/FR-009):
  - after `reset()`, the root's `projectProperties` has all six keys `null`;
  - `add({ kind: 'panel', … })` copies the reference store's current `tables.incomingDevices`, four
    rows as shipped;
  - `wrapConsumersAndAdd` and `wrapConsumersAndMove` give the new panel the same copy;
  - each stays one undo step.
- [X] T011 [P] In `tests/unit/services/projectFile.test.js` (003/FR-019, 003/FR-020, 003/FR-009,
  003/SC-004):
  - **Round trip.** A project with the following saves and reopens with every field deep-equal, empty
    ones included:
    - some project properties set and the rest `null`;
    - a panel with own values for two keys;
    - a panel with a copy of three devices, one with `install: true`;
    - `buySeparately` partly set;
    - a sub-panel;
    - consumers.
  - **Copy kept as is.** A file whose panel copy names a device absent from the local table, or present
    there with other widths, opens with the file's copy.
  - **Old shape.** A file whose entry lacks `projectProperties` is refused at `checkFields` with the
    path `nodes[0].projectProperties`.
  - **Key lists.** Update `CONSUMER_KEYS` (`:100`, `:165`).
- [X] T012 [P] In `tests/unit/contracts/projectSchema.test.js`, read
  `specs/003-panel-properties/contracts/project-file.schema.json` instead of the 002 path. The top-level
  keys are unchanged and there are still three `oneOf` variants.

**Red checkpoint**: run `npx vitest run`. T004–T012 fail. Stop for the user's review.

### Implementation

- [X] T013 In `src/schemas/index.js`, per data-model.md and contracts/services.md:
  - extend `REFERENCE_TABLES` to five and `NAMED_TABLES` to four;
  - add `CountCell` and `PositiveCell` (research R7);
  - add `EnclosureSizeSchema`, `DeviceWidthSchema` and `IncomingDeviceWidthSchema`;
  - make `ReferenceTablesSchema` require all five arrays;
  - add `PROJECT_PROPERTY_SCHEMAS`, `ProjectPropertiesSchema`, `PanelOverridesSchema`,
    `IncomingDeviceCopySchema` and `BuySeparatelySchema`, and the `calculated` objects of `v.null()`
    fields (research R6);
  - add the new keys to `EntryNodeSchema` (`:56-63`), `PanelNodeSchema` (`:65-72`) and
    `ConsumerNodeSchema` (`:80-88`).

  `SCHEMA_VERSION` stays 1.
- [X] T014 [P] Add `enclosureSizes`, `deviceWidths` and `incomingDevices` to
  `src/data/referenceTables.builtin.json`, with the rows and order of the spec's *Reference Table
  Columns*. Generate each id once with `node -e "console.log('es-' + crypto.randomUUID())"`, using `dw-`
  and `iw-` likewise, and keep them fixed from then on (research R7).
- [X] T015 [P] Add the three tables to `src/modules/reference/config/columns.js`:
  - `enclosureSizes`: `rowModularity` «Модульність ряду» and `rowCount` «Кількість рядів», kind `count`;
  - `deviceWidths`: `name` «Полюсність» kind `name`, and `widthModules` «Модулів» kind `positive`;
  - `incomingDevices`: `name` «Апарат» kind `name`, and `width1ph` «1ф» and `width3ph` «3ф» kind
    `positive`.

  Widen the `Column` typedef (`:8`) with the two new kinds. Do not add `tableTitles` yet. The parsing
  and checking of those kinds come in T048–T049, and the titles, which make the tabs appear, in T050.
- [X] T016 In `src/modules/tree/engine/treeOps.js` (contracts/services.md):
  - **`addNode` (`:173-219`).** It takes `incomingDevices` for a panel and refuses its absence with
    `incomingDevicesRequired`. It builds the panel with the copies `{ ...row, install: false }`, empty
    `overrides`, `buySeparately` and `calculated`, and gives a consumer `calculated`.
  - **`wrapChildrenInPanel` (`:382-420`).** It takes the rows as a fourth argument and builds the new
    panel the same way.
  - **Shared code.** The panel literal is built once, in a helper both functions use.
- [X] T017 In `src/modules/tree/stores/tree.js`:
  - `createEmptyTree` (`:31-49`) gives the entry `projectProperties` with six `null`s;
  - `add` passes `useReferenceTablesStore().tables.incomingDevices` for a panel;
  - `wrapConsumersAndAdd` (`:183`) and `wrapConsumersAndMove` (`:204`) pass the same rows to
    `wrapChildrenInPanel`.
- [X] T018 In `scripts/emit-project-schema.mjs`, set the output to
  `specs/003-panel-properties/contracts/project-file.schema.json`, then run `npm run schema:emit`.
- [X] T019 Regenerate `tests/fixtures/tree-500.eltree.json` in the new shape:
  - the entry gets `projectProperties` with all `null`;
  - each of the 30 panels gets `overrides` with all `null`, a copy of the four shipped
    `incomingDevices` rows from `src/data/referenceTables.builtin.json` with `install: false`,
    `buySeparately` with all `false`, and `calculated` with all `null`;
  - each of the 469 consumers gets `calculated`;
  - write it as Prettier formats it, and record its new size in research R14.

**Green checkpoint**: `npx vitest run` is green, `npx eslint .` is clean and `npm run build` succeeds.

---

## Phase 3: User Story 1 — Set the project properties (Priority: P1) 🎯 MVP

**Goal**: The user views, sets and clears the six project properties in the properties of «Ввід».
Every panel shows the five overridable ones as inherited, with the mark «з проекту».

**Independent test**: quickstart Q1; spec User Story 1, scenarios 1–6.

### Tests first

- [X] T020 [P] [US1] Create `tests/unit/engine/panelProperties.test.js`, `describe('setProjectProperty (003/FR-002)')`:
  - Each of the six keys accepts a value of its kind and `null`, the clear.
  - These are refused with `badProjectProperty`, and the message contains the property's label:
    - `supplyPhases: 2`;
    - `moduleReservePct: -5`;
    - `maxLinesPerGroupRcd: 0` and `2.5`;
    - `separateRcdMode: 'x'`;
    - `neutralBreak: 'так'`.
  - An unknown key is refused with `unknownProperty`.
  - Only the root changes. The result is frozen and the argument untouched.
- [X] T021 [P] [US1] In the same file, `describe('effectiveProperty / isInherited (003/FR-005, 003/FR-008)')`:
  - A panel with no own values returns the root's value for each overridable key, `null` included, and
    `isInherited` is `true`.
  - A sub-panel three levels deep returns the root's value.
- [X] T022 [P] [US1] In `tests/unit/stores/tree.test.js` (003/FR-021, US1 scenario 5):
  - `setProjectProperty` is one undo step;
  - a refused value adds no step;
  - after a value is cleared, `undo()` restores it and `redo()` clears it again.
- [X] T023 [P] [US1] Create `tests/component/panelProperties.test.js`, mounted as
  `tests/component/nodeInspector.test.js:34-57` does, with the `fieldUnder`/`commit` helpers of
  `:80-125`. Its `describe('entry (003/FR-001, 003/FR-002, 003/FR-003)')`:
  - **New project.** Selecting the entry shows `data-project-properties` below «Назва» and «Нотатка»,
    with the six labels in data-model.md order, all empty.
  - **Choices.** «Фазність вводу» set to 3ф stores `3`, and clearing it stores `null`.
  - **Numbers.** `2,5` in «Резерв модулів, %» stores `2.5`.
  - **Refusals.** `-5` there, and `0` or `2,5` in «Макс. ліній на групове ПЗВ», each show a warning
    naming the rule, and the input shows the stored value again.
  - **Yes/no.** «Розрив нейтралі» set to «так» stores `true`.
- [X] T024 [P] [US1] In the same file, `describe('panel shows inherited values (003/FR-005, 003/FR-007, 003/FR-008, 003/SC-003)')`,
  covering US1 scenarios 2, 4 and 5:
  - **Fields shown.** A panel and a sub-panel show `data-panel-properties` with the five labels, without
    «Фазність вводу».
  - **Inherited display.** Each input is empty, its placeholder is the label of the project's value
    («20», «так», «диф»), and it carries an `NTag` «з проекту» (`data-inherited`).
  - **Following the project.** Changing the project's reserve to `25` changes both placeholders to «25».
    Clearing it leaves both empty, with the tag still there.
- [X] T025 [US1] In `tests/component/nodeInspector.test.js:204-215`, the entry and the panel still start
  with «Назва» and «Нотатка». Assert those two as the first fields of `data-project-group` instead of
  the whole field list.

**Red checkpoint**: run `npx vitest run`. T020–T025 fail. Stop for the user's review.

### Implementation

- [X] T026 [P] [US1] Create `src/modules/tree/config/properties.js` with `PROJECT_PROPERTIES`: six
  `{ key, label, kind, options?, overridable }`, as in data-model.md.
  - `supplyPhases` is kind `choice` with options `[{ label: '1ф', value: 1 }, { label: '3ф', value: 3 }]`.
  - `separateRcdMode` is kind `choice` with options `[{ label: 'диф', value: 'rcbo' }, { label: 'автомат + ПЗВ', value: 'mcbRcd' }]`.
  - The two numbers are kind `number`, and the two yes/no properties kind `yesno`.
- [X] T027 [US1] Create `src/modules/tree/engine/panelProperties.js` with `setProjectProperty`,
  `effectiveProperty` and `isInherited` (contracts/services.md). Validate with
  `PROJECT_PROPERTY_SCHEMAS[key]`. A refusal throws `RuleError` (imported from `treeOps.js`) with the
  code `badProjectProperty` and the message «<label>: тут має бути <rule>, або порожньо.» The labels
  come from `config/properties.js`.
- [X] T028 [US1] Add `setProjectProperty(key, value)` to `src/modules/tree/stores/tree.js`. It calls the
  engine with `rootId` and commits through `apply()`, and it is exported.
- [X] T029 [US1] Extend `src/modules/reference/components/CellEditor.vue` (contracts/services.md):
  - **`choice` kind.** A clearable `NSelect` over a new `options` prop, which emits the chosen value, or
    `null`, on change, as `yesno` does (`:44-64`).
  - **`placeholder` prop.** Passed to the `NInput` and to both selects. When the selects get none, they
    get `' '` instead of Naive UI's default placeholder.
  - **No regression.** Nothing changes for existing callers.
- [X] T030 [US1] In `src/modules/tree/components/NodeInspector.vue`:
  - **Entry.** After the note (`:200-210`), render the group `data-project-properties` with the caption
    «Властивості проекту». It has one `n-form-item` per `PROJECT_PROPERTIES` entry, each holding a
    `CellEditor` with `value = root.projectProperties[key]`. A commit runs `parseCell`, then
    `tree.setProjectProperty`. A refusal goes through `refused()` (`:125-129`).
  - **Panel.** Render `data-panel-properties`, «Властивості щитка», for the five overridable entries,
    `data-property="<key>"`.
    - Each editor's `value` is `node.overrides[key]`.
    - Its `placeholder` is the label of `effectiveProperty(…)` while the property is inherited.
    - It carries the `NTag` «з проекту» (`data-inherited`, `size="small"`, `:bordered="false"`) while the
      property is inherited.
    - Committing comes in T036.

  Use theme vars only: `tests/component/theme.test.js` refuses literal colours.

**Green checkpoint**: `npx vitest run` is green, `npx eslint .` is clean and `npm run build` succeeds.
The user runs quickstart Q1.

---

## Phase 4: User Story 2 — Give one panel its own value and reset it (Priority: P2)

**Goal**: A panel holds its own value of any overridable property, keeps it when the project changes,
and inherits again after «Скинути» or after its field is cleared.

**Independent test**: quickstart Q2; spec User Story 2, scenarios 1–6.

**Depends on**: Phase 3, for the panel group and `effectiveProperty`.

### Tests first

- [X] T031 [P] [US2] In `tests/unit/engine/panelProperties.test.js`, `describe('setPanelOverride (003/FR-004, 003/FR-006, 003/FR-007, 003/FR-008)')`:
  - **Own value.** It sets an own value under the same rules and refusals as `setProjectProperty`.
    `effectiveProperty` then returns it, and `isInherited` is `false`.
  - **Reset.** `null` resets.
  - **Equal to the project's.** An own value equal to the project's stays after the project's value
    changes.
  - **`false`.** An own `false` is returned, not the project's `true`.
  - **Sub-panel.** A sub-panel under a parent with own values still returns the root's value.
- [X] T032 [P] [US2] In `tests/unit/stores/tree.test.js` (003/FR-021, US2 scenario 3):
  - `setPanelOverride` is one undo step;
  - after a reset, `undo()` brings the own value back.
- [X] T033 [P] [US2] In `tests/component/panelProperties.test.js`, `describe('panel own value (003/FR-005, 003/FR-006, 003/FR-007, 003/SC-003)')`,
  covering US2 scenarios 1–5:
  - **Setting.** `40` typed into a panel's reserve shows 40 without `data-inherited` and with «Скинути»
    (`data-reset`). Another panel is unchanged.
  - **Project change.** Changing the project's reserve leaves 40.
  - **«Скинути».** It shows an empty input with the project's value as placeholder and the tag.
  - **Clearing.** Clearing an own value does the same.
  - **Equal value.** Typing into an inherited field the value equal to the project's makes it own, with
    no tag.
  - **Yes/no.** An own «так» on «Розрив нейтралі», then cleared, inherits again.
  - **Sub-panel.** A sub-panel under a panel with own values shows the project's value.
  - **Refusal.** `-5` and `abc` typed into a panel's own 40 are refused with the reason, and the field
    shows 40 again.

**Red checkpoint**: run `npx vitest run`. T031–T033 fail. Stop for the user's review.

### Implementation

- [X] T034 [US2] Add `setPanelOverride` to `src/modules/tree/engine/panelProperties.js`.
- [X] T035 [US2] Add `setPanelOverride(nodeId, key, value)` to `src/modules/tree/stores/tree.js`. It
  commits through `apply()` and is exported.
- [X] T036 [US2] In `src/modules/tree/components/NodeInspector.vue`, wire the panel editors:
  - a commit runs `parseCell`, then `tree.setPanelOverride(id, key, value)`, where an empty input gives
    `null`;
  - a text button «Скинути» (`data-reset`) is shown while `overrides[key] !== null` and calls
    `setPanelOverride(id, key, null)`;
  - a refusal goes through `refused()`.

**Green checkpoint**: `npx vitest run` is green, `npx eslint .` is clean and `npm run build` succeeds.
The user runs quickstart Q2.

---

## Phase 5: User Story 3 — Mark incoming devices and separately bought accessories (Priority: P3)

**Goal**: A panel's «встановлювати» marks, one per device of its copy, and its five «купувати окремо»
marks are set and cleared on that panel only. No edit of the incoming device widths table reaches an
existing panel.

**Independent test**: quickstart Q3 and Q5 step 3; spec User Story 3, scenarios 1–5.

**Depends on**: Phase 2, for the copy. It does not depend on Phases 3–4.

### Tests first

- [X] T037 [P] [US3] In `tests/unit/engine/panelProperties.test.js`, `describe('marks (003/FR-009, 003/FR-010)')`:
  - **Device mark.** `setIncomingDeviceMark` sets and clears `install` of the one device with that id.
  - **Accessory mark.** `setBuySeparately` sets and clears one of the five keys.
  - **Scope.** Every other mark of that panel, and every other panel, is unchanged.
- [X] T038 [P] [US3] In `tests/unit/stores/tree.test.js` (003/FR-009, 003/FR-021, 003/SC-006, US3 scenarios 4–5):
  - **Undo.** Each mark change is one undo step.
  - **Table edits.** After the following, an existing panel's `incomingDevices` deep-equals its copy
    from before:
    - `useReferenceTablesStore().addRow('incomingDevices', 'Перемикач мережа-генератор')`;
    - `updateCell` of «Лічильник»'s name and `width1ph`;
    - `deleteRow` of «Лічильник».
  - **New panel.** A panel added afterwards copies the table as it now is.
- [X] T039 [P] [US3] In `tests/component/panelProperties.test.js`, `describe('marks (003/FR-009, 003/FR-010)')`,
  and in `tests/component/missingReference.test.js` (003/FR-009):
  - **Shown.** A new panel shows `data-install-marks` with one unchecked `NCheckbox` per copied device,
    labelled with its name in copy order, and `data-buy-marks` with the five accessory labels, all
    unchecked.
  - **Scope.** Checking one changes only that mark of that panel.
  - **Table edited.** After the device row is renamed or deleted in the table, the panel's label is
    unchanged.
  - **Opened file.** Opened through `ProjectFileService`, a file whose panel copy names a device absent
    locally shows that device with its mark.

**Red checkpoint**: run `npx vitest run`. T037–T039 fail. T038's table-edit checks may already pass
after Phase 2, and the red run says which. Stop for the user's review.

### Implementation

- [X] T040 [US3] Add `setIncomingDeviceMark` and `setBuySeparately` to
  `src/modules/tree/engine/panelProperties.js`. Add `ACCESSORIES` (data-model.md labels) to
  `src/modules/tree/config/properties.js`.
- [X] T041 [US3] Add `setIncomingDeviceMark(nodeId, deviceId, install)` and
  `setBuySeparately(nodeId, key, checked)` to `src/modules/tree/stores/tree.js`. Each commits through
  `apply()`.
- [X] T042 [US3] In `src/modules/tree/components/NodeInspector.vue`, after `data-panel-properties`
  render the panel's `data-install-marks` «Встановлювати» and `data-buy-marks` «Купувати окремо» groups
  of `NCheckbox`es (`data-device="<id>"`, `data-accessory="<key>"`). An `update:checked` event calls the
  store setter (research R12).

**Green checkpoint**: `npx vitest run` is green, `npx eslint .` is clean and `npm run build` succeeds.
The user runs quickstart Q3.

---

## Phase 6: User Story 4 — View and edit the three new reference tables (Priority: P4)

**Goal**: The «Довідники» section shows five tabs. The three new tables are edited cell by cell, and
rows are added and deleted, under the `count`, `positive` and `name` rules, each edit stored at once.

**Independent test**: quickstart Q4; spec User Story 4, scenarios 1–4.

**Depends on**: Phase 2, for the data, the file and the columns. It does not depend on Phases 3–5.

### Tests first

- [X] T043 [P] [US4] In `tests/unit/reference/cells.test.js` (003/FR-017):
  - `parseCell('count', '2')` is `2`, `parseCell('positive', '2,5')` is `2.5`, and
    `parseCell('count', 'abc')` throws `notANumber`;
  - `formatCell('count', 14)` is `'14'`, and `null` is `''`.
- [X] T044 [P] [US4] In `tests/unit/reference/tableOps.test.js` (003/FR-016, 003/FR-017):
  - **Count cells.** `updateCell` on `rowCount` refuses `0`, `1.5` and `-1` with `notACount` and the
    message «Тут має бути ціле число, не менше 1.», and accepts `2` and `null`.
  - **Positive cells.** On `width1ph` it refuses `0` and `-1` with `notPositive` and accepts `0.5`.
  - **Rows without a name.** `addRow(tables, 'enclosureSizes', undefined, () => 'es-x')` appends
    `{ id: 'es-x', rowModularity: null, rowCount: null }`.
  - **Named rows.** `addRow` on `deviceWidths` still requires a name, and «2p» is refused with
    `nameTaken`.
  - **`rowLabel`.** It returns the name, or «12 × 2» for an enclosure size.
- [X] T045 [P] [US4] In `tests/unit/stores/referenceTables.test.js` (003/FR-016, 003/FR-018, 003/SC-002):
  - `updateCell('incomingDevices', id, 'width1ph', '5')` stores `5` and writes it;
  - `addRow('enclosureSizes')` and `deleteRow` of a device width are written too;
  - a fresh Pinia plus `load()` over the same `MemoryFs` returns all three edits.
- [X] T046 [P] [US4] In `tests/component/referenceTable.test.js` (003/FR-013, 003/FR-016, 003/FR-017,
  US4 scenarios 1–4):
  - **Enclosure sizes.**
    - `table="enclosureSizes"` shows the headers «Модульність ряду» and «Кількість рядів», with 16 rows.
    - There is no `data-add-name` input, and «Додати рядок» appends an empty row.
    - `0` in «Кількість рядів» shows a warning and reverts.
    - Deleting a row asks with «12 × 1».
  - **Device widths.** `deviceWidths` shows «Полюсність» and «Модулів», with 5 rows.
  - **Incoming devices.** `incomingDevices` shows «Апарат», «1ф» and «3ф», with 4 rows. `0` in «1ф» is
    refused.
  - **No ids.** No text matching `/\b(es|dw|iw)-[0-9a-f]{8}/` appears in the DOM.
- [X] T047 [P] [US4] In `tests/component/referenceNavigation.test.js` (003/FR-013): the section shows five
  tabs, «Типи навантажень», «Зони», «Типорозміри корпусів», «Ширина за полюсністю» and «Ввідні
  апарати», and each tab shows its table.

**Red checkpoint**: run `npx vitest run`. T043–T047 fail. Stop for the user's review.

### Implementation

- [X] T048 [P] [US4] In `src/modules/reference/engine/cells.js`, make `parseCell` (`:32-37`) send `count`
  and `positive` to `parseNumberCell`, and make `formatCell` (`:40-44`) show them as `String(value)`.
- [X] T049 [US4] In `src/modules/reference/engine/tableOps.js`:
  - `checkedValue` (`:47-59`) gains the `count` and `positive` checks, with the codes `notACount` and
    `notPositive` and the messages of data-model.md;
  - `ID_PREFIX` (`:23`) gains `es`, `dw` and `iw`;
  - `addRow` (`:64-74`) runs `checkedName` only for a table with a `name` column and otherwise appends
    a row of `null`s;
  - add `rowLabel(table, row)`.
- [X] T050 [US4] In `src/modules/reference/components/ReferenceTable.vue`:
  - the add-row name input (`:108-117`) is shown only when `columns[table]` has a `name` column;
  - «Додати рядок» then calls `addRow(table)`;
  - the delete confirmation text uses `rowLabel`.

  `CellEditor` already renders `count` and `positive` with its default number input. Then add
  `tableTitles` «Типорозміри корпусів», «Ширина за полюсністю» and «Ввідні апарати» to
  `src/modules/reference/config/columns.js`, so the three tabs appear.

**Green checkpoint**: `npx vitest run` is green, `npx eslint .` is clean and `npm run build` succeeds.
The user runs quickstart Q4.

---

## Phase 7: User Story 5 — Calculated fields, empty and kept in the file (Priority: P5)

**Goal**: Panels show the enclosure, the device composition and the accessory quantities. Consumers,
and panels under a panel, show the group RCD and the phase. All of them are empty and cannot be edited,
and the file keeps them, which Phase 2 already does.

**Independent test**: quickstart Q5 steps 1–2; spec User Story 5, scenarios 1–4.

**Depends on**: Phase 2. It does not depend on Phases 3–6.

### Tests first

- [X] T051 [P] [US5] In `tests/component/panelProperties.test.js`, `describe('calculated fields (003/FR-011, 003/FR-012, 003/SC-005)')`:
  - **Panel under the entry.** It shows `data-calculated` with «Корпус», «Склад апаратів» and
    «Кількість комплектуючих», and no «Групове ПЗВ» or «Фаза».
  - **Panel under a panel.** It shows all five.
  - **Consumer.** It shows «Групове ПЗВ» and «Фаза».
  - **Not editable.** Every one of these inputs is empty and disabled.
  - **Moving.** Moving a top-level panel under another panel with `tree.move` shows its line pair, and
    its `calculated` object is unchanged.

**Red checkpoint**: run `npx vitest run`. T051 fails. Stop for the user's review.

### Implementation

- [X] T052 [US5] Add `CALCULATED_LABELS` to `src/modules/tree/config/properties.js`. In
  `src/modules/tree/components/NodeInspector.vue`, render `data-calculated` «Розрахунок» last for a
  panel and after the copy group for a consumer. It holds disabled `NInput`s with an empty value, and
  the line pair is shown for a consumer, or for a panel whose parent is a panel (research R12).

**Green checkpoint**: `npx vitest run` is green, `npx eslint .` is clean and `npm run build` succeeds.

---

## Phase 8: Polish and cross-cutting

- [X] T054 [P] Update `README.md`:
  - «Структура»: `config/properties.js`, `engine/panelProperties.js`, and five tables in
    `referenceTables.builtin.json`;
  - «Файл проекту»: the entry's `projectProperties`, and the panel's `overrides`, `incomingDevices`,
    `buySeparately` and `calculated`;
  - the spec links gain `specs/003-panel-properties/`.
- [X] T055 Run the final checks: `npx vitest run`, `npx eslint .` and `npm run build`. The user walks
  quickstart Q1–Q5 end to end in `npm run neu:dev`.

---

## Dependencies

```text
Phase 1 Setup ─→ Phase 2 Foundational ─┬─→ Phase 3 US1 (MVP) ─→ Phase 4 US2
                                       ├─→ Phase 5 US3
                                       ├─→ Phase 6 US4
                                       └─→ Phase 7 US5
Phases 3–7 ─→ Phase 8 Polish
```

**Between phases:**
- US2 needs US1, for the panel group, `effectiveProperty` and `CellEditor`'s `placeholder`.
- US3, US4 and US5 need only Phase 2 and can run in any order.

**Within each phase:** test outline → stop → tests → red checkpoint → implementation → green
checkpoint. No test is written before the user has seen the outline, and no implementation task starts
before the user has reviewed the red run.

**Within Phase 2:**
- T002 and T003 come first, because every other test of the phase imports the fixtures.
- Then T013 → T016 → T017: the schema, then the engine, then the store.
- T014 and T015 sit beside T013.
- T019 comes after T014, because the fixture copies the shipped rows.

**Shared files:** `NodeInspector.vue` is touched by T030, T036, T042 and T052, and
`tests/component/panelProperties.test.js` by T023, T024, T033, T039 and T051. If US3–US5 run beside
US1–US2, these edits go one after another.

## Parallel examples

- **Phase 2 tests**: T004 – T012, once T002 and T003 have changed the fixtures.
- **Phase 2 implementation**: T014 and T015 beside T013; T018 after T013.
- **US1 tests**: T020 – T024 (T020 and T021 share a file, so one person writes both).
- **US1 implementation**: T026 and T029 together; T027 → T028 → T030.
- **US3 tests**: T037, T038 and T039, three files.
- **US4 tests**: T043 – T047, five files. **US4 implementation**: T048 beside T049 → T050.

## Implementation strategy

1. **MVP = Phases 1–3.** The project has its six properties, and every panel shows them as inherited.
   Stop, run quickstart Q1, and decide whether to go on.
2. **Phase 4** adds own values and reset. That completes the inheritance rule of the source document.
3. **Phases 5, 6 and 7** are independent of each other and can come in any order: marks, the three
   tables' editing, calculated fields.
4. **Phase 8** updates the README and runs the final checks.
