# Feature Specification: Electrical Consumer Tree Editor

**Feature Branch**: `001-electrical-load-tree-editor`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "створи візуальний редактор складу електричних мереж квартир та котеджів. обмеження: не потрібно моделювати прокладання мереж, а лише дерево споживачів- ввід - щиток1 - щиток2...щитокN. Для кожного щитка можливі варіанти: щиток1 - щиток 1.1 - щиток 1.2 ... щиток 1.N, або щиток1 - споживач1 - споживач2 ... сроживачN. щиток не може одночасно мати в потомках і інший щиток і споживача. Потрібно стоворити довідник типів кінцевих споживачів на підставі доступних онлайн даних. для таких споживачів добавити характеристики щодо споживання електроенергії."

## Overview

A visual editor for the **composition** of a residential electrical installation — an apartment or a detached house. The user builds a strictly hierarchical tree that starts at the service entry, branches through distribution boards ("panels"), and terminates in end consumers (appliances, lighting groups, fixed equipment).

The editor deliberately does **not** model physical wiring: no cable routes, no floor plans, no conduit lengths, no terminal-level connections. The only relationship expressed is "is fed from".

Every end consumer is placed from a built-in **consumer type catalog**, which supplies the appliance's name and its category. The tree is saved to and reopened from a file on the user's disk.

## Clarifications

### Session 2026-09-10

- Q: What stays in the scope of this feature? → A: The structure editor and the file only — building the tree and saving/reopening it. The catalog is the list a consumer is picked from; no separate catalog screen, no user-created types, no human-readable export.
- Q: What does a consumer node carry? → A: Catalog type, name, quantity, and a free-text note available on any node. No location label — a consumer's location is the panel it hangs under, which already has a name.
- Q: Must a consumer always be created from a catalog type? → A: Yes, always. The node records the type and can then be renamed.
- Q: What does the project file hold besides the tree? → A: Schema version, catalog version, project name, created and modified timestamps, root id, and the nodes. Each consumer also stores a copy of its type's name, so the file stays readable when a type is no longer in the catalog.
- Q: How many catalog types ship, carrying what? → A: At least 80 types across the listed categories, each carrying its display name, English name and category.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compose the distribution tree (Priority: P1)

An electrician preparing a quote for a two-storey house opens the editor, creates a project, and describes the installation top-down: the service entry, then a main panel, then a floor panel per storey, then the end consumers hanging off each floor panel. They add, rename, reorder, move and delete nodes until the tree matches the property.

**Why this priority**: This is the product. A user who can build and save a correct tree has a usable installation inventory.

**Independent Test**: Create a project, build a three-level tree (entry → main panel → 2 sub-panels → 6 consumers), save it, reopen it, and confirm the structure is identical.

**Acceptance Scenarios**:

1. **Given** an empty project, **When** the user creates it, **Then** exactly one service-entry node exists as the root and cannot be deleted or given a sibling.
2. **Given** a selected panel with no children, **When** the user adds a child panel, **Then** the child appears nested under it and the parent is now marked as a panel-parent.
3. **Given** a panel whose children are panels, **When** the user attempts to add an end consumer to it, **Then** the action is blocked and the user is told why, with the option to place the consumer under one of the child panels instead.
4. **Given** a panel whose children are end consumers, **When** the user attempts to add a child panel to it, **Then** the action is blocked and the user is offered to convert the panel by moving the existing consumers into a new sub-panel.
5. **Given** a sub-tree of 12 nodes, **When** the user drags its root panel onto a different panel that currently has no children, **Then** the whole sub-tree moves with it and all descendant relationships are preserved.
6. **Given** a panel that is dragged onto one of its own descendants, **When** the drop is attempted, **Then** it is rejected and the tree is left unchanged.
7. **Given** a panel with descendants, **When** the user deletes it, **Then** the user is shown how many descendant nodes will be removed and must confirm before the deletion applies.
8. **Given** any structural change has just been applied, **When** the user undoes it, **Then** the tree returns to its exact previous state, and redoing restores the change.
9. **Given** a tree built entirely with the keyboard, **When** the user compares it to the same tree built with a pointer, **Then** both are identical, confirming every editing action is reachable without a pointer.

