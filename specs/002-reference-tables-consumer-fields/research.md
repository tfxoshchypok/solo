# Phase 0 Research: Reference Tables and Consumer Fields

**Date**: 2026-09-26, revised 2026-10-03 (a copy of the row on the consumer: R3, R9, R14 – R17) | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

The stack is fixed by feature 001 (`specs/001-electrical-load-tree-editor/research.md`, R1–R11) and is
not reopened here. Every decision below is about how this feature fits into it. None of them adds a
dependency; one removes `fuse.js`.

---

## R1 — Where the reference tables live

**Decision**: One JSON file, `<appDataDir>/reference-tables.json`, where `appDataDir` is the existing
`PathService.appDataDir()` — `os.getPath('data')` joined with the application id `ua.eltree.editor`
(on Linux `~/.local/share/ua.eltree.editor/`). Both tables sit in that one file.

**Rationale**: FR-007 asks for JSON on the user's machine, one set per installation. The clarified
startup rule (the refused file is kept beside the stored one "so it can be repaired by hand") needs a
plain file at a known path. One file means one validation pass and one atomic write per edit, so the
two tables can never be half-updated relative to each other.

**Alternatives considered**:
- `Neutralino.storage` (already used for `{theme, sidebarCollapsed}` in `src/stores/ui.js`). It stores
  JSON too, but in `.neustorage` files named by key inside the app's storage directory — not a file a
  user finds and repairs.
- One file per table. Two writes per edit that touches neither table's partner is harmless, but two
  refusal paths and two "kept as a copy" files at startup are not.
- Embedding the tables in each project file. The spec settles this against it: the tables belong to the
  installation (Assumptions, "Application-wide tables").

---

## R2 — Shipped contents and the first write

**Decision**: The shipped tables are `src/data/referenceTables.builtin.json`, imported at build time and
deep-frozen, exactly as `catalog.builtin.json` is today. Nothing is written to disk until the first
accepted edit; until then the application reads the bundled file.

**Rationale**: FR-002 fixes the shipped rows to the source document. Reading the bundle while no stored
file exists means a fresh installation needs no write to be correct, and FR-007's startup fallback
("continue with the tables as shipped") is the same code path as a fresh start.

**Alternatives considered**: Copying the bundle to disk at first launch. It adds a write that proves
nothing, and it would pin a user who never edited to the first build's rows forever.

---

## R3 — Row identifiers

**Decision**: `lt-${crypto.randomUUID()}` for load types, `zn-${crypto.randomUUID()}` for zones —
the same shape as node ids (`n-${uuid}`, `treeOps.js`). A row added in the section gets its id when it
is created. The 41 shipped rows got theirs once, when the bundled file was written, and those ids are
committed with it.

**Rationale**: The user asked for a value "generated automatically, which the user has no access to"
(clarification 2026-09-26). Since the 2026-10-03 clarification a consumer carries a copy of its
row (R15), so the id no longer decides what a consumer shows; it records which row the copy came from
(FR-010). UUIDs keep that record unambiguous across installations: shipped rows carry the same id
everywhere, and a row one user added never shares an id with a row another user added.

**Alternatives considered**:
- Sequential integers. The colleague's own 34th load type would silently match the sender's 34th —
  a wrong row shown as if it were right, which is worse than an absent one.
- The source document's codes (`LIGHT`, `SOCKET_ROOM`) as hidden ids for the shipped rows. Two id
  styles in one table, and the user's answer replaced the code with a generated value.

---

## R4 — Storing every edit at once

**Decision**: `ReferenceTablesFileService.save(tables)` writes the whole file through `tmpPath(path)`
then `fs.move(tmp, path)` — the atomic write `ProjectFileService.save` already uses — and every call is
chained onto one promise, so writes run one after another in the order the edits were made.
`flush()` returns the tail of that chain; `closeGuard`'s `flush` awaits it next to
`ProjectFileService.flushAutosave()`, inside the existing 2000 ms cap.

**Rationale**: The clarification says each edit is stored as soon as it is made. The file is small
(41 rows serialize to about 10 KB), so rewriting it per edit costs nothing measurable. The chain matters
because two edits within a few milliseconds would otherwise race on the same `.tmp` path.

