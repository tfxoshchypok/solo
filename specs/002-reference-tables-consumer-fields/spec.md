# Feature Specification: Reference Tables and Consumer Fields

**Feature Branch**: `002-reference-tables-consumer-fields`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "в /specs/docs/002-spozhyvachi-dovidnyk-tz.md специфікація довідників. потрібно добавити в апку. зробити для довідників окремий розділ з можливістю перегляду та редагування. достатньо буде json формату для довідників. також є перелік полів для споживачів, потрібно внести зміни згідно переліку. перелік повністю достатній, якщо вже є поля які не входять у перелік - видаляй. якщо якісь рішення суперечать тому, що записано вже у проекті - узгоджуй. однозначно - на даному єтапі ніяких розрахунків"

**Source document**: [`specs/docs/002-spozhyvachi-dovidnyk-tz.md`](../docs/002-spozhyvachi-dovidnyk-tz.md) — the
load types table (§1, 33 rows), the zones table (§2, 8 rows) and the field list of an end-consumer
line (§3). It is referred to below as "the source document".

## Overview

The application gains two reference tables taken from the source document — **load types** and
**zones** — and a separate section where the user views and edits them. An end consumer in the tree is
redefined by the field list in §3 of the source document: it now carries a name, a load type, a zone
and an optional cable cross-section, and nothing else. When the user chooses a load type or a zone, the
consumer keeps the reference to that row and takes a copy of every value of it. From then on the
consumer works with its own copy, in the open project and in the saved file, until the user chooses a
row again.

At this stage nothing is computed from any of these values. The reference values and the cable
cross-section are stored, shown and edited; that is all.

## Clarifications

### Session 2026-09-26

- Q: "JSON format is enough for the reference tables" — how are the tables viewed and edited? → A: As
  tables with the source document's columns, edited cell by cell, with rows added and deleted. JSON is
  the format the tables are stored in.
- Q: The built-in consumer type catalog of feature 001 (87 types in 11 categories) is referenced only by
  the consumer's type field, which the new field list does not contain. What happens to it? → A: The
  load types table replaces it. A consumer is created by choosing a load type; the old catalog and its
  categories are removed.
- Q: When does an edit in a reference table — a changed cell, an added or deleted row — take effect? →
  A: At once. Each edit is applied and stored as soon as it is made; there is no separate save step.
- Q: When the user changes the load type of an existing consumer, what happens to its name? → A: The
  name follows the new load type if the user has not renamed the consumer; a name the user typed stays.
- Q: How does a row's code behave once consumers reference it? → A: A code in a reference table is not
  subject to change. The source document's code column is dropped: each row carries an identifier the
  application generates, which the user has no access to — it is neither shown nor editable.
- Q: With no code on screen, rows are told apart by name alone. May two rows of one table share a name?
  → A: No. A name is unique within its table; an edit that would duplicate one is refused.
- Q: At startup the stored reference tables cannot be read — the file is damaged, or a hand edit left a
  duplicate name or text in a numeric column. What happens? → A: The file is refused as a whole with a
  message naming the failing element, the application continues with the tables as shipped, and the
  refused file is kept as a copy beside it so it can be repaired by hand.

### Session 2026-10-03

- Q: What does a consumer keep of its load type and zone? → A: The reference to the row and a copy of
  every value of that row. The application works with the values held by the project until the user
  explicitly redefines them.
- Q: When is the copy taken? → A: When the user chooses the load type or the zone — on adding the
  consumer or on changing it in the properties area. Later edits of the tables reach neither the open
  project nor a saved file.
- Q: How does the user explicitly redefine the copied values? → A: By choosing a load type or a zone in
  the properties area, even the row already chosen: the consumer takes a fresh copy of that row's
  current values.
- Q: What does the properties area show of the copied values? → A: All of them, each editable for that
  consumer only.
