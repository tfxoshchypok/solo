# Quickstart: validating Panel Properties

**Date**: 2026-10-12 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Manual scenarios Q1–Q5 prove the user stories end to end in the running application. The automated
suite covers the same requirements as plain function and component tests.

## Prerequisites

- Node.js 22.13.0 or newer, with `npm install` done.
- The stored tables file. On Linux it is `~/.local/share/ua.eltree.editor/reference-tables.json` (see
  [contracts/reference-tables-file.md](./contracts/reference-tables-file.md)).
  - A file written before this feature is refused once at the first start and kept as
    `reference-tables.refused-<timestamp>.json` (research R9).
  - For a fresh-install run, rename the file aside if it exists.
- The spec's *Reference Table Columns* ([spec.md](./spec.md)) open for comparison.

## Run

```bash
npm test            # unit + component suites (vitest), no window needed
npm run neu:dev     # the desktop window
```

## Q1 — Project properties (User Story 1)

1. Create a new project and select «Ввід». Expected: below «Назва» and «Нотатка» there is a group
   «Властивості проекту» with six empty fields.
2. Set them in this order:

   | Property | Value |
   |---|---|
   | Фазність вводу | 3ф |
   | Резерв модулів, % | `20` |
   | Виконання окремого ПЗВ | диф |
   | Макс. ліній на групове ПЗВ | `4` |
   | Розрив нейтралі | ні |
   | Селективне ПЗВ на лінії живлення підщитка | так |

3. Each of these is refused with a warning naming the rule, and the field returns to its previous value:
   - `-5` in the reserve;
   - `0`, `2,5` and `abc` in the max lines.
4. Add panels «Поверх 1» and «Поверх 2» under «Ввід», and a sub-panel «Гараж» under «Поверх 1». Select
   each one. Expected:
   - five properties, without «Фазність вводу»;
   - each one empty, showing the project's value in grey, and marked «з проекту».
5. Change the project's reserve to `25`. Expected: all three panels show 25. Clear it: all three show an
   empty field marked «з проекту». Ctrl+Z: 25 again. Ctrl+Shift+Z: empty again.

## Q2 — A panel's own value and reset (User Story 2)

1. On «Гараж» type `40` in the reserve. Expected: «Гараж» shows 40 with «Скинути» and no mark. The other
   panels are unchanged.
2. Set the project's reserve to `30`. Expected: «Гараж» still shows 40, and the others show 30.
3. Press «Скинути» on «Гараж». Expected: an empty field, 30 in grey, «з проекту». Ctrl+Z: 40 again, own
   value.
4. On «Поверх 2» type `30`, equal to the project's, then set the project's reserve to `35`. Expected:
   «Поверх 2» still shows 30.
5. On «Поверх 1» set «Розрив нейтралі» to так, then clear that field. Expected: it inherits again, and
   shows ні in grey with «з проекту».

## Q3 — Marks (User Story 3)

1. Select «Поверх 1». Expected:
   - «Встановлювати» lists Реле напруги, ОПН, Лічильник and Рубильник;
   - «Купувати окремо» lists N-шини, PE-шина, Гребінчасті шини, Кабельні вводи and Заглушки;
   - every mark is cleared.
2. Tick Реле напруги, ОПН and Лічильник, then Гребінчасті шини and Заглушки. Expected: «Поверх 2» is
   unchanged. Ctrl+Z clears Заглушки, and Ctrl+Shift+Z sets it again.
3. In «Довідники» → «Ввідні апарати», add «Перемикач мережа-генератор» and delete «Лічильник». Back in
   «Дерево»:
   - «Поверх 1» still lists its four devices, with Лічильник ticked;
   - a new panel lists Реле напруги, ОПН, Рубильник and Перемикач мережа-генератор, all cleared.

## Q4 — The three new tables (User Story 4)

1. On a fresh installation, open «Довідники». Expected: five tabs.
   - «Типорозміри корпусів» has 16 rows, 12×1 … 24×4.
   - «Ширина за полюсністю» has 1P 1, 1P+N 2, 2P 2, 3P 3 and 4P 4.
   - «Ввідні апарати» has the four devices with 2/4, 2/4, 6/8 and 2/4.
   - Every value is as in the spec's *Reference Table Columns*.
2. Delete the four rows with modularity 13, add an enclosure row and fill it with `14` and `2`, and set
   Лічильник's 1ф to `5`. Restart the application. Expected: all the changes are there.
3. Each of these is refused with a warning, and the cell returns:
   - `0` and `1,5` in «Кількість рядів»;
   - `0` in «1ф»;
   - an empty name in «Полюсність»;
   - «2p» in a second row of «Полюсність».
4. «Додати рядок» in «Типорозміри корпусів» asks for no name.

## Q5 — Calculated fields and the file (User Story 5)

1. Build «Ввід» → «Головний» → «Гараж» → «Ворота» (a consumer). Expected:
   - «Головний» shows «Розрахунок» with Корпус, Склад апаратів and Кількість комплектуючих;
   - «Гараж» shows those three plus Групове ПЗВ and Фаза;
   - «Ворота» shows Групове ПЗВ and Фаза;
   - every field is empty and cannot be edited.
2. Save the project from Q1–Q3 and Q5 and reopen it. Expected: every project property, own value,
   inheritance and mark is as before. The file holds `projectProperties` and, per panel, `overrides`,
   `incomingDevices`, `buySeparately` and `calculated`, all null where empty
   ([contracts/project-file.md](./contracts/project-file.md)).
3. Close the application, rename `reference-tables.json` aside so the shipped tables come back, start
   it and open the same file. Expected: «Поверх 1» still lists its four devices, Лічильник ticked, and
   the new panel still lists Перемикач мережа-генератор, although the local table no longer does. Put the
   renamed file back afterwards.

## Automated coverage

`npm test` includes, among the rest:

| Area | Test file |
|---|---|
| Shipped rows of the three tables equal the spec's *Reference Table Columns* (SC-001) | `tests/unit/data/referenceTablesBuiltin.test.js` |
| `count` / `positive` parsing and checks, a row without a name, `rowLabel` | `tests/unit/reference/cells.test.js`, `tests/unit/reference/tableOps.test.js` |
| Five tables loaded, saved and refused; a file without the new tables refused | `tests/unit/services/referenceTablesFile.test.js`, `tests/unit/stores/referenceTables.test.js` |
| Value kinds of the six properties; node schemas with the new keys | `tests/unit/schemas.test.js` |
| Inheritance, own value, reset, marks; refusals | `tests/unit/engine/panelProperties.test.js` (new) |
| A panel's copy taken at creation and by a wrap; untouched by table edits | `tests/unit/engine/treeOps.test.js`, `tests/unit/stores/tree.test.js`, `tests/unit/stores/wrapAndMove.test.js` |
| One undo step per edit (FR-021) | `tests/unit/stores/tree.test.js` |
| File round trip of every new field, empty ones included | `tests/unit/services/projectFile.test.js` |
| Entry and panel groups, «з проекту», «Скинути», marks, calculated fields | `tests/component/panelProperties.test.js` (new), `tests/component/nodeInspector.test.js` |
| Five tabs, the add row without a name, refusals of the new kinds | `tests/component/referenceTable.test.js`, `tests/component/referenceNavigation.test.js` |
| Every requirement of all three specs named by a test | `tests/unit/scope/boundaries.test.js` |