**Alternatives considered**:
- A 400 ms debounce like the project autosave. It contradicts "at once" and opens a window in which a
  closed application loses the last edit.
- Writing straight to the target path. A crash mid-write leaves a truncated file, which the next start
  would refuse — correctly, but it would hide every earlier edit behind the fallback.

A failed write is reported with `n-message` (`Не вдалося записати довідники — …`). The in-memory tables
keep the edit, and the next accepted edit rewrites the whole file, so one failed write does not strand
a later one.

---

## R5 — A stored file that cannot be used

**Decision**: Loading runs in stages, as `ProjectFileService.load` does: exists → read → `JSON.parse`
→ `schemaVersion` → `v.safeParse(ReferenceTablesSchema)` → uniqueness of ids and names per table. The
first failing stage produces a `LoadError` with a path such as `zones[5].name`. On refusal the service
moves the file to `reference-tables.refused-<timestamp>.json` in the same directory and returns the
bundled tables together with the refusal, which `AppLayout.vue` shows once with `message.error`.

**Rationale**: The clarification asks for the file to be refused as a whole, the failing element named,
the shipped tables used, and the refused file kept beside the stored one. Moving rather than copying
frees the stored path, so the next edit writes a clean file without overwriting what the user may want
to repair. The fs adapter (`src/services/fs/index.js`) has `move` and no `copy`.

**Alternatives considered**: Leaving the broken file in place and refusing to write until it is fixed.
Every edit made in the meantime would be lost at the next restart.

---

## R6 — Validation

**Decision**: `LoadTypeSchema`, `ZoneSchema` and `ReferenceTablesSchema` join the existing schemas in
`src/schemas/index.js`. Empty cells are `null` — never absent, never `''` — so a row always carries all
its keys. Name uniqueness is checked outside valibot, in one pure function shared by the loader and by
the table engine: trimmed, compared with `toLocaleLowerCase('uk')`. `LoadError` moves from
`ProjectFileService.js` to `src/services/LoadError.js` so both file services throw the same type.

**Rationale**: One schema module is feature 001's R6. Case-insensitive comparison is what makes the
uniqueness rule serve its purpose: "Розетки" and "розетки" would read as the same row in a choice list.

---

## R7 — The editable table

**Decision**: Naive UI `n-data-table` (part of `naive-ui` 2.45.3, not yet used in the project) with a
`render` per column that returns the editor for that column's kind:

| Kind | Editor | Commit |
|---|---|---|
| name, text | `NInput` | on blur or Enter |
| number | `NInput` + `parseNumberCell` | on blur or Enter |
| yes/no | `NSelect` with "так" / "ні", clearable to empty | on change |

A name field and an "Додати рядок" button above each table create a row; a delete button ends each row.
41 rows need no virtual scrolling.

**Rationale**: The clarified editing model is cell by cell with rows added and deleted, stored at once.
Commit on blur/Enter is the pattern `NodeInspector.vue` already uses for name and note (drafts at
:36-56). A row needs its name at creation because FR-005 refuses a row without one.

**Alternatives considered**: A dedicated grid library (ag-grid, vxe-table) — a new dependency for 41
rows. A hand-written `<table>` — gives up the light/dark theming every other screen gets from Naive UI.

---

## R8 — Number cells

**Decision**: A plain `NInput` and a pure parser, `parseNumberCell(text)`: trim; empty → `null`; a comma
is accepted as the decimal separator; anything but an optional minus, digits and one decimal part is
refused with the reason. The cable cross-section uses the same parser and then requires a value above 0.

**Rationale**: FR-006 requires a refused value to be refused *with the reason shown*. `n-input-number`
reverts unparseable text silently on blur, and a Ukrainian keyboard types `0,95`.

---

## R9 — Consumer edits and undo

**Decision**: Load type, zone and cable cross-section are changed through new `treeOps` functions and
committed through the tree store's existing `apply()`, so each is one undo step — the same as
`setNote` and `setQuantity` are today (`stores/tree.js:108-117`, 138-144). A load type choice — the new copy and, under FR-014,
the rename — is one `produce` and therefore one step; so is an edit of one copied value (FR-021, R16). Reference table edits are not in
the tree's history: they are not part of the project, and they are stored the moment they are made.

