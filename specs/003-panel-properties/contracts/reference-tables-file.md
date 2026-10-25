# Contract: Reference tables file

**Date**: 2026-10-12 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

This file covers only what feature 003 changes in
`specs/002-reference-tables-consumer-fields/contracts/reference-tables-file.md`. The following are
unchanged:
- the two files, the bundled one and `<appDataDir>/reference-tables.json`;
- the serializer;
- the staged load;
- the refusal, which moves the file aside;
- the chained atomic writes.

## Shape

```json
{
  "schemaVersion": 1,
  "loadTypes": [ "…unchanged…" ],
  "zones": [ "…unchanged…" ],
  "enclosureSizes": [
    { "id": "es-3c1e9f20-7d44-4b0a-9e51-2a6c8d0f1b37", "rowModularity": 12, "rowCount": 1 }
  ],
  "deviceWidths": [
    { "id": "dw-8a20c5e1-4f93-4d6b-b2a7-91e0d3c6f548", "name": "1P+N", "widthModules": 2 }
  ],
  "incomingDevices": [
    { "id": "iw-51d7a0b8-2e6c-4a19-8f35-c7b4e9d20a16", "name": "Лічильник", "width1ph": 6, "width3ph": 8 }
  ]
}
```

## Field rules added

| Rule | Applies to |
|---|---|
| `enclosureSizes`, `deviceWidths` and `incomingDevices` are arrays, possibly empty, and all three are required | the file |
| `id` is a non-empty string, unique in its table | every row of the three tables |
| `name` is 1–120 characters, unique in its table under `nameKey` | `deviceWidths`, `incomingDevices` |
| a whole number ≥ 1 or `null` | `rowModularity`, `rowCount` |
| a finite number > 0 or `null` | `widthModules`, `width1ph`, `width3ph` |

Enclosure sizes have no name, so no name check runs on them.

## Load

The stages are the same as in 002. Stage 6 checks id uniqueness in all five tables and name uniqueness
in the four tables that have a name column.

A stored file written by feature 002 lacks `enclosureSizes`. Stage 5 refuses it as a whole with the path
`enclosureSizes`, and the file is moved aside as in 002. The application starts with the five shipped
tables. No merge or migration runs (research R9).
