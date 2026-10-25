# Feature Specification: Panel Properties

**Feature Branch**: `003-panel-properties`

**Created**: 2026-10-11

**Status**: Draft

**Input**: User description: "нова фіча на основі розділу 1 документа [Властивості щитка — специфікація.md]"

**Source document**: [`docs/Властивості щитка — специфікація.md`](<../../docs/Властивості щитка — специфікація.md>),
Part 1 "Властивості" — the project properties, the panel properties, the line properties and three
reference tables. It is referred to below as "the source document".

## Overview

A project gains six properties that describe how its panels are built: supply phases, module reserve,
how a separate RCD is executed, the maximum number of lines per group RCD, neutral break, and a
selective RCD on the line that feeds a sub-panel. A new project starts with all six empty. Every panel
inherits five of them — all but supply phases — from the project, shows each inherited value with the
mark «з проекту», may hold its own value instead, and may reset its own value back to the inherited one.

A panel also carries two sets of marks: which optional incoming devices are installed in it — one mark
per device of the copy of the incoming device widths table the panel takes when it is created, as
shipped voltage relay, surge protective device, meter and main switch — and which accessories are
bought separately — neutral bars, PE bar, comb busbars, cable glands, blanking plates.

Three reference tables join the load types and zones of feature 002 and are edited the same way:
enclosure sizes, device widths by pole count, and widths of the optional incoming devices.

The line properties of the source document — phases, RCD type, rated power and demand factor from the
load type; RCD mandatory, separate RCD and leakage setpoint from the zone — are the values a consumer
already holds as its copy of the load type and zone rows under feature 002 (002/FR-010).

The properties the source document fills by the calculation of its Part 2 appear as empty fields,
kept in the project file: a panel's enclosure, device composition and accessory quantities; a line's
group RCD and phase. A sub-panel, being one line of its parent panel, carries the two line fields too.

## Clarifications

### Session 2026-10-11

- Q: The source document lists properties whose source is the calculation of its Part 2 — the panel's
  enclosure, device composition and accessory quantities; the line's group RCD and phase; and a
  sub-panel as one line of its parent panel. Are they part of this feature? → A: Yes, as empty fields:
  shown in the properties of the panel and the line, holding no value, until the calculation of Part 2
  arrives.
- Q: Which of the three new reference tables does the user edit? → A: All three, fully — as the load
  types and zones of feature 002: cells changed, rows added and deleted.
- Q: What values do the six project properties hold in a new project? → A: None. All six start empty
  and the user fills them in; until then a panel shows the empty value marked «з проекту».
- Q: Are the calculated fields kept in the project file? → A: Yes, all of them — the panel's enclosure,
  device composition and accessory quantities, and the group RCD and phase of a consumer and of a
  sub-panel.
- Q: How are a panel's «встановлювати» marks tied to the rows of the incoming device widths table,
  which the user may add, rename and delete? → A: By a copy, as the load types and zones of feature
  002: a new panel takes a copy of every row of the table — the device name and its 1ф and 3ф widths —
  each with a cleared mark. Later edits of the table reach neither existing panels nor saved files; the
  project stays independent of the reference tables.
- Q: May the user make a filled project property empty again? → A: Yes, any of the six.
- Q: The source document gives the numeric values no limits. Which apply? → A: Zero is not acceptable
  in substance. Module reserve is a number ≥ 0; max lines per group RCD, row modularity and row count
  are whole numbers ≥ 1; device widths are numbers > 0.
- Q: Where does the user view and edit the six project properties? → A: In the properties area of the
  root service entry node «Ввід», below its name and note.
- Q: Are the new edits — a project property, a panel's own value and its reset, a panel's mark — undone
  and redone? → A: Yes, as the other edits: each is one step of the same undo/redo history.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set the project properties (Priority: P1)

An electrician creates the project of a cottage with a three-phase supply and selects the service
entry «Ввід»; below its name and note are the six project properties, empty. They set supply phases to 3ф, module reserve to 20, separate RCD execution to «диф», max lines
per group RCD to 4, neutral break to «ні», and selective RCD on a sub-panel feeder line to «так». Every
panel of the project — the floor panels and the garage sub-panel alike — shows the last five values,
each marked «з проекту». The user changes the module reserve to 25, and every panel shows 25.

