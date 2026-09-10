# Implementation Plan: Electrical Consumer Tree Editor

**Branch**: `001-electrical-load-tree-editor` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Revised**: 2026-09-08 — dependency versions verified against the registry and pinned to the current
major line; five ready-made libraries replace code this plan previously assigned to hand-written
modules. See `research.md` R5 and R8.

**Revised**: 2026-09-09 — the development-mode wiring corrected against `@neutralinojs/neu` 11.7.2 as
installed. That version's `neu run` has no `--url` option; running against an external dev server is
configured through `cli.frontendLibrary`, which in turn fixes what `url` in `neutralino.config.json`
has to be. See *Development mode* below.

**Revised**: 2026-09-10 — replanned against the clarified scope. The feature is the structure editor
and the project file; the catalog supplies a consumer's name and category and nothing else. Rated
power, the other consumption figures, the line-sharing rules and the project-wide warnings list left
both the specification and the code. Two dependencies lost their only consumer and are removed with
them. See *Removed in the 2026-09-10 replan* below.

**Input**: Feature specification from `/specs/001-electrical-load-tree-editor/spec.md`

## Summary

A local-first desktop application: a NeutralinoJS window hosting a Vue 3 single-page app. The user
builds a tree of service entry → panels → end consumers, picks each consumer from a bundled catalog of
appliance names, and saves the result to a JSON file on disk.

No database, no network, no figures. A project is one JSON file the user picks with a native dialog.
Every structural rule is a pure function over an in-memory normalized tree, which is what makes the 38
requirements testable without a running window.

## Technical Context

**Language/Version**: JavaScript (ES2022), Vue 3.5 Composition API with `<script setup>`. No TypeScript —
the stack skill's scaffold is plain JS, and schema-level type safety comes from valibot at the two
places it matters, form input and file loading.

**Primary Dependencies**: every version below was read from the npm registry on 2026-09-08, not
recalled. The whole set sits on the current major line, which is a single decision: `vue-router` 5
carries `peerDependencies` of `vite: ^7.3.0 || ^8.0.0` and `pinia: ^3.0.4 || ^4.0.2`, so the router,
the bundler and the store library move together or not at all.

| Package | Version | Why |
|---------|---------|-----|
| `neutralinojs` framework | 6.9.0 | Desktop shell, native dialogs, filesystem |
| `@neutralinojs/neu` CLI | 11.7.2 | `neu run`, `neu build` |
| `@neutralinojs/lib` | 6.9.0 | JS client for the Neutralino API; matches the framework version |
| `vite` | 8.2.2 | Dev server, HMR, production build |
| `@vitejs/plugin-vue` | 6.0.8 | SFC compilation; accepts vite `^5 \|\| ^6 \|\| ^7 \|\| ^8` |
| `vue` | 3.5.42 | UI |
| `vue-router` | 5.3.1 | Hash-mode routing; `createWebHashHistory` confirmed present in 5.x |
| `pinia` | 4.0.3 | Stores, setup syntax; peer `vue: ^3.5.11` |
| `naive-ui` | 2.45.3 | `n-tree`, forms, dialogs, theming |
| `@vicons/ionicons5` | 0.13.0 | Icons |
| `@vueuse/core` | 14.4.0 | Undo/redo history, autosave debounce, keyboard bindings — see R5, R8 |
| `immer` | 11.1.18 | Structural sharing and auto-freeze for the normalized node map — see R5 |
| `valibot` | 1.4.2 | One schema library for both form validation and file validation |
| `vee-validate` | 4.15.1 | Form binding around valibot schemas |
| `@vee-validate/valibot` | 4.15.1 | The bridge between the two; peer `valibot: ^1.0.0-beta.7` |
| `fuse.js` | 7.5.0 | Catalog search across the Ukrainian and English name — see R8 |
| `vitest` | 5.0.0 | Unit and component tests |
| `@vitest/coverage-v8` | 5.0.0 | Requirement coverage over the engines |
| `@vue/test-utils` | 2.5.0 | Component tests |
| `happy-dom` | 20.14.0 | DOM for component tests; vitest 5 declares it a peer |
| `fast-check` | 4.9.0 | Property-based tests for the tree invariants — see R10 |
| `@valibot/to-json-schema` | 1.7.1 | Emits the machine-readable form of `contracts/project-file.md` |
| `eslint` | 10.10.0 | Linting; flat config only — `.eslintrc.*` was removed in 9 |
| `@eslint/js` | 10.0.1 | Base rule set for the flat config |
| `eslint-plugin-vue` | 10.11.0 | SFC rules |
| `prettier` | 3.9.6 | Formatting |
| `eslint-config-prettier` | 10.1.8 | Turns off the rules Prettier owns |

