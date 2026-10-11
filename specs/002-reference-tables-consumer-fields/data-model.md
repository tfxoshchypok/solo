# Phase 1 Data Model: Reference Tables and Consumer Fields

**Date**: 2026-09-26, revised 2026-10-03 (the consumer holds a copy of its rows) | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

What changes against `specs/001-electrical-load-tree-editor/data-model.md`. Anything not named here —
the normalized tree, `childrenKind`, the entry and panel nodes — is unchanged. Field rules are the
valibot schemas in `src/schemas/index.js`.

---

## Reference tables

### Runtime shape

The store holds both tables as one deep-frozen object, in display order:

```js
{
  loadTypes: [
    { id: 'lt-6d0f…', name: 'Освітлення загальне', ratedPowerKw: 0.3, phases: '1ф', breakerCurve: 'B',
      continuous: false, powerFactor: 0.95, demandFactor: 0.8, rcdType: 'A' },
    // …
  ],
  zones: [
    { id: 'zn-2b91…', name: 'Критична безперервна лінія', rcdRequired: false, leakageMa: null,
      minIp: 'IP44', separateRcd: true, purpose: 'Дренаж проти затоплення, септики, аерація (без розеток)' },
    // …
  ],
}
```

Two `Map`s, `loadTypeById` and `zoneById`, are `computed` over it; they are how the row the user picks is
found, to be copied onto the consumer (FR-012, FR-014, research R15). On disk the same object gains `schemaVersion` — see
[contracts/reference-tables-file.md](./contracts/reference-tables-file.md).

### LoadType

A row of the load types table (spec, source document §1).

| Field | Type | Rule | Source header |
|---|---|---|---|
| `id` | string | `lt-` + UUID. Set once when the row is created, never changed, never shown (FR-005) | — |
| `name` | string | 1–120 characters, trimmed, unique in the table under `toLocaleLowerCase('uk')` (FR-005) | Назва типу |
| `ratedPowerKw` | number or null | Any finite number | P, кВт |
| `phases` | string or null | Free text, e.g. `1ф або 2ф` | Фазність |
| `breakerCurve` | string or null | Free text, e.g. `C/D` | Хар-ка АВ |
| `continuous` | boolean or null | так → `true`, ні → `false` | Тривалий |
| `powerFactor` | number or null | Any finite number | cos φ |
| `demandFactor` | number or null | Any finite number | Кп |
| `rcdType` | string or null | Free text, e.g. `F` | Тип ПЗВ |

The 120-character limit is the node `Name` limit, because a new consumer is named after its load type
(FR-012) and has to pass `Name` itself.

### Zone

A row of the zones table (spec, source document §2).

| Field | Type | Rule | Source header |
|---|---|---|---|
| `id` | string | `zn-` + UUID, same terms as `LoadType.id` | — |
| `name` | string | Same rule as `LoadType.name` | Назва зони |
| `rcdRequired` | boolean or null | так → `true`, ні → `false` | ПЗВ обов'язкове |
| `leakageMa` | number or null | Any finite number. The source document's "—" ships as `null` | Уставка витоку, мА |
| `minIp` | string or null | Free text, e.g. `IP20 / IP44` | Мін. IP |
| `separateRcd` | boolean or null | так → `true`, ні → `false` | Окреме ПЗВ |
| `purpose` | string or null | Up to 2000 characters | Призначення та нормативні межі |

Text cells other than the name are capped at 2000 characters — the node `Note` limit — so no cell can
grow without bound.

### Cell rules shared by both tables

- Every row always carries every key. An empty cell is `null`: never absent, never `''`.
- Text is stored trimmed; a cell trimmed to `''` becomes `null`.
- Number cells accept `0.95` and `0,95`; anything else is refused with the reason (R8).
- Rows are appended at the end when added. There is no sort column; array order is display order.

### Lifecycle of the stored file

```text
no file ──first accepted edit──→ stored ──each accepted edit──→ stored
stored ──startup, file refused──→ moved to reference-tables.refused-<timestamp>.json; tables = shipped
                                 ──next accepted edit──→ stored (a new, valid file)
```

---

## Project

| Field | Change from feature 001 |
|---|---|
| `schemaVersion` | Unchanged: `1` until test use starts. A reader refuses any other value |
| `catalogVersion` | **Removed.** The catalog it versioned is gone (spec, *Relation to Feature 001*) |
| `name`, `createdAt`, `modifiedAt`, `rootId`, `nodes` | Unchanged |

## Node — kind `consumer`

Replaces the feature 001 table in full.

| Field | Type | Rule |
|---|---|---|
| `id` | string | Unchanged: `n-` + UUID |
| `kind` | `'consumer'` | Unchanged |
| `name` | string | Unchanged: 1–120 characters. Set from the load type's name at creation (FR-012); follows a new load type choice only while it equals `loadType.name` (FR-014) |
| `parentId` | id | Unchanged |
| `childIds` | `[]` | Unchanged: always empty |
| `loadType` | `LoadType` | Required. A copy of the chosen row, `id` included — the `id` is the reference (FR-010). Every key but `id` and `name` editable on this consumer (FR-021) |
| `zone` | `Zone` | Required. The same for the zones table |
| `cableSectionMm2` | number or null | Always present. `null` when empty, otherwise finite and above 0 (FR-011) |

`loadType` and `zone` are validated by `LoadTypeSchema` and `ZoneSchema`, the rules of the rows they
copy (above). Example:

```json
{ "id": "n-77b", "kind": "consumer", "name": "Розетки фартуха кухні", "parentId": "n-9a1", "childIds": [],
  "loadType": { "id": "lt-aeff…", "name": "Розетки кухні (робоча зона)", "ratedPowerKw": 3.5,
                "phases": "1ф", "breakerCurve": "C", "continuous": false, "powerFactor": 0.95,
                "demandFactor": 0.4, "rcdType": "A" },
  "zone": { "id": "zn-85f1…", "name": "Кухня", "rcdRequired": true, "leakageMa": 30,
            "minIp": "IP20 / IP44", "separateRcd": false,
            "purpose": "Робочі поверхні кухонь, зона біля кухонної мийки" },
  "cableSectionMm2": 2.5 }
```

Removed from the consumer: `typeId`, `typeName`, `quantity`, `note`, and — since 2026-10-03 —
`loadTypeId` and `zoneId`, which became `loadType.id` and `zone.id`. The entry and panel nodes keep
`note` (spec, *Relation to Feature 001*, FR-012 row).

`cableSectionMm2` is `v.nullable`, not `v.optional`, so a consumer record always has exactly these
fields besides its place in the tree (SC-006).

---

## Relationships

```text
Project 1 ── * Node                     (unchanged)
Node    1 ── * Node                     (unchanged)
Node(consumer) * ── 0..1 LoadType       (loadType.id → loadTypes[].id; records where the copy came from)
Node(consumer) * ── 0..1 Zone           (zone.id → zones[].id; the same)
```

The consumer never reads its row again after the copy. A row renamed, changed or deleted in its table
leaves every consumer as it was (FR-010, FR-015, SC-007); a file whose ids are in no local row, or in
rows holding other values, opens with its own values (FR-018).

## Lifecycle of a consumer's copy

```text
row chosen (add, or a choice in the inspector — the same row included)
    ──→ loadType / zone := { ...row }; name follows if it equalled the old loadType.name   (FR-012, FR-014)
value edited in the inspector
    ──→ that one key of the copy, this consumer only                                       (FR-021)
table edited in «Довідники»
    ──→ no consumer changes                                                                (FR-010)
```

## Derived values

None. Nothing is computed from the copied values or the cable cross-section (FR-020).
