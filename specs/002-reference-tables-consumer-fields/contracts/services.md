# Contract: Service, engine, store and component surfaces

**Date**: 2026-09-26, revised 2026-10-03 (copies of the rows on the consumer) | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

What this feature adds to, changes in, and removes from
`specs/001-electrical-load-tree-editor/contracts/services.md`. The layering is unchanged: views call
stores, stores call engines and services, engines call nothing and return frozen data.

## Engines — pure

### `modules/reference/engine/cells.js` — new

```js
parseNumberCell(text)          // → number | null; throws TableRuleError('notANumber')   002/FR-006, R8
parseTextCell(text)            // → string | null   trimmed; '' → null
formatCell(kind, value)        // → string for display: null → '', true → 'так', false → 'ні'
parseCell(kind, input)         // → value   number → parseNumberCell, text → parseTextCell, else as is
                               //   moved here from stores/referenceTables.js:24-29 (research R16)
```

`kind` is one of `'name' | 'text' | 'number' | 'yesno'`, as `config/columns.js` declares per column.

### `modules/reference/engine/tableOps.js` — new

`tables` is `{ loadTypes, zones }`; `table` is `'loadTypes' | 'zones'`. Every function returns
`produce(tables, …)`, so the result is frozen and the argument untouched.

```js
class TableRuleError extends Error     // { code, message }
  // codes: nameRequired, nameTaken, notANumber, notYesNo, unknownRow, unknownColumn

addRow(tables, table, name, newId?)    // → { tables, rowId }   every other cell null, appended   002/FR-004, 002/FR-005
updateCell(tables, table, rowId, key, value)
                                       // → tables   `value` already parsed; key 'id' → unknownColumn   002/FR-004
deleteRow(tables, table, rowId)        // → tables   002/FR-004
nameKey(name)                          // → string   trim + toLocaleLowerCase('uk'); the uniqueness key
findDuplicateName(rows)                // → index of the first row whose nameKey repeats, or -1
```

`nameKey` and `findDuplicateName` are defined in `src/schemas/index.js` and re-exported here:
`ReferenceTablesFileService` applies them on load, and a service does not import from a module.

`newId` defaults to `` () => `${table === 'loadTypes' ? 'lt' : 'zn'}-${crypto.randomUUID()}` ``; tests
pass their own.

### `modules/tree/engine/treeOps.js` — changed

`loadType` and `zone` below are rows as the reference store holds them; the engine copies them
(`{ ...row }`) and never keeps the caller's object (research R15).

```js
addNode(nodes, { parentId, kind, name, loadType, zone })
                                       // → { nodes, nodeId }   consumer: both rows required and copied,
                                       //   cableSectionMm2: null   002/FR-010, 002/FR-012
setConsumerLoadType(nodes, nodeId, loadType)
                                       // → nodes   replaces the whole copy, hand edits included; renames
                                       //   to loadType.name when node.name === node.loadType.name   002/FR-014
setConsumerZone(nodes, nodeId, zone)   // → nodes   replaces the whole copy   002/FR-014
setConsumerCopyValue(nodes, nodeId, part, key, value)
                                       // → nodes   part: 'loadType' | 'zone'; value already parsed;
                                       //   the copy must still pass LoadTypeSchema / ZoneSchema   002/FR-021
setCableSection(nodes, nodeId, mm2)    // → nodes   mm2: null | finite > 0   002/FR-011
setNote(nodes, nodeId, note)           // → nodes   now refuses a consumer (code noteOnConsumer)
```