**Toolchain floor**: Node **22.13.0**, and the exact patch matters. The constraints do not agree at
22.12:

| Package | `engines.node` | 22.12.0 |
|---|---|---|
| `vitest` 5.0.0 | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | ✅ |
| `@vitejs/plugin-vue` 6.0.8 | `^20.19.0 \|\| >=22.12.0` | ✅ |
| `naive-ui` 2.45.3 | `>=20` | ✅ |
| `eslint` 10.10.0 | `^20.19.0 \|\| ^22.13.0 \|\| >=24` | ❌ |

22.13.0 is the lowest version that satisfies all four; anything in 24.x or later also does.

### Removed in the 2026-09-10 replan

Two dependencies were pinned for capabilities the feature no longer has, and both are uninstalled:

- **`microdiff` 1.6.0** — per-field comparison between a project's stored figures and a newer bundled
  catalog. Nothing is copied from a type onto a node any more, so there is nothing to compare.
- **`convert` 8.0.1** — parsing `2.5 kW` into `2500 W` and formatting watts back for display. No
  figure is entered or displayed anywhere in the product.

`fuse.js` stays: FR-021 requires finding a type by name fragment across 80 types, in Ukrainian and
English.

Also deliberately **not** used, unchanged from the earlier revision:

- *Dexie and IndexedDB*, which the stack skill includes by default. The user specified no database and
  a JSON file on disk.
- *`nanoid` / `uuid`* — `crypto.randomUUID()` exists in the Chromium runtime Neutralino ships and in
  Node 22 for the test suite.
- *`es-toolkit` / `lodash-es`* — `@vueuse/core` plus native array and object methods cover every use.
- *`write-file-atomic`, `fs-extra`, `conf`, `electron-store`* — all Node-only. The Neutralino frontend
  is a browser context with no Node API, so Vite cannot bundle an import of `node:fs`. The
  `.tmp` → `Neutralino.filesystem.move` sequence in R2 stays hand-written for that reason.
- *`he-tree-vue` and `@he-tree/vue`* — `n-tree` already provides the drag-phase veto FR-027 needs,
  verified in the shipped 2.45.3 build (R3).
- *`pinia-undo`* — unmaintained, and `useManualRefHistory` does the same job (R5).

**Storage**: Plain JSON files through `Neutralino.filesystem`.

- Project — a file the user chooses, default name `<project>.eltree.json`. Holds the schema version,
  the catalog version, the project metadata and the whole tree (FR-033).
- Built-in catalog — bundled JSON, imported at build time, read-only at runtime (FR-022).
- UI preferences (theme, last opened path) — `Neutralino.storage`, not a project concern.

There is no second catalog file. Custom types left the scope, so `catalog.custom.json` and everything
that read or wrote it are gone.

**Development mode**: `neu run` in `@neutralinojs/neu` 11.7.2 accepts no `--url` option. Running the
window against the Vite dev server is configured entirely in `neutralino.config.json`:

```jsonc
"cli": {
  "frontendLibrary": {
    "devCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "projectPath": "./",
    "patchFile": "/index.html",
    "waitTimeout": 30000
  }
}
```

`neu run` then starts Vite itself, waits for port 5173, passes `--url` to the binary, and rewrites the
`__neutralino_globals.js` tag in `index.html` to point at its own randomly chosen port, reverting the
file when it exits. Three consequences the rest of this plan rests on:

