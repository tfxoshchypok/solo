# Quickstart: validating Reference Tables and Consumer Fields

**Date**: 2026-09-26, revised 2026-10-03 (copies of the rows on the consumer) | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Manual scenarios Q1–Q5 prove the user stories end to end in the running application. The automated
suite covers the same requirements as plain function and component tests.

## Prerequisites

- Node.js 22.13.0 or newer, `npm install` done.
- The stored tables file is `~/.local/share/ua.eltree.editor/reference-tables.json` on Linux (see
  [contracts/reference-tables-file.md](./contracts/reference-tables-file.md)). For a fresh-install run,
  rename it aside if it exists — do not delete it, it holds your edits.
- The source document `specs/docs/002-spozhyvachi-dovidnyk-tz.md` open for comparison.

## Run

```bash
npm test            # unit + component suites (vitest), no window needed
npm run neu:dev     # the desktop window
```

## Q1 — Reference tables section (User Story 1)

1. Click «Довідники» in the side menu. Two tabs: «Типи навантажень» (33 rows) and «Зони» (8 rows).
2. Compare every cell with §1 and §2 of the source document. Expected: identical, except that there is
   no «Код» column; «Уставка витоку, мА» of «Критична безперервна лінія» is empty.
3. In «Розетки кухні (робоча зона)» set «Кп» to `0,5`. Add a load type row named «Інфрачервоний
   обігрівач». Delete the zone «Лінія гарантованого живлення».
4. Close the application and start it again. Expected: all three changes are there.
5. Refusals — each shows a warning with the reason, and the cell returns to its previous value:
   - clear the name of any row;
   - rename a row to «освітлення загальне» (lower case, same as an existing row);
   - type `abc` into «P, кВт».

## Q2 — A consumer by load type, zone and cable section (User Story 2)

1. «Дерево» → select a panel → «Додати споживача». «Додати» stays disabled until both a load type and a
   zone are chosen. Typing `роз` in the load type list narrows it to the socket rows.
2. Choose «Розетки кухні (робоча зона)» and «Кухня». Expected: the new consumer is named «Розетки кухні
   (робоча зона)». Its properties show two groups: on top «Назва» and «Переріз кабелю, мм²»; below, on
   a tinted block «З довідника · копія», «Тип навантаження» with «P, кВт» 3.5, «Фазність» 1ф, «Хар-ка АВ»
   C, «Тривалий» ні, «cos φ» 0.95, «Кп» 0.4, «Тип ПЗВ» A, then «Зона» with «ПЗВ обов'язкове» так,
   «Уставка витоку, мА» 30, «Мін. IP» IP20 / IP44, «Окреме ПЗВ» ні and its purpose. No quantity, no
   note. Steps 1–2 take under 20 seconds from clicking «Додати споживача» (SC-004).
3. Enter `2,5` in the cross-section → stored as 2.5. Clear it → stays empty. Enter `0`, then `-1`, then
   `abc` → each is refused with a reason.
4. In «Довідники» rename «Розетки кухні (робоча зона)» to «Розетки кухні» and set its «Кп» to `0,5`.
   Back in «Дерево»: the consumer's load type still reads «Розетки кухні (робоча зона)» and «Кп» 0.4;
   its own name has not changed.
5. Open its load type list and choose «Розетки кухні» — the same row. Expected: the load type reads
   «Розетки кухні», «Кп» 0.5, and the consumer is renamed «Розетки кухні», having still been named after
   its load type.
6. On that consumer set «Кп» to `0,6`. Expected: only this consumer shows 0.6; the table row and any
   other consumer of that type keep 0.5. Type `abc` into «P, кВт» → refused with a reason, the value
   returns. «Тип навантаження» and «Зона» have no name field to edit; the names change only by
   choosing a row.
7. Add a consumer of type «Духова шафа», then change its type to «Мікрохвильова піч» → renamed
   «Мікрохвильова піч». Rename it by hand to «НВЧ», change the type again → the name stays «НВЧ».
8. Undo (Ctrl+Z) takes back the last type change and its rename in one step.
9. In «Довідники» delete the row «Мікрохвильова піч». Expected: the consumer still reads «Мікрохвильова
   піч» with its copied values and no mark; no id is shown anywhere.

## Q3 — Saving and reopening (User Story 3)

1. Save the project from Q2 and reopen it. Expected: every consumer's name, load type, zone, copied
   values and cross-section as before — «Кп» 0.6 on the consumer edited by hand, «Мікрохвильова піч»
   for the deleted row — and the empty cross-section still empty. The file's consumers carry exactly
   `id, kind, name, parentId, childIds, loadType, zone, cableSectionMm2`, `loadType` and `zone` being
   whole rows ([contracts/project-file.md](./contracts/project-file.md)).
2. Close the application, rename `reference-tables.json` aside so the shipped tables come back, start it
   and open the same file. Expected: the same values as in step 1, although the local «Розетки кухні
   (робоча зона)» has its shipped name and «Кп» 0.4 again. Put the renamed file back afterwards.

## Q4 — A stored tables file that cannot be used (FR-007)

1. Close the application. In `reference-tables.json` give two zones the same `name`.
2. Start the application. Expected: one error message naming `zones[…].name` and the kept file; both
   tables show their shipped contents; `reference-tables.refused-<timestamp>.json` sits beside where
   the stored file was, holding the broken content.
3. Make any edit. Expected: a new, valid `reference-tables.json` appears; the refused copy is untouched.

## Q5 — Switching sections (FR-008)

1. Make an unsaved change in the tree (the title shows the unsaved mark). Switch to «Довідники» and
   back. Expected: the change and the unsaved mark are still there.
2. With unsaved changes, switch to «Довідники» and close the window. Expected: the same
   save / don't save / cancel prompt as from «Дерево».

## Automated coverage

`npm test` includes, among the rest:

| Area | Test file |
|---|---|
| Shipped rows equal the source document cell by cell (SC-001) | `tests/unit/data/referenceTablesBuiltin.test.js` |
| Cell parsing, row add/update/delete, name uniqueness | `tests/unit/reference/cells.test.js`, `tests/unit/reference/tableOps.test.js` |
| Load stages, refusal and kept copy, serialized writes | `tests/unit/services/referenceTablesFile.test.js` |
| Consumer operations and the rename rule | `tests/unit/engine/treeOps.test.js` |
| Project file round trip of every consumer field | `tests/unit/services/projectFile.test.js` |
| Table editing in the UI | `tests/component/referenceTable.test.js` |
| Adding a consumer, the two inspector groups, editing a copied value, re-choosing a row | `tests/component/addConsumer.test.js`, `tests/component/nodeInspector.test.js` |
| A file whose rows are missing or different locally opens with its own values | `tests/component/missingReference.test.js` |
| Section switching and the exit prompt from «Довідники» | `tests/component/referenceNavigation.test.js` |
| Every requirement of both specs named by a test | `tests/unit/scope/boundaries.test.js` |
