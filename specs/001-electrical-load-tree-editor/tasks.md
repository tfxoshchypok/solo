# Tasks: Electrical Consumer Tree Editor

**Date**: 2026-09-10 | **Input**: Design documents from `/specs/001-electrical-load-tree-editor/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md),
[contracts/](./contracts/), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: included. The spec states its requirements as acceptance scenarios, the engines are pure
functions, and the project already runs a Vitest suite — so every engine and service task is preceded
by its failing test.

## Reading this file

A task marked `[X]` is already in the repository and verified by the suite. A task marked `[ ]` is
outstanding. Phases 1 and 2 carry both, because the 2026-09-10 replan narrowed the feature after part
of it had been built: what survived the cut is checked off, what the cut left behind is a task.

**Removal tasks** (T001 … T010) exist because the code still carries three hangovers from the removed
scope: two dependencies nothing imports, the custom-catalog file API, and the catalog screen. They are
first because every later task touches the same files.

Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
`[P]` = parallelizable, different file, no dependency on an unfinished task.

---

## Phase 1: Setup and removal of the cut scope

- [X] T001 Scaffold the project — `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/App.vue`, `src/assets/main.css`, `neutralino.config.json` with `cli.frontendLibrary` for `neu run`
- [X] T002 Pin the toolchain floor at Node 22.13.0 and install the dependency set from plan.md *Technical Context*
- [X] T003 Flat-config ESLint and Prettier — `eslint.config.js`, `.prettierrc`
- [X] T004 [P] Uninstall `microdiff` and `convert` and drop them from `package.json` — nothing imports either since the figures and unit parsing left the scope (plan.md *Removed in the 2026-09-10 replan*)
- [X] T005 [P] Delete `src/modules/catalog/` entirely — `index.js`, `views/CatalogView.vue`, and move `stores/catalog.js` to `src/modules/tree/stores/catalog.js`, updating the import in every consumer (plan.md *Structure Decision*)
- [X] T006 Remove the `/catalog` route registration and its sidebar menu entry from `src/main.js` and `src/components/AppLayout.vue`; `/tree` becomes the only route (plan.md *Project Structure*)
- [X] T007 [P] Remove `loadCustom` and `saveCustom` from `src/services/CatalogFileService.js`, leaving `loadBuiltin()` alone — the catalog is bundled and read-only (FR-022, contracts/services.md)
- [X] T008 [P] Remove `CUSTOM_CATALOG_FILENAME` and `customCatalogPath()` from `src/services/PathService.js` and their assertions from `tests/unit/services/pathService.test.js`
- [X] T009 [P] Strip the energy fields from all 25 existing types in `src/data/catalog.builtin.json`, leaving `id`, `name`, `nameEn`, `categoryId`; drop the `sources` block (contracts/catalog.md)
- [X] T010 Narrow `ConsumerTypeSchema` and `CatalogSchema` in `src/schemas/index.js` to the four fields above, removing `NumberOrRangeSchema`, `RangeSchema`, `DutySchema`, `LineClassSchema`, `DedicatedLineSchema`, `SourceReferenceSchema` and the `dedicatedLineSourceId` check; also drop `customTypes` from `ProjectSchema` and `locationLabel` from `ConsumerNodeSchema`, which the clarified scope removed; update `tests/unit/schemas.test.js`

**Checkpoint**: `npx vitest run` green, `npx eslint .` clean, `npm run build` succeeds, and no file under `src/` mentions a figure, a rule or a warning.

Done 2026-09-10. One item surfaced only while working: comments across `src/` and `tests/` cited
requirement numbers from before the replan, so following a citation in `NeutralinoFs.js` or
`stores/project.js` landed the reader on nothing. All of them were remapped onto the current
numbering, and the one that named the deleted catalog-drift check now points at
`contracts/project-file.md` instead. Every requirement number left in the code and in this file is
inside FR-001 … FR-038, and every research citation inside R1 … R11.

---

## Phase 2: Foundational (blocking prerequisites)

- [X] T011 [P] Filesystem adapter — `src/services/fs/index.js` selecting on `window.NL_PORT`, `NeutralinoFs.js`, `MemoryFs.js`, all ten methods wrapping failures in `FsError`; local storage only, no network path anywhere (FR-032, contracts/services.md, R7)
- [X] T012 [P] Tests for the adapter in `tests/unit/fs/memoryFs.test.js`
- [X] T013 [P] `src/services/PathService.js` — `join`, `basename`, `dirname`, `appDataDir`, `autosavePath`, `tmpPath`, `projectFileName`
- [X] T014 [P] Tests in `tests/unit/services/pathService.test.js`
- [X] T015 Node and project valibot schemas in `src/schemas/index.js` — `EntryNodeSchema`, `PanelNodeSchema`, `ConsumerNodeSchema`, `NodeSchema`, `ProjectSchema`, `formatIssuePath`; exactly three node kinds (FR-003) and a consumer whose `childIds` is capped at zero (FR-004)
- [X] T016 Schema tests in `tests/unit/schemas.test.js`
- [X] T017 `src/modules/tree/engine/homogeneity.js` — `childrenKindAfter`, `canAccept`: the mixture is refused (FR-013), the entry node obeys the same rule as a panel (FR-014), refusal happens at the moment of the attempt rather than later (FR-015), an empty panel is legal and `undecided` (FR-005, FR-018)
- [X] T018 Homogeneity tests in `tests/unit/engine/homogeneity.test.js`
- [X] T019 `src/modules/tree/engine/treeOps.js` over `immer.produce` — add, remove, move, reorder, rename (FR-006), a move into the node's own subtree refused with the tree unchanged (FR-008), a re-parent carrying the whole subtree (FR-009), the depth guard (FR-007) and `RuleError`
- [X] T020 treeOps tests in `tests/unit/engine/treeOps.test.js`, including the `fast-check` properties that no move sequence produces a cycle and that the returned map is frozen (R10)
- [X] T021 `src/modules/tree/stores/tree.js` — normalized nodes, selection, expansion, `useManualRefHistory` with `capacity: 100` and `clone: false` (R5); `createEmptyTree` produces the single undeletable entry root (FR-002)
- [X] T022 `src/stores/ui.js` and `src/stores/project.js`
- [X] T023 `src/components/AppLayout.vue` — sidebar, toolbar, RouterView
- [X] T024 Add `typeName` to `ConsumerNodeSchema` in `src/schemas/index.js` as a required non-empty string, with a test that a consumer without it is rejected (FR-034, data-model.md)
- [X] T025 Write `typeName` in `addNode` in `src/modules/tree/engine/treeOps.js`, taking it from the caller alongside `typeId`; extend the `typeRequired` guard to refuse a blank one (contracts/services.md)
- [X] T026 [P] Add a `name` guard to `addNode` refusing an empty node name, so the map can never hold a node `ProjectSchema` would reject at save time
- [X] T027 [P] Guard the `parentId` walk in `depthOf` and `isDescendantOf` (`src/modules/tree/engine/treeOps.js`) with a visited set, so a hand-edited cyclic file cannot hang the window

**Checkpoint**: the engine and the schemas match `data-model.md` field for field. No user story can start before this point.

Done 2026-09-10. The cycle guard (T027) is worth a note: written as a test first, it did not fail —
it hung, exactly as the window would, and the run had to be killed. `depthOf` and `isDescendantOf`
now refuse with `RuleError({ code: 'corruptTree' })` on the second visit to a node.

---

## Phase 3: User Story 1 — Compose the distribution tree (P1) 🎯 MVP

**Goal**: the user builds, rearranges and undoes a tree of entry and panels, with the homogeneity rule
enforced at the moment of the attempt.

**Independent test**: create a project, build entry → main panel → 2 sub-panels, drag a subtree, delete
a panel with descendants, undo everything. No catalog and no file needed.

- [ ] T028 [P] [US1] Component test for the tree canvas in `tests/component/TreeCanvas.test.js` — renders the nested options, expands, selects (FR-026, FR-028)
- [ ] T029 [US1] `src/modules/tree/components/TreeCanvas.vue` — `n-tree` with `virtualScroll`, `draggable`, `expandedKeys`, `selectedKeys`, bound to the store's `nestedOptions` (FR-026, FR-028)
- [ ] T030 [US1] Wire `allowDrop` in `TreeCanvas.vue` to `homogeneity.canAccept` for both `phase: 'drag'` and `phase: 'drop'`, so a rejected drop shows while the pointer is down (FR-027, R3)
- [ ] T031 [US1] Store actions in `src/modules/tree/stores/tree.js` — `add`, `rename`, `remove`, `move`, `reorder`, each calling `treeOps` and committing one history step (FR-006, FR-011); renaming a node touches that node alone (FR-024)
- [ ] T032 [P] [US1] Store-action tests in `tests/unit/stores/tree.test.js` — every action commits exactly one undo step and a refused action commits none
- [ ] T033 [P] [US1] `src/composables/useConfirm.js` — promise-returning confirmation over `n-dialog`
- [ ] T034 [US1] Delete confirmation naming the descendant count, using `removeNode`'s `removedIds` before the change applies (FR-010)
- [ ] T035 [US1] `src/modules/tree/components/StructuralFixDialog.vue` — offers the one-step fix carried on `RuleError.fix`: wrap existing consumers in a new sub-panel, or place the consumer under a chosen sub-panel (FR-016, FR-017, SC-002)
- [ ] T036 [US1] `src/modules/tree/components/NodeInspector.vue` — name and note of the selected node, editable in place through vee-validate over the node schema (FR-012, FR-029)
- [ ] T037 [P] [US1] `src/composables/useKeyboardTree.js` over `useMagicKeys` / `onKeyStroke` — add, rename, delete, move and reorder without a pointer, inert while a text field has focus (FR-030, R9)
- [ ] T038 [P] [US1] Keyboard test in `tests/component/keyboardTree.test.js` — the tree built by keystrokes equals the tree built by store calls (US1 scenario 10)
- [ ] T039 [US1] Assemble `src/modules/tree/views/TreeEditorView.vue` — canvas, inspector, undo/redo toolbar buttons. Walk V1 in quickstart.md end to end against a stopwatch: a first-time user reaches entry → two panels → six consumers inside five minutes without documentation (SC-001)
- [ ] T040 [US1] Depth refusal surfaced in the UI with the current depth named (FR-007)

**Checkpoint**: V1 in [quickstart.md](./quickstart.md) passes end to end in `npm run neu:dev`.

---

## Phase 4: User Story 2 — Place end consumers from the catalog (P2)

**Goal**: a consumer is created by picking a type, found by fragment in either language.

**Independent test**: search `холод`, then `fridge`; place the result; rename it; set a quantity of 8.

- [ ] T041 [US2] Extend `src/data/catalog.builtin.json` to at least 80 types across all eleven categories from spec.md *Catalog Scope*, each with `id`, `name`, `nameEn`, `categoryId` (FR-019, FR-020)
- [ ] T042 [P] [US2] Catalog-coverage test in `tests/unit/catalog/coverage.test.js` — the representative types from the spec's category table resolve at a rate of at least 90%, and every `categoryId` resolves (SC-003)
- [ ] T043 [P] [US2] Search test in `tests/unit/catalog/search.test.js` — `холод` and `fridge` both return the fridge row; a one-letter typo still ranks it first (FR-021, SC-004)
- [ ] T044 [US2] Build the `fuse.js` index as a `computed` over the loaded catalog in `src/modules/tree/stores/catalog.js`, and a pure `search(index, query, categoryId)` beside it (R8)
- [ ] T045 [US2] `src/modules/tree/components/AddConsumerDialog.vue` — search field, category filter, results showing name and category, keyboard-navigable (FR-021, FR-023)
- [ ] T046 [US2] Placing a result calls the store's `add` with `typeId` and `typeName`, naming the node after the type (FR-023, FR-034)
- [ ] T047 [P] [US2] Quantity field on the consumer in `NodeInspector.vue`, integer ≥ 1 (FR-025)
- [ ] T048 [P] [US2] Test in `tests/component/addConsumer.test.js` — placing then renaming leaves the catalog row untouched (US2 scenario 3)

**Checkpoint**: V2 in quickstart passes; US1 still passes untouched.

---

## Phase 5: User Story 3 — Keep the project on disk (P3)

**Goal**: save, reopen, survive a crash, refuse a broken file whole.

**Independent test**: build a tree, save, close, reopen — identical node for node.

- [ ] T049 [P] [US3] Test in `tests/unit/services/projectFile.test.js` over `MemoryFs` — a round trip reproduces the tree; a truncated file throws `LoadError` naming the element; nothing reaches the store on failure (FR-035, FR-036, SC-005)
- [ ] T050 [US3] `src/services/ProjectFileService.js` — `load`, `save` with the `.tmp` → `move` sequence, `scheduleAutosave` debounced at 400 ms, `findRecovery`, `discardRecovery` (FR-031, FR-033, R2)
- [ ] T051 [US3] Structural validation beyond the schema in `ProjectFileService.load` — every `parentId` and `childIds` entry resolves and agrees, exactly one root, no cycle (contracts/project-file.md)
- [ ] T052 [US3] Normalize on load and denormalize on save between the file's `nodes` array and the store's map (data-model.md *Runtime shape*)
- [ ] T053 [US3] Toolbar actions in `src/modules/tree/views/TreeEditorView.vue` — New, Open, Save, Save As through the adapter's native dialogs, with the dirty marker in the title (FR-001, FR-031)
- [ ] T054 [P] [US3] Recovery prompt on open when a newer autosave sidecar exists, offered before anything loads (FR-031, R2)
- [ ] T055 [P] [US3] Test that a project naming a type absent from the catalog still renders, from the node's stored `typeName` (FR-034, quickstart V3.2)
- [ ] T056 [P] [US3] Emit the JSON Schema form of `ProjectSchema` through `@valibot/to-json-schema` as a build script, so `contracts/project-file.md` and the code cannot drift (R6)

**Checkpoint**: V3 in quickstart passes, including `kill -9` recovery under `npm run neu:dev`.

---

## Phase 6: Polish and cross-cutting concerns

- [ ] T057 [P] 500-node fixture at `tests/fixtures/tree-500.eltree.json` and a performance check that expand, collapse and select stay responsive (FR-037, SC-006, quickstart V4)
- [ ] T058 [P] Dark and light theme passes over every new component, driven by the `[data-theme]` hook in `src/assets/main.css`
- [ ] T059 [P] Empty states — a fresh project with one entry node, and a search with no matches
- [ ] T060 Requirement-coverage run — `npm run test:coverage` over `src/modules/tree/engine/` and `src/services/`, confirming every FR with an acceptance scenario has a test that names it, and that no module models a cable route, length, cross-section, conduit or floor-plan position (FR-038)
- [ ] T061 Update `README.md` with the run and build commands from quickstart.md

---

## Dependencies

```text
Phase 1 (T001…T010)  removal and setup
        ↓