**Why this priority**: The project properties are where the panels take their values from, so the
panel properties of User Story 2 have nothing to inherit without them.

**Independent Test**: Create a project, confirm all six properties are empty, set all six, add two
panels and a sub-panel under one of them, confirm all three panels show the five overridable values
marked «з проекту», change one project value, confirm all three follow it, then save, reopen and
compare.

**Acceptance Scenarios**:

1. **Given** a new project, **When** the user selects the service entry node, **Then** its properties
   area shows, below its name and note, exactly the six properties listed in *Project Properties*, all
   empty.
2. **Given** a new project with a panel, **When** the user looks at the panel's properties, **Then**
   each of the five overridable properties is empty and marked «з проекту».
3. **Given** a project, **When** the user sets a property to a value of its kind (*Project
   Properties*), **Then** the project holds that value; **When** they enter any other value, **Then**
   it is refused with the reason shown and the property keeps its previous value — module reserve −5,
   max lines per group RCD 0 or 2.5 included.
4. **Given** a panel that holds no values of its own, **When** the user looks at its properties,
   **Then** they see module reserve, separate RCD execution, max lines per group RCD, neutral break and
   selective RCD on a sub-panel feeder line, each with the project's value and the mark «з проекту».
5. **Given** three panels that hold no values of their own, **When** the user changes the project's
   module reserve from 20 to 25, **Then** all three show 25 marked «з проекту»; **When** the user then
   clears the project's module reserve, **Then** all three show it empty, marked «з проекту»;
   **When** the user undoes the clearing, **Then** all three show 25 again, and redo empties it again.
6. **Given** a project with some properties set and the rest empty, **When** the user saves and reopens
   it, **Then** every property holds the value it had, and the empty ones are empty.

---

### User Story 2 - Give one panel its own value and reset it (Priority: P2)

The garage panel needs more spare room, so the user sets its module reserve to 40. The garage panel
shows 40 without the mark; every other panel still shows the project's 20 marked «з проекту». Later the
user raises the project's reserve to 25: the garage panel stays at 40, the others show 25. Then the user
resets the garage panel's reserve, and it shows 25 marked «з проекту».

**Why this priority**: The source document gives every property but supply phases a panel override;
without it, every panel of a project is built to the same rules.

**Independent Test**: In a project with two panels, set an own value on one panel, change the project
value, confirm only the other panel follows it, reset the own value, confirm both panels now follow the
project, then save, reopen and compare.

**Acceptance Scenarios**:

1. **Given** a panel that inherits module reserve 20, **When** the user sets 40 on it, **Then** it
   shows 40 without the mark «з проекту» and every other panel is unchanged.
2. **Given** a panel with its own module reserve 40, **When** the user changes the project's module
   reserve to 25, **Then** the panel still shows 40.
3. **Given** a panel with its own module reserve 40, **When** the user resets it, **Then** the panel
   shows the project's current value marked «з проекту» and follows every later change of it;
   **When** the user undoes the reset, **Then** the panel shows its own 40 again without the mark.
4. **Given** a panel with its own module reserve 20, equal to the project's, **When** the user changes
   the project's value to 25, **Then** the panel still shows 20.
5. **Given** a parent panel with its own module reserve 40 and a sub-panel under it that holds no value
   of its own, **When** the user looks at the sub-panel, **Then** it shows the project's value marked
   «з проекту».
6. **Given** a panel with an own value for some properties and inherited values for the rest, **When**
   the user saves and reopens the project, **Then** the same properties hold the same own values and
   the rest are inherited.

---

### User Story 3 - Mark incoming devices and separately bought accessories (Priority: P3)

In the main panel the user marks voltage relay, surge protective device and meter «встановлювати» and
leaves the main switch unmarked. They mark comb busbars and blanking plates «купувати окремо» and leave
the neutral bars, PE bar and cable glands unmarked, as every new panel has them.

