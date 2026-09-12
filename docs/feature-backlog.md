# LSCSO Website Feature Backlog

This document tracks approved concepts and future feature ideas for the LSCSO public website, Personnel Portal, roster, recruitment, Guardian, and Command workflows. It is intentionally a backlog, not a commitment to build everything at once.

## Confirmed concepts

### Promotion workflow
A full promotion review system with three valid entry paths:

1. **Personnel request** — an eligible member requests a promotion review for themselves.
2. **Supervisor recommendation** — a supervisor recommends a member for promotion.
3. **Command initiated** — Command starts a promotion review without a request or recommendation.

All three paths should converge into one promotion case with source, requested/recommended rank, eligibility checks, reviewer assignment, supporting notes, review/interview steps if required, decision, effective date, and permanent personnel-history entry. Approval should update the existing personnel record rather than create a separate record.

Future enhancement: configurable rank prerequisites, minimum time-in-grade, certifications, Guardian review, probation status, and automatic eligibility warnings.

### Guardian performance evaluations and record continuity
Performance evaluations belong inside the Guardian system rather than as a separate personnel module.

Guardian is part of the member's permanent personnel record. Guardian history follows the person through transfers, separation, rehire, reinstatement, and future personnel actions; it is not reset or detached because the member changes assignment, rank, or employment status.

Guardian should eventually support scheduled and ad-hoc evaluations, evaluation categories, supervisor narrative, strengths/improvement areas, member acknowledgment, command review, and historical evaluations as part of the member's accountability/service record.

### Personnel record PDF export
Command needs the ability to export an individual's personnel record as a professional PDF for lateral-transfer or records purposes.

The export should be generated from the authoritative personnel record and allow Command to control which sections are included. Likely sections: identity/service summary, rank history, assignments, certifications, training, awards/commendations, employment dates, Guardian records, evaluations, and other service history.

Guardian records are part of the personnel record and must be available for authorized personnel-record releases. The export/release workflow may still apply role-based access and release rules, but Guardian history is not treated as a separate record that disappears or is omitted by default simply because the member transfers, separates, or is rehired.

### Command Orders
Create an internal Command Orders system modeled after the existing PSA publishing workflow, but inside the Personnel Portal.

Command Orders should support order number, title, issuing authority, effective date, body, attachments, active/rescinded status, target audience, required acknowledgment when applicable, and a permanent archive. Personnel should see active orders relevant to them from the portal.

### Training record and FTO redesign
Training history is broader than Recruit Academy or FTO. Personnel appointed directly into Deputy, supervisory, Command, Sheriff, Undersheriff, lateral-entry, rehire, or reinstatement positions can still have legitimate training history even when they never completed LSCSO Recruit/FTO training.

The personnel record should distinguish three training record categories:

1. **Department Training** — LSCSO Academy, FTO, remedial training, continuing education, leadership training, in-service training, qualifications, and other department-completed training.
2. **Prior / Lateral Training** — training completed with another agency or organization and accepted into the LSCSO personnel record. Records should support source agency/provider, course, completion date when known, documentation, who verified it, and an acceptance status such as Verified, Accepted as Equivalent, or Recorded for History Only.
3. **Training Requirement Disposition** — a permanent explanation when an entry requirement was not applicable or was formally waived, such as FTO Not Required — Appointed at Command Rank or Academy Waived — Verified Lateral Entry.

`training_progress` should remain the active workflow for a member currently going through a program, but it should not be the entire historical training record. A permanent completed-training ledger should retain final training outcomes after the active workflow is closed.

Completing or releasing a member from Academy/FTO should automatically write the permanent completion record and route any required final personnel action back to Command instead of ending at a percentage/status change with no next step.

Training & FTO management should ultimately live in the main Personnel Portal rather than being buried in the separate roster-management workspace. Command should be able to start a training record, assign the trainer/FTO, and review progress there; assigned trainers should have a clear trainee workspace for recording phases, progress, evaluations, remediation, and release recommendations.

