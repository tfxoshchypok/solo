# Contract: Service, engine, store and component surfaces

**Date**: 2026-10-12 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

This contract covers what feature 003 adds to and changes in
`specs/002-reference-tables-consumer-fields/contracts/services.md`. The layering is unchanged: views
call stores, stores call engines and services, and engines call nothing and return frozen data.

## Schemas — `src/schemas/index.js`

```js
REFERENCE_TABLES          // ['loadTypes', 'zones', 'enclosureSizes', 'deviceWidths', 'incomingDevices']
NAMED_TABLES              // the four with a `name` column — the name check runs on these
CountCell, PositiveCell   // research R7
EnclosureSizeSchema, DeviceWidthSchema, IncomingDeviceWidthSchema
ReferenceTablesSchema     // all five arrays required
PROJECT_PROPERTY_SCHEMAS  // { supplyPhases, moduleReservePct, separateRcdMode, maxLinesPerGroupRcd,
                          //   neutralBreak, selectiveFeederRcd } → nullable valibot schema each
ProjectPropertiesSchema   // v.object over all six
PanelOverridesSchema      // v.object over the five overridable ones
IncomingDeviceCopySchema  // IncomingDeviceWidthSchema + install: v.boolean()
EntryNodeSchema           // + projectProperties
PanelNodeSchema           // + overrides, incomingDevices, buySeparately, calculated
ConsumerNodeSchema        // + calculated: { groupRcd: v.null(), phase: v.null() }
```

## Engines — pure

### `modules/reference/config/columns.js` — changed

- Three entries are added to `columns`, with the headers and kinds of research R7.
- `tableTitles` gains «Типорозміри корпусів», «Ширина за полюсністю» and «Ввідні апарати».
- The kind union becomes `'name' | 'text' | 'number' | 'yesno' | 'count' | 'positive'`.

### `modules/reference/engine/cells.js` — changed

```js
parseCell(kind, input)     // count, positive → parseNumberCell, like number   research R7
formatCell(kind, value)    // count, positive → String(value), null → ''
```

### `modules/reference/engine/tableOps.js` — changed

```js
// new TableRuleError codes: notACount, notPositive
addRow(tables, table, name, newId?)   // name required only when the table has a `name` column;
                                      //   enclosureSizes → a row of nulls   research R8
updateCell(…)                         // checkedValue: count → integer ≥ 1, positive → > 0
rowLabel(table, row)                  // → name, or '<rowModularity> × <rowCount>' for enclosureSizes
// ID_PREFIX gains es, dw, iw
```

### `modules/tree/engine/treeOps.js` — changed

```js
addNode(nodes, { parentId, kind, name, loadType, zone, incomingDevices })
    // panel: incomingDevices (array of rows) required and copied { ...row, install: false };
    //   overrides, buySeparately, calculated created empty
    // consumer: + calculated { groupRcd: null, phase: null }               003/FR-009
wrapChildrenInPanel(nodes, parentId, panelName, incomingDevices)
    // the new panel is built like addNode's                               003/FR-009
```

New `RuleError` code: `incomingDevicesRequired`, raised when a panel is requested without the rows
array.

### `modules/tree/engine/panelProperties.js` — new

Each function returns `produce(nodes, …)`, or throws `RuleError` before changing anything.

```js
effectiveProperty(nodes, rootId, panelId, key)   // → value | null   overrides[key] ?? root's   003/FR-005, 003/FR-008
isInherited(nodes, panelId, key)                 // → boolean        overrides[key] === null
setProjectProperty(nodes, rootId, key, value)    // value parsed; PROJECT_PROPERTY_SCHEMAS[key]   003/FR-002
setPanelOverride(nodes, panelId, key, value)     // null = reset; non-null by the same schema     003/FR-006
setIncomingDeviceMark(nodes, panelId, deviceId, install)                                         003/FR-010
setBuySeparately(nodes, panelId, key, checked)                                                   003/FR-010
```

New `RuleError` codes:
- `unknownProperty`, for a key outside the six;
- `badProjectProperty`, whose message is «<label>: тут має бути <rule>, або порожньо.».

### `modules/tree/config/properties.js` — new