**Why this priority**: The marks record decisions about one panel that no table and no project
property holds.

**Independent Test**: Add a panel, confirm all its marks are cleared, set and clear several of them,
confirm another panel is unaffected, then save, reopen and compare. Add, rename and delete rows of the
incoming device widths table and confirm the existing panel is unchanged while a panel added afterwards
takes the table as it now is.

**Acceptance Scenarios**:

1. **Given** a new panel, **When** the user looks at its properties, **Then** they see a
   «встановлювати» mark for each row the incoming device widths table held when the panel was created —
   four as shipped — and the five «купувати окремо» marks, all cleared.
2. **Given** a panel, **When** the user sets or clears any mark, **Then** only that mark of that panel
   changes.
3. **Given** a panel with some marks set, **When** the user saves and reopens the project, on this
   installation or on one whose incoming device widths table differs, **Then** the panel shows the same
   «встановлювати» marks under the same names, the same marks set and the rest cleared.
4. **Given** an existing panel with «Лічильник» marked, **When** the user adds the row «Перемикач
   мережа-генератор» to the incoming device widths table and deletes the row «Лічильник», **Then** the
   existing panel still shows exactly its four marks, «Лічильник» set; **When** the user then adds a
   panel, **Then** the new panel shows a cleared mark for «Перемикач мережа-генератор» and none for
   «Лічильник».
5. **Given** a panel, **When** the user sets a mark and then undoes, **Then** the mark is cleared;
   **When** they redo, **Then** it is set again.

---

### User Story 4 - View and edit the three new reference tables (Priority: P4)

The user opens the reference tables section and finds, beside the load types and zones, the enclosure
sizes, the device widths by pole count, and the widths of the optional incoming devices, filled with the
shipped values of *Reference Table Columns*. They delete the four records with row modularity 13, which their
supplier does not stock, add an enclosure size of 2 rows of 14, and change the meter's 1ф width from 6
to 5. After restarting the application, all the changes are still there.

**Why this priority**: These tables hold the values the calculation of the source document's Part 2
reads; this feature makes them present and lets the user correct them.

**Independent Test**: On a fresh installation, open the section and compare the three tables with the
shipped values of *Reference Table Columns* cell by cell, then change one cell, add one row and delete one row in each table,
restart the application and confirm all nine changes persist.

**Acceptance Scenarios**:

1. **Given** a fresh installation, **When** the user opens the reference tables section, **Then** it
   shows the enclosure sizes table with 16 records, the device widths table with 5 rows and the
   incoming device widths table with 4 rows, each value as listed in *Reference Table Columns*.
2. **Given** any of the three tables, **When** the user changes a cell, adds a row or deletes a row and
   restarts the application, **Then** the table holds the change.
3. **Given** a numeric column of any of the three tables, **When** the user enters text that is not a
   number, or a number outside the column's value kind — a row count of 0 or 1.5, a width of 0 —
   **Then** the edit is refused with the reason shown.
4. **Given** the device widths table or the incoming device widths table, **When** the user clears a
   row's name or gives it the name of another row in the same table, **Then** the edit is refused with
   the reason shown and the table stays as it was before that edit.

---

### User Story 5 - Calculated fields, empty and kept in the file (Priority: P5)

The user selects the garage sub-panel. Among its properties they see the enclosure, the device
composition and the accessory quantities, all empty, and — because the sub-panel is a line of the main
panel — its group RCD and phase, empty too. Selecting a consumer under the garage panel, they see its
group RCD and phase, empty.

**Why this priority**: The fields are where the calculation of the source document's Part 2 will put
its results, and the project file already holds them; they carry no value in this feature.

**Independent Test**: Build entry → main panel → sub-panel → consumer; select each node and confirm
which calculated fields it shows, all empty and not editable, then save, reopen and confirm the same
fields are present and empty.

**Acceptance Scenarios**:

1. **Given** any panel, **When** the user looks at its properties, **Then** they see the enclosure, the
   device composition and the accessory quantities, each holding no value and not editable.
