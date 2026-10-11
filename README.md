# eltree — редактор дерева електричних споживачів

Локальний desktop-редактор, у якому електрик або власник квартири збирає дерево живлення:
ввід → щитки → кінцеві споживачі. Проект лежить одним файлом `.eltree.json` на диску користувача,
працює без мережі й нічого нікуди не надсилає.

Що редактор **не** робить: не рахує навантаження, не підбирає автомати, не моделює траси, довжини,
гофри й розташування на плані поверху. Це редактор структури (FR-038).

Специфікації фіч:

- [`specs/001-electrical-load-tree-editor/`](specs/001-electrical-load-tree-editor/) — дерево,
  збереження й відкриття проекту; сценарії ручної перевірки V1–V4;
- [`specs/002-reference-tables-consumer-fields/`](specs/002-reference-tables-consumer-fields/) —
  довідники типів навантажень і зон, поля споживача; сценарії ручної перевірки Q1–Q5.

У кожній: `spec.md` (вимоги), `plan.md` (стек і структура), `contracts/` (формати файлів і сигнатури
сервісів), `quickstart.md` (сценарії ручної перевірки).

## Стек

NeutralinoJS 6.9 + Vite 8 + Vue 3 (Composition API) + Pinia + Naive UI + valibot + immer.
Node.js **22.13.0** або новіший.

## Встановлення

```bash
npm install
npx neu update          # завантажує бінарники Neutralino у bin/
```

## Запуск

```bash
npm run dev             # тільки Vite, відкривається у браузері
npm run neu:dev         # Vite + нативне вікно
npm run neu:build       # production-збірка і пакування бінарників
```

`npm run dev` працює тому, що адаптер файлової системи падає назад на `MemoryFs`, коли немає
`window.NL_PORT`: у браузері збереження йде в памʼять, діалоги повертають заздалегідь задані шляхи.
Усе, що торкається справжніх файлів — «Зберегти», «Відкрити», відновлення після аварійного
завершення — перевіряється під `npm run neu:dev`.

## Перевірки

```bash
npm test                # Vitest, один прогін
npm run test:watch
npm run test:coverage   # покриття по engine/, services/, schemas/
npx eslint .            # flat config, без .eslintrc
npx prettier --check .
npm run schema:emit     # перегенерувати contracts/project-file.schema.json зі схем valibot
```

Тести під `tests/unit/` не потребують DOM і Neutralino — це швидкий сигнал. `tests/component/`
працюють у happy-dom. `tests/unit/performance/tree500.test.js` ганяє фікстуру на 500 вузлів
(FR-037).

## Структура

```text
src/
  modules/tree/          редактор дерева
    engine/              чисті функції: treeOps.js, homogeneity.js — без Vue і без I/O
    stores/              tree.js (дерево, undo/redo)
    components/          TreeCanvas, NodeInspector, AddConsumerDialog, StructuralFixDialog
    views/TreeEditorView.vue
  modules/reference/     розділ «Довідники»: типи навантажень і зони
    config/columns.js    колонки обох таблиць під заголовками вихідного документа
    engine/              чисті функції: tableOps.js, cells.js (розбір і показ клітинки)
    stores/              referenceTables.js (таблиці, правка, запис на диск)
    components/          ReferenceTable, CellEditor (редактор клітинки, спільний з інспектором)
    views/ReferenceTablesView.vue
  services/              PathService, ProjectFileService, ReferenceTablesFileService, fs/ (адаптер)
  schemas/index.js       valibot: вузли, проект, рядки довідників — одна схема для форм і для файлу
  stores/                project.js (файл, dirty, відновлення), ui.js (тема, сайдбар)
  data/referenceTables.builtin.json   вбудовані довідники: 33 типи навантажень і 8 зон
```

Напрямок залежностей не розвертається: views → stores → engines і services, engines не викликають
нічого. Деталі — у `contracts/services.md`.

## Файл проекту

`.eltree.json` — один файл на проект, формат описано в
[`contracts/project-file.md`](specs/002-reference-tables-consumer-fields/contracts/project-file.md), а
машинна форма схеми лежить поруч у `project-file.schema.json`.

Кінцевий споживач зберігає назву, переріз кабелю `cableSectionMm2` і повні копії вибраних рядків
довідників: `loadType` і `zone`, разом з їхніми `id`. Правка довідника споживачів не змінює, а при
відкритті копії не звіряються з місцевими таблицями, тож проект з іншої установки відкривається зі
своїми значеннями.

Збереження атомарне: спершу пишеться `<path>.tmp`, потім один `move` на місце файлу, тож аварія
посеред запису не залишає обрізаного проекту. Поки редактор відкритий, кожні 400 мс після паузи
пишеться `<path>.autosave.json`; якщо він виявиться новішим за сам файл, при відкритті редактор
запропонує відновити незбережене.