- `npm run neu:dev` is `neu run` and nothing else.
- `index.html` must carry `<script src="/__neutralino_globals.js"></script>`. Without it the CLI has no
  tag to patch, `window.NL_PORT` never exists, and the adapter selects `MemoryFs` inside the real
  window — every save would land in memory with no error anywhere.
- `url` stays `/`. `neu build` ignores `frontendLibrary` and reads `url` from the config, so a dev
  address left there would make the packaged app load localhost and fail offline (FR-032).

**Testing**: Vitest. The tree operations and the homogeneity rule are pure functions and carry the bulk
of the suite; components are tested with `@vue/test-utils`; the filesystem is behind an adapter with an
in-memory implementation, so no test touches a real file or a real Neutralino runtime.

**Target Platform**: Desktop — Linux, Windows, macOS, through Neutralino. The same build runs in a
plain browser during development, because the filesystem adapter falls back to its in-memory
implementation when `window.NL_PORT` is absent.

**Project Type**: Single desktop application. Not a client/server split; there is no backend.

**Performance Goals**: A 500-node project stays navigable — expand, collapse, select and drag with no
perceptible delay (FR-037, SC-006). `n-tree` has `virtualScroll`, which covers the render side.

**Constraints**: Fully offline (FR-032) — no network call at any point, including a catalog refresh,
which arrives as a new bundled version. A confirmed structural change must survive an unexpected close
(FR-031).

**Scale/Scope**: One user, one project open at a time. 500 nodes, a built-in catalog of at least 80
types, 38 functional requirements, 3 user stories.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Pre-Phase-0 | Post-Phase-1 | Evidence |
|-----------|------|-------------|--------------|----------|
| I. Specify Only What Was Asked (NON-NEGOTIABLE) | No user-facing capability appears in the plan that FR-001 … FR-038 does not already require | ✅ PASS | ✅ PASS | Nothing in this plan renders a figure, evaluates a rule or reports a warning. The catalog supplies a name and a category, which is what FR-020 defines it as carrying |
| I — *Removal leaves no residue* clause | Nothing deleted from the spec survives here as a `MUST NOT`, a note, or a parenthetical | ✅ PASS | ✅ PASS | *Removed in the 2026-09-10 replan* records two uninstalled dependencies, which is a technical fact about `package.json`, not a product capability described in its absence |
| I — *Compliance check* clause | The specification's quality checklist records that the traceability check was performed | ✅ PASS | ✅ PASS | `checklists/requirements.md`, section *Constitution Compliance*, two items |
| *Complexity Tracking* | A violation, if any, is justified in the table below | ✅ PASS — none | ✅ PASS — none | *Complexity Tracking* is empty by consequence, not by omission |

The constitution's *Scope* paragraph puts Principle I in force "from `/speckit-specify` until
`/speckit-plan` runs for the first time on that feature." That first run happened on 2026-09-07, so the
principle has lapsed and technical decisions are unrestricted. It is checked here anyway on the one
clause that still binds by its own terms — the *Compliance check* on the spec's checklist — and on the
product half of the gate, because a replan is exactly where a capability the user cut could creep back
in under a technical name.

**Post-Phase-1 re-check**: passed. `data-model.md` adds no entity the spec's *Key Entities* section
does not name. `contracts/` describes the file format and the service signatures, which are
implementation surfaces. `quickstart.md` validates existing acceptance scenarios and adds no new ones.

**Complexity gate**: no violation to justify, so *Complexity Tracking* below is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-electrical-load-tree-editor/
├── spec.md                  # Feature specification (English, source of truth)
├── spec.uk.md               # Ukrainian translation
├── plan.md                  # This file
├── research.md              # Phase 0 output
├── data-model.md            # Phase 1 output
├── quickstart.md            # Phase 1 output
├── contracts/               # Phase 1 output
│   ├── project-file.md      # The .eltree.json format — the save/load contract
│   ├── catalog.md           # Built-in catalog entry format
│   └── services.md          # Internal service and engine signatures
├── checklists/
│   └── requirements.md      # Specification quality checklist
└── tasks.md                 # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
neutralino.config.json       # Window 1200x800, minWidth 900, documentRoot /dist/, url /,
                             # cli.frontendLibrary for `neu run` against the dev server