2. **Given** an end consumer, **When** the user looks at its properties, **Then** they see its group
   RCD and its phase, each holding no value and not editable.
3. **Given** a panel whose parent is a panel, **When** the user looks at its properties, **Then** they
   also see its group RCD and its phase as a line of the parent panel, each holding no value and not
   editable.
4. **Given** a project with panels, sub-panels and consumers, **When** the user saves and reopens it,
   **Then** every node holds the same calculated fields as before, empty.

---

### Edge Cases

- **Empty project value**: a panel that inherits it shows it empty, marked «з проекту» (User Story 1,
  scenario 2).
- **Own value equal to the project's**: it is still the panel's own value and does not follow a change
  of the project value (User Story 2, scenario 4); only a reset makes the panel inherit again.
- **Sub-panel under a panel with own values**: a panel at any nesting level inherits from the project,
  not from its parent panel (User Story 2, scenario 5).
- **Incoming device row added, renamed or deleted**: existing panels keep their copies and marks; only
  a panel created afterwards takes the table as it then is (FR-009).
- **Stored reference tables unreadable at startup**: as in 002/FR-007, refused as a whole with
  the failing element named; the application continues with all five tables as shipped and keeps the
  refused file as a copy.

## Requirements *(mandatory)*

### Functional Requirements

#### Project properties

- **FR-001**: A project MUST carry the six properties listed in *Project Properties*.
- **FR-002**: Users MUST be able to view and change each project property, and to clear it back to
  empty, in the properties area of the service entry node, below its name and note. A property MUST accept only a value of its kind or empty, and refuse any other with the reason
  shown, keeping its previous value.
- **FR-003**: A new project MUST start with all six properties empty.

#### Panel properties

- **FR-004**: For each of the five properties marked *overridable* in *Project Properties*, a panel
  MUST either hold no value of its own, inheriting the project's value, or hold its own value. Supply
  phases has no panel override, as the source document states.
- **FR-005**: The properties area of a panel MUST show the five overridable properties. An inherited
  property MUST show the project's current value, empty included, with the mark «з проекту»; a
  property with the panel's own value MUST show that value without the mark.
- **FR-006**: Users MUST be able to set a panel's own value for each overridable property, under the
  value kinds of FR-002, and to reset it, after which the panel inherits the project's value again.
- **FR-007**: A change of a project property MUST show at once on every panel that inherits it and on
  no panel that holds its own value of it, including an own value equal to the project's.
- **FR-008**: Every panel, at any nesting level, MUST inherit from the project.
- **FR-009**: When a panel is created, it MUST take a copy of every row of the incoming device widths
  table — the device name and its 1ф and 3ф widths. The panel MUST carry one «встановлювати» mark for
  each device of its copy, named after that device, and five «купувати окремо» marks — neutral bars,
  PE bar, comb busbars, cable glands, blanking plates. On a new panel all marks MUST be cleared. No
  later edit of the table MUST change the copy held by an existing panel, in the open project or in a
  saved file, and a project file opened on any installation MUST show each panel's marks from the copy
  it holds.
- **FR-010**: Users MUST be able to set and clear each mark of a panel; doing so MUST change that mark
  of that panel only.

#### Calculated fields

- **FR-011**: The properties area of every panel MUST show three calculated fields — enclosure (row
  modularity and row count), device composition, accessory quantities — each holding no value and not
  editable.
- **FR-012**: The properties area of every end consumer, and of every panel whose parent is a panel,
  MUST show two calculated line fields — group RCD and phase (L1/L2/L3) — each holding no value and not
  editable.

#### Reference tables

- **FR-013**: System MUST provide three reference tables — *enclosure sizes*, *device widths by pole
  count* and *incoming device widths* — with the columns listed in *Reference Table Columns*, shown in
  the reference tables section of feature 002 beside the load types and zones.
- **FR-014**: System MUST ship the three tables filled with exactly the shipped values listed in
  *Reference Table Columns*: 16 enclosure sizes, 5 device widths and 4 incoming devices, in the order
  listed there.
