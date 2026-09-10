# Contract: Internal service and engine signatures

**Date**: 2026-09-10 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

The internal surfaces this feature exposes. There is no HTTP API and no external caller; these are the
boundaries that keep the requirements testable as plain function calls.

Three layers, and the direction of dependency never reverses: views call stores, stores call engines
and services, engines call nothing.

## Engines — pure, no I/O, no Vue, no Pinia

Plain data in, plain data out. `nodes` is always the normalized map from `data-model.md`.

Every function that returns `nodes` returns `produce(nodes, draft => …)` from `immer`, so the argument
is never mutated, unchanged nodes stay the same objects (which is what makes a history snapshot cheap)
and the result is frozen. A caller that tries to patch the returned map in place throws. R5.

### `modules/tree/engine/treeOps.js`

```js
MAX_PANEL_DEPTH                                  // 6 — panels below the entry (FR-007)
class RuleError extends Error                    // { code, message, fix }

addNode(nodes, { parentId, kind, name, typeId }) // → nodes    FR-006, FR-023
removeNode(nodes, nodeId)                        // → { nodes, removedIds }   FR-006
moveNode(nodes, nodeId, newParentId, index)      // → nodes    FR-008, FR-009
reorderSibling(nodes, nodeId, index)             // → nodes    FR-006
renameNode(nodes, nodeId, name)                  // → nodes    FR-006, FR-024

descendantIds(nodes, nodeId)                     // → id[]     the subtree, excluding the node
depthOf(nodes, nodeId)                           // → integer  entry is 0
isDescendantOf(nodes, nodeId, ancestorId)        // → boolean  FR-008
```

`RuleError` is the single refusal channel. `code` is one of `homogeneity`, `cycle`, `depth`,
`typeRequired`; `fix` is the one-step remedy FR-016 and FR-017 require the UI to offer, or `null` when
there is none.

`removeNode` returns `removedIds` rather than a count, because FR-010 needs the number **before** the
deletion applies and the selection needs the ids after.

`addNode` refuses a consumer without a `typeId` (FR-023). Without that guard the map would hold a node
`ConsumerNodeSchema` rejects, and the failure would surface only when the user tried to save.

### `modules/tree/engine/homogeneity.js`

```js
childrenKindAfter(nodes, parentId)          // → 'undecided' | 'panels' | 'consumers'
canAccept(nodes, parentId, childKind)       // → { ok: true } | { ok: false, code, message, fix }
```

`canAccept` is the whole of FR-013 … FR-017 and it is called from two places: `treeOps` before every
add and move, and `n-tree`'s `allowDrop` during the drag, so an illegal drop is shown as illegal while
the pointer is still down (FR-027, R3). One predicate, two call sites, no second implementation.

### Undo and redo — no engine module

`useManualRefHistory` from `@vueuse/core` in `stores/tree.js`, `capacity: 100`, `clone: false`. Safe
without cloning only because `produce` froze the result. R5.

## Services — I/O, no reactive state

### `services/fs/index.js`

One interface, two implementations chosen by `window.NL_PORT`, which the Neutralino runtime supplies
through `__neutralino_globals.js`.

The check is `NL_PORT` alone, not `typeof Neutralino !== 'undefined' && window.NL_PORT`: the API comes
from the `@neutralinojs/lib` npm package, which exports functions and defines no global `Neutralino`,
so the second half would be false inside the real window and every write would go to `MemoryFs`.

```js
readText(path)                   // → string
writeText(path, text)            // → void
exists(path)                     // → boolean          via getStats / NE_FS_NOPATHE
stat(path)                       // → { size, modifiedAt, ... }
move(from, to)                   // → void
remove(path)                     // → void
ensureDir(path)                  // → void
dataDir()                        // → string           the platform data directory
showOpenDialog({ title, filters, defaultPath })  // → string | null
showSaveDialog({ title, filters, defaultPath })  // → string | null
```

Every method wraps a platform failure in `FsError({ code, path, cause })`, the two dialog methods
included — a caller that catches `FsError` must not have a raw Neutralino rejection slip past it.

`MemoryFs` implements all of it over a `Map`, so tests and browser dev never reach the platform.

`dataDir()` is part of the interface for that reason. `os.getPath('data')` is the only platform call
`PathService` needs, and `@neutralinojs/lib` queues a call made before `Neutralino.init()` against a
WebSocket that is never opened outside the window — the promise neither resolves nor rejects. Routing
it through the adapter is what keeps `PathService` testable; `MemoryFs` answers a preset directory
(`new MemoryFs({ dataDir })`).

### `services/PathService.js`

```js
APPLICATION_ID                   // 'ua.eltree.editor'
PROJECT_EXTENSION                // '.eltree.json'

join(...parts)                   // → string
basename(path) / dirname(path)   // → string
appDataDir()                     // → string    dataDir() + applicationId()
autosavePath(projectPath)        // → string    <project>.autosave.json
tmpPath(path)                    // → string    <path>.tmp
projectFileName(name)            // → string    a project name → a safe filename
```

### `services/ProjectFileService.js`

```js
load(path)                       // → { project } | throws LoadError    FR-035, FR-036
save(project, path)              // → void    write .tmp → move → drop autosave    FR-031, FR-033
scheduleAutosave(project, path)  // debounced 400 ms                     R2
findRecovery(path)               // → { sidecarPath, modifiedAt } | null
discardRecovery(path)            // → void
```

`LoadError` carries `{ path: 'nodes[42].quantity', expected, received, message }` — the element name
FR-036 requires. A file that fails validation is rejected whole: nothing is applied to the store.

### `services/CatalogFileService.js`

```js
loadBuiltin()                    // → catalog    bundled import, deeply frozen, never fails at runtime
```

One function. The catalog is read-only (FR-022) and there is no second catalog file, so nothing here
writes. What it returns is frozen with `freeze(…, true)` from immer, the same way the tree store
freezes its node map — a shallow `Object.freeze` would leave `categories` and `types` writable, and
every consumer of this service holds those arrays by reference.

## Stores — reactive state, no I/O

`stores/tree.js` holds `nodes`, `rootId`, `selectedId`, `expandedIds`, the `useManualRefHistory`
handle, and the computed `nestedOptions` for `n-tree`. It calls engines and services; it never touches
the filesystem directly.

`stores/catalog.js` holds the bundled catalog and, as a `computed` over it, the `fuse.js` index over
`name`, `nameEn` and the category name — one query has to match both the Ukrainian and the English
name (R8). Search is a pure function taking that index, so it tests without Pinia.

`stores/project.js` holds `path`, `name`, `isDirty`, `catalogVersion`, `recovery`.

`stores/ui.js` holds theme and sidebar state, persisted through `Neutralino.storage`.

## Views — template and UI logic only

A view calls store actions. No view imports an engine, a service, or the filesystem.
