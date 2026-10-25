# Phase 1 Data Model: Panel Properties

**Date**: 2026-10-12 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This document lists what changes against `specs/002-reference-tables-consumer-fields/data-model.md`.
Anything not named here is unchanged: the normalized tree, `childrenKind`, the load types, the zones,
and the consumer's copies and cable cross-section. Field rules are the valibot schemas in
`src/schemas/index.js`.

---

## Reference tables

### Runtime shape

The tables object gains three arrays. `REFERENCE_TABLES` in `src/schemas/index.js` names all five, in
tab order:

```js
{
  loadTypes: [ /* unchanged */ ],
  zones: [ /* unchanged */ ],
  enclosureSizes: [
    { id: 'es-3c1e…', rowModularity: 12, rowCount: 1 },
    // … 16 shipped, 12×1 … 24×4
  ],
  deviceWidths: [
    { id: 'dw-8a20…', name: '1P+N', widthModules: 2 },
    // … 5 shipped
  ],
  incomingDevices: [
    { id: 'iw-51d7…', name: 'Лічильник', width1ph: 6, width3ph: 8 },
    // … 4 shipped
  ],
}
```

### EnclosureSize

This is a row of «Типорозміри корпусів» (source document, Part 1, «Довідники»).

| Field | Type | Rule | Header |
|---|---|---|---|
| `id` | string | `es-` + UUID, set once, never shown | — |
| `rowModularity` | integer or null | ≥ 1 (kind `count`) | Модульність ряду |
| `rowCount` | integer or null | ≥ 1 (kind `count`) | Кількість рядів |

- There is no name column. The capacity is not stored (FR-015).
- Two rows with equal values are allowed (research R8).

### DeviceWidth

This is a row of «Ширина апаратів за полюсністю, модулів».

| Field | Type | Rule | Header |
|---|---|---|---|
| `id` | string | `dw-` + UUID | — |
| `name` | string | 1–120 characters, unique in the table under `nameKey` (kind `name`) | Полюсність |
| `widthModules` | number or null | finite, > 0 (kind `positive`) | Модулів |

### IncomingDeviceWidth

This is a row of «Ширина опційних ввідних апаратів, модулів».

| Field | Type | Rule | Header |
|---|---|---|---|
| `id` | string | `iw-` + UUID | — |
| `name` | string | as `DeviceWidth.name` | Апарат |
| `width1ph` | number or null | finite, > 0 (kind `positive`) | 1ф |
| `width3ph` | number or null | finite, > 0 (kind `positive`) | 3ф |

### Cell rules

The 002 rules hold for all five tables: every key is present, and an empty cell is `null`. In addition:

| Kind | Accepts | Refusal |
|---|---|---|
| `count` | a whole number ≥ 1, or empty | «Тут має бути ціле число, не менше 1.» |
| `positive` | a number > 0, or empty | «Тут має бути число, більше 0.» |

Both kinds parse text through `parseNumberCell`, so `2,5` is read as 2.5 and `abc` is refused as
non-numeric before the range check runs.

---

## Project properties

This is the object `projectProperties` on the entry node. All six keys are always present, and an empty
property is `null` (FR-001, FR-003).

| Field | Type | Rule | Label | Overridable |
|---|---|---|---|---|
| `supplyPhases` | `1` \| `3` \| null | — | Фазність вводу | no |
| `moduleReservePct` | number \| null | finite, ≥ 0 | Резерв модулів, % | yes |
| `separateRcdMode` | `'rcbo'` \| `'mcbRcd'` \| null | — | Виконання окремого ПЗВ | yes |
| `maxLinesPerGroupRcd` | integer \| null | ≥ 1 | Макс. ліній на групове ПЗВ | yes |
| `neutralBreak` | boolean \| null | — | Розрив нейтралі | yes |
| `selectiveFeederRcd` | boolean \| null | — | Селективне ПЗВ на лінії живлення підщитка | yes |

The labels shown for the codes are:
- `1` → 1ф, `3` → 3ф;
- `'rcbo'` → диф, `'mcbRcd'` → автомат + ПЗВ;
- `true` → так, `false` → ні.

`src/modules/tree/config/properties.js` holds this table for the inspector. The schemas hold the rules.

---

## Node — kind `entry`