```js
PROJECT_PROPERTIES   // [{ key, label, kind: 'choice'|'number'|'yesno', options?, overridable }] × 6
ACCESSORIES          // [{ key, label }] × 5: neutralBars «N-шини», peBar «PE-шина»,
                     //   combBusbars «Гребінчасті шини», cableGlands «Кабельні вводи», blankingPlates «Заглушки»
CALCULATED_LABELS    // enclosure «Корпус», deviceComposition «Склад апаратів»,
                     //   accessoryQuantities «Кількість комплектуючих», groupRcd «Групове ПЗВ», phase «Фаза»
```

## Services

### `services/ReferenceTablesFileService.js` — changed

- `tablesOf`, the serializer and `checkUnique` iterate `REFERENCE_TABLES`.
- The name check runs on `NAMED_TABLES`.
- Nothing else changes (research R9).

### `services/ProjectFileService.js` — unchanged

`denormalize` already spreads every node (`:50-60`), so the new keys are written with no change.

## Stores

### `modules/tree/stores/tree.js` — changed

```js
add({ parentId, kind, name, loadType, zone })
    // for a panel, passes useReferenceTablesStore().tables.incomingDevices to addNode
wrapConsumersAndAdd(…), wrapConsumersAndMove(…)   // pass the same rows to wrapChildrenInPanel
setProjectProperty(key, value)
setPanelOverride(nodeId, key, value)              // null = reset
setIncomingDeviceMark(nodeId, deviceId, install)
setBuySeparately(nodeId, key, checked)
// createEmptyTree: the entry gains projectProperties, all six null      003/FR-003
```

Each new setter commits one history step through `apply()` (research R13).

### `modules/reference/stores/referenceTables.js` — unchanged

`addRow(table, name)` already hands `name` to `tableOps.addRow`, which ignores it for `enclosureSizes`.

## Components

### `modules/reference/components/CellEditor.vue` — changed

```js
props: { kind: 'name'|'text'|'number'|'yesno'|'count'|'positive'|'choice', value, options?, placeholder?,
         multiline?, dataCell? }
// choice: clearable NSelect over options, emits the chosen value or null on change, as yesno
// count, positive: the number input
// placeholder: shown while the value is empty (research R11)
```

### `modules/reference/components/ReferenceTable.vue` — changed

- The `table` prop accepts any of `REFERENCE_TABLES`.
- The add-row name field is shown only for a table with a `name` column.
- The delete confirmation uses `rowLabel`.

### `modules/reference/views/ReferenceTablesView.vue` — changed

There is one `n-tab-pane` per key of `tableTitles`, which lists all five tables.

### `modules/tree/components/NodeInspector.vue` — changed

**Entry.** After «Назва» and «Нотатка» comes the group `data-project-properties`, captioned «Властивості
проекту». It has six `n-form-item`s, one `CellEditor` each. A commit runs `parseCell`, then
`tree.setProjectProperty`.

**Panel.** After «Назва» and «Нотатка» come four groups:

1. **`data-panel-properties`, «Властивості щитка».** Five `n-form-item`s, `data-property="<key>"`.
   - **Value.** The editor's `value` is `overrides[key]`, and its `placeholder` is the label of the
     project's current value.
   - **Inherited.** An `NTag` «з проекту» (`data-inherited`).
   - **Own value.** A text button «Скинути» (`data-reset`).
   - **Commit.** `tree.setPanelOverride(id, key, parsed)`. An empty commit and «Скинути» both pass
     `null`.
2. **`data-install-marks`, «Встановлювати».** One `NCheckbox` per `incomingDevices` item, labelled with
   its name, `data-device="<id>"`.
3. **`data-buy-marks`, «Купувати окремо».** Five `NCheckbox`es, `data-accessory="<key>"`.
4. **`data-calculated`, «Розрахунок».** Disabled empty `NInput`s for the enclosure, the device
   composition and the accessory quantities. «Групове ПЗВ» and «Фаза» are added when
   `nodes[parentId].kind === 'panel'`.

**Consumer.** After the copy group comes `data-calculated` with «Групове ПЗВ» and «Фаза».

**Refusal.** A `RuleError` or `TableRuleError` shows `message.warning`, and the editor reverts, as it
does today.