---

## R10 — The exit prompt must not depend on the open section

**Decision**: The `setExitDecision(() => decideExit({...}))` block moves unchanged from
`TreeEditorView.vue:41-56` to `AppLayout.vue`, which is mounted for the whole session and sits inside
the dialog and message providers (`App.vue`).

**Rationale**: Today the decision is unregistered in `onBeforeUnmount` of the tree view. With a second
route, closing the window from the reference section would skip the unsaved-changes prompt — the
autosave sidecar is still flushed, but FR-008 and feature 001 FR-031 expect the same behaviour on
every screen.

**Alternatives considered**: `<KeepAlive>` around `<RouterView>`. It keeps the tree view mounted, and
with it the `onKeyStroke` bindings of `useKeyboardTree`: Delete pressed while editing a cell would
delete the selected tree node.

---

## R11 — Removing the old catalog

**Decision**: `catalog.builtin.json`, `CatalogFileService.js`, `modules/tree/stores/catalog.js`,
`ConsumerTypeSchema`, `CategorySchema`, `CatalogSchema` and the `fuse.js` dependency are deleted. The
load type choice uses `NSelect`'s built-in `filterable` search, which matches a fragment of the label
case-insensitively (FR-013).

**Rationale**: The clarification replaces the catalog with the load types table. Fuse was there for
typo tolerance across a Ukrainian and an English name (001 R8); load types have one name and 33 rows.

---

## R12 — Two specs, overlapping requirement numbers

**Decision**: The requirement-to-test guard (`tests/unit/scope/boundaries.test.js`, T060) checks both
specs. Tests for this feature cite requirements as `002/FR-012`; a bare `FR-012` keeps meaning feature
001. The guard skips the feature 001 requirements listed in the spec's *Relation to Feature 001*:
FR-019 – FR-025, FR-033 and FR-034.

**Rationale**: Both specs number from FR-001, so a bare id cannot say which feature it proves. The
superseded 001 requirements lose their tests with the catalog; without the skip list the guard would
fail on exactly the requirements this feature retires.

---

## R13 — Project file format

**Decision**: `SCHEMA_VERSION` stays 1 and `catalogVersion` leaves `ProjectSchema` and `denormalize`.
The application is not in test use yet, so the version-1 shape simply changes; files written by
feature 001 get no treatment of their own. The 500-node fixture
`tests/fixtures/tree-500.eltree.json` is regenerated in the new consumer shape. `npm run schema:emit`
writes to `specs/002-reference-tables-consumer-fields/contracts/project-file.schema.json`.

---

## R14 — What the load type and zone selects show

**Decision**: The inspector's two `NSelect`s are bound to a fixed value no option carries,
`COPY = '@copy'`, with `:fallback-option="() => ({ label: node.loadType.name })"` (the zone likewise).
The options are the table's rows under their current names. `@update:value` copies whichever row is
chosen, the row the copy came from included (FR-014), so `chooseLoadType` and `chooseZone` lose their
"same id → return" guard (`NodeInspector.vue:121-137`). The disabled «Відсутній у довіднику» option goes.

**Rationale**: `NSelect` shows the label of the option whose value equals its own
(`naive-ui/es/_internal/selection/src/Selection.mjs:740`). Bound to `loadType.id`, it would show the
row's *current* name once the row is renamed, where FR-015 requires the copied one, and the raw id once
the row is deleted, which FR-005 forbids. A value no option holds always goes through `fallbackOption`
(`naive-ui/es/select/src/Select.mjs:228-247`), so the field shows the copy in every case, with no mark
(clarification 2026-10-03). Choosing an option calls `onUpdateValue` with no equality check
(`Select.mjs:473-517`), so the handler runs even for the row already chosen.

**Alternatives considered**:
- Value `loadType.id`, and that option relabelled with the copied name. The list would then show a
  renamed row under its old name, and refreshing the copy would mean picking a name the table no longer
  has.
- `:value="null"` with the copied name as the placeholder. It renders in placeholder grey, as if nothing
  were chosen.