- **FR-015**: An enclosure size MUST hold exactly a row modularity and a row count. Its capacity, row
  modularity × row count, is not stored, and an enclosure size has no manufacturer and no series.
- **FR-016**: Users MUST be able to change any cell, add a row and delete a row in each of the three
  tables, as 002/FR-004 provides for the load types and zones.
- **FR-017**: The columns marked *name* in *Reference Table Columns* MUST hold a value that is
  non-empty and unique within its table, and the numeric columns only a number of their value kind,
  under the rules of 002/FR-005 and 002/FR-006: an edit that breaks them is refused with the reason
  shown, and the table stays as it was before that edit. Every other cell may be left empty.
- **FR-018**: The three tables MUST be stored together with the load types and zones, under the
  storage rules of 002/FR-007: on the user's machine, in JSON format, one set per installation, each accepted edit stored as
  soon as it is made and kept through an application restart, and an unreadable stored set refused as a
  whole.

#### Project file

- **FR-019**: The project file MUST hold the six project properties, empty ones included, and, for every
  panel, which overridable properties it inherits, its own values of the rest, its copy of the
  incoming devices with their «встановлювати» marks, and its «купувати окремо» marks.
  Saving and reopening a project MUST reproduce all of them exactly.
- **FR-020**: The project file MUST hold the calculated fields of FR-011 and FR-012 for every node that
  shows them. Saving and reopening a project MUST reproduce them exactly, empty ones included.

#### Undo and redo

- **FR-021**: Each change of a project property, set or cleared, each own value set on a panel or
  reset, and each mark set or cleared on a panel MUST be one step of the undo/redo history that holds
  the other edits of the tree (001/FR-011).

### Key Entities *(include if feature involves data)*

- **Project**: As in feature 002, plus the six properties of *Project Properties*, each possibly empty.
- **Panel**: As in feature 001, plus an own value or inheritance for each of the five overridable
  properties, a copy of the incoming device widths table taken at its creation with a «встановлювати»
  mark per device, five «купувати окремо» marks, and the calculated enclosure, device composition and
  accessory quantities; a panel whose parent is a panel also carries the calculated group RCD and
  phase.
- **End Consumer**: As in feature 002, plus the calculated group RCD and phase.
- **Enclosure Size**: A row modularity and a row count (source document, «Типорозміри корпусів»).
- **Device Width by Pole Count**: A pole configuration and its width in modules (source document,
  «Ширина апаратів за полюсністю»).
- **Incoming Device Width**: An optional incoming device and its width in modules for a 1ф and for a
  3ф supply (source document, «Ширина опційних ввідних апаратів»).

## Project Properties

| Property | Source header | Values | Overridable on a panel |
|---|---|---|---|
| Supply phases | Фазність вводу | 1ф / 3ф | no |
| Module reserve, % | Резерв модулів, % | a number ≥ 0 | yes |
| Separate RCD execution | Виконання окремого ПЗВ | диф / автомат + ПЗВ | yes |
| Max lines per group RCD | Макс. ліній на групове ПЗВ | a whole number ≥ 1 | yes |
| Neutral break | Розрив нейтралі | так / ні | yes |
| Selective RCD on a sub-panel feeder line | Селективне ПЗВ на лінії живлення підщитка | так / ні | yes |

The source document explains neutral break: «так» — single-phase breakers 1P+N, three-phase 4P; «ні» —
1P and 3P; usually «ні» for TN-C-S and «так» for TT.

## Reference Table Columns

### Enclosure sizes (source document, «Типорозміри корпусів»)

| Column | Source header | Value kind |
|---|---|---|
| Row modularity | модульність ряду | whole number ≥ 1 |
| Row count | кількість рядів | whole number ≥ 1 |

Shipped: 16 records, one for each row modularity and row count below, in this order — 12×1, 12×2,
12×3, 12×4, 13×1, … 24×4.

| Row modularity | Row counts |
|---|---|
| 12 | 1, 2, 3, 4 |
| 13 | 1, 2, 3, 4 |
| 18 | 1, 2, 3, 4 |
| 24 | 1, 2, 3, 4 |