- Q: The row a consumer's values were copied from is changed or deleted in its table. What does the
  consumer show? → A: Its own copy, with no mark.
- Q: How does the properties area tell the consumer's own fields from the copied ones? → A: Two groups
  one under the other: the project group (name, cable cross-section) on top, then a visually distinct
  group of values from the reference tables — the load type choice with its copied values, then the zone
  choice with its copied values — all visible and edited in place.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View and edit the reference tables (Priority: P1)

An electrician opens the reference tables section from the application's main navigation. They see the
load types table and the zones table, each with the columns of the source document other than its code
column. They change the demand factor of "Розетки кухні (робоча зона)" from 0.4 to 0.5, add a load type
row for an appliance the table does not have, and delete a zone they never use. After restarting the application, all three changes are
still there.

**Why this priority**: A consumer's load type and zone are copied from these tables, so the tables
have to exist first. The section is the only place where the user sees and corrects their values.

**Independent Test**: On a fresh installation, open the section, compare both tables with the source
document cell by cell, then change one cell, add one row and delete one row in each table, restart the
application and confirm all six changes persist.

**Acceptance Scenarios**:

1. **Given** a fresh installation, **When** the user opens the reference tables section, **Then** the
   load types table shows the 33 rows and the zones table shows the 8 rows of the source document, with
   every value as written there in every column except the code column.
2. **Given** the load types table, **When** the user changes a cell and restarts the application,
   **Then** the cell holds the changed value.
3. **Given** either table, **When** the user adds a row and gives it a name, **Then** the row appears in
   the table and is offered when a consumer's load type or zone is chosen.
4. **Given** either table, **When** the user deletes a row, **Then** the row disappears from the table
   and is no longer offered when a consumer's load type or zone is chosen.
5. **Given** either table, **When** the user views or edits a row, **Then** no code or identifier column
   is shown or editable; **When** the user clears a row's name, or gives it the name of another row in
   the same table, **Then** the edit is refused with the reason shown, and the table stays as it was
   before that edit.
6. **Given** the rated power column, **When** the user enters text that is not a number, **Then** the
   edit is refused with the reason shown.
7. **Given** a project with unsaved changes is open in the tree editor, **When** the user switches to the
   reference tables section and back, **Then** the project is still open with the same unsaved changes.
8. **Given** the stored reference tables hold a duplicate name, **When** the application starts,
   **Then** a message names the failing element, both tables show their shipped contents, and the
   refused file is kept as a copy beside the stored tables.

---

### User Story 2 - Describe a consumer by load type, zone and cable section (Priority: P2)

The user adds a consumer under the kitchen panel. They choose the load type "Розетки кухні (робоча
зона)" and the zone "Кухня"; the new consumer is named after the load type. They rename it to "Розетки
фартуха кухні" and enter a cable cross-section of 2.5 mm², because the cable is already installed. For
the next consumer the cable is not laid yet, so they leave the cross-section empty.

**Why this priority**: This is the consumer field list the user supplied. It replaces the type,
quantity and note fields a consumer carried in feature 001.

**Independent Test**: Add a consumer, confirm a load type and a zone must be chosen and that the node
is named after the load type, then confirm the properties area shows exactly name, load type, zone,
every copied value of the load type and zone rows, and cable cross-section, with the cross-section
accepting an empty value or a positive number.

**Acceptance Scenarios**:

1. **Given** a panel that holds consumers or no children, **When** the user adds a consumer, **Then**
   they choose a load type and a zone, and the consumer is created with both, holding a copy of every
   value of both rows, and named after the chosen load type.
2. **Given** the load type choice is open, **When** the user types part of a load type name, **Then**
   the matching load types are listed.
3. **Given** a selected consumer, **When** the user looks at its properties, **Then** they see exactly
   its name, load type, zone, the copied values of the load type and zone rows, and cable
   cross-section, each editable — the load type and zone names by choosing a row.
