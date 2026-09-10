# Phase 0 Research: Electrical Consumer Tree Editor

**Date**: 2026-09-07 | **Revised**: 2026-09-10 | **Plan**: [plan.md](./plan.md)

Every unknown that the Technical Context could not answer from the user's instruction, resolved with
the API surface actually verified rather than recalled.

---

## R1 — Persistence without a database

**Decision**: One JSON file per project, chosen by the user through a native dialog and written
through `Neutralino.filesystem`. The catalog is bundled with the build and never written.

**Rationale**: The user ruled out a database and named JSON on disk. Nothing else needs a store:
FR-033 puts the whole project in the file the user picks, and FR-022 ships the catalog read-only
inside the build, so there is exactly one writable artefact and no second source of truth.

**Verified API** (`Neutralino.filesystem`):

| Call | Signature | Note |
|------|-----------|------|
| `writeFile` | `(filename, data)` → void | Throws `NE_FS_FILWRER` |
| `readFile` | `(filename, options?)` → String | Throws `NE_FS_FILRDER` |
| `getStats` | `(path)` → `{size, isFile, isDirectory, createdAt, modifiedAt}` | Throws `NE_FS_NOPATHE` when the path does not exist — this is the existence check |
| `move` | `(source, destination)` → void | Throws `NE_FS_MOVEERR` |
| `remove` | `(path)` → void | Throws `NE_FS_REMVERR` |
| `createDirectory` | `(path)` → void | Throws `NE_FS_DIRCRER` |

`Neutralino.os.getPath(name)` accepts `config`, `data`, `cache`, `documents`, `pictures`, `music`,
`video`, `downloads`, `savedGames1`, `savedGames2`. R2's autosave sidecar goes under `data`.

**Alternatives considered**:

- *Dexie / IndexedDB*, the stack skill's default — excluded by the user's instruction. It would also
  have made FR-033 harder, since saving would then be a serialisation step over a store rather than
  the file itself.
- *`Neutralino.storage`* for the project — it is a key/value store in a `.storage` directory inside the
  app folder, not a user-visible file. It cannot satisfy "a file on disk the user picks". Retained for
  UI preferences only.

---

## R2 — Surviving an unexpected close

**Decision**: Debounced autosave to a sidecar file plus atomic replace on explicit save.

- Every mutation marks the project dirty and schedules a write of `<project>.autosave.json`, debounced
  at 400 ms.
- An explicit save writes `<project>.eltree.json.tmp`, then `Neutralino.filesystem.move(tmp, path)`,
  then removes the autosave sidecar. `move` on the same filesystem is the closest thing to an atomic
  replace the API offers, and it means a crash mid-write can never leave a truncated project file.
- On open, if a sidecar exists and its `modifiedAt` from `getStats` is newer than the project file, the
  user is offered the recovered state before anything is loaded.

**Rationale**: FR-031 allows either continuous persistence or explicit save, but forbids losing a
confirmed structural change on an unexpected close. Autosave alone would risk a torn file; atomic
replace alone would lose everything since the last manual save. Both together cost one extra file.

**Alternatives considered**: writing the whole project on every keystroke — rejected, a 500-node tree
serialises to roughly 200–400 KB and a synchronous write per keystroke would be felt. An operation
journal appended per change — rejected as more machinery than a 400 ms debounce buys here.

---

## R3 — Tree widget

**Decision**: Naive UI `n-tree`, with `virtualScroll` enabled.

**Rationale**: It is already in the stack, and its drag-and-drop contract maps onto the spec's hardest
UI requirement without adaptation. Verified from the component's own type definitions:

```ts
export type DropPosition = 'before' | 'inside' | 'after'

export interface TreeDropInfo {
  event: DragEvent
  node: TreeOption        // the drop target
  dragNode: TreeOption    // what is being dragged
  dropPosition: 'before' | 'inside' | 'after'
}

export type AllowDrop = (info: {
  dropPosition: DropPosition
  node: TreeOption
  phase: 'drag' | 'drop'
}) => boolean
```

The `phase: 'drag'` call is what FR-027 needs — "rejected drops indicated before the drop is released".
`allowDrop` is consulted during the drag, so an illegal drop can be shown as illegal while the pointer
is still down, and the same predicate is consulted again at `phase: 'drop'`. One function serves both,
and it is the pure `homogeneity.canAccept` from the engine.

Relevant props confirmed present: `virtualScroll`, `draggable`, `allowDrop`, `expandedKeys`,
`defaultExpandedKeys`, `selectedKeys`, `onDrop`, `onDragstart` (note the lower-case `s`),
`renderLabel`, `renderPrefix`, `renderSuffix`, `keyField`, `childrenField`, `labelField`, `blockLine`,
`showLine`.

