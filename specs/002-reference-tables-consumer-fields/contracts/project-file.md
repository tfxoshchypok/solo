# Contract: Project file

**Date**: 2026-09-26, revised 2026-10-03 (copies of the rows on the consumer) | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

Feature 001's contract is `specs/001-electrical-load-tree-editor/contracts/project-file.md`. Everything
there holds except what this file changes: the extension `.eltree.json`, the atomic save, the
autosave sidecar, the staged load and the structural checks are all unchanged.

The machine-readable form is `project-file.schema.json` beside this file, generated from
`ProjectSchema` by `npm run schema:emit`.

## Shape

```json
{
  "schemaVersion": 1,
  "name": "Котедж, вул. Садова 12",
  "createdAt": "2026-09-26T09:00:00.000Z",
  "modifiedAt": "2026-09-26T09:40:12.000Z",
  "rootId": "n-4f3c",
  "nodes": [
    { "id": "n-4f3c", "kind": "entry", "name": "Ввід", "parentId": null,
      "childIds": ["n-9a1"], "childrenKind": "panels" },
    { "id": "n-9a1", "kind": "panel", "name": "Кухня", "note": "Щиток за холодильником",
      "parentId": "n-4f3c", "childIds": ["n-77b", "n-77c"], "childrenKind": "consumers" },
    { "id": "n-77b", "kind": "consumer", "name": "Розетки фартуха кухні", "parentId": "n-9a1",
      "childIds": [],
      "loadType": { "id": "lt-aeff…", "name": "Розетки кухні (робоча зона)", "ratedPowerKw": 3.5,
                    "phases": "1ф", "breakerCurve": "C", "continuous": false, "powerFactor": 0.95,
                    "demandFactor": 0.4, "rcdType": "A" },
      "zone": { "id": "zn-85f1…", "name": "Кухня", "rcdRequired": true, "leakageMa": 30,
                "minIp": "IP20 / IP44", "separateRcd": false,
                "purpose": "Робочі поверхні кухонь, зона біля кухонної мийки" },
      "cableSectionMm2": 2.5 },
    { "id": "n-77c", "kind": "consumer", "name": "Духова шафа", "parentId": "n-9a1",
      "childIds": [],
      "loadType": { "id": "lt-df12…", "name": "Духова шафа", "ratedPowerKw": 3, "phases": "1ф",
                    "breakerCurve": "C", "continuous": false, "powerFactor": 1, "demandFactor": 0.7,
                    "rcdType": "A" },
      "zone": { "id": "zn-85f1…", "name": "Кухня", "rcdRequired": true, "leakageMa": 30,
                "minIp": "IP20 / IP44", "separateRcd": false,
                "purpose": "Робочі поверхні кухонь, зона біля кухонної мийки" },
      "cableSectionMm2": null }
  ]
}
```

## Changes from feature 001

`schemaVersion` stays `1`: the application is not in test use yet, so the shape changes without a new
version.

| Field | Feature 001 | Feature 002 |
|---|---|---|
| `catalogVersion` | required string | removed |
| consumer `typeId` | required | removed |
| consumer `typeName` | required | removed |
| consumer `quantity` | integer ≥ 1 | removed |
| consumer `note` | optional | removed; entry and panel keep it |
| consumer `loadType` | — | required; a copy of a load types row, every key of it, `id` included ([data-model](../data-model.md), *LoadType*) |
| consumer `zone` | — | required; a copy of a zones row, likewise (*Zone*) |
| consumer `cableSectionMm2` | — | required key; `null` or a finite number above 0 |

A copy is validated by the rules of the row it copies, and **only** by them: it is not compared with the
local reference tables on load. A file whose `loadType.id` or `zone.id` is in no local row, or in a row
holding other values, is a valid file and opens with its own values (FR-018, FR-015).

## Load validation

Unchanged (`parseJson` → `checkSchemaVersion` → `checkFields` → `checkStructure`).