package.json
vite.config.js               # @ alias → src/, publicDir → resources/
index.html                   # #app mount point + the __neutralino_globals.js tag

resources/                   # Neutralino runtime assets (icons, tray)

src/
├── main.js                  # Neutralino.init() guard → createApp → pinia, router, module plugin
├── App.vue                  # n-config-provider + n-dialog-provider + n-message-provider + RouterView
├── assets/main.css
│
├── data/
│   └── catalog.builtin.json # ≥80 consumer types: name, nameEn, category (FR-019, FR-020)
│
├── router/index.js          # createWebHashHistory; /tree
├── components/
│   └── AppLayout.vue        # Sidebar, toolbar, RouterView
├── stores/
│   ├── ui.js                # Theme, sidebar state
│   └── project.js           # Current file path, dirty flag, recovery state
├── composables/
│   ├── useConfirm.js        # Destructive-action confirmation (FR-010)
│   └── useKeyboardTree.js   # useMagicKeys / onKeyStroke bindings (FR-030)
├── schemas/
│   └── index.js             # valibot schemas — NodeSchema per kind, ProjectSchema,
│                            # ConsumerTypeSchema. One source for vee-validate and for
│                            # file validation (R6)
├── services/
│   ├── fs/
│   │   ├── index.js         # Picks the adapter by window.NL_PORT
│   │   ├── NeutralinoFs.js  # Real filesystem + native dialogs
│   │   └── MemoryFs.js      # In-memory, used by tests and browser dev
│   ├── ProjectFileService.js  # Load, save, atomic write, autosave, recovery
│   ├── CatalogFileService.js  # Reads the bundled catalog
│   └── PathService.js         # os.getPath('data') + appId, path joining
│
└── modules/
    └── tree/
        ├── index.js         # Plugin: registers /tree
        ├── engine/          # Pure functions, no I/O, no reactivity
        │   ├── treeOps.js         # add, move, remove, reorder, cycle guard, depth guard
        │   └── homogeneity.js     # FR-013 … FR-018, the hard block
        ├── stores/
        │   ├── tree.js      # Normalized nodes, selection, expansion, useManualRefHistory
        │   └── catalog.js   # The bundled catalog and the fuse index over it (R8)
        ├── views/TreeEditorView.vue
        └── components/      # TreeCanvas, NodeInspector, AddConsumerDialog,
                             # StructuralFixDialog (FR-016, FR-017)

tests/
├── unit/                    # engine/* — the bulk of the suite
├── component/               # Views and components via @vue/test-utils
└── fixtures/                # Sample projects, including a 500-node tree
```

**Structure Decision**: One Vue Plugin module, `tree`, because there is now exactly one route and one
area of the UI. The catalog stopped being a module when its screen left the scope: it is a bundled JSON
file, a store that indexes it for search, and a picker inside the add-consumer dialog. Its store lives
under `modules/tree/stores/` with the only code that reads it. Project file I/O is **not** a module —
it registers no route and is invoked from the toolbar, so it lives in `src/services/` where the module
and the toolbar can both reach it.

The engine sits under `modules/tree/engine/` as pure functions with no imports from Pinia, Vue or the
filesystem. That boundary is what lets the structural requirements be tested as plain function calls,
and it is the single most load-bearing decision in this plan.

Every mutating function in `treeOps.js` returns `produce(nodes, draft => …)`. That keeps the engine
pure — plain data in, plain data out — while giving two things a hand-written version could not.
Unchanged nodes stay the same objects in memory, so a history snapshot costs a reference instead of a
deep clone. And the returned map is frozen, so a stray `nodes[id].name = x` anywhere in the codebase
throws on the spot instead of silently rewriting all 100 snapshots. `CatalogFileService` freezes what
it hands out for the same reason.

## Complexity Tracking

No Constitution Check violations. Section intentionally empty.