Re-verified on 2026-09-08 against the **published** build rather than the repository: in
`naive-ui@2.45.3`, `es/tree/src/interface.d.ts` declares `AllowDrop` with `phase: 'drag' | 'drop'`,
and `es/tree/src/Tree.d.ts` carries `virtualScroll`, `draggable`, `allowDrop`, `expandedKeys`,
`keyField`, `childrenField`, `blockLine` and `renderSuffix`. The API this decision rests on is in the
release, not only on `main`.

**Alternatives considered**: `he-tree-vue` (3.1.2, last released January 2024), `@he-tree/vue`
(2.10.5), `vue-tree-dnd`, `light-vue-tree` — all would add a dependency outside the stack and none
offers a drag-phase veto as clean as `allowDrop`'s `phase` argument, which is exactly the shape
FR-027 asks for.

---

## R4 — Tree representation in memory

**Decision**: Normalized — `nodes: Record<id, Node>` where each node holds `parentId` and `childIds`,
plus a single `rootId`. The nested shape `n-tree` wants is a `computed` derived from it.

**Rationale**: Every structural requirement is cheaper on a flat map. Re-parenting (FR-009) is two
array splices instead of a recursive rebuild. The cycle guard (FR-008) is a walk up `parentId`, which
terminates in depth steps rather than traversing a subtree. The depth guard (FR-007) is the same walk.
At 500 nodes the derived nested array `n-tree` consumes rebuilds in well under a frame.

**Alternatives considered**: keeping the nested structure as the source of truth — rejected, because
move and delete then need recursive find-and-splice, and every rule that asks "what is above this
node" becomes a search.

---

## R5 — Undo and redo

**Decision**: `immer.produce` inside every `treeOps` function, and `useManualRefHistory` from
`@vueuse/core` in the tree store, capped at 100 steps with `clone: false`.

```js
// modules/tree/engine/treeOps.js — pure, plain data in, plain data out
import { produce } from 'immer'

export const moveNode = (nodes, nodeId, newParentId, index) =>
  produce(nodes, draft => {
    const node = draft[nodeId]
    const oldSiblings = draft[node.parentId].childIds
    oldSiblings.splice(oldSiblings.indexOf(nodeId), 1)
    draft[newParentId].childIds.splice(index, 0, nodeId)
    node.parentId = newParentId
  })
```

```js
// modules/tree/stores/tree.js
import { useManualRefHistory } from '@vueuse/core'

const { undo, redo, commit, canUndo, canRedo } = useManualRefHistory(nodes, {
  capacity: 100,   // FR-011
  clone: false,    // safe only because produce froze the result — see below
})
```

**Rationale**: FR-011 covers add, delete, move, reorder and rename — five operations, of which move
and delete are the ones whose inverses are fiddly to get right (a delete must restore a subtree at its
exact former sibling index). Snapshots avoid writing those inverses at all, so the question is only
what a snapshot costs.

The naive answer is a deep clone per step, and the reason to reach for one is not the clone itself but
a failure mode: if a snapshot is a bare reference and any code anywhere writes `nodes[id].name = x`,
that single line rewrites the live state **and all 100 snapshots**, because they are the same objects.
Undo then restores something that was never there. Nothing throws; the bug is silent.

`produce` removes the failure mode instead of paying around it, on two counts:

- **Structural sharing.** The returned map is a new object, but every node the mutation did not touch
  is the same object as before. Renaming one node out of 500 allocates the map wrapper plus that one
  node — not 500 copies.
- **Auto-freeze.** `immer@11.1.18` ships `autoFreeze_ = true`; the result of `produce` is
  `Object.freeze`-d, so the stray write above throws at the point of the write, in the first test that
  executes it.

With the failure mode gone, `clone: false` is correct and the memory arithmetic changes by roughly an
order of magnitude:

| Snapshot strategy | One step | 100 steps |
|---|---|---|
| `structuredClone(nodes)` | all 500 nodes, ≈300 KB | ≈30 MB |
| `produce` + `clone: false` | map of 500 references ≈8–16 KB, plus the 1–3 changed nodes | ≈1–1.5 MB |

`useManualRefHistory` rather than `useRefHistory` because the snapshot must be taken when a structural
change is confirmed, not on every reactive tick — `commit()` is called by the store action, which is
also how instance-value edits stay coalesced while a user types in a field.

