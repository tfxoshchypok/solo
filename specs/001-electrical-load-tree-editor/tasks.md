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

- [X] T028 [P] [US1] Component test for the tree canvas in `tests/component/TreeCanvas.test.js` — renders the nested options, expands, selects (FR-026, FR-028)
- [X] T029 [US1] `src/modules/tree/components/TreeCanvas.vue` — `n-tree` with `virtualScroll`, `draggable`, `expandedKeys`, `selectedKeys`, bound to the store's `nestedOptions` (FR-026, FR-028)
- [X] T030 [US1] Wire `allowDrop` in `TreeCanvas.vue` to `homogeneity.canAccept` for both `phase: 'drag'` and `phase: 'drop'`, so a rejected drop shows while the pointer is down (FR-027, R3)
- [X] T031 [US1] Store actions in `src/modules/tree/stores/tree.js` — `add`, `rename`, `remove`, `move`, `reorder`, each calling `treeOps` and committing one history step (FR-006, FR-011); renaming a node touches that node alone (FR-024)
- [X] T032 [P] [US1] Store-action tests in `tests/unit/stores/tree.test.js` — every action commits exactly one undo step and a refused action commits none
- [X] T033 [P] [US1] `src/composables/useConfirm.js` — promise-returning confirmation over `n-dialog`
- [X] T034 [US1] Delete confirmation naming the descendant count, using `removeNode`'s `removedIds` before the change applies (FR-010)
- [X] T035 [US1] `src/modules/tree/components/StructuralFixDialog.vue` — offers the one-step fix carried on `RuleError.fix`: wrap existing consumers in a new sub-panel, or place the consumer under a chosen sub-panel (FR-016, FR-017, SC-002)
- [X] T036 [US1] `src/modules/tree/components/NodeInspector.vue` — name and note of the selected node, editable in place through vee-validate over the node schema (FR-012, FR-029)
- [X] T037 [P] [US1] `src/composables/useKeyboardTree.js` over `useMagicKeys` / `onKeyStroke` — add, rename, delete, move and reorder without a pointer, inert while a text field has focus (FR-030, R9)
- [X] T038 [P] [US1] Keyboard test in `tests/component/keyboardTree.test.js` — the tree built by keystrokes equals the tree built by store calls (US1 scenario 10)
- [X] T039 [US1] Assemble `src/modules/tree/views/TreeEditorView.vue` — canvas, inspector, undo/redo toolbar buttons. Walk V1 in quickstart.md end to end against a stopwatch: a first-time user reaches entry → two panels → six consumers inside five minutes without documentation (SC-001)
- [X] T040 [US1] Depth refusal surfaced in the UI with the current depth named (FR-007)

**Checkpoint**: V1 in [quickstart.md](./quickstart.md) passes end to end in `npm run neu:dev`.

Done 2026-09-10. Two things the task list had not anticipated:

- **The note (FR-012) had no operation at all.** `NodeInspector` needs one, so `setNote` was added
  to the engine and the store. An empty note deletes the field rather than storing `''`, because
  the schema marks it optional and two spellings of "no note" would both end up in saved files.
- **The FR-016 fix could not be composed from existing operations.** Adding the wrapper panel to a
  parent that still holds consumers is refused by the very rule the fix exists to resolve. The
  legal transition now lives in the engine as `wrapChildrenInPanel`, which builds the intermediate
  state inside one `produce` where nothing can observe it, and the store composes it with the add
  the user asked for into a single history step.

---

## Phase 4: User Story 2 — Place end consumers from the catalog (P2)

**Goal**: a consumer is created by picking a type, found by fragment in either language.

**Independent test**: search `холод`, then `fridge`; place the result; rename it; set a quantity of 8.

