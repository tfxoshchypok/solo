# Tasks: Reference Tables and Consumer Fields

**Date**: 2026-09-26 | **Input**: Design documents from `/specs/002-reference-tables-consumer-fields/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: included, test-first, with three stops per phase:

1. **Outline stop** — a short description of the phase's tests (file and what each checks, no code);
   wait for the user.
2. **Red checkpoint** — write the tests, run the suite, show the failures; wait for the user's review
   and an explicit go.
3. **Implementation**, ending at the **green checkpoint**.

**Requirement citations**: tests for this feature cite requirements as `002/FR-012` in their `describe`
or `it` titles; a bare `FR-012` keeps meaning feature 001 (research R12). T055 makes that a checked rule.

Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
`[P]` = parallelizable: a different file, and no dependency on an unfinished task.

---

## Phase 1: Setup

- [X] T001 Move the `LoadError` class from `src/services/ProjectFileService.js:23-32` to a new `src/services/LoadError.js` and import it from there in `ProjectFileService.js`, `src/modules/tree/views/TreeEditorView.vue:30` and every test that imports it from `ProjectFileService.js` (`grep -rn "LoadError" src tests`); no behaviour change (research R6)
- [X] T002 [P] Create `tests/fixtures/sourceDocument.js` exporting `loadTypesTable()` and `zonesTable()`: parse the markdown tables under §1 and §2 of `specs/docs/002-spozhyvachi-dovidnyk-tz.md` into `{ headers: string[], rows: string[][] }` of raw cell text — split on `|`, trim, strip backticks, tolerate a cell with no space before the next `|` (the INVERTER_CHARGER row), map the header `$\cos\varphi$` to `cos φ`, skip the `:---` alignment row. The source document is untracked today; it must be in the repository for this helper to run in a clean checkout

**Checkpoint**: `npx vitest run` green.

---

## Phase 2: Foundational — the tables' data, file and store

**Purpose**: the load types and zones exist, load at startup and resolve by id. User Story 1 edits them;
User Story 2 picks from them. No user story can start before this phase is green.

### Tests first

- [X] T003 [P] Add `describe('ReferenceTablesSchema (002/FR-005, 002/FR-006)')` to `tests/unit/schemas.test.js`: accepts a load type and a zone row carrying every key with `null` in every cell but `id` and `name`; refuses a missing key, `name: ''`, a 121-character name, the string `'0.95'` in `powerFactor`, `'так'` in `continuous`, `schemaVersion: 2`; drops an unknown key — field list in `data-model.md`
- [X] T004 [P] Create `tests/unit/reference/tableOps.test.js` with `describe('nameKey / findDuplicateName (002/FR-005)')`: `nameKey(' Розетки ') === nameKey('розетки')`; `findDuplicateName` returns the index of the second of two rows named «Кухня» and «кухня», and `-1` for distinct names
- [X] T005 [P] Create `tests/unit/services/referenceTablesFile.test.js` using `setFs(new MemoryFs({ dataDir: '/memfs/data' }))` as `tests/component/editorToolbar.test.js:30-40` does. Cover, per `contracts/reference-tables-file.md`: no stored file → bundled tables, `source: 'builtin'`, no refusal (002/FR-002); a valid stored file → `source: 'stored'`; each refusal stage 2–6 of *Load* → bundled tables, `refusal.error.path` as listed there (`''`, `schemaVersion`, `loadTypes[3].powerFactor`, `zones[5].name`), the file moved to `reference-tables.refused-<stamp>.json` with its content intact and the stored path empty (002/FR-007); `save` creates the directory and writes through `.tmp` + move; two `save` calls without awaiting leave the second state on disk; `flush()` resolves only after pending writes; a failing write rejects and the next `save` succeeds
- [X] T006 [P] Create `tests/unit/data/referenceTablesBuiltin.test.js` (SC-001, 002/FR-002): the bundled file passes `ReferenceTablesSchema`; it holds 33 load types and 8 zones; for row *i* of each table, every column except «Код» equals row *i* of the source document (T002 helper) after converting `так` → `true`, `ні` → `false`, `—` → `null`, numeric text → `Number`; ids match `/^lt-[0-9a-f-]{36}$/` and `/^zn-[0-9a-f-]{36}$/` and are unique
- [X] T007 [P] Create `tests/unit/stores/referenceTables.test.js` with `describe('load (002/FR-007)')`: after `load()` with no stored file, `tables` is the bundled content, frozen, and `loadTypeById` / `zoneById` resolve every row; after `load()` with a refused file, `refusal` is `{ error, keptAs }`

**Red checkpoint**: `npx vitest run tests/unit` — T003–T007 fail. Stop for the user's review.

### Implementation

- [X] T008 Add `LoadTypeSchema`, `ZoneSchema` and `ReferenceTablesSchema` to `src/schemas/index.js` per `data-model.md`: `name` is the existing `Name`; number cells `v.nullable(v.pipe(v.number(), v.finite()))`; yes/no cells `v.nullable(v.boolean())`; text cells `v.nullable(Note)`; `schemaVersion: v.literal(1)`
- [X] T009 [P] Create `src/modules/reference/engine/tableOps.js` with `nameKey(name)` (`trim().toLocaleLowerCase('uk')`) and `findDuplicateName(rows)` only; the editing functions come in T021 (research R6)
- [X] T010 [P] Author `src/data/referenceTables.builtin.json` as `{ "schemaVersion": 1, "loadTypes": [...33], "zones": [...8] }` in the source document's row order with the keys of `data-model.md`; generate each id once (`node -e "console.log('lt-' + crypto.randomUUID())"`, `zn-` for zones) and keep them fixed from then on; «Критична безперервна лінія» gets `leakageMa: null` (002/FR-002, research R2, R3)
- [X] T011 Create `src/services/ReferenceTablesFileService.js` per `contracts/reference-tables-file.md` and `contracts/services.md`: `REFERENCE_TABLES_FILE`, `REFERENCE_TABLES_VERSION`, `loadBuiltin()` (deep-frozen like today's `CatalogFileService.loadBuiltin`), `load({ now })` with stages 1–6 throwing through `LoadError` and `findDuplicateName`, the move-aside name `reference-tables.refused-<ISO, ":" and "." → "-">.json`, `save(tables)` chained on one promise (`ensureDir(appDataDir())`, `tmpPath`, `move`), `flush()` (research R1, R4, R5)
- [X] T012 Create `src/modules/reference/stores/referenceTables.js` — `useReferenceTablesStore` with `tables`, `loadTypeById`, `zoneById` (`computed` `Map`s), `refusal` and `load()`; editing actions come in T024
- [X] T013 Call `referenceTables.load()` once in `onMounted` of `src/components/AppLayout.vue`, after the existing setup; the refusal message comes in T028

**Green checkpoint**: `npx vitest run` green, `npx eslint .` clean.

Done 2026-09-26: 31 files, 308 tests green; `npx eslint .` clean; `npm run build` succeeds. One change
against T009 as written: `nameKey` and `findDuplicateName` are defined in `src/schemas/index.js` and
re-exported from `modules/reference/engine/tableOps.js`, because `ReferenceTablesFileService` applies
them on load and the services layer does not import from a module (plan.md *Structure Decision*).

---

## Phase 3: User Story 1 — View and edit the reference tables (Priority: P1) 🎯 MVP

**Goal**: a «Довідники» section shows both tables with the source document's columns and lets the user
change any cell, add a row and delete a row, each stored at once.

**Independent test**: quickstart Q1, Q4 and Q5; spec User Story 1, scenarios 1–8.

### Tests first

- [X] T014 [P] [US1] Create `tests/unit/reference/cells.test.js` (002/FR-006, research R8): `parseNumberCell` — `'0.95'` → 0.95, `'0,95'` → 0.95, `' 7.4 '` → 7.4, `'-1'` → -1, `''` and `'  '` → `null`; `'abc'`, `'1.2.3'`, `'1,2,3'`, `'1e3'`, `'0x10'` throw `TableRuleError` with code `notANumber` and a Ukrainian message; `parseTextCell` trims and turns `''` into `null`; `formatCell` — `null` → `''`, `true` → `'так'`, `false` → `'ні'`, `0.3` → `'0.3'`
- [X] T015 [P] [US1] Extend `tests/unit/reference/tableOps.test.js` (002/FR-004, 002/FR-005): `addRow` appends a row whose every other cell is `null` with the id from an injected `newId`; refuses `''` (`nameRequired`) and a name equal under `nameKey` (`nameTaken`); `updateCell` changes exactly one cell, allows a row to keep its own name in another case, refuses key `id` (`unknownColumn`), an unknown row (`unknownRow`), clearing a name, and another row's name; `deleteRow` removes the row and refuses an unknown one; every result is frozen and the argument unchanged
- [X] T016 [P] [US1] Extend `tests/unit/stores/referenceTables.test.js` (002/FR-004, 002/FR-007, SC-002): `addRow`, `updateCell` and `deleteRow` each change `tables` and leave exactly the new state on disk after `flush()`; `updateCell('loadTypes', id, 'demandFactor', '0,5')` stores `0.5` (parsed by the column's kind); a refused edit leaves `tables` unchanged and writes nothing; a fresh Pinia plus `load()` over the same `MemoryFs` returns the edited tables — the restart
- [X] T017 [P] [US1] Add to `tests/unit/services/closeGuard.test.js`: the `flush` step awaits a pending `ReferenceTablesFileService.save` as well as the autosave (research R4)
- [X] T018 [P] [US1] Create `tests/component/referenceTable.test.js`, mounted inside `NConfigProvider` / `NDialogProvider` / `NMessageProvider` over `MemoryFs` (002/FR-001, 002/FR-003, 002/FR-004, 002/FR-005, 002/FR-006; User Story 1 scenarios 1–6): column titles equal the source document's headers without «Код» (T002 helper); 33 and 8 rows; no text matching `/\b(lt|zn)-[0-9a-f]{8}/` anywhere in the rendered DOM; «Кп» of «Розетки кухні (робоча зона)» set to `0,5` and blurred is stored as `0.5`; clearing a name, typing «освітлення загальне» into another row's name, and `abc` in «P, кВт» each show a warning message and put the stored value back in the input; the name input plus «Додати рядок» appends a row; the row's delete button removes it; a yes/no cell offers «так» and «ні» and clears to empty
- [X] T019 [P] [US1] Create `tests/component/referenceNavigation.test.js` with a harness that mounts `AppLayout` + `RouterView` inside the Naive UI providers and a router built with `createMemoryHistory()` on which both `TreeModule` and `ReferenceModule` are installed (002/FR-003, 002/FR-007, 002/FR-008; User Story 1 scenarios 7–8): the menu shows «Дерево» and «Довідники»; a dirty project survives `/tree` → `/reference` → `/tree` with `project.isDirty` still true and the changed node intact; with the route at `/reference`, the exit decision registered through `setExitDecision` (the seam `tests/unit/services/closeGuard.test.js` uses) still prompts; a stored file with a duplicate zone name makes one `message.error` containing `zones[` and `reference-tables.refused-`, and the zones table shows the shipped rows

**Red checkpoint**: `npx vitest run` — T014–T019 fail. Stop for the user's review.

### Implementation

- [X] T020 [P] [US1] Create `src/modules/reference/engine/cells.js` with `parseNumberCell`, `parseTextCell` and `formatCell` (contracts/services.md, research R8)
- [X] T021 [US1] Complete `src/modules/reference/engine/tableOps.js`: `TableRuleError { code, message }`, `addRow(tables, table, name, newId)`, `updateCell(tables, table, rowId, key, value)`, `deleteRow(tables, table, rowId)`, each returning `produce(tables, …)` from `immer` (contracts/services.md)
- [X] T022 [P] [US1] Create `src/modules/reference/config/columns.js` exporting `columns.loadTypes` and `columns.zones`: ordered `{ key, header, kind }` entries matching `data-model.md`, `header` exactly as the source document writes it (`cos φ` for its LaTeX header), `kind` one of `name | text | number | yesno`
- [X] T023 [P] [US1] Create `src/modules/reference/index.js` exporting `ReferenceModule` (route `/reference`, name `reference`, lazy `views/ReferenceTablesView.vue`) and install it in `src/main.js` after `TreeModule` and before `app.use(router)` (`main.js:59-63`)
- [X] T024 [US1] Add `addRow`, `updateCell` and `deleteRow` to `src/modules/reference/stores/referenceTables.js`: parse the input by the column's kind (`config/columns.js`, `engine/cells.js`), apply the engine, assign the frozen result, then `ReferenceTablesFileService.save(tables)`; a `TableRuleError` propagates before anything is assigned or written; a rejected `save` propagates for the view to report as `Не вдалося записати довідники — …` (research R4)
- [X] T025 [US1] Create `src/modules/reference/components/ReferenceTable.vue` (`props: { table }`): `n-data-table` whose column `render` returns, by kind, an `NInput` with a local draft committed on blur and Enter, or an `NSelect` with «так» / «ні», clearable; a name `NInput` and «Додати рядок» above the table; a delete button at the end of each row; a refused edit calls `message.warning(error.message)` and resets the draft to the stored value; every cell editor carries `data-cell="<key>"`, the new-row name input `data-add-name`, the buttons read «Додати рядок» and «Видалити рядок» (`aria-label`) — the hooks `tests/component/referenceTable.test.js` uses (research R7)
- [X] T026 [US1] Create `src/modules/reference/views/ReferenceTablesView.vue`: `n-tabs` with «Типи навантажень» → `<ReferenceTable table="loadTypes" />` and «Зони» → `<ReferenceTable table="zones" />`
- [X] T027 [US1] Move the `setExitDecision(() => decideExit({...}))` block unchanged from `src/modules/tree/views/TreeEditorView.vue:39-56` into `src/components/AppLayout.vue`, with its save-failure report as `message.error` in the same wording as `TreeEditorView`'s `report()`; remove it and its now-unused imports from `TreeEditorView.vue` (research R10)
- [X] T028 [US1] In `src/components/AppLayout.vue`: add `{ key: 'reference', label: link('/reference', 'Довідники'), icon: icon(LibraryOutline) }` to `menuOptions` (icon from `@vicons/ionicons5`); after `load()`, show a refusal once with `message.error` in the text given in `contracts/reference-tables-file.md` *Load*
- [X] T029 [US1] In `src/services/closeGuard.js`, export `flushPendingWrites()` returning `Promise.all([ProjectFileService.flushAutosave(), ReferenceTablesFileService.flush()])` and pass it as `flush` in `installCloseGuard`, still under `FLUSH_TIMEOUT_MS` (contracts/services.md; tested by T017)

**Green checkpoint**: `npx vitest run` green, `npx eslint .` clean, `npm run build` succeeds. The user runs quickstart Q1, Q4 and Q5 in `npm run neu:dev`.

Done 2026-09-27: 34 files, 363 tests green; `npx eslint .` clean; `npm run build` succeeds; the two
new component suites print no Vue or Naive UI warnings. Quickstart Q1, Q4 and Q5 in the window are
still the user's to run.

---

## Phase 4: User Story 2 — Describe a consumer by load type, zone and cable section (Priority: P2)

**Goal**: a consumer is created from a load type and a zone, named after the load type, and carries
exactly name, load type, zone and an optional cable cross-section. The feature 001 catalog is gone.

**Independent test**: quickstart Q2; spec User Story 2, scenarios 1–7. Scenarios 8–9 and the copied rows are Phase 6.

**Depends on**: Phase 2 (the store the pickers read). Not on User Story 1's editing, except scenarios
5–6 in T035 and the empty-table case in T034, which use the store's `updateCell` / `deleteRow` from T024.

### Tests first

- [X] T030 [US2] Change the builder in `tests/fixtures/tree.js` to `consumer(id, { loadTypeId = 'lt-test', zoneId = 'zn-test', cableSectionMm2 = null, ...extra } = {})`, drop the `quantity` default in `walk` (`:19`), and update every call site: `tests/component/{TreeCanvas,keyboardMoveFix,moveRefusalFix,editorToolbar,fixDialogMove}.test.js`, `tests/unit/stores/{wrapAndMove,tree,project}.test.js`, `tests/unit/engine/homogeneity.test.js` (including the property test at `:171-172`), `tests/unit/services/closeGuard.test.js`
- [X] T031 [P] [US2] In `tests/unit/schemas.test.js` (002/FR-009, 002/FR-010, 002/FR-011): a consumer with `loadTypeId`, `zoneId` and `cableSectionMm2` of `null` or `2.5` is accepted; a missing or `''` `loadTypeId` / `zoneId`, a missing `cableSectionMm2` key, and `0`, `-1`, `'2.5'` in it are refused; `note`, `typeId`, `typeName` and `quantity` are dropped from a consumer while entry and panel still accept a note (001 FR-012); a project without `catalogVersion` is accepted. Delete 'refuses a consumer without typeName…', 'refuses a quantity below 1', 'refuses a project without a catalogVersion' and the `ConsumerTypeSchema` describe; change the `formatIssuePath` example from `nodes[42].quantity` to `nodes[42].zoneId`
- [X] T032 [P] [US2] In `tests/unit/engine/treeOps.test.js` (002/FR-010, 002/FR-011, 002/FR-012, 002/FR-014, 002/FR-020): `addNode` builds a consumer with exactly `{ id, kind, name, parentId, childIds: [], loadTypeId, zoneId, cableSectionMm2: null }` and refuses a missing `loadTypeId` (`loadTypeRequired`) or `zoneId` (`zoneRequired`); `setConsumerLoadType` renames when `node.name === previousName`, keeps a name the user typed, keeps the name when `previousName` is `null`; `setConsumerZone` sets the id; `setCableSection` accepts `null` and `2.5`, refuses `0`, `-1`, `NaN`, `Infinity` (`badCableSection`); all three refuse a panel (`notAConsumer`); after any of them the consumer still has exactly those eight keys — no reference value copied onto it; `setNote` refuses a consumer (`noteOnConsumer`) and still sets a panel's note. Delete the `typeId` / `typeName` tests and the `treeOps.setQuantity` describe; update the property test at `:431`
- [X] T033 [P] [US2] In `tests/unit/stores/tree.test.js` (002/FR-014): with the reference store holding «Духова шафа» and «Мікрохвильова піч», `setLoadType` on a consumer named «Духова шафа» renames it, and one `undo()` restores both the id and the name; a previous row missing from the table keeps the name; `setZone` and `setCableSection` are one undo step each. Delete 'setQuantity commits one step…'
- [X] T034 [P] [US2] Rewrite `tests/component/addConsumer.test.js` (002/FR-012, 002/FR-013; User Story 2 scenarios 1–2): «Додати» is disabled until both selects have a value; typing `роз` into the load type select leaves only rows whose name contains «роз»; placing creates a consumer named after the load type with the chosen ids and `cableSectionMm2: null`; placing under a panel that holds panels still emits `refused`; with the load types table emptied through the store, the select has no options and «Додати» stays disabled
- [X] T035 [P] [US2] Rewrite `tests/component/nodeInspector.test.js` (002/FR-009, 002/FR-014, 002/FR-015; User Story 2 scenarios 3–7): a consumer shows exactly «Назва», «Тип навантаження», «Зона», «Переріз кабелю, мм²» — no «Кількість», no «Нотатка», no type-name line; a panel still shows «Нотатка»; `2,5` stores `2.5`, clearing stores `null`, `0`, `-1` and `abc` show a warning and put the stored value back; renaming the load type row through the store changes the select's label and not the node's name; a consumer whose `loadTypeId` is in no row shows «Відсутній у довіднику» and no `lt-` text; changing the load type applies the rename rule
- [X] T036 [US2] Delete `tests/unit/catalog/search.test.js`, `tests/unit/catalog/coverage.test.js`, `tests/component/categoryFilter.test.js`, `tests/component/missingType.test.js` and the `CatalogFileService` describe in `tests/unit/services/pathService.test.js`. In `tests/unit/scope/boundaries.test.js`: delete 'reads the catalog from the bundle…'; add a `SUPERSEDED_BY_002` set — `FR-019` … `FR-025`, `FR-033`, `FR-034`, commented with a pointer to spec 002 *Relation to Feature 001* — that the T060 test skips; in 'keeps a node at its structural fields…' build the consumer with `loadTypeId`, `zoneId`, `cableSectionMm2` instead of `typeId`, `typeName`, `quantity` (research R12)
- [X] T037 [US2] In `tests/unit/quickstart/walkthrough.test.js`: remove the `useCatalogStore` import and V2.1–V2.5 (placement from the removed catalog); V1.3–V1.9 build consumers with `loadTypeId` / `zoneId`; 'V3.1' compares name, `loadTypeId`, `zoneId`, `cableSectionMm2` and panel notes; 'V3.2' opens a project whose `loadTypeId` is in no row and finds the node under its own name
- [X] T038 [US2] In `tests/unit/services/projectFile.test.js` and `tests/fixtures/tree-500.eltree.json`: give every consumer the new shape — the fixture's 469 consumers get `loadTypeId` / `zoneId` from `src/data/referenceTables.builtin.json` (round-robin over the rows) and `cableSectionMm2: null`, and lose `typeId`, `typeName`, `quantity`; drop `catalogVersion` from `META` and from the fixture. Leave `schemaVersion` at 1 in both — T052 moves it

**Red checkpoint**: `npx vitest run` — T030–T038 fail. Stop for the user's review.

Red 2026-10-01: 30 files, 84 failed / 266 passed; `npx eslint tests` clean. Every failure is the old
engine or schema (`typeRequired`, missing `setConsumerLoadType` / `setZone` / `setCableSection`,
`catalogVersion` / `typeId` required). Beyond T038 as written: in `projectFile.test.js` the tests
on `nodes[2].quantity`, a missing `typeName` and an unshipped `typeId` became `cableSectionMm2`, a
missing `zoneId` and an unresolved `loadTypeId` / `zoneId`, and the written file is checked for no
`catalogVersion` — as left they would fail at the green checkpoint; T047 has nothing left to delete.
`tests/unit/performance/tree500.test.js` reads the regenerated fixture unchanged.

### Implementation

- [X] T039 [US2] In `src/schemas/index.js`: take `note` out of the shared node fields and put it on entry and panel only; replace the consumer variant with `loadTypeId: Id`, `zoneId: Id`, `cableSectionMm2: v.nullable(v.pipe(v.number(), v.finite(), v.gtValue(0)))`; delete `ConsumerTypeSchema`, `CategorySchema`, `CatalogSchema`; remove `catalogVersion` from `ProjectSchema`; update the `formatIssuePath` doc example. `SCHEMA_VERSION` stays 1 until T051 (data-model.md)
- [X] T040 [US2] In `src/modules/tree/engine/treeOps.js` per `contracts/services.md`: `addNode(nodes, { parentId, kind, name, loadTypeId, zoneId })` with `loadTypeRequired` / `zoneRequired` in place of `typeRequired` / `typeNameRequired`, building the consumer with `cableSectionMm2: null`; add `setConsumerLoadType`, `setConsumerZone`, `setCableSection`; make `setNote` refuse a consumer; delete `setQuantity`
- [X] T041 [US2] In `src/modules/tree/stores/tree.js`: `add({ parentId, kind, name, loadTypeId, zoneId })`; `setLoadType(nodeId, loadTypeId)` resolving `previousName` / `nextName` through `useReferenceTablesStore().loadTypeById`; `setZone`; `setCableSection` — each through `apply()`; remove `setQuantity`, its import and export; correct the `:3` comment that says the store reads the catalog
- [X] T042 [US2] Rewrite `src/modules/tree/components/AddConsumerDialog.vue` per `contracts/services.md`: same props and emits; a `filterable` load type `NSelect` and a zone `NSelect` from `useReferenceTablesStore`; «Додати» enabled only when both are set; request `{ kind: 'consumer', name: <load type name>, loadTypeId, zoneId }`; `defineExpose({ place })`; replace the `:3-5` comment about there being no catalog screen
- [X] T043 [US2] In `src/modules/tree/components/NodeInspector.vue`: for a consumer render «Назва», «Тип навантаження» (`NSelect`, filterable), «Зона» (`NSelect`), «Переріз кабелю, мм²» (`NInput` → `parseNumberCell`, then `tree.setCableSection`, a refusal shown with `message.warning`); add a disabled option «Відсутній у довіднику» when the stored id is in no row (research R14); remove the `typeName` line (`:94-96`), the quantity field (`:110-112`) and the note for consumers (`v-if="node.kind !== 'consumer'"` on `:114-124`)
- [X] T044 [P] [US2] In `src/modules/tree/components/StructuralFixDialog.vue:26` change the documented pending shape to `{ kind, name, loadTypeId, zoneId }`; confirm `:85` and `:90` pass it through unchanged
- [X] T045 [US2] In `src/stores/project.js` remove `useCatalogStore` and `catalogVersion` from state, `open()`, `snapshot()` and the exports (`:12`, `:21`, `:28`, `:59`, `:87-94`, `:123`, `:138`, `:210`); in `src/services/ProjectFileService.js` drop `catalogVersion` from `denormalize` (`:63`, `:69`) and update the comments at `:20` and `:268-269`
- [X] T046 [US2] Delete `src/data/catalog.builtin.json`, `src/services/CatalogFileService.js` and `src/modules/tree/stores/catalog.js`; run `npm uninstall fuse.js` (research R11)

**Green checkpoint**: `npx vitest run` green, `npx eslint .` clean, `npm run build` succeeds, and `grep -rnE "\btypeId\b|\btypeName\b|\bquantity\b|catalogVersion|fuse\.js" src` finds nothing. The user runs quickstart Q2.

Done 2026-10-02: 30 files, 351 tests green; `npx eslint .` clean; `npm run build` succeeds; the grep
finds nothing in `src`. T049 and T053 were pulled forward from Phase 5 with the user's go:
`tests/unit/contracts/projectSchema.test.js` compares the live `ProjectSchema` with the emitted file,
so removing `catalogVersion` (T039) turned it red until the 002 file existed. The emitted schema does
not pin `schemaVersion` to a value. In
`tests/component/addConsumer.test.js` the search test alone swaps `NModal` for a plain shell: under
happy-dom the modal's `trap-focus` keeps an open select's menu from rendering. Both selects render
with `:virtual-scroll="false"` so every option is a real element. Quickstart Q2 in the window is
still the user's to run.

---

## Phase 5: User Story 3 — Keep projects with the new consumer fields on disk (Priority: P3)

**Goal**: the project file reproduces every consumer field and opens files whose references do not
resolve. `schemaVersion` stays 1.

**Independent test**: quickstart Q3; spec User Story 3, scenarios 1–2.

**Depends on**: Phase 4 (the consumer shape being saved).

### Tests first

- ~~T047 [P] [US3] In `tests/unit/services/projectFile.test.js`: a round trip of three consumers with the `loadTypeId` / `zoneId` key list~~ — replaced 2026-10-03 by T068 (copies of the rows on the consumer)
- ~~T048 [P] [US3] In `tests/unit/stores/project.test.js` (002/FR-017): opening a version-1 file leaves the open project untouched~~ — dropped 2026-10-03 with FR-017
- [X] T049 [P] [US3] In `tests/unit/contracts/projectSchema.test.js`: read `specs/002-reference-tables-consumer-fields/contracts/project-file.schema.json`, and expect the key list without `catalogVersion`
- ~~T050 [P] [US3] Create `tests/component/missingReference.test.js` expecting «Відсутній у довіднику» in both selects~~ — replaced 2026-10-03 by T069

**Red checkpoint**: moved to Phase 6 with T068 and T069.

### Implementation

- ~~T051 [US3] Set `SCHEMA_VERSION = 2` in `src/schemas/index.js:7`~~ — dropped 2026-10-03: the version stays 1 (research R13)
- ~~T052 [US3] Set `schemaVersion` to 2 in `tests/fixtures/tree-500.eltree.json` and in the `META` of `tests/unit/services/projectFile.test.js`~~ — dropped with T051
- [X] T053 [US3] Point `scripts/emit-project-schema.mjs` at `specs/002-reference-tables-consumer-fields/contracts/project-file.schema.json` and run `npm run schema:emit`

**Green checkpoint**: moved to Phase 6; the user runs quickstart Q3 after it.

---

## Phase 6: Convergence

**Goal**: the consumer holds copies of its rows (spec, clarification session 2026-10-03; research R14 – R17).

### Tests first

Outline stop first, as for every phase (see *Tests* at the top).

- [X] T061 Give `consumer()` in `tests/fixtures/tree.js:32-37` the copy shape — `consumer(id, { loadType, zone, cableSectionMm2 })`, defaulting to whole test rows `{ id: 'lt-test', name: 'Тестовий тип', … }` and `{ id: 'zn-test', name: 'Тестова зона', … }` with every other column `null` — and regenerate `tests/fixtures/tree-500.eltree.json` so each of its 469 consumers carries copies of the shipped rows its current `loadTypeId` / `zoneId` name, per 002/FR-010, plan: fixtures (contradicts)
- [X] T062 In `tests/unit/schemas.test.js` (`consumerNode()` `:30-39`, tests at `:84`, `:94`, `:105`, `:154`): a consumer carries `loadType` and `zone` as whole rows; it is refused when either is missing or when a copied value breaks its row schema (`zone.leakageMa: 'abc'` → path `nodes[42].zone.leakageMa`); its output keys are exactly `id, kind, name, parentId, childIds, loadType, zone, cableSectionMm2`, per 002/FR-009, 002/FR-010, SC-006 (contradicts)
- [X] T063 In `tests/unit/engine/treeOps.test.js`: `addNode` copies both rows — equal by value, never the caller's object (`:69`, `:89`, `:102`; `CONSUMER_KEYS` `:360-371` gains `loadType`, `zone` in place of the ids); `setConsumerLoadType(nodes, id, row)` replaces the whole copy, hand edits included, and renames only when `node.name === node.loadType.name` — re-choosing the same row after its rename in the table renames, a typed name stays (`:400-433`); `setConsumerZone(nodes, id, row)` replaces the copy and leaves the name; new `setConsumerCopyValue` sets one key and refuses `id` / `name` (`copyKeyLocked`), a key the row lacks (`unknownColumn`) and a value its row schema refuses (`badCopyValue`, the message naming the column header); delete 'keeps the name when the previous load type row no longer exists' (`:422`), per 002/FR-010, 002/FR-014, 002/FR-021 (contradicts)
- [X] T064 In `tests/unit/stores/tree.test.js` (`:225-270`): `setLoadType(id, loadTypeId)` copies the row found in `loadTypeById`, and the copy with its rename is one undo step; `setCopyValue` is one undo step and leaves the reference store's tables as they were; `useReferenceTablesStore().updateCell` on a row a consumer was copied from changes no consumer; delete 'setLoadType keeps the name when the previous load type is in no row' (`:255`), per 002/FR-014, 002/FR-021, SC-007 (contradicts)
- [X] T065 Add `parseCell(kind, input)` to `tests/unit/reference/cells.test.js`: `number` — `'0,5'` → `0.5`, `'abc'` → `TableRuleError` `notANumber`; `text` — `'  IP44 '` → `'IP44'`, `''` → `null`; `yesno` — `true` and `null` pass through, per plan R16 (missing)
- [X] T066 In `tests/component/nodeInspector.test.js`: a consumer's properties show the project group `['Назва', 'Переріз кабелю, мм²']` and below it the reference group — «Тип навантаження», the seven load type headers of `config/columns.js` except the name, «Зона», the five zone headers (`:137`, `:158`); after its row is renamed (`:193`) or deleted (`:208`) in the table the select still reads the copied name, with no «Відсутній у довіднику» and no id; choosing the same row again shows the row's current values and replaces a hand edit (User Story 2 scenario 8); «Кп» set to `0,6` changes this consumer only, and `abc` in «P, кВт» is refused with a warning and the editor reverts (scenario 9); neither name has an editor in the reference group, per 002/FR-015, 002/FR-021, 002/FR-022, US2/AC5, US2/AC6, US2/AC8, US2/AC9 (contradicts)
- [X] T067 In `tests/component/addConsumer.test.js`: the placed consumer carries whole copies of both chosen rows (`:108-127`), and a refused placement hands on `{ kind, name, loadType, zone }` (`:131-148`), per 002/FR-012 (contradicts)
- [X] T068 Write T047's round trip in `tests/unit/services/projectFile.test.js` with the consumer keys `id, kind, name, parentId, childIds, loadType, zone, cableSectionMm2` in place of T047's key list, reproducing a hand-edited copied value and an empty copied cell exactly; rework 'refuses a consumer with no zoneId' (`:161`) to a missing `zone`, and 'accepts a load type and a zone in no row' (`:253`) to a file whose copies name rows absent locally or holding other values, loaded with the file's values, per 002/FR-016, 002/FR-018, 002/FR-019, SC-005 (contradicts)
- [X] T069 Create `tests/component/missingReference.test.js` in place of T050: open through `ProjectFileService` a file whose `loadType.id` and `zone.id` are in no local row, and a file whose rows hold other values locally; in both the inspector shows the file's names and values, with no «Відсутній у довіднику», per 002/FR-015, 002/FR-018, US3/AC2, US3/AC3 (missing)
- [X] T070 Move the remaining consumer literals to the copy shape — `tests/unit/engine/homogeneity.test.js:171-172`, `tests/unit/quickstart/walkthrough.test.js:81,99,128,166,198,234,242`, `tests/component/editorToolbar.test.js:67,84,109`, `tests/component/fixDialogMove.test.js:91`, `tests/unit/stores/project.test.js:36-37` — and turn walkthrough V3.2 (`:268`) into quickstart Q3 step 2: a file whose rows differ locally opens with its own values, per 002/FR-010, 002/FR-018 (contradicts)

**Red checkpoint**: `npx vitest run` — T061–T070 fail on the consumer still holding `loadTypeId` / `zoneId`. Stop for the user's review.

Red 2026-10-03: 31 files, 97 failed / 278 passed; `npx eslint tests` clean. Every failure is the old
consumer shape: `addNode` still asks for `loadTypeId` (44), the schema still wants `loadTypeId` (14),
`setConsumerCopyValue`, `parseCell` and `store.setCopyValue` do not exist yet, `setConsumerLoadType`
still takes `{ previousName, nextName }`. Beyond the tasks as written: the consumer in
`tests/unit/scope/boundaries.test.js` 'keeps a node at its structural fields…' now holds copies. Three
new tests pass already, for a reason that goes away with T071: the two schema refusals of a missing or
broken copy (the old schema refuses any consumer without `loadTypeId`) and SC-007 in
`tests/unit/stores/tree.test.js` (nothing touches a node today). The 500-node fixture, written as
Prettier formats it, grew from 158 KB to 423 KB.

### Implementation

- [X] T071 In `src/schemas/index.js` move `LoadTypeSchema`, `ZoneSchema` and their cell schemas above `ConsumerNodeSchema`, replace its `loadTypeId` / `zoneId` (`:46-54`) with `loadType: LoadTypeSchema` and `zone: ZoneSchema`, rewrite its doc comment (`:41-45`), then run `npm run schema:emit` so `contracts/project-file.schema.json` matches, per 002/FR-010, 002/FR-016, plan R15 (contradicts)
- [X] T072 Move `parseInput` from `src/modules/reference/stores/referenceTables.js:24-29` to `src/modules/reference/engine/cells.js` as the exported `parseCell(kind, input)`, have `updateCell` use it, and reword the store's header comment (`:1-3`): the maps find the row a user picks, they no longer show a consumer, per plan R16 (missing)
- [X] T073 In `src/modules/tree/engine/treeOps.js`: `addNode(nodes, { parentId, kind, name, loadType, zone })` copies both rows (`{ ...row }`) and refuses a missing row or one without an `id` (`loadTypeRequired` / `zoneRequired`); `setConsumerLoadType(nodes, nodeId, loadType)` replaces the copy and renames when `node.name === node.loadType.name`; `setConsumerZone(nodes, nodeId, zone)` replaces the copy; new `setConsumerCopyValue(nodes, nodeId, part, key, value)` with `copyKeyLocked`, `unknownColumn` and `badCopyValue`, validated by `LoadTypeSchema` / `ZoneSchema`, per 002/FR-010, 002/FR-012, 002/FR-014, 002/FR-021 (contradicts)
- [X] T074 In `src/modules/tree/stores/tree.js`: `add` forwards the `loadType` and `zone` rows (`:123-136`); `setLoadType` / `setZone` find the row in `loadTypeById` / `zoneById` and pass it, dropping the previous/next name lookup (`:150-159`); new `setCopyValue(nodeId, part, key, value)` through `apply()`, per 002/FR-014, 002/FR-021 (contradicts)
- [X] T075 In `src/modules/tree/components/AddConsumerDialog.vue` `place()` (`:47-64`) look up both rows and build `{ kind: 'consumer', name: loadType.name, loadType, zone }`; update the `pending` prop doc in `StructuralFixDialog.vue:26` to that shape, per 002/FR-012 (contradicts)
- [X] T076 Extract `src/modules/reference/components/CellEditor.vue` from `textEditor` / `yesNoEditor` in `ReferenceTable.vue:81-106` — props `kind`, `value`, `multiline`, `dataCell`; emits `commit`; drops its draft at commit, so a refused value shows the stored one again — and render every table cell through it, per plan R17 (missing)
- [X] T077 Rebuild the consumer part of `src/modules/tree/components/NodeInspector.vue` per plan R14 and R17: the project group («Назва», «Переріз кабелю, мм²»), then the reference group on `useThemeVars().actionColor` with the caption «З довідника · копія» — each select bound to `COPY` with a `fallback-option` labelled by the copied name, the «Відсутній у довіднику» option (`:93-113`) and the same-id guards (`:121-137`) removed, then a label | editor grid of `CellEditor`s over `columns.loadTypes` / `columns.zones` except `name`, `purpose` spanning both grid columns as `multiline`, each commit parsed by `parseCell` into `tree.setCopyValue`, a refusal shown with `message.warning`; reword the header comment (`:2-5`), per 002/FR-015, 002/FR-021, 002/FR-022 (contradicts)
- [X] T078 Extend T055's coverage to `002/FR-021` and `002/FR-022`, so `002/FR-\d{3}` citations cover every FR of `specs/002-reference-tables-consumer-fields/spec.md`, per plan R12 (partial)
- [X] T079 Reword the doc comment at `src/services/ProjectFileService.js:252-254`: the consumer's copies, not ids, are what load never checks against the local tables, and nothing is shown as absent, per 002/FR-018 (partial)

**Green checkpoint**: `npx vitest run` green, `npx eslint .` clean, `npm run build` succeeds. Then T055 with T078, T054, and T056.

Green 2026-10-04: 31 files, 375 passed; `npx eslint .` clean; `npm run build` succeeds. T078 waits for
T055, as the checkpoint says. Beyond the tasks as written: the inspector's muted captions take
`textColor3` through `:style`, because `tests/component/theme.test.js` allows no custom property
outside `main.css`; and 'refuses a copied value its column would refuse' in
`tests/unit/services/projectFile.test.js` now replaces the copy instead of assigning into it, since
the copy is the module's shared `fridge` row and the assignment broke the seven tests after it.

---

## Phase 7: Polish and cross-cutting

- [X] T054 [P] Update `README.md`: «Структура» (`:54-66`) — the `modules/reference/` module, `ReferenceTablesFileService.js`, `referenceTables.builtin.json` in place of `catalog.js` and "82 типи споживачів"; «Файл проекту» (`:72`) — the consumer fields; the spec link at `:10` gains `specs/002-reference-tables-consumer-fields/`
- [X] T055 Extend the T060 guard in `tests/unit/scope/boundaries.test.js` to both specs: bare `(?<!\/)FR-\d{3}` citations must cover every FR of `specs/001-electrical-load-tree-editor/spec.md` outside `SUPERSEDED_BY_002`, and `002/FR-\d{3}` citations must cover every FR of `specs/002-reference-tables-consumer-fields/spec.md`; add a citation to any test that proves an uncited requirement rather than weakening the guard (research R12); T078 adds 002/FR-021 and 002/FR-022 — do both in one pass
- [X] T056 Final verification, after Phase 6's green checkpoint: `npx vitest run`, `npx eslint .`, `npm run build`; the user walks quickstart Q1–Q5 end to end in `npm run neu:dev`, timing Q2 steps 1–2 against SC-004 (under 20 seconds)

---

## Dependencies

```text
Phase 1 Setup ─→ Phase 2 Foundational ─→ Phase 3 US1 (MVP)
                                     └─→ Phase 4 US2 ─→ Phase 5 US3 ─→ Phase 6 Convergence
Phase 3 + Phase 6 ─→ Phase 7 Polish
```

- US1 and US2 both need only Phase 2 and can run side by side; T034 and T035 use `updateCell` and
  `deleteRow` from T024, so T024 has to be done before they can go green.
- US3 needs US2: it saves the consumer shape US2 introduces.
- Inside a phase: test outline → stop → tests → red checkpoint → implementation → green checkpoint.
  No test is written before the user has seen the outline, and no implementation task starts before
  the user has reviewed the red run.
- T039 → T040 → T041 → T042 / T043 (the schema, then the engine, then the store, then the components).
- T046 last in Phase 4: nothing may still import the catalog when it is deleted.
- Phase 6 reworks what Phase 4 built (revision 2026-10-03). T061 first: every other Phase 6 test
  imports its fixtures. Then T071 → T072 → T073 → T074 → T075; T076 before T077.
- Phase 7 runs after Phase 6: T055 with T078, T054, then T056.

## Parallel examples

- **Phase 2 tests**: T003, T004, T005, T006, T007 — five different files.
- **Phase 2 implementation**: T009 and T010 next to T008; T011 after T008–T010; T012 after T011.
- **US1 tests**: T014 – T019 — six different files.
- **US1 implementation**: T020, T022, T023 together; T021 → T024 → T025 → T026; T027 – T029 after T023.
- **US2 tests**: T031 – T035 in parallel once T030 has changed the fixture they all import.
- **US3 tests**: T068 and T069, in Phase 6.
- **Phase 6 tests**: T062 – T070 in parallel once T061 has changed the fixtures they import.

## Implementation strategy

1. **MVP = Phases 1–3.** The «Довідники» section works end to end, and the old consumer model is still
   intact beside it. Stop, run quickstart Q1, Q4 and Q5, and decide whether to go on.
2. **Phase 4** swaps the consumer model and removes the catalog in one pass. The suite is red between
   T030 and T046 by design; do not stop halfway through the implementation tasks.
3. **Phase 5** proves the consumer fields survive a save and reopen; the file version stays 1.
4. **Phase 6** turns the consumer's ids into copies of its rows and adds the two-group properties
   area (spec, clarification session 2026-10-03).
5. **Phase 7** closes the requirement map over both specs, after Phase 6.