### Device widths by pole count (source document, «Ширина апаратів за полюсністю, модулів»)

| Column | Source header | Value kind |
|---|---|---|
| Pole count | Полюсність | name |
| Width, modules | Модулів | number > 0 |

| Shipped row | Width, modules |
|---|---|
| 1P | 1 |
| 1P+N | 2 |
| 2P | 2 |
| 3P | 3 |
| 4P | 4 |

### Incoming device widths (source document, «Ширина опційних ввідних апаратів, модулів»)

| Column | Source header | Value kind |
|---|---|---|
| Device | Апарат | name |
| Width for a 1ф supply, modules | 1ф | number > 0 |
| Width for a 3ф supply, modules | 3ф | number > 0 |

| Shipped row | Source name | 1ф | 3ф |
|---|---|---|---|
| Voltage relay | Реле напруги | 2 | 4 |
| Surge protective device | ОПН | 2 | 4 |
| Meter | Лічильник | 6 | 8 |
| Main switch | Рубильник | 2 | 4 |

## Relation to Feature 002

The following parts of [`specs/002-reference-tables-consumer-fields/spec.md`](../002-reference-tables-consumer-fields/spec.md)
are extended by this feature; everything not listed stays in force.

| Feature 002 | Extended by |
|---|---|
| 002/FR-001: two reference tables, load types and zones | FR-013: three more tables |
| 002/FR-003, 002/FR-004: a section where both tables are shown and edited | FR-013, FR-016: the same section shows and edits all five |
| 002/FR-007: the stored reference tables | FR-018: the stored set holds all five |
| 002/FR-016 and *Key Entities — Project*: the project file holds schema version, name, timestamps and tree | FR-001, FR-019: the six project properties |
| *Key Entities — Service Entry, Panel*: unchanged from feature 001 | FR-002: the service entry's properties area shows the project properties; FR-004 – FR-012, FR-020: the panel's overridable properties, marks and calculated fields |
| 002/FR-009, 002/FR-016, 002/SC-006 and the two-group properties area of feature 002: an end consumer carries exactly identifier, name, load type, zone and cable cross-section, in its properties area and in the project file | FR-012, FR-020: it also carries the calculated group RCD and phase |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fresh installation, a cell-by-cell comparison of the three new tables with the
  shipped values of *Reference Table Columns* finds zero differences across 16 enclosure sizes, 5 device
  widths and 4 incoming devices.
- **SC-002**: A changed cell, an added row and a deleted row in each of the three tables are all present
  after an application restart, in 100% of attempts.
- **SC-003**: After a change of a project property, 100% of panels that inherit it show the new value
  marked «з проекту», and 0 panels that hold their own value show a change.
- **SC-004**: A project saved and reopened reproduces every project property, every panel's own values,
  which of its properties are inherited, all marks of every panel, and every calculated field of
  every panel and consumer with zero differences, including empty values.
- **SC-005**: 100% of panels show the three calculated panel fields, and 100% of end consumers and of
  panels under a panel show the two calculated line fields, all empty.
- **SC-006**: After any edit of the incoming device widths table, 0 existing panels, in the open project
  or in a reopened file, show a changed «встановлювати» mark.

## Assumptions

- **«встановлювати» marks start cleared**: forced by FR-009 — a mark on a new panel has to start in
  some state. The source document states this default for the «купувати
  окремо» marks and none for these; the same one is taken.
- **Project properties kept in the project file**: forced by 001/FR-001, under which a project
  is saved and reopened; the properties belong to the project.
- **New tables in the existing section, stored with the others**: forced by the 2026-10-11
  clarification — the three tables are edited as the load types and zones are — and by the source
  document, which files them under «Довідники».
- **A name column in two of the new tables**: forced by the same clarification. 002/FR-005
  requires a non-empty, unique name because rows are told apart by it; the pole count and the device
  play that part in their tables.
- **Calculated fields not editable**: forced by the 2026-10-11 clarification together with the source
  document, which names the calculation as the source of these fields.