Phase 2 (T011…T027)  foundational — blocks every story
        ↓
Phase 3 (T028…T040)  US1  ── MVP, independently shippable
        ↓
Phase 4 (T041…T048)  US2  ── needs US1's canvas and store actions
        ↓
Phase 5 (T049…T056)  US3  ── needs a tree to save; does not need US2
        ↓
Phase 6 (T057…T061)  polish
```

US3 depends on US1 but not on US2: a project of entry and panels saves and reopens perfectly well.
Shipping US1 + US3 without US2 is a coherent increment, if a less useful one than US1 + US2.

## Parallel execution

Within Phase 1, T004, T005, T007, T008 and T009 touch different files and can run together; T006 and
T010 follow because they edit files the others move or shrink.

Within Phase 3: T028, T033, T037 and T038 are independent of the canvas work in T029 … T031.

Within Phase 4: T042, T043 and T047 are independent of T044 … T046.

Within Phase 5: T049 comes first as the failing test; T054, T055 and T056 are independent of each
other once T050 exists.

## Implementation strategy

**MVP** is Phase 1 + Phase 2 + Phase 3 — a tree editor with undo, keyboard access and the homogeneity
rule, holding nothing on disk. That is testable by hand and demonstrates the whole model.

**Increment 2** adds Phase 5, which turns a demonstration into a tool: work survives closing the app.

**Increment 3** adds Phase 4, the 80-type catalog and its search.

Phase 1 is not optional and not deferrable. Until it runs, `package.json` carries two unused
dependencies and `src/` carries a screen and a file API for a capability the specification no longer
describes — the exact residue the constitution's Principle I exists to prevent.