---

## R15 — Where the copy lives on the consumer

**Decision**: The consumer's `loadTypeId` and `zoneId` become `loadType` and `zone`, each a whole copy
of the chosen row with its `id`, validated by the existing `LoadTypeSchema` and `ZoneSchema`
(`src/schemas/index.js:68-89`). The copy is `{ ...row }` of the row the store finds in `loadTypeById` /
`zoneById` when the user chooses it. Loading a project never compares a copy with the local tables
(FR-018).

**Rationale**: FR-010 makes the load type "a reference to a row … and a copy of that row's value in
every column"; one object holding both is exactly that, and the consumer keeps its five fields besides
its place in the tree (FR-009, SC-006). Reusing the row schemas gives a copied value the same rules as
the cell it came from (FR-021 → FR-006) without a second rule list. Rows are flat, so a spread is a full
copy, and `produce` freezes it with the node.

**Alternatives considered**:
- `loadTypeId` kept beside a `loadType` object without `id`. Two fields for one choice, free to disagree.
- Flat keys (`loadTypeRatedPowerKw` and 12 more). No schema reuse, and every column added to a table
  would need a node field by hand.

**Cost**: a copied load type averages 201 bytes of JSON and a zone 211 (measured on
`src/data/referenceTables.builtin.json`). The 500-node fixture, 469 consumers, grows from 158 KB to 423 KB as
Prettier writes it (measured). Save and autosave already write the whole file.

---

## R16 — Editing a copied value

**Decision**: A new `treeOps.setConsumerCopyValue(nodes, nodeId, part, key, value)`, `part` being
`'loadType'` or `'zone'`, sets one key of the copy and validates the copy with its row schema. It
refuses `id` and `name` (`copyKeyLocked`), a key the schema lacks (`unknownColumn`) and a value the
schema refuses (`badCopyValue`, naming the column's header). The inspector parses text by the column's
kind before the call, through `parseCell(kind, input)` — today the private `parseInput` of
`stores/referenceTables.js:24-29`, moved to `engine/cells.js` so the table and the inspector share it.
The tree store's `setCopyValue` commits through `apply()`, one undo step, and never touches the
reference store (FR-021).

**Rationale**: FR-021 asks for each copied value to follow its column's kind and to change that consumer
only. Parser and schema are the ones the table uses, so a value the table refuses is refused here with
the same reason (R8). The names stay locked because FR-014 renames a consumer by comparing its name
with the copied load type name (spec, Assumptions, "Names of the copy not edited by hand").

---

## R17 — The properties area of a consumer

**Decision**: Two groups, one under the other, as the user chose on 2026-10-03 (FR-022):

```text
Назва                           ┐ project group: n-form, labels on top, as today
[Розетки фартуха кухні     ]    │
Переріз кабелю, мм²             │
[2.5                       ]    ┘
З ДОВІДНИКА · копія             ┐ reference group: tinted block
Тип навантаження                │
[Розетки кухні (роб. з.)  ▾]    │ select (R14)
  P, кВт          [3.5     ]    │ label | editor grid over columns.loadTypes, name excluded
  …                             │
Зона                            │
[Кухня                    ▾]    │
  ПЗВ обов'язкове [так    ▾]    │ the same over columns.zones; «Призначення та нормативні
  …                             ┘ межі» spans both grid columns as an autosize textarea
```

Labels are the source-document headers from `config/columns.js`, as in the table's column heads. The
block's background is Naive UI's `actionColor` theme variable (`useThemeVars()`; `rgb(250, 250, 252)` in
light, an overlay in dark), so it follows the theme. The editors come from a new
`modules/reference/components/CellEditor.vue`, extracted from `ReferenceTable.vue`'s `textEditor` and
`yesNoEditor` (`:81-106`), which the table then uses as well.

**Rationale**: The user chose this layout over tabs, collapsible blocks and a summary with a dialog.
Label-left rows keep each of the 12 values to one line in the 340 px inspector
(`src/assets/main.css:33`); the zone purpose is the one long text (up to 2000 characters), so it wraps.
One editor component keeps commit on blur or Enter and the «так / ні» select identical in both places
(R7).