- [X] T041 [US2] Extend `src/data/catalog.builtin.json` to at least 80 types across all eleven categories from spec.md *Catalog Scope*, each with `id`, `name`, `nameEn`, `categoryId` (FR-019, FR-020)
- [X] T042 [P] [US2] Catalog-coverage test in `tests/unit/catalog/coverage.test.js` — the representative types from the spec's category table resolve at a rate of at least 90%, and every `categoryId` resolves (SC-003)
- [X] T043 [P] [US2] Search test in `tests/unit/catalog/search.test.js` — `холод` and `fridge` both return the fridge row; a one-letter typo still ranks it first (FR-021, SC-004)
- [X] T044 [US2] Build the `fuse.js` index as a `computed` over the loaded catalog in `src/modules/tree/stores/catalog.js`, and a pure `search(index, query, categoryId)` beside it (R8)
- [X] T045 [US2] `src/modules/tree/components/AddConsumerDialog.vue` — search field, category filter, results showing name and category, keyboard-navigable (FR-021, FR-023)
- [X] T046 [US2] Placing a result calls the store's `add` with `typeId` and `typeName`, naming the node after the type (FR-023, FR-034)
- [X] T047 [P] [US2] Quantity field on the consumer in `NodeInspector.vue`, integer ≥ 1 (FR-025)
- [X] T048 [P] [US2] Test in `tests/component/addConsumer.test.js` — placing then renaming leaves the catalog row untouched (US2 scenario 3)

**Checkpoint**: V2 in quickstart passes; US1 still passes untouched.

Done 2026-09-10. 82 types across all eleven categories. Two things the search test caught that the
data alone would not have:

- **`холод` ranked «Винний шаф-холодильник» above «Холодильник»**, because the fridge still carried
  «, 16–20 куб. футів» in its name. That suffix meant something while the type held a power figure
  for that size; with the figures gone it is noise that outweighs the word the user typed. Five
  names carried such leftovers and all were trimmed.
- **The id `fridge-16-20` was renamed to `fridge`.** `contracts/catalog.md` forbids changing an id
  because it orphans saved projects — but `ProjectFileService` is phase 5, so no project has ever
  been saved. This was the last moment the rename was free.

`setQuantity` also had to be added to the engine and the store: `addNode` set `quantity: 1` and
nothing could ever change it, so FR-025 had no implementation behind it.

---

## Phase 5: User Story 3 — Keep the project on disk (P3)

**Goal**: save, reopen, survive a crash, refuse a broken file whole.

**Independent test**: build a tree, save, close, reopen — identical node for node.

- [X] T049 [P] [US3] Test in `tests/unit/services/projectFile.test.js` over `MemoryFs` — a round trip reproduces the tree; a truncated file throws `LoadError` naming the element; nothing reaches the store on failure (FR-035, FR-036, SC-005)
- [X] T050 [US3] `src/services/ProjectFileService.js` — `load`, `save` with the `.tmp` → `move` sequence, `scheduleAutosave` debounced at 400 ms, `findRecovery`, `discardRecovery` (FR-031, FR-033, R2)
- [X] T051 [US3] Structural validation beyond the schema in `ProjectFileService.load` — every `parentId` and `childIds` entry resolves and agrees, exactly one root, no cycle (contracts/project-file.md)
- [X] T052 [US3] Normalize on load and denormalize on save between the file's `nodes` array and the store's map (data-model.md *Runtime shape*)
- [X] T053 [US3] Toolbar actions in `src/modules/tree/views/TreeEditorView.vue` — New, Open, Save, Save As through the adapter's native dialogs, with the dirty marker in the title (FR-001, FR-031)
- [X] T054 [P] [US3] Recovery prompt on open when a newer autosave sidecar exists, offered before anything loads (FR-031, R2)
- [X] T055 [P] [US3] Test that a project naming a type absent from the catalog still renders, from the node's stored `typeName` (FR-034, quickstart V3.2)
- [X] T056 [P] [US3] Emit the JSON Schema form of `ProjectSchema` through `@valibot/to-json-schema` as a build script, so `contracts/project-file.md` and the code cannot drift (R6)

**Checkpoint**: V3 in quickstart passes, including `kill -9` recovery under `npm run neu:dev`.

Done 2026-09-11. 32 new tests across `tests/unit/services/projectFile.test.js`,
`tests/unit/stores/project.test.js`, `tests/component/missingType.test.js` and
`tests/unit/contracts/projectSchema.test.js`. Three things the tests decided that the contract left
open:

- **Which element a structural failure names.** With one pass over the nodes, a dangling
  `parentId` was reported as the *parent's* `nodes[0].childIds[0]` — technically true and useless
  to the person opening the file. The checks now run in four passes (parentId, childIds,
  childrenKind, cycle), so the node whose own field is wrong is the one named.
- **The never-saved sidecar has a fixed name, `unsaved.autosave.json`.** The contract said
  "a generated name"; the fs adapter has no directory listing, so a random name could be written
  and never found again. `contracts/project-file.md` now says so.
