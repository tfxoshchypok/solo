# Contract: Reference tables file

**Date**: 2026-09-26 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

Two files carry the same shape:

| File | Written by | Read |
|---|---|---|
| `src/data/referenceTables.builtin.json` | Committed with the build; never written at runtime | Imported at build time, deep-frozen |
| `<appDataDir>/reference-tables.json` | `ReferenceTablesFileService.save`, after every accepted edit | At startup, by `ReferenceTablesFileService.load` |

`appDataDir` is `PathService.appDataDir()`: `os.getPath('data')` joined with `ua.eltree.editor`. On
Linux that is `~/.local/share/ua.eltree.editor/reference-tables.json`.

## Shape

```json
{
  "schemaVersion": 1,
  "loadTypes": [
    {
      "id": "lt-6d0f8a52-1c3e-4b7a-9f21-0e5b7c4d2a19",
      "name": "Варильна поверхня",
      "ratedPowerKw": 7.4,
      "phases": "1ф або 2ф",
      "breakerCurve": "C",
      "continuous": false,
      "powerFactor": 0.98,
      "demandFactor": 0.65,
      "rcdType": "A"
    }
  ],
  "zones": [
    {
      "id": "zn-2b91c7e4-5a60-4f3d-8e12-7c9a0b6d4f38",
      "name": "Критична безперервна лінія",
      "rcdRequired": false,
      "leakageMa": null,
      "minIp": "IP44",
      "separateRcd": true,
      "purpose": "Дренаж проти затоплення, септики, аерація (без розеток)"
    }
  ]
}
```

Written with `JSON.stringify(x, null, 2) + '\n'`, the same serializer as a project file.

## Field rules

`data-model.md` holds the per-field table. In short:

| Rule | Applies to |
|---|---|
| `schemaVersion` is exactly `1` | the file |
| `loadTypes` and `zones` are arrays, possibly empty | the file |
| Every key of the row is present; empty is `null` | every row |
| `id` is a non-empty string, unique in its table | every row |
| `name` is 1–120 characters, unique in its table under `trim()` + `toLocaleLowerCase('uk')` | every row |
| number columns hold a finite number or `null` | `ratedPowerKw`, `powerFactor`, `demandFactor`, `leakageMa` |
| yes/no columns hold `true`, `false` or `null` | `continuous`, `rcdRequired`, `separateRcd` |
| other text columns hold a string of at most 2000 characters or `null` | the rest |

Keys the schema does not name are dropped on load, as valibot does for a project file.

## Load

`ReferenceTablesFileService.load()` runs the stages in order and stops at the first failure:

1. The file does not exist → the bundled tables, `{ source: 'builtin' }`. Not a refusal.
2. `readText` fails → refusal, path `''`.
3. `JSON.parse` fails → refusal, path `''`.
4. `schemaVersion !== 1` → refusal, path `schemaVersion`.
5. `v.safeParse(ReferenceTablesSchema)` fails → refusal, path from `formatIssuePath`, e.g.
   `loadTypes[3].powerFactor`.
6. A duplicate id or name → refusal, path of the second occurrence, e.g. `zones[5].name`.

On success: `{ tables, source: 'stored' }`.

On refusal the file is moved — not copied — to
`<appDataDir>/reference-tables.refused-<ISO timestamp, ":" and "." replaced by "-">.json`, and the
result is `{ tables: <bundled>, source: 'builtin', refusal: { error: LoadError, keptAs: <file name> } }`.
Moving frees the stored path, so the next accepted edit writes a clean file and never overwrites the
refused one. `AppLayout.vue` shows the refusal once:

```text
Довідники не прочитались — zones[5].name: назва повторюється. Відкрито початкові таблиці; файл збережено як reference-tables.refused-2026-09-26T10-14-03-221Z.json.
```

## Write

- Every accepted edit calls `save(tables)` with the whole next state.
- `save` ensures `appDataDir` exists, writes `reference-tables.json.tmp`, then moves it onto
  `reference-tables.json`.
- Calls are chained on one promise: a later write never starts before an earlier one finishes, and
  the file on disk always ends as the last state saved.
- `flush()` resolves when the chain is empty; the window-close path awaits it (R4).
- A failed write rejects that call's promise. The store reports it with `message.error` and keeps the
  in-memory state; the next accepted edit rewrites the whole file.