4. **Given** a consumer, **When** the user clears the cable cross-section, **Then** the consumer keeps
   an empty cross-section; **When** they enter 0, a negative number or text, **Then** the value is
   refused.
5. **Given** a consumer with load type "Розетки кухні (робоча зона)", **When** the user renames that
   load type in the reference tables section, **Then** the consumer's load type still shows "Розетки
   кухні (робоча зона)" and the consumer's own name is unchanged.
6. **Given** a consumer with load type "Подрібнювач відходів (диспоузер)", **When** the user deletes
   that row from the load types table, **Then** the consumer keeps showing that load type and its copied
   values with no mark, keeps them through a save and reopen, and the user can choose another load type
   for it.
7. **Given** a consumer named "Духова шафа" after its load type, **When** the user changes its load type
   to "Мікрохвильова піч", **Then** it is renamed "Мікрохвильова піч"; **Given** a consumer the user
   renamed to "Розетки фартуха кухні", **When** its load type changes, **Then** the name stays.
8. **Given** a consumer whose load type "Розетки кухні (робоча зона)" was copied with demand factor 0.4,
   **When** the user changes that row's demand factor to 0.5 in the reference tables section, **Then**
   the consumer still shows 0.4; **When** the user then chooses the same load type for it again in the
   properties area, **Then** it shows 0.5, and every value of that load type changed by hand on this
   consumer is replaced by the row's current value.
9. **Given** a consumer, **When** the user changes its copied demand factor to 0.6 in the properties
   area, **Then** only that consumer shows 0.6, while the table and every other consumer of the same
   load type keep their values; **When** they enter text there, **Then** the value is refused.

---

### User Story 3 - Keep projects with the new consumer fields on disk (Priority: P3)

The user saves a project whose consumers carry load types, zones and cable cross-sections, reopens it
later, and finds every value in place. They pass the file to a colleague whose reference tables differ;
the colleague's application opens it and shows the same values.

**Why this priority**: The new fields are worth entering only if they survive a save and reopen, and
the project file format changes because of them.

**Independent Test**: Build a tree with three consumers — one with a cable cross-section, one without,
one whose load type row is then deleted from the reference tables — save, restart, reopen and compare
every consumer field, the copied values included.

**Acceptance Scenarios**:

1. **Given** a project with consumers, **When** the user saves and reopens it, **Then** every
   consumer's name, load type, zone, the copied values of both, and cable cross-section are reproduced
   exactly, and an empty cross-section or an empty copied value stays empty.
2. **Given** a project file whose consumers reference rows absent from the local reference tables,
   **When** the user opens it, **Then** it opens normally and those consumers show the values stored in
   the file.
3. **Given** a project file whose consumers reference rows that hold other values in the local
   reference tables, **When** the user opens it, **Then** those consumers show the values stored in the
   file.

---

### Edge Cases

- **Row deleted or changed after the copy, or a file from another installation**: the consumer keeps
  its own copy, with no mark, until the user chooses a row again (FR-015, FR-018).
- **The same row chosen again**: a fresh copy replaces the values changed by hand (FR-014).
- **Empty or duplicate name**: refused with the reason shown; the table stays as it was before that edit.
- **Non-numeric value in a numeric column**: refused with the reason shown.
- **Empty cell**: any cell other than the name may be left empty; the zone "Критична безперервна лінія"
  ships with its leakage setpoint empty, as in the source document ("—").
- **Every row deleted**: a table may be emptied; a consumer cannot then be added until that table has a
  row again, because a load type and a zone are both required.
- **Stored reference tables unreadable at startup**: refused as a whole with the failing element named;
  the application continues with the tables as shipped and keeps the refused file as a copy.
- **Switching sections with unsaved project changes**: the project stays open with its changes intact.

## Requirements *(mandatory)*

### Functional Requirements

#### Reference tables

- **FR-001**: System MUST provide two reference tables, *load types* and *zones*, each with the columns
  listed in *Reference Table Columns* below.
