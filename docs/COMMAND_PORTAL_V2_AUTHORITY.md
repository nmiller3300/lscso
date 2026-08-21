# LSCSO Command Portal V2 — Authority Contract

This document governs Command Portal V2 authorization behavior. UI surfaces must not create independent rank rules that conflict with this contract.

## Core rule

Authorization is based on rank capability plus current organizational scope. Certification is a qualification record and never grants supervisory authority by itself.

## Standing department-wide operational authority

The following ranks have standing department-wide operational reach regardless of their primary bureau or division assignment:

- Sheriff
- Undersheriff
- Major
- Captain

A home assignment establishes normal responsibility and dashboard priority. It does not block these ranks from acting elsewhere in LSCSO when operationally required.

Executive-only actions remain Sheriff/Undersheriff functions where separately defined.

## Scope-aware authority

The following ranks require a valid supervisory or command relationship to the subject for normal personnel actions:

- 1st Lieutenant
- Lieutenant
- Sergeant
- Corporal

1st Lieutenant remains Command Staff but does not receive Captain-style department-wide personnel reach merely because the access tier is Command.

Valid scope can originate from:

- direct supervision
- authority over the subject's active organizational unit
- inherited downward command chain
- active temporary organizational assignment
- matter-specific conflict reassignment
- an explicit directed action for the permitted task

## Multiple assignments

A person may hold multiple simultaneous assignments, including primary, secondary, special, and temporary assignments. Each assignment may create a legitimate supervisory path through a different unit.

A person may therefore be under the purview of multiple supervisors for different active assignments.

The portal must show why the person is in the viewer's purview rather than flattening all relationships into one supervisor field.

## Command inheritance

Scoped leaders inherit appropriate authority downward through their active command chain.

Example:

1st Lieutenant -> Lieutenant -> Sergeant -> Deputy

The 1st Lieutenant can reach the Deputy through that active chain even if the Deputy is not a direct report.

## Directed actions

An authorized superior may direct a scoped leader to perform a specific action involving an otherwise out-of-purview member.

Example: Sheriff directs a 1st Lieutenant in training to conduct and document a Conversation Guardian with a deputy outside the 1st Lieutenant's normal unit.

The result remains the normal Guardian type. There is no Training Guardian label.

Directed authority:

- is subject-specific
- is capability-specific
- is time-limited or completion-limited
- does not expose the subject's entire unit
- does not create a permanent supervisory relationship
- is recorded in the audit/authority history

## Conflict of interest / recusal

A normal supervisory relationship may be recused for a specific matter without changing the person's organizational assignment.

A recusal may identify a replacement authorized leader for that matter. The recused person must not approve or materially alter the matter while the recusal is active unless formally restored.

## FTO / trainer authority

FTO or trainer status creates training authority only over assigned trainees or training matters. It does not create general supervisory authority over the trainee's personnel file.

Training authority can permit training records, evaluations, and certification recommendations according to policy.

## Information access principle

Authorized information must be easy to retrieve through more than one sensible path. Search is a fast path, not the only path.

Command and supervisors should have appropriate browse views such as:

- personnel under purview
- organizational/unit views
- recent records
- recently viewed records
- full authorized lists
- search and filters

Every path must resolve to the same underlying record and the same authorization decision.

## Permanent rules for Portal V2

- My Info remains available to every authenticated member regardless of rank.
- Existing functionality is not removed solely to simplify navigation.
- Dangerous actions remain confirmed and audited.
- Permanent records are not silently rewritten when assignments or supervisors change.
- Organizational history must preserve effective dates.
- UI permission checks are advisory; database/RPC authorization remains the enforcement boundary.
- No page may rely solely on client-side hiding to secure protected data.
