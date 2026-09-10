# Solo Constitution

## Core Principles

### I. Specify Only What Was Asked (NON-NEGOTIABLE)

Every user story, functional requirement, key entity, success criterion and assumption written into a
specification MUST trace back to something the user actually stated. Nothing is added because it is
common in similar products, because it would round out the feature, or because it seems obviously
useful.

**Filling gaps.** A detail the user left unstated may be filled with a standard default only when the
stated request cannot be executed without it. Such a default MUST be recorded in the *Assumptions*
section and MUST name the part of the request that forced it. If the request is executable without
deciding the point, the point is not decided: it is raised as a question to the user.

**Removal leaves no residue.** When something is found in a specification that the user did not ask
for, it is deleted outright. It is not converted into a `MUST NOT` requirement, an assumption
explaining its absence, a success criterion asserting users understand its absence, a note in a
checklist naming it, or a parenthetical anywhere in the document. The absence is the record. The one
exception is a limit the user stated themselves — that stays, phrased as their own constraint.

**Rationale.** An unrequested requirement is indistinguishable from a requested one once the
specification reaches planning: it acquires tasks, code and tests, and the cost of the invention is
paid in full before anyone notices it was never wanted. A `MUST NOT` clause left behind after a
removal is the same failure in a quieter form — it keeps the invented feature present in the
document, and in the reader's head, as a thing that was considered.

**Scope.** This principle governs `spec.md`, its checklists, and any `/speckit-clarify` update to
them. It is in force from `/speckit-specify` until `/speckit-plan` runs for the first time on that
feature. After the first plan generation it lapses, because introducing technical decisions the user
did not state is precisely the job of the planning phase.

**Compliance check.** Before reporting a specification complete, every line of it MUST be traceable
to the user's request or to a gap-filling assumption that names its trigger. The specification's
quality checklist MUST carry an item recording that this check was performed.

## Governance

This constitution takes precedence over the default behaviour of any Spec Kit command. Where a
command template and this document conflict, this document wins.

Amendments require an explicit request from the user, a dated entry in the version line below, and a
one-line note of what changed and why. Principles are added only when the user asks for them; this
document does not accumulate best practices on its own initiative.

**Version**: 1.0.0 | **Ratified**: 2026-09-07 | **Last Amended**: 2026-09-07

<!--
  1.0.0 (2026-09-07) — Initial ratification. Added Principle I, "Specify Only What Was Asked",
  after a specification draft introduced an electrical-calculation feature the user had not
  requested, and the first correction left prohibition clauses behind in its place.
-->