- **FR-002**: System MUST ship both tables filled with exactly the rows and values of the source
  document, in every column except its code column: 33 load types and 8 zones. Compound values
  ("1ф або 2ф", "1ф і 3ф", "C/D", "IP20 / IP44") are kept as written there.
- **FR-003**: System MUST provide a separate section of the application, reachable from its main
  navigation alongside the tree editor, where both tables are shown as tables.
- **FR-004**: Users MUST be able to change any cell, add a row and delete a row in either table in that
  section.
- **FR-005**: System MUST give every row, when the row is created, an identifier that is unique within
  its table and never changes. The user has no access to it: it is neither shown nor editable. Every
  row MUST have a name that is non-empty and unique within its table, and System MUST refuse an edit
  that clears a name or repeats another row's name, showing the reason and leaving the table as it was
  before that edit.
- **FR-006**: System MUST accept only a number in the columns marked *number* and only yes or no in the
  columns marked *yes/no*, refusing any other value with the reason shown. Every cell except the name
  may be left empty.
- **FR-007**: System MUST store the reference tables in JSON format on the user's machine, as one set
  per installation of the application, independent of any project. Each accepted edit MUST be stored
  as soon as it is made, with no separate save step, and MUST survive an application restart. When
  the stored tables cannot be read at startup, or break FR-005 or FR-006, System MUST refuse them as a
  whole with a message naming the failing element, continue with the tables as shipped (FR-002), and
  keep the refused file as a copy beside the stored tables.
- **FR-008**: Switching between the reference tables section and the tree editor MUST leave the open
  project and its unsaved changes intact.

#### End consumer

- **FR-009**: Besides its place in the tree, an end consumer MUST carry exactly these fields and no
  others: identifier, name, load type, zone, cable cross-section.
- **FR-010**: The load type MUST hold a reference to a row of the load types table by its identifier
  and a copy of that row's value in every column listed under *Reference Table Columns*; the zone MUST
  hold the same for a row of the zones table. Both are required. The copy MUST be taken when the user
  chooses the row (FR-012, FR-014), and no later edit of the tables MUST change it.
- **FR-011**: The cable cross-section MUST be optional: either empty or a positive number of square
  millimetres, being the actual conductor cross-section of the installed cable.
- **FR-012**: Adding an end consumer MUST have the user choose a load type and a zone, MUST copy both
  rows into it (FR-010), and MUST name the new consumer after the chosen load type's name.
- **FR-013**: The load type choice MUST list the rows of the load types table and let the user find a
  row by a fragment of its name; the zone choice MUST list the rows of the zones table.
- **FR-014**: Users MUST be able to rename an end consumer and change its load type, zone and cable
  cross-section in the properties area. Choosing a load type or a zone there — the row already chosen
  included — MUST replace every value copied from that table with the row's current values, discarding
  values changed by hand. When the load type changes, System MUST rename the consumer after the new
  load type if its current name equals the load type name copied in the consumer; otherwise the name
  stays.
- **FR-015**: System MUST show a consumer's load type, zone and their values from the copy the consumer
  holds, whether or not the referenced row still exists or still holds the same values, with no mark
  of a difference.

#### Project file

- **FR-016**: The project file MUST hold the schema version, the project name, the created and modified
  timestamps, and the tree. Every end consumer in it MUST carry its identifier, name, load type
  reference with the copied load type values, zone reference with the copied zone values, and cable
  cross-section, the last possibly empty.
- **FR-018**: System MUST open a project file whose consumers reference rows absent from the local
  reference tables or holding other values there, displaying those consumers as FR-015 describes.
- **FR-019**: Saving and reopening a project MUST reproduce every consumer's name, load type, zone, the
  copied values of both and cable cross-section exactly, including an empty cross-section and empty
  copied values.

#### The user's limit for this stage