Existing personnel should not receive fabricated backdated Academy/FTO records simply to fill blank history. Historical records should be added only when based on known, documented, or Command-verified information. Every existing member should eventually have an entry-training basis/disposition so a blank FTO section does not falsely imply missing training.

## Additional backlog ideas

### Career and personnel development
- **Promotion eligibility dashboard** — automatically show who currently meets, nearly meets, or does not meet requirements for each promotable rank and why.
- **Career development plan** — supervisors can document a member's next-rank goals, recommended training, specialty interests, and development milestones without making it a formal promotion case.
- **Specialty assignment applications** — personnel can apply for FTO, investigations, traffic, command-support, or future specialty units; supervisors/Command can also nominate members.
- **Internal vacancy postings** — Command can advertise open supervisory or specialty positions inside the portal with requirements, closing date, and an Apply/Recommend workflow.
- **Transfer / reassignment workflow** — request or Command-initiate division, unit, supervisor, or primary-assignment changes with an audit trail and effective date.

### Training and qualification
- **Training course / class manager** — create academy classes, in-service training, qualifications, attendance rosters, instructors, completion records, and certificates from one workflow.
- **Training prerequisites** — automatically prevent or warn against enrollment when required certifications or prior courses are missing.
- **Qualification matrix** — one Command view of personnel versus certifications/qualifications with current, missing, expiring, and expired status.
- **Academy cohort dashboard** — manage a group of Recruits through onboarding, academy phases, FTO assignment, evaluations, remediation, and graduation.
- **Remedial training plans** — Guardian or Training can assign required remediation with a deadline and completion evidence.
- **Historical training intake** — Command can add verified prior-agency, lateral-entry, legacy LSCSO, leadership, and continuing-education training without creating a fake active training program.
- **FTO release review** — an FTO can recommend release/completion, but Command receives the final release action before any downstream rank, probation, assignment, or certification change is made.

### Command and supervision
- **Supervisor action center** — one page showing direct reports, probation deadlines, LOA, expiring certifications, promotion cases, Guardian items, pending requests, and required acknowledgments.
- **Command review queue** — a single priority queue for matters requiring Command action instead of making staff hunt across modules.
- **Delegation / acting assignment workflow** — temporary acting supervisor or command assignments with start/end dates, authority scope, and automatic expiration.
- **Succession / temporary command coverage** — document who has authority when a command member is unavailable without permanently changing rank.
- **Meeting minutes / command brief archive** — restricted internal records tied to dates, attendees, decisions, and follow-up assignments.
- **Smart action notifications** — notify personnel only when an event actually requires action, such as a policy acknowledgment, training evaluation, expiring certification, pending promotion review, interview, LOA decision, Guardian acknowledgment, or employment offer signature.
- **Internal forms center** — standardized personnel forms and workflows for training requests, equipment requests, transfer requests, promotion interest, commendation recommendations, resignations, specialty assignments, and other recurring administrative actions.

### Personnel records and documents
- **Personnel document vault** — controlled storage for appointment letters, certificates, signed acknowledgments, transfer paperwork, separation documents, and other official records.
- **Record-release packet builder** — choose authorized personnel-record sections and attachments, including Guardian material when applicable, then generate one export package for lateral-transfer or records requests.
- **Employment verification letter generator** — Command can generate a standardized verification of service/rank/status PDF from current personnel data.
- **Service milestone automation** — flag anniversaries, probation completion, time-in-rank milestones, and eligibility dates.
- **Personnel record completeness check** — show missing supervisor, assignment, call sign, certifications, signatures, entry-training disposition, or other required administrative fields.

### Recognition and awards
- **Award / commendation nomination workflow** — supervisor, Command, or authorized personnel nominate a member; Command reviews and awards it into the existing service record.
- **Public commendation intake** — public compliments can be reviewed and, when appropriate, converted into an internal commendation record.
- **Recognition board** — internal view of recent awards, commendations, milestones, and noteworthy service.