| Field | Change from feature 002 |
|---|---|
| `projectProperties` | **New**, required. See *Project properties* |
| everything else | Unchanged |

## Node — kind `panel`

| Field | Type | Rule |
|---|---|---|
| `id`, `kind`, `name`, `note?`, `parentId`, `childIds`, `childrenKind` | | Unchanged |
| `overrides` | object | **New**, required. The five overridable keys of *Project properties*, each with that property's rule or `null`. `null` means inherited (FR-004). All `null` on a new panel |
| `incomingDevices` | array of `IncomingDeviceCopy` | **New**, required. Taken when the panel is created: every row of the incoming device widths table, in table order (FR-009). May be empty |
| `buySeparately` | object | **New**, required. `{ neutralBars, peBar, combBusbars, cableGlands, blankingPlates }`, each a boolean, all `false` on a new panel (FR-009) |
| `calculated` | object | **New**, required. `{ enclosure, deviceComposition, accessoryQuantities, groupRcd, phase }`, each `null` (FR-011, FR-012, FR-020) |

### IncomingDeviceCopy

```text
IncomingDeviceWidth (all four keys, id included) + install: boolean
```

- **`install`.** It is the «встановлювати» mark, `false` when the copy is taken (FR-009).
- **`id`.** It records the row the copy came from, and the mark is addressed by it.
- **`name`, `width1ph`, `width3ph`.** They are never edited on the panel and never compared with the
  local table.

### Example

```json
{ "id": "n-9a1", "kind": "panel", "name": "Гараж", "parentId": "n-4f3c",
  "childIds": ["n-77b"], "childrenKind": "consumers",
  "overrides": { "moduleReservePct": 40, "separateRcdMode": null, "maxLinesPerGroupRcd": null,
                 "neutralBreak": null, "selectiveFeederRcd": null },
  "incomingDevices": [
    { "id": "iw-0b3a…", "name": "Реле напруги", "width1ph": 2, "width3ph": 4, "install": true },
    { "id": "iw-6e19…", "name": "ОПН", "width1ph": 2, "width3ph": 4, "install": true },
    { "id": "iw-51d7…", "name": "Лічильник", "width1ph": 6, "width3ph": 8, "install": true },
    { "id": "iw-c240…", "name": "Рубильник", "width1ph": 2, "width3ph": 4, "install": false } ],
  "buySeparately": { "neutralBars": false, "peBar": false, "combBusbars": true,
                     "cableGlands": false, "blankingPlates": true },
  "calculated": { "enclosure": null, "deviceComposition": null, "accessoryQuantities": null,
                  "groupRcd": null, "phase": null } }
```

## Node — kind `consumer`

| Field | Change from feature 002 |
|---|---|
| `calculated` | **New**, required. `{ groupRcd, phase }`, each `null` (FR-012, FR-020) |
| everything else | Unchanged: `id, kind, name, parentId, childIds, loadType, zone, cableSectionMm2` |

---

## Derived value — the property a panel shows

```text
effectiveProperty(nodes, rootId, panelId, key)
  = nodes[panelId].overrides[key] ?? nodes[rootId].projectProperties[key]
inherited(panel, key) = panel.overrides[key] === null
```

The root is always the source, whatever the panel's depth (FR-008). The derived value is never stored.

## Lifecycle of a panel's properties

```text
panel created (add, or a wrap fix)
    ──→ overrides: all null; incomingDevices := rows of the table, each install: false;
        buySeparately: all false; calculated: all null                               (FR-009)
own value set                 ──→ overrides[key] := value                            (FR-006)
own value cleared or «Скинути» ──→ overrides[key] := null                             (FR-006, research R11)
mark set or cleared           ──→ one install / one buySeparately key, this panel only (FR-010)
project property changed      ──→ no panel data changes; inheriting panels show it   (FR-007)
incoming device table edited  ──→ no panel changes                                   (FR-009)
panel moved                   ──→ no property data changes; the line pair shows or hides by the new parent
```

Every transition except the last two is one undo step (FR-021).

## Relationships

```text
Project 1 ── 1 Node(entry)                          (unchanged; the entry holds projectProperties)
Node(panel) * ── 1 Node(entry)                      (inherits by effectiveProperty, any depth)
Node(panel).incomingDevices[] * ── 0..1 IncomingDeviceWidth
                                                    (id → incomingDevices[].id; records where the copy came from)
```