- **FR-020**: System MUST NOT compute anything from the reference table values or from the cable
  cross-section at this stage.

#### Properties area of an end consumer

- **FR-021**: Users MUST be able to change each copied value of a consumer's load type and zone, other
  than the two names, in the properties area. The value MUST follow its column's value kind (FR-006)
  and MUST change that consumer only, never the table or another consumer.
- **FR-022**: The properties area MUST show the consumer's own fields — name and cable cross-section —
  as one group on top. Below it, a second group, set apart by its own background and a caption saying
  its values are copied from the reference tables, MUST show the load type choice with the copied load
  type values, then the zone choice with the copied zone values.

### Key Entities *(include if feature involves data)*

- **Load Type**: A row of the load types table (source document §1). Carries a generated identifier,
  unique within the table, unchanging and hidden from the user, by which consumers reference it; a
  name; and the electrical characteristics listed under *Reference Table Columns*.
- **Zone**: A row of the zones table (source document §2). Carries a generated identifier on the same
  terms, a name, and the safety requirements listed under *Reference Table Columns*.
- **End Consumer**: A leaf of the tree, representing one final circuit of a consumer (source document
  §3). Carries an identifier, a name, a load type and a zone — each a reference to a row with a copy of
  that row's values (FR-010) — and an optional cable cross-section in mm².
- **Project**: As in feature 001, less the catalog version. Holds the schema version, name, created and
  modified timestamps, and the tree.
- **Service Entry, Panel**: Unchanged from feature 001, including the free-text note.

## Reference Table Columns

The *Source header* column gives each column's header as written in the source document. The source
document's code column (Код) is not among them; its role goes to the generated identifier of FR-005.

### Load types (`load_types`, source document §1)

| Column | Source header | Value kind |
|---|---|---|
| Name | Назва типу | text, non-empty, unique within the table |
| Rated power, kW | P, кВт | number |
| Phases | Фазність | text ("1ф", "1ф або 2ф", "3ф", "1ф і 3ф") |
| Circuit breaker characteristic | Хар-ка АВ | text ("B", "C", "C/D") |
| Continuous load | Тривалий | yes/no |
| Power factor | cos φ | number |
| Demand factor | Кп | number |
| RCD type | Тип ПЗВ | text ("A", "F", "B") |

### Zones (`zones`, source document §2)

| Column | Source header | Value kind |
|---|---|---|
| Name | Назва зони | text, non-empty, unique within the table |
| RCD mandatory | ПЗВ обов'язкове | yes/no |
| Leakage setpoint, mA | Уставка витоку, мА | number |
| Minimum IP rating | Мін. IP | text ("IP20", "IP44", "IP20 / IP44", "IP44 / IP65") |
| Separate RCD | Окреме ПЗВ | yes/no |
| Purpose and normative limits | Призначення та нормативні межі | text |

## Relation to Feature 001

The user asked that decisions contradicting what the project already records be reconciled. The
following parts of [`specs/001-electrical-load-tree-editor/spec.md`](../001-electrical-load-tree-editor/spec.md)
are superseded by this feature; everything not listed stays in force.