### Policy and accountability
- **Policy acknowledgment system** — require personnel to acknowledge new or revised policies/orders, with due dates and Command visibility of who has not signed.
- **Guardian-linked corrective plans** — formal improvement plans with objectives, deadlines, check-ins, and completion outcome attached to the Guardian matter.
- **Guardian trend view** — Command-only trends by category and time period without replacing individual-case review.
- **Appeal / review request workflow** — where appropriate, allow a member to request Command review of a qualifying personnel action while preserving the original action and audit history.

### Scheduling and availability
- **Department calendar** — interviews, training, meetings, LOA, important deadlines, promotion boards, academy dates, and department events with permission-aware visibility.
- **Shift availability** — personnel maintain availability and supervisors can identify staffing gaps.
- **Duty schedule / shift roster** — optional future scheduling layer if the department wants formal scheduled patrol shifts.

### Equipment and assets
- **Equipment issue / return records** — assign radios, uniforms, keys, vehicles, or other department assets to personnel and track returned/lost/damaged status.
- **Vehicle assignment records** — track permanent or temporary vehicle assignments independently from FiveM.
- **Equipment request workflow** — personnel request authorized equipment; supervisor/Command reviews and records issuance.

### Onboarding, separation, rehire, and reinstatement
- **Recruit onboarding checklist** — automatically created after the signed employment offer and Recruit appointment, including account setup, policy acknowledgments, academy enrollment, call sign, assignments, and required training.
- **Probation workflow** — milestone reviews, supervisor check-ins, Guardian/evaluation links, extension if authorized, and final completion decision.
- **Separation / exit workflow** — resignation, retirement, transfer, or termination triggers a checklist for assignments, delegated authority, equipment, account access, final service record, and archive. The personnel record, including Guardian history, remains intact.
- **Rehire / reinstatement review** — structured review of former personnel using the existing historical personnel record instead of creating disconnected records. The review should surface prior service, prior recruitment applications/interviews, separation reason, former rank/assignments, certifications, training, awards, Guardian history, and previous evaluations before Command decides whether to reinstate, rehire at a different rank, require a new interview, or require additional training.
- **Prior-candidate recognition** — recruitment should detect when an applicant has previously applied or interviewed with LSCSO and surface that history to authorized Command staff instead of treating the person as a completely new candidate.
- **Entry basis review** — every appointment, lateral, rehire, or reinstatement should record whether Academy/FTO is Required, Partially Required, Accepted as Equivalent, Waived, or Not Applicable and why.

### Public-facing ideas
- **Commendation / complaint portal** — public intake with tracking, staff review, and routing to the correct internal workflow.
- **Ride-along requests** — application, approval/denial, scheduling, applicant tracking, and completion record.
- **Public records requests** — intake and tracked fulfillment status for releasable records.
- **News / press releases** — Command-published department updates using a controlled publishing workflow.
- **Community calendar** — public events, recruitment events, ceremonies, and community programs.
- **Public policy / standards library** — selected public-facing policies and procedures controlled by Command.
- **Dynamic organization / command page** — pull current command structure and public-facing assignments from the personnel system instead of maintaining duplicate content.
- **Recruitment eligibility pre-screen** — a short public minimum-qualification check before someone opens the full application. It should identify obvious eligibility problems without making or implying a hiring decision.

## Design principles for future features

- One authoritative personnel record; do not duplicate records between modules.
- Guardian is part of the authoritative personnel record and follows the member through transfer, separation, rehire, and reinstatement.
- Authorized personnel-record releases can include Guardian history as part of that record; release permissions determine access, not whether Guardian is considered part of the record.
- Training history belongs to the member's permanent personnel record even when the member did not enter through Recruit/FTO.
- Do not fabricate historical training to eliminate blank screens; record verified history and explicit entry-training dispositions instead.
- Requests, recommendations, and Command-initiated actions should converge into the same underlying workflow when they represent the same personnel action.
- Keep applicant/public information separate from internal notes and protected personnel information.
- Important actions should be atomic, audited, and permission-controlled.
- Put actions next to the record or decision they affect; avoid separate pages merely because a feature was added later.
- Prefer concise UI labels and clear outcomes over explanatory filler.
- FiveM/computer integration remains optional and separate from authoritative website personnel workflows until intentionally re-enabled.
