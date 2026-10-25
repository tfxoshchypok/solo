# 003 — фаза 2: результати тестування та review

**Дата:** 2026-10-12  
**Об’єкт:** поточний робочий стан репозиторію; `tasks.md`, Phase 2, T002–T019.  
**Висновок:** фаза 2 **не готова**. Поточні зміни реалізують підготовчу фазу 1 (T001), а не нові структури даних фази 2. Регресійні перевірки успішні, але не доводять виконання вимог 003.

## Запущені перевірки

| Перевірка | Результат |
|---|---|
| `npm test` (`vitest run`) | **PASS:** 32 файли, 418 тестів; 15,45 с |
| `npx eslint .` | **PASS:** код завершення 0, без повідомлень |
| `npm run build` | **PASS:** код завершення 0; 1,78 с |
| Додаткові прямі перевірки вимог фази 2 через Node.js, `assert` і Valibot | **FAIL:** 0/12 успішних |
| Пошук `rg '003/' tests` | Збігів немає: тести не цитують вимоги фічі 003 |

Build повідомив про chunk понад 500 kB після мінімізації. Це попередження, а не помилка збірки; як новий дефект поточного diff його не атрибутовано.

## Додаткові перевірки фази 2

Перевірки запускались окремо через `node --input-type=module`, з імпортами реальних схем, builders і columns та читанням JSON-файлів. Це діагностичні assertions, **не** повний запланований набір Vitest T004–T012; репозиторні тести не змінювались.

| № | Вимога / завдання | Очікування | Фактичний результат |
|---|---|---|---|
| 1 | T013 | `REFERENCE_TABLES.length === 5` | **FAIL:** 2 |
| 2 | T013 | `NAMED_TABLES.length === 4` | **FAIL:** 2 |
| 3 | T004/T013 | Експорти `EnclosureSizeSchema`, `DeviceWidthSchema`, `IncomingDeviceWidthSchema` | **FAIL:** перевірка зупиняється на відсутньому `EnclosureSizeSchema`; решти експортів також немає при огляді коду |
| 4 | T007/T013 | Старий файл із двома довідниками відхиляється | **FAIL:** `ReferenceTablesSchema` приймає поточний двотабличний builtin |
| 5 | T005/T013 | Entry без `projectProperties` відхиляється | **FAIL:** `EntryNodeSchema` приймає старий entry |
| 6 | T005/T013 | Схема panel зберігає `overrides`, `incomingDevices`, `buySeparately`, `calculated` | **FAIL:** передані нові ключі відсутні у результаті `v.parse`; assertion зупиняється на `overrides` |
| 7 | T005/T013 | Схема consumer зберігає `calculated: { groupRcd: null, phase: null }` | **FAIL:** результат не містить `calculated` |
| 8 | T006/T014 | Builtin містить нові таблиці з 16/5/4 рядками | **FAIL:** assertion зупиняється на відсутньому `enclosureSizes`; усіх трьох масивів немає при огляді файла |
| 9 | T008/T015 | `columns` містить п’ять таблиць | **FAIL:** 2 |
| 10 | T002 | Builders мають helper `incomingDeviceRow` і нові поля вузлів | **FAIL:** helper відсутній; огляд builders підтверджує відсутність нових defaults |
| 11 | T018 | Emitter націлений на контракт у `specs/003-panel-properties/` | **FAIL:** досі шлях до спеки 002 |
| 12 | T019 | Fixture із 500 вузлами має нові обов’язкові поля | **FAIL:** assertion зупиняється на entry без `projectProperties` |

Відтворення двох ключових перевірок із кореня репозиторію:

```bash
node --input-type=module -e "import * as v from 'valibot'; import {EntryNodeSchema} from './src/schemas/index.js'; console.log(v.safeParse(EntryNodeSchema,{id:'r',name:'Ввід',kind:'entry',parentId:null,childIds:[],childrenKind:'undecided'}).success)"
# Фактично: true. За фазою 2 очікується false.

node --input-type=module -e "import * as v from 'valibot'; import {PanelNodeSchema} from './src/schemas/index.js'; console.log(v.parse(PanelNodeSchema,{id:'p',name:'Щиток',kind:'panel',parentId:'r',childIds:[],childrenKind:'undecided',incomingDevices:[]}).incomingDevices)"
# Фактично: undefined — переданий новий ключ відкинуто старою схемою.
```

## Стан завдань фази 2 за оглядом коду

- **T002–T003:** builders залишаються старої форми; міграції тестових literal-вузлів немає у diff.
- **T004–T012:** запланованих змін тестів немає у diff; `tests/unit/reference/columns.test.js` не додано, посилань `003/` немає. Штатний red checkpoint цих тестів ще не проведений.
- **T013:** нових схем і обов’язкових полів немає. Старі схеми приймають старі файли та відкидають передані нові поля; це блокуватиме збереження даних 003, якщо почати використовувати їх до завершення фази.
- **T014:** нові три вбудовані таблиці відсутні.
- **T015:** конфігурація columns містить лише `loadTypes` і `zones`.
- **T016:** `addNode` не приймає `incomingDevices`; panel створюється старої форми, consumer — без `calculated`. Спільного конструктора panel нової форми немає.
- **T017:** `createEmptyTree` створює root без `projectProperties`; інтеграції нових копій у store немає у diff.
- **T018:** emitter залишається прив’язаним до 002; у `specs/003-panel-properties/contracts/` немає `project-file.schema.json`. Генерацію не запускали, щоб не перезаписувати контракт 002.
- **T019:** fixture `tree-500.eltree.json` не мігрований.

У `tasks.md` усі T002–T019 також залишаються непозначеними.

## Межі review і наступні дії

Нових доведених регресій у поточному diff фази 1 не виявлено. Відсутність фази 2 — це **незавершена робота за планом**, а не регресія, внесена рефакторингом T001. Тому inline findings до diff не створено.

Для приймання фази 2 потрібно пройти її заплановані зупинки: outline тестів → T002–T012 і штатний red checkpoint → погодження → T013–T019 → green checkpoint. Додаткові 12 діагностичних перевірок вище не замінюють перевірок копіювання об’єктів, незалежності від довідників, undo, відмови старих файлів у сервісах і повного save/open round trip.

Desktop/Neutralino UI вручну не перевірявся. Код і постійний набір тестів не змінювались; додано лише цей звіт. Повні журнали поточного запуску доступні в `/tmp/solo-003-phase2-{vitest,eslint,build,probes}.log` (тимчасові файли).