---

### User Story 2 - Place end consumers from the catalog (Priority: P2)

The user needs to add a fridge, an induction hob, a washing machine and eight LED downlights to a kitchen panel. They search the catalog by name or browse by category, pick a type, and the new consumer arrives named after it. They then adjust the name and the quantity for this particular installation.

**Why this priority**: The catalog is what a consumer is created from — the tree structure works on its own, but every consumer would otherwise need its name typed from scratch.

**Independent Test**: Search the catalog for "холодильник", place the result under a panel, confirm the node is named after the type and records which type it came from, then rename the node and confirm the catalog entry is unchanged.

**Acceptance Scenarios**:

1. **Given** the user is adding a consumer, **When** they type part of a type name, **Then** matching types are listed with their category before selection.
2. **Given** a catalog type is selected, **When** the user places it under a panel that has no panel children, **Then** an end-consumer node is created recording that type and named after it.
3. **Given** a placed consumer, **When** the user renames it, **Then** only that node changes and the catalog type keeps its own name.
4. **Given** the user needs eight identical downlights, **When** they set a quantity of 8 on one consumer node, **Then** the node records eight units without requiring eight separate sibling nodes.

---

### User Story 3 - Keep the project on disk (Priority: P3)

The user saves the installation to a file, closes the application, reopens the file later, and continues from where they stopped. They can hand that file to a colleague, who opens it in their own copy of the editor.

**Why this priority**: Work that cannot be put down and picked up again is not usable beyond a single sitting.

**Independent Test**: Build a tree, save it, close and reopen the application, open the file, and confirm the tree is identical node for node.

**Acceptance Scenarios**:

1. **Given** a project with unsaved changes, **When** the user saves it to a file and reopens that file, **Then** the tree, every node name, every quantity and every note are reproduced exactly.
2. **Given** a project file, **When** it is opened in an installation whose catalog no longer contains one of the referenced types, **Then** the affected consumers still read correctly, because each node carries the type name recorded when it was placed.
3. **Given** a malformed or truncated project file, **When** the user opens it, **Then** it is rejected as a whole with the failing element named, and no half-loaded project is left behind.
4. **Given** no network connection is available, **When** the user creates a project, places catalog consumers and saves the result, **Then** every one of those steps completes normally.

---

### Edge Cases

- **Mixed-children attempt**: adding a panel to a consumer-parent, or a consumer to a panel-parent, must never silently succeed. The block explains the rule and offers the structural fix (wrap the existing consumers in a new sub-panel).
- **Emptying a panel**: when the last child of a consumer-parent or panel-parent is removed, the panel returns to "undecided" and will accept either child kind again.
- **Move that would break the rule**: dragging a consumer into a panel-parent, or a panel into a consumer-parent, is rejected at drop time with the same explanation as the add path.
- **Move into own descendant**: rejected; the tree is unchanged.
- **Deep nesting**: nesting beyond the supported depth is refused with the current depth shown, rather than producing an unreadable tree.
- **Type missing from the catalog**: a consumer whose type is no longer in the catalog still displays, because the node carries the type name stored when it was placed.
- **Large project**: a tree of 500 nodes must remain navigable.
- **Corrupt or partial project file**: rejected as a whole with the failing element named; a project is never half-loaded.

## Requirements *(mandatory)*

### Functional Requirements

#### Project and tree structure