Verified: `capacity`, `clone`, `dump`/`parse` and `eventFilter` are all present on
`UseRefHistoryOptions` in `@vueuse/core@14.4.0`; `produce`, `freeze`, `enablePatches`,
`produceWithPatches` and `applyPatches` are all exported by `immer@11.1.18`.

**Alternatives considered**:

- *Inverse-command pattern* — the standard choice, still rejected: 500 nodes bounds the snapshot cost,
  and inverses for delete-with-subtree are the fiddly part. If it is ever wanted, `immer`'s
  `produceWithPatches` hands over inverse patches for free, so the door is not closed.
- *Hand-written `engine/history.js`* — the five functions the earlier draft of this plan specified.
  Deleted; `useManualRefHistory` is the same behaviour, already tested upstream.
- *`pinia-undo`* — 0.2.4, last released December 2023, unmaintained.

---

## R6 — Where valibot earns its place

**Decision**: One schema module, `src/schemas/`, used from two directions — `vee-validate` binds it for
form input, and `ProjectFileService` runs the same schemas over a parsed import.

**Rationale**: FR-036 requires a malformed import to be rejected **in full, naming the failing
element**. Valibot reports issues with a `path` array, which yields a message like
`nodes[42].quantity: expected number, received string` without hand-written traversal. Using the same
schemas for forms means a field the editor accepts is a field the importer accepts, by construction.

The same schemas emit the machine-readable form of `contracts/project-file.md`:
`@valibot/to-json-schema@1.7.1` turns them into JSON Schema, so the documented file format and the
code that enforces it cannot drift apart. It runs as a build script, never at runtime.

**Alternatives considered**: hand-rolled validation — rejected, FR-036's "naming the failing element"
is precisely what a schema library gives for free. Zod (4.5.4) — equivalent in capability; valibot is
what the stack skill already lists.

---

## R7 — Filesystem adapter boundary

**Decision**: `src/services/fs/index.js` exports one interface, implemented twice —
`NeutralinoFs` against the real API, `MemoryFs` against a `Map`. Selection is by the runtime marker
the Neutralino window puts in the page:

```js
const isNeutralino = typeof window !== 'undefined' && Boolean(window.NL_PORT)
```

**Corrected 2026-09-09**: this was `typeof Neutralino !== 'undefined' && window.NL_PORT`, copied from
the stack skill's init guard. That guard belongs to the classic `neutralino.js` client script, which
defines a global `Neutralino`. This project takes the API from the `@neutralinojs/lib` npm package
instead, which exports functions and defines no such global — so the first half was false inside the
real window and every write would have gone to `MemoryFs` with nothing reported. `NL_PORT` itself
arrives from `__neutralino_globals.js`, verified in a running window: `NL_PORT=40671`,
`NL_APPID='ua.eltree.editor'`.

**Rationale**: Three things fall out of one boundary. Tests never touch a real file or need a running
Neutralino process. `npm run dev` works in a plain browser with hot reload, which is the fast loop for
UI work. And the native dialogs — `Neutralino.os.showOpenDialog` and `showSaveDialog`, both of which
accept `defaultPath` — sit behind the same interface, so a component never calls the platform directly.

**Alternatives considered**: mocking the global `Neutralino` object in test setup — works, but leaves
production code calling a global that does not exist in browser dev, which costs the fast loop.

---

## R8 — Catalog search

**Decision**: `fuse.js@7.5.0`, indexing `name`, `nameEn` and the category name.

**Rationale**: FR-021 asks for search by name fragment, and SC-004 puts a 10-second ceiling on finding
a type. The complication is not speed — 80 to 200 types is nothing — it is that the *Interface
language* assumption keeps every type under two names, Ukrainian for the user and English so the
public source figures stay traceable. A user typing `fridge` and a user typing `холод` must both land
on the same entry. `fuse.js` takes both fields as `keys` in one index and tolerates a typo, which a
substring match does not.

**Alternatives considered**: a plain `.includes()` over both fields — enough for the literal wording of
FR-021, but it fails the first typo and cannot rank. `minisearch@7.2.0` — stronger (prefix search,
BM25 ranking), and the better choice for a corpus of documents; at 200 short records the extra
machinery buys nothing. `n-select`'s built-in `filter` — single-field and unranked.

---

## R9 — Autosave debounce and keyboard bindings

**Decision**: `@vueuse/core@14.4.0` for both — `useDebounceFn` for R2's 400 ms autosave,
`useMagicKeys` and `onKeyStroke` for `useKeyboardTree.js`.

