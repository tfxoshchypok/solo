# Specification Quality Checklist: Reference Tables and Consumer Fields

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-26
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Constitution Compliance

- [x] Every requirement, user story, entity, success criterion and assumption traces to the user's own request, the source document, a clarification answer, or a gap-filling assumption that names its trigger (Principle I)
- [x] No requirement, note or assumption exists solely to describe something the specification does not do (Principle I)

## Validation Notes

The specification passes every item above after one revision pass.

### Revision pass

The first draft carried three lines that traced to nothing the user said:

- FR-008 and User Story 1 scenario 7 (switching sections keeps the open project) — now backed by an
  assumption naming FR-003 and feature 001 FR-031 as its trigger.
- FR-013 (find a load type by name fragment) — now backed by an assumption carrying it over from feature
  001 FR-021.
- A sentence saying the section uses the source document's headers as column titles — removed; the
  column table now only records the source header for traceability.

### On "no implementation details"

FR-007 names JSON as the storage format. That is the user's own requirement ("достатньо буде json
формату для довідників"), confirmed in the 2026-09-26 clarification, not a design choice of the
specification.

### Scope settled in the 2026-09-26 clarification session

Recorded in the spec's *Clarifications* section: the tables are edited as tables and stored as JSON;
the load types table replaces the feature 001 catalog of 87 types.

### Scope settled in the 2026-10-03 clarification session

Six questions, recorded in the spec's *Clarifications* section: a consumer keeps the reference and a
copy of every value of its load type and zone rows, taken when the row is chosen; choosing a row
again, the same one included, takes a fresh copy; every copied value is shown and edited on that
consumer only; a row changed or deleted later leaves the copy as it is, with no mark; the properties
area shows the consumer's own fields and the copied values as two groups (FR-010, FR-014, FR-015,
FR-021, FR-022, SC-007). The names of the copy are changed only by choosing a row — a gap-filling
assumption whose trigger, FR-014's rename rule, the spec's *Assumptions* names.

### Reconciliation with feature 001

The user asked that contradicting decisions be reconciled. The spec's *Relation to Feature 001* section
lists every feature 001 requirement, clarification and success criterion this feature supersedes.
FR-020 is the user's own limit for this stage ("на даному етапі ніяких розрахунків"), phrased as their
constraint.

### Coverage check

- 21 functional requirements in five groups: reference tables, end consumer, project file, the user's
  limit, and the consumer's properties area.
- 3 user stories, P1 through P3, each independently testable.
- 8 edge cases, dominated by rows changed after the copy and by values the tables refuse.
- 7 success criteria, each stated as a user-observable outcome with a numeric threshold.