- **FR-001**: System MUST let a user create, name, save, reopen and delete installation projects, where a project describes exactly one apartment or house.
- **FR-002**: System MUST create every new project with exactly one root node of kind *service entry*, which cannot be deleted, duplicated, or given a sibling.
- **FR-003**: System MUST support exactly three node kinds: *service entry* (root), *panel* (intermediate), and *end consumer* (leaf).
- **FR-004**: System MUST treat *end consumer* nodes as leaves that can never have children.
- **FR-005**: System MUST allow a *panel* to have zero children.
- **FR-006**: System MUST let users add, rename, delete, reorder among siblings, and re-parent nodes.
- **FR-007**: System MUST support nesting of at least 6 levels of panels below the service entry and MUST refuse deeper nesting with an explicit message stating the limit.
- **FR-008**: System MUST reject any move that would place a node inside its own sub-tree, leaving the tree unchanged.
- **FR-009**: System MUST move a node's entire sub-tree with it when it is re-parented.
- **FR-010**: System MUST require explicit confirmation before deleting a node that has descendants, stating how many nodes will be removed.
- **FR-011**: System MUST provide undo and redo for every structural change (add, delete, move, reorder, rename).
- **FR-012**: System MUST let users attach a free-text note to any node.

#### Homogeneous-children constraint

- **FR-013**: System MUST enforce that a panel's children are either all panels or all end consumers, and never a mixture.
- **FR-014**: System MUST apply the same constraint to the service-entry node.
- **FR-015**: System MUST block a violating add or move at the moment it is attempted and explain the rule in the user's own terms, rather than accepting it and reporting an error later.
- **FR-016**: When a user tries to add a sub-panel to a panel that already holds end consumers, System MUST offer to move all of those consumers into a newly created sub-panel so the requested structure becomes valid in one step.
- **FR-017**: When a user tries to add an end consumer to a panel that already holds sub-panels, System MUST offer to place it under a chosen sub-panel instead.
- **FR-018**: When a panel loses its last child, System MUST return it to an undecided state that accepts either child kind.

#### Consumer type catalog

- **FR-019**: System MUST ship a built-in catalog of at least 80 end-consumer types across the categories listed in *Catalog Scope*.
- **FR-020**: Each catalog type MUST carry a display name, an English equivalent of that name, and a category.
- **FR-021**: System MUST let users find a catalog type by name fragment and by category while placing a consumer.
- **FR-022**: System MUST ship the catalog with the product and MUST NOT require a network connection to read it.

#### End-consumer instances

- **FR-023**: System MUST create every end-consumer node from a catalog type, recording which type it came from and naming the node after that type.
- **FR-024**: System MUST let users rename an end-consumer node without affecting the catalog type or any other node.
- **FR-025**: System MUST support a quantity of identical units on one consumer node, so that repeated identical loads need not be entered as separate sibling nodes.

#### Visual editing

- **FR-026**: System MUST present the installation as a visual tree in which each node's kind and name are readable without opening the node.
- **FR-027**: System MUST support building the tree by direct manipulation, including drag-and-drop re-parenting, with rejected drops indicated before the drop is released.
- **FR-028**: System MUST support collapsing and expanding any panel's sub-tree.
- **FR-029**: System MUST show the properties of the selected node in a dedicated area, editable in place.
- **FR-030**: System MUST make every editing action reachable by keyboard as well as by pointer.
- **FR-031**: System MUST persist the user's work continuously or on an explicit save, and MUST never lose a confirmed structural change on an unexpected close.

#### Persistence

- **FR-032**: System MUST store projects locally and MUST remain fully functional without a network connection.
- **FR-033**: System MUST save a project to a self-contained, machine-readable file holding the schema version, the catalog version, the project name, its created and modified timestamps, and the whole tree.
- **FR-034**: System MUST store, on every end-consumer node, a copy of its catalog type's name, so a project file stays readable when the referenced type is no longer in the catalog.
- **FR-035**: System MUST reopen such a file and reproduce the project exactly.
- **FR-036**: System MUST reject a malformed or partial project file in full, naming the failing element, and MUST never leave a partially loaded project behind.
- **FR-037**: System MUST allow at least 500 nodes in one project without loss of navigability.