New `RuleError` codes: `loadTypeRequired`, `zoneRequired` (a row missing or without an `id`),
`notAConsumer`, `badCableSection`, `noteOnConsumer`, `copyKeyLocked` (`id`, `name`), `unknownColumn`,
`badCopyValue` (message names the column's source-document header). Removed: `setQuantity` and the
codes `typeRequired`, `typeNameRequired`, `quantityOnNonConsumer`, `badQuantity`.

## Services — I/O through the fs adapter

### `services/LoadError.js` — new (moved)

`LoadError` as it is today in `ProjectFileService.js:23-32` — `{ path, expected, received, message,
cause }`. `ProjectFileService` and `ReferenceTablesFileService` both import it from here.

### `services/ReferenceTablesFileService.js` — new

```js
REFERENCE_TABLES_FILE                  // 'reference-tables.json'
REFERENCE_TABLES_VERSION               // 1
loadBuiltin()                          // → frozen tables from src/data/referenceTables.builtin.json
load({ now? })                         // → { tables, source: 'builtin' | 'stored', refusal? }
save(tables)                           // → Promise<void>   serialized, atomic
flush()                                // → Promise<void>   resolves when no write is pending
```

The stages, the refusal path and the file name of the kept copy are
[reference-tables-file.md](./reference-tables-file.md).

### `services/ProjectFileService.js` — changed

- `denormalize` no longer writes `catalogVersion`. It spreads each node (`depthFirst`, `:62-77`), so the
  copies are written with no change here.
- `LoadError` is imported from `services/LoadError.js`.
- The doc comment at `:252-254` says the copies, not ids, are what is not checked against the local
  tables (002/FR-018).
- Nothing else changes; `SCHEMA_VERSION` is imported from the schemas as before.

### `services/closeGuard.js` — changed

```js
flushPendingWrites()   // → Promise.all([ProjectFileService.flushAutosave(), ReferenceTablesFileService.flush()])
```

`installCloseGuard` passes it as `flush`, still under `FLUSH_TIMEOUT_MS`. It is exported so the flush
is testable without a Neutralino window.

### `services/CatalogFileService.js` — removed

## Schemas — `src/schemas/index.js`

```js
SCHEMA_VERSION = 1                                     // unchanged
LoadTypeSchema, ZoneSchema, ReferenceTablesSchema      // new
NodeSchema                                             // consumer: loadType: LoadTypeSchema, zone: ZoneSchema,
                                                       //   cableSectionMm2; note off consumers
ProjectSchema                                          // catalogVersion removed
// removed: ConsumerTypeSchema, CategorySchema, CatalogSchema
```

## Stores

### `modules/reference/stores/referenceTables.js` — new, `useReferenceTablesStore`

```js
tables                 // frozen { loadTypes, zones }
loadTypeById, zoneById // computed Map<id, row>   used to find a row the user picks, never to show a consumer
refusal                // the startup refusal, or null
load()                 // → Promise   calls the service once at startup
addRow(table, name)    // → Promise<rowId>   engine, then service.save
updateCell(table, rowId, key, text | boolean | null)
                       // → Promise<void>    parses by the column's kind, engine, then service.save
deleteRow(table, rowId)  // → Promise<void>
```

`updateCell` parses through `cells.parseCell`. All three are async: a `TableRuleError` arrives as a rejection, before `tables` is assigned, so a
refused edit leaves `tables` unchanged and nothing is written (002/FR-005, 002/FR-006). A failed write
rejects too, after the in-memory edit is in place.

### `modules/tree/stores/tree.js` — changed

```js
add({ parentId, kind, name, loadType, zone })   // rows, copied by addNode; replaces typeId/typeName
setLoadType(nodeId, loadTypeId)   // finds the row in loadTypeById, then setConsumerLoadType(row)
setZone(nodeId, zoneId)           // finds the row in zoneById, then setConsumerZone(row)
setCopyValue(nodeId, part, key, value)   // setConsumerCopyValue; the reference store is not touched
setCableSection(nodeId, mm2)
// removed: setQuantity
```

Each commits one history step through `apply()` (R9).

### `stores/project.js` — changed

`useCatalogStore` and `catalogVersion` are removed from state, `open()`, `snapshot()` and the exports.

### `modules/tree/stores/catalog.js` — removed

## Components

### `modules/reference/views/ReferenceTablesView.vue` — new

Route `/reference`, name `reference`. An `n-tabs` with «Типи навантажень» and «Зони», each a
`ReferenceTable`.

### `modules/reference/components/CellEditor.vue` — new (research R17)

```js
props: { kind: 'name' | 'text' | 'number' | 'yesno', value, multiline?: Boolean, dataCell?: String }
emits: commit(input)        // text / number: the typed text, on blur or Enter (blur only when multiline)
                            // yesno: true | false | null, on change
expose: { revert }          // puts the editor back to `value` after a refusal
```

The `textEditor` and `yesNoEditor` of `ReferenceTable.vue` (`:81-106`) moved into a component. It
parses nothing: the caller parses with `parseCell` and owns the refusal message.

### `modules/reference/components/ReferenceTable.vue` — new

```js
props: { table: 'loadTypes' | 'zones' }
```

Columns from `config/columns.js`, in source-document order, headed by the source document's headers.
No id column. Each cell is a `CellEditor`. A refused edit shows `message.warning` with the
`TableRuleError` message and the cell reverts to its stored value.

### `modules/tree/components/AddConsumerDialog.vue` — rewritten

```js
props:  { show: Boolean, parentId: String }            // unchanged
emits:  placed(nodeId), refused({ error, request }), cancel   // unchanged
expose: { place }                                      // place({ loadTypeId, zoneId })
```

Two `NSelect`s — load type (`filterable`, `:virtual-scroll="false"`) and zone — and a «Додати» button
enabled only when both are chosen. `place()` looks both rows up and builds the request
`{ kind: 'consumer', name: loadType.name, loadType, zone }`; a refused request carries the same rows to
`StructuralFixDialog.vue`, whose `pending` prop doc (`:26`) changes to that shape. The load type list is 41 rows and needs no virtual list; with one, happy-dom
renders no options and `tests/component/addConsumer.test.js` cannot see the filtered rows.

### `modules/tree/components/NodeInspector.vue` — changed

For a consumer, two groups (research R17):

- **Project group** — `n-form`, labels on top: «Назва», «Переріз кабелю, мм²» (`NInput`, parsed by
  `parseNumberCell`, empty → `null`).
- **Reference group** — a block with the `actionColor` background and the caption «З довідника · копія»:
  - «Тип навантаження»: `NSelect` (filterable, `:virtual-scroll="false"`) bound to `COPY` with a
    `fallback-option` labelled `node.loadType.name`; options are the table's rows by current name; any
    choice calls `tree.setLoadType` (research R14).
  - a label | editor grid: one `CellEditor` per `columns.loadTypes` entry except `name`, labelled by
    its `header`, value `node.loadType[key]`; a commit parses with `parseCell` and calls
    `tree.setCopyValue(id, 'loadType', key, value)`.
  - «Зона» and its grid the same over `columns.zones`; `purpose` spans both grid columns, `multiline`.
  - A `RuleError` or `TableRuleError` shows `message.warning` and the editor reverts.

No type name line, no quantity, no note, no «Відсутній у довіднику». Entry and panel keep «Назва» and
«Нотатка».

### `components/AppLayout.vue` — changed

- `menuOptions` gains `{ key: 'reference', label: link('/reference', 'Довідники') }`.
- On mount: `referenceTables.load()`, then `message.error` for a refusal.
- Registers the exit decision moved from `TreeEditorView.vue` (R10).

## Module registration — `modules/reference/index.js`

```js
export const ReferenceModule = {
  install(app, { router }) {
    router.addRoute({ path: '/reference', name: 'reference',
      component: () => import('./views/ReferenceTablesView.vue') })
  },
}
```

Installed in `main.js` after `TreeModule` and before `app.use(router)`, for the reason given at
`main.js:59-61`.
