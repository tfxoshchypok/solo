# Contract: Project file

**Date**: 2026-10-12 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

This file covers only what feature 003 changes in
`specs/002-reference-tables-consumer-fields/contracts/project-file.md`. Everything else there holds,
including:
- the extension `.eltree.json`;
- the atomic save and the autosave sidecar;
- the staged load and the structural checks;
- the consumer's copies.

The machine-readable form is `project-file.schema.json` beside this file. `npm run schema:emit`
generates it from `ProjectSchema` during implementation.

## Shape

```json
{
  "schemaVersion": 1,
  "name": "Котедж, вул. Садова 12",
  "createdAt": "2026-10-12T09:00:00.000Z",
  "modifiedAt": "2026-10-12T09:40:12.000Z",
  "rootId": "n-4f3c",
  "nodes": [
    { "id": "n-4f3c", "kind": "entry", "name": "Ввід", "parentId": null,
      "childIds": ["n-9a1"], "childrenKind": "panels",
      "projectProperties": { "supplyPhases": 3, "moduleReservePct": 20, "separateRcdMode": "rcbo",
                             "maxLinesPerGroupRcd": 4, "neutralBreak": false,
                             "selectiveFeederRcd": true } },
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
                      "groupRcd": null, "phase": null } },
    { "id": "n-77b", "kind": "consumer", "name": "Ворота", "parentId": "n-9a1", "childIds": [],
      "loadType": { "…": "unchanged from feature 002" },
      "zone": { "…": "unchanged from feature 002" },
      "cableSectionMm2": null,
      "calculated": { "groupRcd": null, "phase": null } }
  ]
}
```

## Changes from feature 002

`schemaVersion` stays `1` (research R14).

| Field | Feature 002 | Feature 003 |
|---|---|---|
| entry `projectProperties` | — | Required. Six keys, each `null` or a value of its kind ([data-model](../data-model.md), *Project properties*) |
| panel `overrides` | — | Required. Five keys, each `null` (inherited) or a value of the property's kind |
| panel `incomingDevices` | — | Required array, possibly empty. Each item is `{ id, name, width1ph, width3ph, install }`. The first four keys follow the rules of an incoming device widths row, and `install` is a boolean |
| panel `buySeparately` | — | Required. Five booleans |
| panel `calculated` | — | Required. Five keys, each exactly `null` |
| consumer `calculated` | — | Required. `{ groupRcd, phase }`, each exactly `null` |

A panel's `incomingDevices` copy is validated by its own rules and only by them. It is never compared
with the local incoming device widths table. A file whose copies name devices the local table lacks, or
holds with other widths, is a valid file and opens with its own copies and marks (FR-009, SC-006).

## Load validation

The stages are unchanged: `parseJson` → `checkSchemaVersion` → `checkFields` → `checkStructure`. The new
fields are checked at `checkFields` by `ProjectSchema`, and `checkStructure` gains no rule.
