# Phase 1 Data Model: Electrical Consumer Tree Editor

**Date**: 2026-09-10 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Every entity the spec's *Key Entities* section names, in the shape the code holds it. Field rules are
the valibot schemas in `src/schemas/index.js`; this document is what those schemas encode.

---

## Runtime shape

The tree is **normalized** in memory (R4): a flat map keyed by node id, each node carrying `parentId`
and an ordered `childIds`, plus one `rootId`. The nested array `n-tree` renders is a `computed` over
that map and is never stored.

```js
{
  rootId: 'n-4f3c…',
  nodes: {
    'n-4f3c…': { id: 'n-4f3c…', kind: 'entry',    name: 'Ввід',   parentId: null,      childIds: ['n-9a1…'], childrenKind: 'panels' },
    'n-9a1…':  { id: 'n-9a1…',  kind: 'panel',    name: 'Кухня',  parentId: 'n-4f3c…', childIds: ['n-77b…'], childrenKind: 'consumers' },
    'n-77b…':  { id: 'n-77b…',  kind: 'consumer', name: 'Холодильник', parentId: 'n-9a1…', childIds: [],
                 typeId: 'fridge-16-20', typeName: 'Холодильник', quantity: 1 },
  },
}
```

The map is deeply frozen — `produce` from immer returns it that way, and `stores/tree.js` freezes what
it loads (R5). A write anywhere outside `treeOps` throws at the point of the write.

The file on disk is **denormalized to an array**: `nodes` is a list, because a JSON object keyed by
generated ids diffs badly and reads worse. `contracts/project-file.md` carries that shape.

---

## Entities

### Project

The unit the user saves and reopens. One apartment or house (FR-001).

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | integer | Current value 1. A reader that does not know the value refuses the file (FR-036) |
| `catalogVersion` | string | The bundled catalog's version at the time of writing, so a later reader can tell which vintage the `typeId`s came from |
| `name` | string | 1–120 characters |
| `createdAt` | ISO 8601 string | Set once |
| `modifiedAt` | ISO 8601 string | Rewritten on every save |
| `rootId` | id | Must resolve to the one node of kind `entry` |
| `nodes` | Node[] | Every node of the tree, in no significant order — order among siblings lives in `childIds` |

Not present: a list of custom types. Custom types are not in this feature, so a project references
only the bundled catalog.

### Node

The shared shape, before the per-kind fields (FR-003).

| Field | Type | Rule |
|---|---|---|
| `id` | string | Non-empty. `n-${crypto.randomUUID()}` |
| `kind` | `'entry' \| 'panel' \| 'consumer'` | Immutable after creation |
| `name` | string | 1–120 characters (FR-006) |
| `note` | string | Optional, up to 2000 characters (FR-012) |
| `parentId` | id or null | `null` for the entry node only |
| `childIds` | id[] | Sibling order. Empty for a consumer |

#### Node — kind `entry`

| Field | Type | Rule |
|---|---|---|
| `parentId` | null | Always. Exactly one such node exists and it cannot be deleted (FR-002) |
| `childrenKind` | `'undecided' \| 'panels' \| 'consumers'` | Same homogeneity field a panel carries (FR-014) |

#### Node — kind `panel`

| Field | Type | Rule |
|---|---|---|
| `parentId` | id | Required |
| `childrenKind` | `'undecided' \| 'panels' \| 'consumers'` | The field that enforces FR-013. `undecided` while `childIds` is empty, and it returns there when the last child leaves (FR-018) |

`childrenKind` is stored rather than derived, because an empty panel has to remember nothing — it is
`undecided` and accepts either kind. Derivation would make the same empty panel indistinguishable
from a panel that never had children, which is the same state, so the field is written on every
structural change rather than computed on read.

#### Node — kind `consumer`

| Field | Type | Rule |
|---|---|---|
| `parentId` | id | Required |
| `childIds` | id[] | Always empty — a consumer is a leaf and can never take children (FR-004) |
| `typeId` | id | Required. Every consumer comes from a catalog type (FR-023) |
| `typeName` | string | A copy of that type's display name, taken when the node was created. Keeps the file readable when the type is no longer in the catalog (FR-034) |
| `quantity` | integer ≥ 1 | Identical units on one node, so eight downlights are one node (FR-025) |

`typeName` is a deliberate denormalization and the only one in the model. It is written once, at
placement, and never refreshed: refreshing it would need a comparison against a newer catalog, which
is not part of this feature.

### ConsumerType (catalog entry)

A row of the bundled catalog. Read-only at runtime (FR-022).

| Field | Type | Rule |
|---|---|---|
| `id` | id | Stable across catalog versions — it is what a saved project stores |
| `name` | string | Ukrainian display name |
| `nameEn` | string | English equivalent, so a user typing `fridge` and a user typing `холод` reach the same row (R8) |
| `categoryId` | id | Must resolve to a Category in the same file |

### Category

A grouping used while placing a consumer (FR-021).

| Field | Type | Rule |
|---|---|---|
| `id` | id | Referenced by `ConsumerType.categoryId` |
| `name` | string | Ukrainian display name |
| `nameEn` | string | English equivalent |
| `order` | integer | Display order; ties break on `name` under the `uk` collation |

---

## Relationships

```text
Project 1 ── * Node          (nodes[], one of them is rootId)
Node    1 ── * Node          (parentId / childIds, acyclic, single root)
Node(consumer) * ── 1 ConsumerType   (typeId, resolved against the bundled catalog)
ConsumerType   * ── 1 Category       (categoryId)
```

The `typeId` reference is the only one that can dangle: a project written against an older catalog may
name a type a newer build no longer ships. That is not an error state — `typeName` on the node carries
what the user needs to read, so the tree renders unchanged.

## Derivation order

Nothing in the model is derived except the shape `n-tree` consumes:

1. `nodes` (frozen map) → `nestedOptions` — one pass, rebuilt by reactivity.
2. `childrenKind` is **not** derived; it is written by `treeOps` on every add, move and remove, and
   `homogeneity.childrenKindAfter` computes the value that gets written.

## State transitions

`childrenKind` is the only field with a lifecycle:

```text
undecided ──add panel──────→ panels    ──remove last child──→ undecided
undecided ──add consumer───→ consumers ──remove last child──→ undecided
```

`panels → consumers` and `consumers → panels` have no direct edge. Getting from one to the other means
emptying the node first, which is what makes FR-013 an invariant rather than a check: the illegal
state is unreachable, not merely rejected.
