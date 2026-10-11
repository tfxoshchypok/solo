# Quickstart: Electrical Consumer Tree Editor

**Date**: 2026-09-10 | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/)

How to run the app and how to prove the feature works. Validation scenarios below map to the
acceptance scenarios in [spec.md](./spec.md); details of formats and signatures are in the contracts
rather than repeated here.

## Prerequisites

- Node.js 22.13.0 or newer — the floor is exact, see *Toolchain floor* in the plan
- The Neutralino CLI: `npm i -g @neutralinojs/neu` (or use `npx neu`)

## Setup

```bash
npm install
npx neu update          # fetches the Neutralino 6.9.0 binaries into bin/
```

## Run

```bash
npm run dev             # Vite only, opens in a browser — MemoryFs, fast UI loop
npm run neu:dev         # Vite + native window — real filesystem and native dialogs
npm run neu:build       # production build, then packaged binaries
```

`npm run dev` works because the filesystem adapter falls back to `MemoryFs` when `window.NL_PORT` is
absent. Anything touching a real file must be checked under `npm run neu:dev`.

## Test

```bash
npm test                # Vitest, single run
npm run test:watch
npm run test:coverage
npx eslint .            # flat config; no .eslintrc
```

The engine suites under `tests/unit/` run without a DOM and without Neutralino. They are the fast
signal; component tests are slower and fewer.

---

## Validation scenarios

Each one is runnable by hand in `npm run neu:dev` and is also the shape of the corresponding automated
test. The requirement each proves is named so a failure points somewhere.

### V1 — Build the tree (User Story 1)

1. Create a project. **Expect**: one node, kind *entry*, and no way to delete it or give it a sibling.
   *(FR-002)*
2. Add a panel under it, then two panels under that one. **Expect**: the parent is now a panel-parent
   and offers no consumer. *(FR-013)*
3. Try to add a consumer to a panel that holds panels. **Expect**: refused, with the rule explained and
   the option to place it under a child panel instead. *(FR-015, FR-017)*
4. Try to add a sub-panel to a panel that holds consumers. **Expect**: refused, with the offer to move
   the existing consumers into a new sub-panel in one confirmation. *(FR-016, SC-002)*
5. Drag a 12-node subtree onto an empty panel. **Expect**: the whole subtree moves, every descendant
   relationship intact. *(FR-009)*
6. Drag a panel onto one of its own descendants. **Expect**: the drop is refused **while the pointer is
   still down**, and the tree is unchanged. *(FR-008, FR-027)*
7. Delete a panel with descendants. **Expect**: a confirmation naming how many nodes go. *(FR-010)*
8. Undo it, then redo it. **Expect**: the tree returns to its exact previous state, then forward again.
   *(FR-011)*
9. Remove the last child of a panel. **Expect**: the panel accepts either child kind again. *(FR-018)*
10. Build the same tree using only the keyboard. **Expect**: identical to the pointer-built one.
    *(FR-030)*
11. Nest panels past six levels. **Expect**: refused, with the current depth named. *(FR-007)*

### V2 — Place consumers from the catalog (User Story 2)

1. Start adding a consumer and type `холод`. **Expect**: matching types listed with their category.
   Type `fridge` instead. **Expect**: the same row. *(FR-021, SC-004)*
2. Pick a type and place it under a panel with no panel children. **Expect**: a leaf node named after
   the type, recording `typeId` and `typeName`. *(FR-023)*
3. Rename that node. **Expect**: only the node changes; placing the same type again yields the catalog
   name. *(FR-024)*
4. Set a quantity of 8 on one downlight node. **Expect**: eight units on one node, no siblings created.
   *(FR-025)*
5. Browse by category. **Expect**: at least 80 types across the eleven categories. *(FR-019, SC-003)*

### V3 — Save, reopen, survive (User Story 3)

1. Save the project, change it and save again, close the app, reopen the file. **Expect**: the tree,
   every name, every quantity and every note identical to the second save. *(FR-033, FR-035, SC-005)*
2. Open a file written against an older catalog that named a type this build no longer ships.
   **Expect**: the consumer still reads correctly, from its stored `typeName`. *(FR-034)*
