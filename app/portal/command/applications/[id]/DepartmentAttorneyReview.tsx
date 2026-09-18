"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  APPLICATION_CERTIFICATION_TEXT,
  APPLICATION_REVIEW_STATUSES,
  INTERVIEW_STATUSES,
  applicationLabel,
  applicationNextAction,
  applicationStatusLabel,
} from "@/lib/recruitment/application";
import {
  RECRUITMENT_TIMEZONES,
  formatRecruitmentDateTime,
  normalizeRecruitmentTimeZone,
  recruitmentTimeZoneLabel,
  toDateTimeLocalInZone,
} from "@/lib/recruitment/timezones";
import { PortalDialog } from "../../../_components/PortalDialog";
import { ApplicationDynamicAnswers } from "./ApplicationDynamicAnswers";
import { ApplicantStatusMessage } from "./ApplicantStatusMessage";

type Decision = "Accepted" | "Denied";
type InterviewDisposition = "Failed" | "No Show";

export function DepartmentAttorneyReview({ application, reviewers, names, notes, history, applicantMessages }: any) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(
    APPLICATION_REVIEW_STATUSES.includes(application.status) ? application.status : "Under Review",
  );
  const [reviewer, setReviewer] = useState(application.reviewer_profile_id ?? "");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [interviewDisposition, setInterviewDisposition] = useState<InterviewDisposition | null>(null);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const initialInterviewTimeZone = normalizeRecruitmentTimeZone(application.interview_timezone || application.timezone);
  const [interview, setInterview] = useState({
    status: application.interview_status ?? "Not Scheduled",
    interviewer: application.interviewer_profile_id ?? "",
    scheduled: toDateTimeLocalInZone(application.interview_scheduled_at, initialInterviewTimeZone),
    timeZone: initialInterviewTimeZone,
    notes: application.interview_notes ?? "",
    result: application.interview_result ?? "",
  });

  async function save(payload: any) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/attorney-applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The Department Attorney application could not be updated.");
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Department Attorney application could not be updated. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function interviewPayload() {
    return {
      action: "interview",
      interviewStatus: interview.status,
      interviewerProfileId: interview.interviewer,
      scheduledLocal: interview.scheduled,
      scheduledTimeZone: interview.timeZone,
      notes: interview.notes,
      result: interview.result,
    };
  }

  async function saveInterview() {
    if (["Failed", "No Show"].includes(interview.status)) {
      setError("");
      setInterviewDisposition(interview.status as InterviewDisposition);
      return;
    }
    await save(interviewPayload());
  }

  async function confirmInterviewDisposition() {
    if (!interviewDisposition) return;
    const ok = await save(interviewPayload());
    if (ok) setInterviewDisposition(null);
  }

  async function noteSubmit(event: FormEvent) {
    event.preventDefault();
    if (await save({ action: "note", content: note })) setNote("");
  }

  async function confirmDecision() {
    if (!decision) return;
    if (decision === "Denied" && decisionReason.trim().length < 4) {
      setError("Enter a documented denial reason before recording the application decision.");
      return;
    }
    const ok = await save({
      action: "decision",
      status: decision,
      reason: decision === "Denied" ? decisionReason.trim() : "",
    });
    if (ok) {
      setDecision(null);
      setDecisionReason("");
    }
  }

  async function confirmAppointment() {
    const ok = await save({ action: "appoint" });
    if (ok) setAppointmentOpen(false);
  }

  const certificationText = application.applicant_certification_text || APPLICATION_CERTIFICATION_TEXT;
  const signed = Boolean(application.applicant_signature_name && application.applicant_signed_at);
  const isReviewing = APPLICATION_REVIEW_STATUSES.includes(application.status);
  const isAccepted = application.status === "Accepted";
  const isDenied = application.status === "Denied";
  const isHired = application.status === "Hired" || Boolean(application.hired_profile_id);
  const isClosed = application.status === "Archived" || Boolean(application.recruitment_closed_at);
  const interviewPassed = application.interview_status === "Passed";
  const interviewNeedsSchedule = interview.status === "Scheduled" && !interview.scheduled;
  const interviewNeedsFinalDetails = ["Passed", "Failed"].includes(interview.status)
    && (!interview.interviewer || interview.result.trim().length < 3);
  const interviewRecordReady = !interviewNeedsSchedule && !interviewNeedsFinalDetails;
  const nextAction = isClosed
    ? "Selection process closed."
    : isHired
      ? "Department Attorney appointment complete."
      : isAccepted && interviewPassed
        ? "Interview passed — complete Department Attorney appointment."
        : applicationNextAction(application.status, application.interview_status, isHired, "Department Attorney");

  return (
    <div className="recruitment-review recruitment-review--workflow">
      {error ? <p className="application-error" role="alert">{error}</p> : null}

      <section className="portal-panel recruitment-applicant recruitment-applicant--command">
        <div className="recruitment-applicant__identity">
          <p>Department Attorney candidate record</p>
          <h2>{application.full_name}</h2>
          <span>{applicationLabel(application.application_number)} · submitted {new Date(application.submitted_at ?? application.created_at).toLocaleString()}</span>
        </div>
        <dl>
          <div><dt>Role</dt><dd><strong>Department Attorney</strong></dd></div>
          <div><dt>Discord</dt><dd>{application.discord_username}</dd></div>
          <div><dt>Applicant timezone</dt><dd>{application.timezone || "Not recorded"}</dd></div>
          <div><dt>Application</dt><dd><b className={`recruitment-status recruitment-status--${application.status.toLowerCase().replaceAll(" ", "-")}`}>{isClosed ? "Closed" : applicationStatusLabel(application.status)}</b></dd></div>
          <div><dt>Assigned reviewer</dt><dd>{names[application.reviewer_profile_id] ?? "Unassigned"}</dd></div>
          <div><dt>Interview</dt><dd>{application.interview_status ?? "Not Scheduled"}</dd></div>
          <div><dt>Appointment</dt><dd>{isHired ? "Completed" : "Not completed"}</dd></div>
        </dl>
      </section>

      <section className={`portal-panel recruitment-next-action ${isDenied || isClosed ? "is-denied" : isHired ? "is-complete" : isAccepted ? "is-interview" : "is-review"}`}>
        <div className="recruitment-next-action__marker" aria-hidden="true">{isDenied || isClosed ? "×" : isHired ? "✓" : isAccepted ? "03" : "02"}</div>
        <div><p>Required next action</p><h2>{nextAction}</h2></div>
      </section>

      <ApplicationDynamicAnswers application={application} />

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Applicant certification</p><h2>Electronic signature</h2></div><b className={`recruitment-status ${signed ? "recruitment-status--accepted" : "recruitment-status--denied"}`}>{signed ? "Signed" : "Unavailable"}</b></div>
        <div className="recruitment-signature-record">
          <p>{certificationText}</p>
          <dl>
            <div><dt>Signed by</dt><dd>{application.applicant_signature_name || "Not recorded"}</dd></div>
            <div><dt>Signed at</dt><dd>{application.applicant_signed_at ? new Date(application.applicant_signed_at).toLocaleString() : "Not recorded"}</dd></div>
            <div><dt>Method</dt><dd>{application.applicant_signature_method || "Not recorded"}</dd></div>
          </dl>
        </div>
      </section>

      {isReviewing && !isClosed ? (
        <section className="portal-panel recruitment-controls recruitment-controls--decision">
          <div className="portal-panel-heading"><div><p>Command legal-counsel screening</p><h2>Department Attorney review</h2></div><span>Audited</span></div>
          <div className="recruitment-control-grid recruitment-control-grid--review">
            <label>
              Assigned reviewer
              <select value={reviewer} onChange={(event) => setReviewer(event.target.value)}>
                <option value="">Select reviewer</option>
                {reviewers.map((person: any) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
              <button className="portal-button" disabled={busy || !reviewer} onClick={() => void save({ action: "assign_reviewer", reviewerProfileId: reviewer })}>Assign reviewer</button>
            </label>
            <label>
              Screening stage
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {APPLICATION_REVIEW_STATUSES.map((item) => <option key={item}>{item}</option>)}
              </select>
              <button className="portal-button" disabled={busy || status === application.status} onClick={() => void save({ action: "status", status })}>Update stage</button>
            </label>
            <div className="recruitment-final-decision recruitment-final-decision--application">
              <span>Application decision</span>
              <div>
                <button className="portal-button portal-button--primary" disabled={busy} onClick={() => { setError(""); setDecision("Accepted"); }}>Accept Application</button>
                <button className="portal-button portal-button--danger" disabled={busy} onClick={() => { setError(""); setDecision("Denied"); }}>Deny with reason</button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {(isAccepted || isHired) && !isClosed ? (
        <section className="portal-panel recruitment-interview-panel">
          <div className="portal-panel-heading">
            <div><p>Required interview</p><h2>{isHired ? "Interview completed" : "Department Attorney interview"}</h2></div>
            <b className={`recruitment-status recruitment-status--${String(application.interview_status ?? "not-scheduled").toLowerCase().replaceAll(" ", "-")}`}>{application.interview_status ?? "Not Scheduled"}</b>
          </div>
          <div className="recruitment-interview-flow" aria-label="Department Attorney interview workflow">
            <article className={interview.status !== "Not Scheduled" ? "is-complete" : "is-current"}><span>01</span><div><strong>Schedule</strong><small>Set the interview in the applicant&apos;s intended timezone.</small></div></article>
            <article className={["Completed", "Passed", "Failed", "No Show"].includes(interview.status) ? "is-complete" : interview.status === "Scheduled" ? "is-current" : ""}><span>02</span><div><strong>Conduct</strong><small>Record attendance and preserve the interview record.</small></div></article>
            <article className={["Passed", "Failed", "No Show"].includes(interview.status) ? "is-current" : ""}><span>03</span><div><strong>Decision</strong><small>Pass unlocks appointment. Fail means the completed interview did not meet the selection standard.</small></div></article>
          </div>
          <div className="recruitment-control-grid">
            <label>
              Interview stage / outcome
              <select value={interview.status} onChange={(event) => setInterview({ ...interview, status: event.target.value })} disabled={isHired}>
                {INTERVIEW_STATUSES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Interviewer
              <select value={interview.interviewer} onChange={(event) => setInterview({ ...interview, interviewer: event.target.value })} disabled={isHired}>
                <option value="">Not assigned</option>
                {reviewers.map((person: any) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <label>
              Interview timezone
              <select value={interview.timeZone} onChange={(event) => setInterview({ ...interview, timeZone: event.target.value })} disabled={isHired}>
                {RECRUITMENT_TIMEZONES.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
              </select>
              <small>Use the timezone the applicant should see and attend in. This is stored with the interview record.</small>
            </label>
            <label>
              Scheduled date & time
              <input type="datetime-local" value={interview.scheduled} onChange={(event) => setInterview({ ...interview, scheduled: event.target.value })} disabled={isHired} />
              <small>{interview.scheduled ? `${interview.scheduled.replace("T", " ")} · ${recruitmentTimeZoneLabel(interview.timeZone)}` : `Enter the date/time in ${recruitmentTimeZoneLabel(interview.timeZone)}.`}</small>
            </label>
            <label>
              Result summary
              <input value={interview.result} onChange={(event) => setInterview({ ...interview, result: event.target.value })} placeholder="Required for Pass / Fail" disabled={isHired} />
            </label>
          </div>
          {application.interview_scheduled_at ? (
            <div className="recruitment-interview-time-summary">
              <span>Saved interview time</span>
              <strong>{formatRecruitmentDateTime(application.interview_scheduled_at, application.interview_timezone || interview.timeZone)}</strong>
              <small>{recruitmentTimeZoneLabel(application.interview_timezone || interview.timeZone)} · stored as one absolute instant so it will not drift between devices.</small>
            </div>
          ) : null}
          <label className="recruitment-wide-label">Interview notes<textarea rows={5} value={interview.notes} onChange={(event) => setInterview({ ...interview, notes: event.target.value })} disabled={isHired} /></label>
          {!isHired ? (
            <div className="recruitment-interview-actions">
              <button
                className={`portal-button ${["Failed", "No Show"].includes(interview.status) ? "portal-button--danger" : "portal-button--primary"}`}
                disabled={busy || !interviewRecordReady}
                onClick={() => void saveInterview()}
              >
                {["Failed", "No Show"].includes(interview.status) ? "Review final disposition" : "Save interview record"}
              </button>
              <span className={interviewPassed ? "is-ready" : ""}>
                {interview.status === "No Show"
                  ? "No Show means the applicant did not attend the scheduled interview and closes the selection process."
                  : interview.status === "Failed"
                    ? "Failed means the interview was completed but did not meet the standard required to advance."
                    : interviewNeedsSchedule
                      ? "Enter the interview date and time."
                      : interviewNeedsFinalDetails
                        ? "Pass / Fail requires an interviewer and result summary."
                        : interviewPassed
                          ? "✓ Interview passed — Department Attorney appointment is unlocked below."
                          : interview.status === "Completed"
                            ? "Interview completed — record Pass or Fail after Command reaches the selection decision."
                            : "Department Attorney appointment requires a Passed interview."}
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {isAccepted && interviewPassed && !isHired && !isClosed ? (
        <section className="portal-panel recruitment-next-action is-complete">
          <div className="recruitment-next-action__marker" aria-hidden="true">04</div>
          <div>
            <p>Final appointment</p>
            <h2>Interview passed. Create the Department Attorney personnel record when Command is ready to appoint.</h2>
            <p className="command-v2-compact-copy">This creates the LS-### employee record, assigns the Department Attorney role and Attorney access tier, and does not assign a call sign.</p>
            <div className="command-v2-action-row" style={{ marginTop: 12 }}>
              <button className="portal-button portal-button--primary" disabled={busy} onClick={() => setAppointmentOpen(true)} type="button">Appoint Department Attorney</button>
            </div>
          </div>
        </section>
      ) : null}

      {isHired ? (
        <section className="portal-panel recruitment-next-action is-complete">
          <div className="recruitment-next-action__marker" aria-hidden="true">✓</div>
          <div><p>Appointment complete</p><h2>Department Attorney personnel record created. Continue account access and onboarding through Personnel Administration.</h2></div>
        </section>
      ) : null}

      {isDenied ? (
        <section className="portal-panel recruitment-denial-record">
          <div className="portal-panel-heading"><div><p>Application disposition</p><h2>Not selected</h2></div><b className="recruitment-status recruitment-status--denied">Denied</b></div>
          <div className="recruitment-denial-record__reason"><span>Denial reason</span><p>{application.decision_notes || "Reason unavailable."}</p></div>
          <dl>
            <div><dt>Decision recorded</dt><dd>{application.decided_at ? new Date(application.decided_at).toLocaleString() : "Not recorded"}</dd></div>
            <div><dt>Recorded by</dt><dd>{names[application.decided_by_profile_id] ?? "Command"}</dd></div>
          </dl>
        </section>
      ) : null}

      <ApplicantStatusMessage applicationId={application.id} messages={applicantMessages ?? []} names={names} />

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Internal notes</p><h2>Chronological notes</h2></div></div>
        <form onSubmit={noteSubmit}>
          <label className="recruitment-wide-label">Add internal note<textarea required rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <button className="portal-button" disabled={busy}>Add note</button>
        </form>
        <div className="recruitment-notes">
          {notes.map((item: any) => <article key={item.id}><strong>{names[item.author_profile_id] ?? "Command"}</strong><span>{new Date(item.created_at).toLocaleString()}</span><p>{item.content}</p></article>)}
          {!notes.length ? <div className="portal-empty-state"><strong>No internal notes recorded.</strong></div> : null}
        </div>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Application history</p><h2>Audit trail</h2></div></div>
        <div className="recruitment-history">
          {history.map((item: any) => <article key={item.id}><strong>{item.event_type}</strong><span>{names[item.actor_profile_id] ?? "System"} · {new Date(item.created_at).toLocaleString()}</span>{Object.keys(item.details ?? {}).length ? <small>{Object.entries(item.details).map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`).join(" · ")}</small> : null}</article>)}
        </div>
      </section>

      <PortalDialog
        open={Boolean(decision)}
        onClose={() => { if (!busy) { setDecision(null); setDecisionReason(""); } }}
        eyebrow="Department Attorney application decision"
        title={decision === "Denied" ? `Deny ${application.full_name}'s application?` : `Accept ${application.full_name}'s application?`}
        description={decision === "Denied"
          ? "A documented reason is required."
          : "Acceptance advances the applicant to the required Department Attorney interview. It does not hire or appoint them."}
        dismissOnBackdrop={!busy}
        footer={<><button className="portal-button portal-button--secondary" disabled={busy} onClick={() => { setDecision(null); setDecisionReason(""); }} type="button">Cancel</button><button className={`portal-button ${decision === "Denied" ? "portal-button--danger" : "portal-button--primary"}`} disabled={busy || (decision === "Denied" && decisionReason.trim().length < 4)} onClick={() => void confirmDecision()} type="button">{busy ? "Recording…" : decision === "Denied" ? "Confirm denial" : "Accept & move to interview"}</button></>}
      >
        <div className="recruitment-decision-review">
          <div><span>Applicant</span><strong>{application.full_name}</strong></div>
          <div><span>Application</span><strong>{applicationLabel(application.application_number)}</strong></div>
          <div><span>Role</span><strong>Department Attorney</strong></div>
          <div><span>Decision</span><strong>{decision === "Denied" ? "Application Denied" : "Application Accepted · Interview Required"}</strong></div>
          {decision === "Denied" ? <label>Denial reason <em>Required</em><textarea required rows={5} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /><small>{decisionReason.trim().length} characters · minimum 4</small></label> : null}
        </div>
      </PortalDialog>

      <PortalDialog
        open={Boolean(interviewDisposition)}
        onClose={() => { if (!busy) setInterviewDisposition(null); }}
        eyebrow="Department Attorney interview disposition"
        title={interviewDisposition === "No Show" ? "Close as interview no-show?" : "Record interview as not selected?"}
        description={interviewDisposition === "No Show"
          ? "No Show means the applicant did not attend the required scheduled interview. This closes the selection process."
          : "The interview was completed, but the applicant did not meet the standard required to advance to Department Attorney appointment. This closes the selection process."}
        dismissOnBackdrop={!busy}
        footer={<><button className="portal-button portal-button--secondary" disabled={busy} onClick={() => setInterviewDisposition(null)} type="button">Cancel</button><button className="portal-button portal-button--danger" disabled={busy} onClick={() => void confirmInterviewDisposition()} type="button">{busy ? "Recording…" : "Confirm final disposition"}</button></>}
      >
        <div className="portal-form-protection"><strong>{application.full_name}</strong><span>{interviewDisposition === "No Show" ? "Interview No Show · applicant did not attend" : "Interview completed · not selected to advance"}</span></div>
      </PortalDialog>

      <PortalDialog
        open={appointmentOpen}
        onClose={() => { if (!busy) setAppointmentOpen(false); }}
        eyebrow="Final Department Attorney appointment"
        title={`Appoint ${application.full_name}?`}
        description="This is the actual hire/appointment step. It creates the employee personnel record only after the passed interview."
        dismissOnBackdrop={!busy}
        footer={<><button className="portal-button portal-button--secondary" disabled={busy} onClick={() => setAppointmentOpen(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={busy} onClick={() => void confirmAppointment()} type="button">{busy ? "Appointing…" : "Confirm appointment"}</button></>}
      >
        <div className="recruitment-decision-review">
          <div><span>Applicant</span><strong>{application.full_name}</strong></div>
          <div><span>Role</span><strong>Department Attorney</strong></div>
          <div><span>Interview</span><strong>Passed</strong></div>
          <div><span>Personnel record</span><strong>New LS-### employee number · No call sign</strong></div>
        </div>
      </PortalDialog>
    </div>
  );
}
