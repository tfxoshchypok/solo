# Contract: Consumer type catalog

**Date**: 2026-09-10 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

`src/data/catalog.builtin.json`, bundled with the build and imported at build time. It is read at
startup and never written (FR-022). There is exactly one catalog file.

## Shape

```json
{
  "catalogVersion": "2026.09.1",
  "categories": [
    { "id": "kitchen", "name": "Кухня", "nameEn": "Kitchen", "order": 10 },
    { "id": "lighting", "name": "Освітлення", "nameEn": "Lighting", "order": 20 }
  ],
  "types": [
    {
      "id": "fridge",
      "name": "Холодильник",
      "nameEn": "Refrigerator",
      "categoryId": "kitchen"
    },
    {
      "id": "led-downlight",
      "name": "Світлодіодний світильник",
      "nameEn": "LED downlight",
      "categoryId": "lighting"
    }
  ]
}
```

## Field rules

| Field | Rule |
|---|---|
| `catalogVersion` | Non-empty string. A project records the value it was written against (`contracts/project-file.md`) |
| `categories[].id` | Unique within the file; referenced by `types[].categoryId` |
| `categories[].name` | Ukrainian display name, 1–120 characters |
| `categories[].nameEn` | English equivalent, non-empty |
| `categories[].order` | Integer. Display order; ties break on `name` under the `uk` collation |
| `types[].id` | Unique within the file, and **stable across catalog versions** — it is what a saved project stores |
| `types[].name` | Ukrainian display name, 1–120 characters. This is the string copied onto a node as `typeName` |
| `types[].nameEn` | English equivalent, non-empty. Indexed for search alongside `name` (R8) |
| `types[].categoryId` | Must resolve to a `categories[].id` in the same file |

Validation is `CatalogSchema` in `src/schemas/index.js`, and it runs as a test over the shipped file
rather than at runtime: a bundled asset that fails its own schema is a build defect, not a user error.

## Rules

- **At least 80 types**, spread across the eleven categories in the spec's *Catalog Scope* table
  (FR-019). Coverage is what makes the catalog usable, because a consumer cannot be created without a
  type — a missing appliance is a missing capability, not an inconvenience.
- **Ids are permanent.** Renaming a type is fine; changing its id orphans every saved project that
  referenced it. Retire an id instead of reusing it for something else.
- **A newer catalog ships as a new build.** Nothing fetches it, and nothing migrates a project when it
  changes: a project holds `typeId` plus the `typeName` recorded at placement, so a dropped type
  degrades to a node that still reads correctly.
- **No user-created types.** Cloning, editing and deleting catalog entries are not part of this
  feature, so nothing writes to this file or to any other catalog file.

## Search

`stores/catalog.js` builds one `fuse.js@7.5.0` index over `name`, `nameEn` and the category name, as a
`computed` over the loaded catalog. A user typing `fridge` and a user typing `холод` must reach the
same row, which a single-field substring match cannot do (R8, FR-021, SC-004).