- **Declining the recovery offer does not delete the sidecar.** `useConfirm` resolves false for
  Escape and for the mask click too, and dropping unsaved work on an ambiguous gesture is the one
  outcome worth avoiding. The next explicit save clears it.

The dirty marker and the 400 ms autosave are driven by one `watch` on `tree.nodes` in
`stores/project.js` with `flush: 'sync'` — the synchronous flush is what lets `replaceTree` suppress
it, so opening a project does not immediately mark it dirty and write it back.

---

## Phase 6: Polish and cross-cutting concerns

- [X] T057 [P] 500-node fixture at `tests/fixtures/tree-500.eltree.json` and a performance check that expand, collapse and select stay responsive (FR-037, SC-006, quickstart V4)
- [X] T058 [P] Dark and light theme passes over every new component, driven by the `[data-theme]` hook in `src/assets/main.css`
- [X] T059 [P] Empty states — a fresh project with one entry node, and a search with no matches
- [X] T060 Requirement-coverage run — `npm run test:coverage` over `src/modules/tree/engine/` and `src/services/`, confirming every FR with an acceptance scenario has a test that names it, and that no module models a cable route, length, cross-section, conduit or floor-plan position (FR-038)
- [X] T061 Update `README.md` with the run and build commands from quickstart.md

Done 2026-09-11. 25 more tests; the suite is 197 across 19 files, `npx eslint .` and
`npx prettier --check .` clean.

- **The 500-node fixture is generated, not hand-written**: 1 entry + 30 panels (6 floors × 4 rooms
  + the floors themselves) + 469 consumers, ids `n-f3r2`, `n-c041`, so a failure names a place in
  the tree. `tests/unit/performance/tree500.test.js` loads it through the real `ProjectFileService`,
  so the fixture is also a validation case: an illegal fixture fails the suite.
- **Budgets, not benchmarks**: open under 500 ms, `nestedOptions` and a full expand under 100 ms,
  100 selections under 50 ms, a subtree move under 50 ms. They catch an accidental O(n²); they do
  not pretend to measure the machine.
- **`virtualScroll` needed a definite height**, which the new empty state would have taken away.
  `TreeCanvas` now grows the tree only while there is something to scroll
  (`.tree-canvas-tree--grow`), and a project that is only its entry node shows the hint instead.
- **The theme pass is enforced by a scan, not by a screenshot**: no `.vue` style block may carry a
  hex, `rgb()` or `hsl()` value, and every `var(--…)` it reads must be declared in `main.css`.
  Both hold today. The visual pass under `npm run dev` is still a human job.
- **T060 found four requirements no test named** — FR-005, FR-024, FR-029, FR-032. Three already
  had behaviour under test and only needed the id in the title; FR-029 had no test at all, so
  `tests/component/nodeInspector.test.js` is new. `tests/unit/scope/boundaries.test.js` now fails
  if any FR in `spec.md` stops being named anywhere in `tests/`.

Coverage over the modules that carry the rules: engine 96.6% of statements, `schemas/` 95.2%,
`services/` 92.4%. `NeutralinoFs.js` sits at 2.6% and stays there — every line of it is a call into
the platform, which only exists inside `neu run`; `MemoryFs` (97.3%) is what the suite exercises.

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

---

## Phase 7: Convergence

Assessed 2026-09-12 against the code as it stands, not against the checkboxes above. The suite is
223 tests across 21 files, all green; `npx eslint .` and `npx prettier --check .` are clean; coverage
is 97.1% of statements over `modules/tree/engine/`, 95.2% over `schemas/`, 92.4% over `services/`.
Every structural requirement (FR-002 … FR-018), the catalog (FR-019 … FR-025), persistence
(FR-032 … FR-037) and the scope boundary (FR-038) hold in the code. The four items below do not.