**Rationale**: R2 specifies a 400 ms debounce and FR-030 requires every editing action to be reachable
by keyboard. Both are solved problems with sharp edges — a debounce needs cancel-on-unmount, a key
binding needs listener teardown and must not fire while a text field has focus. VueUse handles the
lifecycle through `tryOnScopeDispose`. `n-tree` provides no keyboard path for *editing*, only for
navigation, so the composable is still ours; what VueUse removes is the listener plumbing under it.

Note on imports: `useDebounceFn` and `useThrottleFn` live in `@vueuse/shared`, which `@vueuse/core`
re-exports wholesale (`export * from "@vueuse/shared"` in its `dist/index.js`). Importing them from
`@vueuse/core` is correct; `@vueuse/shared` does not need to be a direct dependency.

---

## R10 — Testing the tree invariants

**Decision**: `fast-check@4.9.0` alongside the example-based Vitest suite, over `treeOps` and
`homogeneity`.

**Rationale**: The engines are pure functions and the requirements they carry are stated as
invariants, which is what property-based testing is for. Three that example tests can only sample:

- No sequence of `moveNode` calls, however long, produces a cycle (FR-008).
- No sequence of `addNode` and `moveNode` leaves a panel holding both a panel child and a consumer
  child (FR-013) — the hard block, and the invariant the whole model rests on.
- `undo` after `redo` returns a map deep-equal to the one before the change (FR-011).

`fast-check` generates the sequences and shrinks a failure to its minimal case, which is the part
worth having: a 40-step counterexample is useless, the 3-step one it reduces to is a test case.

**Alternatives considered**: example tests only — they are still the bulk of the suite and cover the
acceptance scenarios verbatim; they cannot cover "no sequence of moves", which is the claim FR-008
actually makes.

---

## R11 — Where nothing ready-made exists

Recorded so the question is not re-opened during implementation. Checked on 2026-09-08.

- **The catalog data itself** (FR-019, FR-020 — ≥80 types × 3 fields). No npm package carries a list
  of Ukrainian residential appliance names paired with English equivalents and a category;
  `appliance-energy`, `power-consumption`, `energystar` and `electrical-units` all return 404 from the
  registry. It is written once by hand from the category table in the spec.
- **The homogeneity rule** (FR-013 … FR-018). The domain itself.
- **Atomic write** (FR-031). `write-file-atomic`, `fs-extra`, `conf` and `electron-store` are all
  Node-only; the Neutralino frontend is a browser context with no Node API, so Vite cannot bundle an
  import of `node:fs`. R2's `.tmp` → `move` sequence stays hand-written.

---

## Resolved: no NEEDS CLARIFICATION remains

The Technical Context carries no unresolved marker. The three inputs the user gave — the stack skill,
no database, JSON on disk — determined the storage answers, and the rest followed from requirements
already in the spec.

## Sources

- Neutralinojs filesystem API — function signatures and error codes. <https://neutralino.js.org/docs/api/filesystem/>
- Neutralinojs os API — `getPath`, `showOpenDialog`, `showSaveDialog`. <https://neutralino.js.org/docs/api/os/>
- Neutralinojs storage API and the `storageLocation` config option. <https://neutralino.js.org/docs/api/storage/>
- Neutralinojs releases — framework 6.9.0, `@neutralinojs/neu` 11.x. <https://github.com/neutralinojs/neutralinojs/releases>
- Naive UI tree component type definitions — `TreeDropInfo`, `AllowDrop`, `DropPosition`. <https://github.com/tusen-ai/naive-ui/blob/main/src/tree/src/interface.ts>
- Naive UI tree component props. <https://github.com/tusen-ai/naive-ui/blob/main/src/tree/src/Tree.tsx>

Added 2026-09-08, all read from the published packages rather than documentation:

- `naive-ui@2.45.3` — `es/tree/src/interface.d.ts` (`AllowDrop`, `phase`), `es/tree/src/Tree.d.ts` (props).
- `@vueuse/core@14.4.0` — `dist/index.d.ts` (`UseRefHistoryOptions`, `useManualRefHistory`,
  `useMagicKeys`, `onKeyStroke`), `dist/index.js` (`export * from "@vueuse/shared"`).
- `immer@11.1.18` — `dist/immer.mjs` (`autoFreeze_ = true`), `dist/immer.d.ts` (`produce`, `freeze`,
  `enablePatches`, `produceWithPatches`, `applyPatches`).
- `vue-router@5.3.1` — `dist/vue-router.d.ts` (`createWebHashHistory`).
- `peerDependencies` and `engines` for `pinia@4.0.3`, `vue-router@5.3.1`, `vitest@5.0.0`,
  `@vitejs/plugin-vue@6.0.8`, `naive-ui@2.45.3`, `@vee-validate/valibot@4.15.1`.