3. Truncate a project file by hand and open it. **Expect**: refused whole, with the failing element
   named; the previously open project is untouched. *(FR-036)*
4. Disconnect the network, then create, place and save. **Expect**: every step completes. *(FR-032)*
5. With unsaved changes in a saved project, wait a second (the copy is written 400 ms after the last
   change), then kill the process (`kill -9`). Relaunch and open the same project. **Expect**: the
   recovered state offered, and accepting it restores the last confirmed structural change with the
   unsaved mark in the title. *(FR-031)*
6. With unsaved changes, close the window and answer «Зберегти». **Expect**: the file saved, the
   window closed, no `.autosave.json` beside the file. Repeat with «Не зберігати». **Expect**: the
   window closes, the change is not in the file, and reopening it offers no recovery. *(FR-031)*
7. Change saved project A, wait a second, then «Відкрити…» → «Продовжити» → pick project B. Open A
   again. **Expect**: no recovery offer, and A's `<path>.autosave.json` is gone. *(SAVE-03)*
8. Create a new project, add a panel with a consumer, wait a second, kill the process. Relaunch.
   **Expect**: exactly one question «Відновити незбережений проект?» with «Відновити» and «Відкинути
   копію»; neither Escape nor a click outside closes it. *(RECOVERY-01)*
9. Answer «Відновити». **Expect**: the tree, the name and every consumer field as before the crash;
   no file name in the title, the unsaved mark shown. Switch to «Довідники» and back: no second
   question. «Зберегти» asks for a path; cancel it, kill the process and relaunch: the question comes
   back. This time save to a path. **Expect**: `~/.local/share/ua.eltree.editor/unsaved.autosave.json`
   is gone. *(RECOVERY-01)*
10. Repeat step 8 and answer «Відкинути копію». **Expect**: an empty project,
    `unsaved.autosave.json` gone, and the next launch asks nothing. *(RECOVERY-01)*
11. Close the app, write `{ broken` into `~/.local/share/ua.eltree.editor/unsaved.autosave.json` and
    start it. **Expect**: no question; one error message naming `unsaved.refused-<timestamp>.json`,
    which sits in the same directory and holds `{ broken`. *(RECOVERY-01)*

Slow or failing disk I/O cannot be staged by hand on a local disk: an edit made while a save is
writing (SAVE-01), a sidecar write still running when the window closes (SAVE-02), a failed sidecar
write, a copy that cannot be read or deleted. Those are covered by `tests/unit/stores/project.test.js`,
`tests/unit/services/projectFile.test.js`, `tests/unit/services/closeGuard.test.js` and
`tests/component/startupRecovery.test.js`, which hold each write at a gate the test opens. The limits
of the guarantee — 400 ms of work on a crash, 2 s for pending writes on close — are in the README.

### V4 — Scale

Load `tests/fixtures/tree-500.eltree.json`. **Expect**: expand, collapse, select and drag with no
perceptible delay. *(FR-037, SC-006)*

---

## Where a failure points

| Symptom | Look at |
|---------|---------|
| A refused action was applied anyway, or vice versa | `engine/homogeneity.js` — `canAccept` feeds the add path and both `allowDrop` phases |
| Drop rejection only shows after release | `allowDrop` not wired for `phase: 'drag'` |
| A consumer was created with no type | the `typeRequired` guard in `engine/treeOps.js` `addNode` |
| A node shows no name after a catalog change | `typeName` was not written at placement, or was refreshed on load |
| Load accepted something broken | the valibot schema in `src/schemas/`, then the structural checks in `contracts/project-file.md` |
| Truncated project file after a crash | the write path skipped `.tmp` and `move` |
| Recovery offered for changes already saved or discarded | which copy is dropped: `leave` and `writeTo` in `stores/project.js`, `dropSidecars` in `ProjectFileService.js` |
| No question at startup after a never-saved project crashed | `checkStartupRecovery` in `stores/project.js`, called from `onMounted` in `components/AppLayout.vue` |
| Undo restores a subtree at the wrong position | `engine/treeOps.js` — `removeNode` must snapshot the sibling index |
| A write outside `treeOps` silently succeeded | the map was not frozen — `produce` or `freeze(…, true)` missing on that path |
