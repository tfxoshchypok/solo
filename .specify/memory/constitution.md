<!--
Sync Impact Report
- Version: 1.0.0 → 1.1.0 (MINOR: two principles added)
- Modified principles: none
- Added: II. Real Cases Only (NON-NEGOTIABLE); III. Silent by Default
- Removed: none
- Templates: plan-template.md ✅ no change (its Constitution Check reads gates from this file);
  spec-template.md, tasks-template.md ✅ no change (Governance: this document wins over templates)
- Deferred TODOs: none
-->

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

### II. Real Cases Only (NON-NEGOTIABLE)

Every feature, scenario, requirement, task, test, code path and review finding MUST describe a real
case. A case is real when it passes both checks:

- **Reachable.** A named actor can bring it about in the app as built, or as planned in `plan.md`,
  `tasks.md` and `contracts/`: the user working through the app's own screens, or a file the app
  itself wrote. A value the interface cannot produce, a call the interface never makes and a file
  edited by hand are not reachable.
- **Used for the app's purpose.** The user would actually do it to meet a need of the app's main
  purpose, as the opening paragraph of `README.md` states it: an electrician or a flat owner builds
  the power tree, entry → panels → end consumers. A sequence that is possible but that nobody would
  perform, and a capability that serves no need of that purpose, do not qualify.

**What follows.** A case that fails either check is not written: no scenario, requirement, task or
test, no guard clause or refusal code in the code, no review finding. One found in an existing
artifact is deleted with no residue, as in Principle I. If the spec, plan and code cannot settle
whether a case is real, it is a question to the user, not a test.

**Additional cases.** A feature or test that serves no need of the app's main purpose is added only
on the user's explicit command. The spec or task that carries it names that command, so a later
check under this principle does not delete it.

**Rationale.** A test of an unreachable case costs as much as a real one: it is written, kept green
and read at every review. It also demands code, such as refusals for calls no screen makes, that no
user will ever trigger.

**Scope.** Every artifact in every phase: `spec.md` and its checklists, `plan.md`, `tasks.md`,
tests, source code and code review, from `/speckit-specify` to the end of implementation. Unlike
Principle I, it does not lapse when planning starts.

**Compliance check.** Before a test outline, a set of tests or review findings is shown to the user,
each case in it MUST name its actor, the path that reaches it (a screen and an action, or a file the
app wrote) and the need of the app's purpose it serves. A case that cannot name all three is dropped
before it is shown.

### III. Silent by Default

Whatever the app can do correctly on its own, it MUST do without the user noticing: no dialog,
confirmation, message or extra step. The user is interrupted only when the outcome depends on a
decision only they can make, or when an action of theirs was refused and they need the reason.

**Rationale.** Every interruption spends the user's attention on something the app could have
settled by itself.

**Scope.** Every behaviour that a specification, plan, task or change of code introduces or alters
from version 1.1.0 on.

**Compliance check.** Each dialog, confirmation or message that a specification or plan introduces
MUST name which of the two conditions above it meets.

## Governance

This constitution takes precedence over the default behaviour of any Spec Kit command. Where a
command template and this document conflict, this document wins.

Amendments require an explicit request from the user, a dated entry in the version line below, and a
one-line note of what changed and why. Principles are added only when the user asks for them; this
document does not accumulate best practices on its own initiative.

**Version**: 1.1.0 | **Ratified**: 2026-09-07 | **Last Amended**: 2026-10-25

<!--
  1.0.0 (2026-09-07) — Initial ratification. Added Principle I, "Specify Only What Was Asked",
  after a specification draft introduced an electrical-calculation feature the user had not
  requested, and the first correction left prohibition clauses behind in its place.
  1.1.0 (2026-10-25) — Added Principle II, "Real Cases Only", and Principle III, "Silent by
  Default", at the user's request, after the phase 4 tests of feature 003 were cut back: they
  covered refusals for calls and select values the interface can never produce. Principle II also
  admits only features and tests that meet a need of the app's main purpose; others come only on
  the user's command.
-->
