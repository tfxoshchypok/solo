# Contract: Project file (`.eltree.json`)

**Date**: 2026-09-10 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

The one artefact this feature writes. The user picks its location through a native save dialog; the
default filename is `<project name>.eltree.json`. It is the whole project: reopening it reproduces the
tree exactly (FR-033, FR-035).

## Shape

```json
{
  "schemaVersion": 1,
  "catalogVersion": "2026.09.1",
  "name": "Квартира на Лесі Українки",
  "createdAt": "2026-09-07T10:14:02.000Z",
  "modifiedAt": "2026-09-10T11:02:41.000Z",
  "rootId": "n-4f3c8a12",
  "nodes": [
    {
      "id": "n-4f3c8a12",
      "kind": "entry",
      "name": "Ввід",
      "parentId": null,
      "childIds": ["n-9a1b77e0"],
      "childrenKind": "panels"
    },
    {
      "id": "n-9a1b77e0",
      "kind": "panel",
      "name": "Кухня",
      "note": "щиток у коридорі",
      "parentId": "n-4f3c8a12",
      "childIds": ["n-77b3c901"],
      "childrenKind": "consumers"
    },
    {
      "id": "n-77b3c901",
      "kind": "consumer",
      "name": "Холодильник",
      "parentId": "n-9a1b77e0",
      "childIds": [],
      "typeId": "fridge",
      "typeName": "Холодильник",
      "quantity": 1
    }
  ]
}
```

`nodes` is a flat **array**, not the object map the store holds: a JSON object keyed by generated ids
diffs badly and reads worse. The store normalizes on load and denormalizes on save; sibling order
lives in `childIds` either way, never in array position.

## Field rules

| Field | Rule |
|---|---|
| `schemaVersion` | Integer, currently `1`. A reader that does not recognise the value refuses the file rather than guessing |
| `catalogVersion` | The bundled catalog's version when the file was written. Recorded, not enforced — a mismatch is not an error |
| `name` | 1–120 characters |
| `createdAt` / `modifiedAt` | ISO 8601. `modifiedAt` is rewritten on every save |
| `rootId` | Must resolve to a node in `nodes` whose `kind` is `entry` |
| `nodes` | Every node. Exactly one has `kind: "entry"` and `parentId: null` |
| `nodes[].note` | Optional on any kind, up to 2000 characters |
| `nodes[].typeName` | Required on a consumer. The type's display name as it was when the node was placed |

Beyond per-field validation, a file is only valid if the tree is: every `parentId` and every entry of
every `childIds` resolves, the two agree with each other, there is exactly one root, and following
`parentId` from any node reaches that root without revisiting a node.

## Load validation (FR-035, FR-036)

`ProjectFileService.load` parses, then runs `ProjectSchema` from `src/schemas/index.js`, then the
structural checks above. A failure at any stage throws `LoadError` and **nothing** is applied to the
store — no half-loaded project, which is what FR-036 requires.

The error names the failing element, because valibot reports an issue path:

```text
nodes[42].quantity: очікується number, отримано string
```

The path is built from the issue's `path` array by `formatIssuePath`, so a new field gets the same
treatment without new code; the sentence around it is Ukrainian because it is shown to the user
verbatim. `LoadError.path` carries the bare path (`nodes[42].quantity`) for anything that needs to
match on it.

The structural failures below are reported the same way, named from the side whose own field is
wrong: a node with a dangling `parentId` is reported as `nodes[3].parentId`, not as the `childIds`
entry of the parent that happens to list it.

Rejected in full, with the failing element named:

- unparseable JSON — `LoadError` with the parser's position;
- an unknown `schemaVersion`;
- any field failing its schema;
- a dangling `parentId` or `childIds` entry;
- a `childrenKind` that contradicts the actual children;
- zero roots, more than one root, or a cycle.

A `typeId` that the current catalog does not carry is **not** a failure. The node keeps rendering from
its stored `typeName` (FR-034).

## Generated JSON Schema

[`project-file.schema.json`](./project-file.schema.json) beside this file is the machine-readable form
of the same rules, emitted from `ProjectSchema` by `npm run schema:emit`
(`scripts/emit-project-schema.mjs`). `tests/unit/contracts/projectSchema.test.js` fails when the
committed file no longer matches the code, so the two cannot drift apart (R6).

## Atomic write (FR-031)

```text
write  <path>.tmp
move   <path>.tmp → <path>        Neutralino.filesystem.move
remove <path>.autosave.json
```

`move` on one filesystem is the closest thing to an atomic replace the platform API offers, so a crash
mid-write can never leave a truncated project file — the previous file stands until the move
completes (R2).

## Autosave sidecar

`<path>.autosave.json` holds the same shape, written debounced at 400 ms after any change. On open, if
a sidecar exists and its `modifiedAt` is newer than the project file, the user is offered the
recovered state **before** anything is loaded. An explicit save removes it.

A project that has never been saved has no path, so its sidecar lives in the application data
directory as `unsaved.autosave.json`, and the first explicit save removes it. The name is fixed
rather than generated on purpose: the filesystem adapter has no directory listing, so a sidecar
under a random name could be written but never found again.