- [X] T062 Flush the pending autosave before the window closes per FR-031 (partial) — `flushAutosave()` is defined at `src/services/ProjectFileService.js:355` and re-exported at `:409`, but no line in `src/` calls it, and `src/` registers no window-close or `beforeunload` handler at all. Autosave is debounced at 400 ms (`ProjectFileService.js:291-347`), so a confirmed structural change made inside that window is lost on an unexpected close — which is exactly what FR-031 forbids. Wire a Neutralino window-close event (`src/main.js` or `App.vue`) that awaits `flushAutosave()` before the window goes away, and cover it with a test over `MemoryFs` asserting the sidecar holds the last change when close fires mid-debounce
- [X] T063 Route move-path refusals into `StructuralFixDialog` per SC-002 (partial) — the two add paths already do this: the toolbar via `attempt()` (`src/modules/tree/views/TreeEditorView.vue:171-184`) and the consumer picker via `onPickerRefused` (`:211-219`), both reading `RuleError.fix`. The two move paths discard it: keyboard reparent at `:251` is `onRefused: (error) => message.warning(error.message)`, and drag-and-drop at `:329` is `@refused="message.warning($event.message)"`. A homogeneity block reached by moving therefore ends in a toast with no one-confirmation remedy, so SC-002's "every block is accompanied by an offered structural fix" is false for moves. Also give the drag-phase veto in `TreeCanvas.vue:61-80` a way to name the reason — `allowDrop` is a bare boolean, so today a refused drag only makes the drop indicator vanish
- [X] T065 [P] Component test for the category filter in `src/modules/tree/components/AddConsumerDialog.vue` per FR-021 (partial) — the `n-select` at `:24` composes with the search box and feeds `catalog.find(query, categoryId)`, but only the store-level `search(index, query, categoryId)` is under test (`tests/unit/catalog/search.test.js:32-36`). No test drives the filter through the UI, so a regression in the `n-select` binding would pass the suite

Done 2026-09-13. 22 more tests; the suite is 245 across 27 files, `npx eslint .` and
`npx prettier --check .` clean.

- **The close guard is a factory, not a listener** (`src/services/closeGuard.js`): `windowClose`
  fires inside a real window and nowhere else, so the handler takes `flush` and `exit` as
  arguments and the suite exercises it without one. `exitProcessOnClose` is now `false` in
  `neutralino.config.json` — that is what gives the handler its turn, and it also makes the
  handler the only thing that closes the window, so a flush that throws *or hangs* still ends in
  `exit`; the hang is capped at 2 s.
- **The drag keeps refusing, and the release explains** (T063): `allowDrop` is a boolean with
  nowhere to put a reason, so `TreeCanvas` parks the refusal that carries a fix and hands it over
  on `dragend`. Moving onto a legal target, or leaving the tree, clears it — a fix dialog that
  opened after the user changed their mind would be worse than none.
- **One funnel for every refusal**: `surfaceRefusal` in `TreeEditorView.vue` now serves the
  toolbar, the picker, the keyboard and the released drag. `StructuralFixDialog` learned to
  relocate an existing node (`pending.op === 'move'`) beside creating a new one, backed by the
  store's `wrapConsumersAndMove`, which is two engine calls under one `commit` for the same reason
  `wrapConsumersAndAdd` is.
- **A latent bug found on the way**: the dialog's defaults were set by a non-immediate `watch`, so
  a dialog mounted with a refusal already in hand had no target panel selected and its apply
  button was dead. Mounting it that way is exactly what the new tests do.
- **T065 was green on arrival**, which was the point: the category filter worked, nothing tested
  it through the component. Four tests now hold the `n-select` binding, its intersection with the
  search box, and the return to the whole catalog.