| Feature 001 | Superseded by |
|---|---|
| Clarification 2026-09-10: "no separate catalog screen, no user-created types" | FR-003, FR-004: a separate section where the reference tables are viewed and edited |
| FR-019 – FR-022 and *Catalog Scope*: a built-in catalog of at least 80 types in 11 categories, each with a display name, an English name and a category, found by name or category, never written | FR-001 – FR-007: the load types and zones tables of the source document, editable. The old catalog and its categories are removed (clarification 2026-09-26) |
| FR-023: every consumer is created from a catalog type and named after it | FR-012: a consumer is created by choosing a load type and a zone, and named after the load type |
| FR-024: renaming a consumer leaves the catalog type and every other node unchanged | FR-014: a consumer is renamed in the properties area; the catalog it referred to is removed |
| FR-025: quantity of identical units on one consumer | FR-009: quantity is not in the field list, so it is removed |
| FR-012: a free-text note on any node | FR-009: the note is not in the consumer field list, so consumers lose it; the service entry and panels keep it |
| FR-033: the project file holds the catalog version | FR-016: the catalog it versioned is removed, so the file no longer records a catalog version |
| FR-034: each consumer stores a copy of its type's name | FR-010: each consumer stores a copy of every value of its load type row and zone row beside the reference |
| FR-038: no cable cross-sections | FR-011: the cable cross-section is a stored consumer field. Cable routes, cable lengths, conduits, terminal-level connections and floor-plan placement stay excluded |
| User Story 2, acceptance scenarios on catalog search, category and quantity; User Story 3, scenario 1 "every quantity and every note" | User Story 2 and User Story 3 of this feature |
| SC-003 (90% of consumers placed from the catalog), SC-004 (find a type in under 10 seconds), SC-005 (quantities and notes reproduced) | SC-004, SC-005 of this feature |
| The request "no figures" behind feature 001 | Figures now appear as reference data and as the cable cross-section; nothing is computed from them (FR-020) |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fresh installation, a cell-by-cell comparison of both tables in the reference tables
  section with the source document finds zero differences across the 33 load types and 8 zones in every
  column except the source document's code column.
- **SC-002**: A changed cell, an added row and a deleted row in each table are all present after an
  application restart, in 100% of attempts.
- **SC-003**: 100% of edits that clear a row's name, repeat another row's name in the same table, or
  put a non-number into a numeric column are refused with the reason shown, and the table afterwards equals the table before.
- **SC-004**: A user can add a consumer with its load type and zone chosen in under 20 seconds from the
  moment they decide to add it.
- **SC-005**: A project saved and reopened reproduces every consumer's name, load type, zone, the
  copied values of both and cable cross-section with zero differences, including empty values.
- **SC-006**: A consumer's properties area and its record in the project file contain exactly the five
  fields of the list — identifier, name, load type, zone, cable cross-section — besides its place in
  the tree, the load type and zone each with the copy of its row's values.
- **SC-007**: After any edit in the reference tables, 0 consumers in the open project or in a reopened
  file show a changed value until the user chooses their row again.

## Assumptions

- **Application-wide tables**: the reference tables belong to the application, one set per
  installation, rather than to a project. Forced by FR-003: the user asked for a separate section of the
  application; the source document calls the tables "base configuration tables".
- **Load type and zone are required**: forced by the source document §3, which marks only
  `cable_section_mm2` as nullable.
- **Value kind per column**: forced by the clarified cell-by-cell editing, which needs each cell to
  accept some kind of value. The kinds in *Reference Table Columns* follow the source document's values:
  numbers where it shows numbers, yes/no where it shows "так"/"ні", text elsewhere, so compound values
  such as "C/D" stay representable. Leaving a cell empty covers the source document's "—".
- **Positive cable cross-section**: forced by FR-011; the source document defines the field as the
  actual conductor cross-section in mm², which is a positive quantity.
- **Names of the copy not edited by hand**: the load type and zone names are what the user chooses
  between, and FR-014 renames a consumer by comparing its name with the copied load type name, so
  FR-021 leaves both names to a new choice of row.
- **Consumer named after its load type**: carried over from feature 001 FR-023, where a consumer is
  named after the list entry it was created from; the load types table is now that list.
- **Name is required**: forced by the hidden identifier of FR-005 — with no code on screen, the name is
  the only thing that tells rows apart in the load type and zone choices, and a consumer takes its name
  from it.
- **Name search in the load type choice**: carried over from feature 001 FR-021. Its category half goes
  with the categories themselves.
- **Switching sections keeps the open project**: forced by FR-003 — a separate section means leaving the
  tree editor — together with feature 001 FR-031, under which a confirmed change is never lost.