#### Explicit exclusions

- **FR-038**: System MUST NOT model cable routes, cable lengths, cable cross-sections, conduits, terminal-level connections, or physical placement on a floor plan.

### Key Entities *(include if feature involves data)*

- **Project**: One apartment or house. Holds the node tree and project metadata — name, schema version, catalog version, created and modified timestamps.
- **Node**: A single element of the tree, of one of three kinds. Holds a name, an optional note, its parent, and its position among siblings.
  - **Service Entry**: The unique root of the tree, representing the supply point of the dwelling.
  - **Panel**: An intermediate node. Carries a *children kind* that is one of *undecided*, *panels*, or *consumers* — the field that enforces the homogeneity rule.
  - **Consumer Instance**: A leaf. References a catalog type, stores a copy of that type's name, and holds a quantity.
- **Consumer Type (catalog entry)**: A reusable appliance definition: display name, English name, and category.
- **Category**: A grouping of consumer types used for browsing while placing a consumer.

## Catalog Scope

The built-in catalog is compiled once and shipped with the product. It is a reference table, not a live feed.

### Categories to cover

| Category | Representative types |
|----------|----------------------|
| Kitchen | refrigerator, freezer, induction hob, electric oven, microwave, dishwasher, kettle, coffee machine, extractor hood, food waste disposer |
| Laundry | washing machine, tumble dryer, washer-dryer, iron |
| Water heating | storage water heater, instantaneous water heater, heat-pump water heater |
| Space heating & cooling | electric convector, underfloor heating loop, heat pump, split air conditioner, towel rail, fan |
| Lighting | LED downlight, LED strip, incandescent and halogen fixtures, outdoor lighting |
| Audio / video | television, set-top box, game console, receiver, projector |
| Office / IT | desktop computer, gaming computer, laptop, monitor, printer, router, network equipment |
| Pumps & utilities | well pump, circulation pump, booster pump, sump pump, ventilation unit |
| Workshop & garden | drill, circular saw, bench grinder, compressor, lawn mower, hedge trimmer |
| Vehicle charging | wall-mounted EV charger, single-phase and three-phase variants |
| Sockets & misc | general socket group, vacuum cleaner, hair dryer, dehumidifier, humidifier, small chargers |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who has never opened the product can build a valid three-level tree — service entry, two panels, six consumers — in under 5 minutes without consulting documentation.
- **SC-002**: 100% of attempts to give a panel both a panel child and a consumer child are blocked, and every block is accompanied by an offered structural fix that resolves the situation in one confirmation.
- **SC-003**: At least 90% of the end consumers in a typical residential project can be placed directly from the built-in catalog.
- **SC-004**: A user can find any catalog type by name fragment in under 10 seconds from the moment they decide to add it.
- **SC-005**: A project saved and reopened reproduces the tree, every node name, every quantity and every note with zero differences.
- **SC-006**: A tree of 500 nodes remains navigable: expanding, collapsing, selecting and dragging stay responsive with no perceptible delay.

## Assumptions

- **Catalog delivery**: The built-in catalog is compiled once and bundled with the product. The product does not query anything at runtime; a refreshed catalog arrives as a new bundled version.
- **No physical modelling**: Explicitly excluded by the request — no cable routing, no lengths, no floor plans, no single-line diagram symbols beyond what the tree needs.
- **Single user, local data**: One person edits a project at a time on their own machine. No accounts, no sharing, no concurrent editing. Collaboration would be a separate feature.
- **Quantity over duplication**: Repeated identical loads such as downlights are expressed with a quantity on one node rather than as many sibling nodes.
- **Lighting groups as consumers**: A lighting circuit is modelled as one consumer node with a quantity, not as a panel, because it is a terminal load.
- **Interface language**: Ukrainian, with catalog type names carrying an English equivalent.