- [X] T066 Ask before closing a dirty project per FR-031 (partial) — T062 made the close flush the pending autosave, but a window with unsaved work still closed without a word, leaving the work only in the sidecar. `tests/unit/services/closeGuard.test.js` already held the intended behaviour and was red: `decideExit` did not exist, and `createCloseHandler` ignored `beforeExit`. Add `decideExit` (clean → close; save / don't save / cancel for a dirty project), let `beforeExit` keep the window open, and wire a three-button prompt into the editor

Done 2026-09-23. The suite is 261 across 27 files, `npx eslint .`, `npx prettier --check .` and
`npm run build` clean. All three buttons checked by hand in the Neutralino window.

- **The decision is registered, not imported** (`setExitDecision` in `src/services/closeGuard.js`):
  the guard is installed in `src/main.js` before the app mounts, while the prompt needs Naive UI's
  dialog provider. `TreeEditorView.vue` registers the decision on setup and unregisters it on
  unmount; with nothing registered the window closes as before.
- **A save that does not land keeps the window open**: backing out of the file dialog resolves
  `null`, a failed write throws — both return false, and the failure is reported in the editor.
- **"Don't save" cancels the queued autosave first** (`discardUnsaved` in `src/stores/project.js`):
  the handler flushes after the decision, and a write still waiting out its 400 ms would put back
  the sidecar that was just removed. The tests did not catch this at first; two tests in
  `tests/unit/stores/project.test.js` now hold it, for a saved project and for one that never had
  a file, and both fail with the cancel removed.
- **Every dismissal other than a button is "cancel"** (`src/composables/useExitPrompt.js`): Escape,
  the mask and the close icon keep the window open, because closing is the step that cannot be
  taken back.

Checked by hand in the Neutralino window on 2026-09-24/25, which turned up six defects in the tree
that the suite did not see. The window on Linux is WebKitGTK 2.52 on Wayland; the suite runs in
happy-dom, where `n-tree`'s virtual list renders no rows, so nothing there clicks or drags a real
row.

- [X] T067 Keep the selection when the selected row is clicked again per FR-026 — `n-tree`'s `cancelable` defaults to `true`, so a second click on the selected row emitted an empty selection and `TreeCanvas.vue` passed it on as `tree.select(null)`, emptying the inspector on the most common gesture there is. Set `:cancelable="false"`
- [X] T068 Stop `n-tree` freezing on a stale row list per FR-028 — with animation on, `n-tree` 2.45.3 swaps its rows for a snapshot while an expand/collapse runs and only the animation's end swaps them back (`naive-ui/es/tree/src/Tree.mjs:461`, `:506`). When the collapsed key is a node that was just deleted, or one with no children, it returns before starting any animation (`:480-482`) and stays frozen. Deleting nested panels until the tree was empty and adding one hid the new panel until the next add. 2.45.3 is the latest release. Set `:animated="false"`
- [X] T069 Make drag-and-drop reach the store per FR-027 — it never worked in the app. `n-tree` calls `allowDrop` with `{ node, dropPosition, phase }` only (naive-ui `AllowDrop`, `es/tree/src/interface.d.ts:55-59`); `judgeDrop` read the dragged node from a `dragNode` that is never passed and refused every position. The tests passed because they supplied that `dragNode` themselves. Take the dragged node from `@dragstart`, and rewrite the drag tests to `n-tree`'s real sequence
- [X] T070 Give the drag a payload so WebKitGTK on Wayland carries it per FR-027 — `n-tree` starts the drag with an empty `dataTransfer`. Chrome carries that; the Neutralino window cancels it right after `dragstart`, and a probe logging DOM events through `debug.log` showed not one `dragenter`, `dragover` or `drop` in between. Call `setData('text/plain', key)` and set `effectAllowed = 'move'` in `onDragStart`
- [X] T071 Land a downward reorder on the row the user chose per FR-006 — `onDrop` computed the index in the sibling list with the dragged node still in it, while `reorderSibling` takes the node out before putting it back (`treeOps.js:254-255`). Moving down, the node landed one row too far: `[A, B, C]`, A dropped after B, gave `[B, C, A]`. Subtract one when the node starts above its target
- [X] T072 Open the panel that receives a move per FR-028 — `add` already expands its target (`expandTo`), `move` did not, so a node dropped into a collapsed panel, or moved there with Alt+→, vanished from view. Call `expandTo(newParentId)` in the store's `move`

Done 2026-09-25. The suite is 267 across 27 files; `npx eslint .` and `npx prettier --check .`
clean. T067 came from a user report and was traced in the `n-tree` source. T068 was reproduced and
then checked fixed in WebKitGTK (the system library, driven from Python through GObject
introspection); T070 in the Neutralino window itself, through the `debug.log` probe; T069, T071
and T072 in headless Chrome through Playwright. Drag, reorder and the row size were then checked
by hand in the Neutralino window.

- **Two of the six are Naive UI's, not ours** (T068, T070), and neither can be fixed by an upgrade.
  Each fix is one prop or two lines, and each carries a comment naming the `n-tree` behaviour it
  works around, so it is not "cleaned up" later.
- **What the drag still does, by design of `n-tree`**: over a row that could take the dragged node
  inside, only an 8 px strip at the top and bottom means "before"/"after" (`eventOffsetY <= 8`),
  and "after" an expanded panel means "first inside it". Left as is.
- **Rows are 36 px with 15 px text** — a requested change, not a defect. It goes through
  `:theme-overrides`, because the virtual list sizes rows by the theme's `nodeHeight`
  (`Tree.mjs:1212`); a CSS-only change would let rows drift as the list scrolls.
