"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
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
import { EmploymentOfferManager } from "./EmploymentOfferManager";
import { RecruitHireHandoff } from "./RecruitHireHandoff";

type Decision = "Accepted" | "Denied";
type InterviewDisposition = "Failed" | "No Show";

export function ApplicationReview({ application, reviewers, names, notes, history, applicantMessages }: any) {
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
      const response = await fetch(`/api/portal/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The application could not be updated.");
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The application could not be updated. Please try again.");
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

  const certificationText = application.applicant_certification_text || APPLICATION_CERTIFICATION_TEXT;
  const signed = Boolean(application.applicant_signature_name && application.applicant_signed_at);
  const isReviewing = APPLICATION_REVIEW_STATUSES.includes(application.status);
  const isAccepted = application.status === "Accepted";
  const isDenied = application.status === "Denied";
  const isHired = application.status === "Hired" || Boolean(application.hired_profile_id);
  const isClosed = application.status === "Archived" || Boolean(application.recruitment_closed_at);
  const offer = application.latest_offer ?? null;
  const offerExpired = Boolean(offer?.status === "Pending" && offer?.expires_at && new Date(offer.expires_at).getTime() <= Date.now());
  const offerStatus = offerExpired ? "Expired" : offer?.status ?? null;
  const offerAccepted = offer?.status === "Accepted";
  const interviewPassed = application.interview_status === "Passed";
  const hireEligible = isAccepted && interviewPassed && offerAccepted && !isHired;
  const interviewNeedsSchedule = interview.status === "Scheduled" && !interview.scheduled;
  const interviewNeedsFinalDetails = ["Passed", "Failed"].includes(interview.status)
    && (!interview.interviewer || interview.result.trim().length < 3);
  const interviewRecordReady = !interviewNeedsSchedule && !interviewNeedsFinalDetails;
  const nextAction = isClosed
    ? "Selection process closed."
    : isAccepted && interviewPassed && offerAccepted && !isHired
      ? "Complete Recruit appointment."
      : isAccepted && interviewPassed && offerExpired
        ? "Employment offer expired — terminate the offer or close the process."
        : isAccepted && interviewPassed && offer?.status === "Pending"
          ? "Await applicant employment-offer signature."
          : isAccepted && interviewPassed && !offer
            ? "Issue employment offer."
            : applicationNextAction(application.status, application.interview_status, isHired);

  return (
    <div className="recruitment-review recruitment-review--workflow">
      {error ? <p className="application-error" role="alert">{error}</p> : null}

      <section className="portal-panel recruitment-applicant recruitment-applicant--command">
        <div className="recruitment-applicant__identity">
          <p>Sworn Personnel candidate record</p>
          <h2>{application.full_name}</h2>
          <span>{applicationLabel(application.application_number)} · submitted {new Date(application.submitted_at ?? application.created_at).toLocaleString()}</span>
        </div>
        <dl>
          <div><dt>Discord</dt><dd>{application.discord_username}</dd></div>
          <div><dt>Applicant timezone</dt><dd>{application.timezone || "Not recorded"}</dd></div>
          <div><dt>Application</dt><dd><b className={`recruitment-status recruitment-status--${application.status.toLowerCase().replaceAll(" ", "-")}`}>{isClosed ? "Closed" : applicationStatusLabel(application.status)}</b></dd></div>
          <div><dt>Assigned reviewer</dt><dd>{names[application.reviewer_profile_id] ?? "Unassigned"}</dd></div>
          <div><dt>Interview</dt><dd>{application.interview_status ?? "Not Scheduled"}</dd></div>
          <div><dt>Employment offer</dt><dd>{offerStatus ?? "Not issued"}</dd></div>
          <div><dt>Personnel record</dt><dd>{isHired ? "Created" : "Not created"}</dd></div>
        </dl>
      </section>

      <section className={`portal-panel recruitment-next-action ${isDenied || isClosed ? "is-denied" : isHired ? "is-complete" : isAccepted ? "is-interview" : "is-review"}`}>
        <div className="recruitment-next-action__marker" aria-hidden="true">{isDenied || isClosed ? "×" : isHired ? "✓" : isAccepted ? "03" : "02"}</div>
        <div><p>Required next action</p><h2>{nextAction}</h2></div>
      </section>

      <ApplicationDynamicAnswers application={application} />

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Applicant certification</p><h2>Electronic signature</h2></div><b className={`recruitment-status ${signed ? "recruitment-status--accepted" : "recruitment-status--denied"}`}>{signed ? "Signed" : "Unavailable"}</b></div>
        <div className="recruitment-signature-record"><p>{certificationText}</p><dl><div><dt>Signed by</dt><dd>{application.applicant_signature_name || "Not recorded"}</dd></div><div><dt>Signed at</dt><dd>{application.applicant_signed_at ? new Date(application.applicant_signed_at).toLocaleString() : "Not recorded"}</dd></div><div><dt>Method</dt><dd>{application.applicant_signature_method || "Not recorded"}</dd></div></dl></div>
      </section>

      {isReviewing && !isClosed ? (
        <section className="portal-panel recruitment-controls recruitment-controls--decision">
          <div className="portal-panel-heading"><div><p>Captain+ screening</p><h2>Application review</h2></div><span>Audited</span></div>
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

      {isDenied ? (
        <section className="portal-panel recruitment-denial-record">
          <div className="portal-panel-heading"><div><p>Application disposition</p><h2>Denied</h2></div><b className="recruitment-status recruitment-status--denied">Denied</b></div>
          <div className="recruitment-denial-record__reason"><span>Denial reason</span><p>{application.decision_notes || "Reason unavailable."}</p></div>
          <dl>
            <div><dt>Decision recorded</dt><dd>{application.decided_at ? new Date(application.decided_at).toLocaleString() : "Not recorded"}</dd></div>
            <div><dt>Recorded by</dt><dd>{names[application.decided_by_profile_id] ?? "Command"}</dd></div>
          </dl>
        </section>
      ) : null}

      {isAccepted || isHired ? (
        <>
          <section className="portal-panel recruitment-interview-panel">
            <div className="portal-panel-heading">
              <div><p>Required interview</p><h2>{isHired ? "Interview completed" : "Interview scheduling & decision"}</h2></div>
              <b className={`recruitment-status recruitment-status--${String(application.interview_status ?? "not-scheduled").toLowerCase().replaceAll(" ", "-")}`}>{application.interview_status ?? "Not Scheduled"}</b>
            </div>
            <div className="recruitment-interview-flow" aria-label="Interview workflow">
              <article className={interview.status !== "Not Scheduled" ? "is-complete" : "is-current"}><span>01</span><div><strong>Schedule</strong><small>Set the interview in the timezone the applicant is expected to use.</small></div></article>
              <article className={["Completed", "Passed", "Failed", "No Show"].includes(interview.status) ? "is-complete" : interview.status === "Scheduled" ? "is-current" : ""}><span>02</span><div><strong>Conduct</strong><small>Record attendance and preserve panel/interview notes.</small></div></article>
              <article className={["Passed", "Failed", "No Show"].includes(interview.status) ? "is-current" : ""}><span>03</span><div><strong>Decision</strong><small>Pass advances to an offer. Fail means the completed interview did not meet the selection standard.</small></div></article>
            </div>
            <div className="recruitment-control-grid">
              <label>
                Interview stage / outcome
                <select value={interview.status} onChange={(event) => setInterview({ ...interview, status: event.target.value })} disabled={isHired || Boolean(offer)}>
                  {INTERVIEW_STATUSES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                Interviewer
                <select value={interview.interviewer} onChange={(event) => setInterview({ ...interview, interviewer: event.target.value })} disabled={isHired || Boolean(offer)}>
                  <option value="">Not assigned</option>
                  {reviewers.map((person: any) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </label>
              <label>
                Interview timezone
                <select value={interview.timeZone} onChange={(event) => setInterview({ ...interview, timeZone: event.target.value })} disabled={isHired || Boolean(offer)}>
                  {RECRUITMENT_TIMEZONES.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
                </select>
                <small>The applicant portal will use this timezone instead of the viewer&apos;s device timezone.</small>
              </label>
              <label>
                Scheduled date & time
                <input type="datetime-local" value={interview.scheduled} onChange={(event) => setInterview({ ...interview, scheduled: event.target.value })} disabled={isHired || Boolean(offer)} />
                <small>{interview.scheduled ? `${interview.scheduled.replace("T", " ")} · ${recruitmentTimeZoneLabel(interview.timeZone)}` : `Enter the date/time in ${recruitmentTimeZoneLabel(interview.timeZone)}.`}</small>
              </label>
              <label>
                Result summary
                <input value={interview.result} onChange={(event) => setInterview({ ...interview, result: event.target.value })} placeholder="Required for Pass / Fail" disabled={isHired || Boolean(offer)} />
              </label>
            </div>
            {application.interview_scheduled_at ? (
              <div className="recruitment-interview-time-summary">
                <span>Saved interview time</span>
                <strong>{formatRecruitmentDateTime(application.interview_scheduled_at, application.interview_timezone || interview.timeZone)}</strong>
                <small>{recruitmentTimeZoneLabel(application.interview_timezone || interview.timeZone)} · stored as one absolute instant so the time stays consistent between devices.</small>
              </div>
            ) : null}
            <label className="recruitment-wide-label">Panel / interview notes<textarea rows={5} value={interview.notes} onChange={(event) => setInterview({ ...interview, notes: event.target.value })} disabled={isHired || Boolean(offer)} /></label>
            {!isHired && !offer ? (
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
                      ? "Failed means the interview was completed but the applicant was not selected to advance."
                      : interviewNeedsSchedule
                        ? "Enter the interview date and time."
                        : interviewNeedsFinalDetails
                          ? "Pass / Fail requires an interviewer and result summary."
                          : interviewPassed
                            ? "✓ Interview passed — issue the employment offer below."
                            : interview.status === "Completed"
                              ? "Interview completed — record Pass or Fail after Command reaches the selection decision."
                              : "Recruit appointment requires a Passed interview and signed offer."}
                </span>
              </div>
            ) : null}
          </section>

          <EmploymentOfferManager
            applicationId={application.id}
            applicantName={application.full_name}
            interviewPassed={interviewPassed}
            hired={isHired}
            offer={offer}
          />

          <RecruitHireHandoff
            applicationId={application.id}
            applicantName={application.full_name}
            eligible={hireEligible}
            hired={isHired}
          />
        </>
      ) : (
        !isDenied && !isClosed ? <section className="portal-panel recruitment-interview-locked"><div><p>Interview stage</p><h2>Locked until application acceptance.</h2></div></section> : null
      )}

      <ApplicantStatusMessage applicationId={application.id} messages={applicantMessages ?? []} names={names} />

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Internal notes</p><h2>Chronological notes</h2></div></div>
        <form onSubmit={noteSubmit}><label className="recruitment-wide-label">Add internal note<textarea required rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="portal-button" disabled={busy}>Add note</button></form>
        <div className="recruitment-notes">{notes.map((item: any) => <article key={item.id}><strong>{names[item.author_profile_id] ?? "Command"}</strong><span>{new Date(item.created_at).toLocaleString()}</span><p>{item.content}</p></article>)}{!notes.length ? <div className="portal-empty-state"><strong>No internal notes recorded.</strong></div> : null}</div>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Application history</p><h2>Audit trail</h2></div></div>
        <div className="recruitment-history">{history.map((item: any) => <article key={item.id}><strong>{item.event_type}</strong><span>{names[item.actor_profile_id] ?? "System"} · {new Date(item.created_at).toLocaleString()}</span>{Object.keys(item.details ?? {}).length ? <small>{Object.entries(item.details).map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`).join(" · ")}</small> : null}</article>)}</div>
      </section>

      <PortalDialog
        open={Boolean(interviewDisposition)}
        onClose={() => { if (!busy) setInterviewDisposition(null); }}
        eyebrow="Final interview disposition"
        title={interviewDisposition === "No Show" ? `Close ${application.full_name}'s case as Interview No Show?` : `Record ${application.full_name} as not selected after interview?`}
        description={interviewDisposition === "No Show"
          ? "This records that the scheduled interview was not attended and closes the recruitment case."
          : "This records that the interview was completed but the applicant was not selected to advance. It does not mean the applicant failed to attend or complete the interview."}
        dismissOnBackdrop={!busy}
        footer={<><button className="portal-button portal-button--secondary" disabled={busy} onClick={() => setInterviewDisposition(null)} type="button">Cancel</button><button className="portal-button portal-button--danger" disabled={busy || !interviewRecordReady} onClick={() => void confirmInterviewDisposition()} type="button">{busy ? "Recording…" : "Confirm final disposition"}</button></>}
      >
        <div className="recruitment-decision-review">
          <div><span>Applicant</span><strong>{application.full_name}</strong></div>
          <div><span>Application</span><strong>{applicationLabel(application.application_number)}</strong></div>
          <div><span>Disposition</span><strong>{interviewDisposition === "No Show" ? "Interview No Show" : "Interview Completed · Not Selected"}</strong></div>
          {interview.scheduled ? <div><span>Scheduled interview</span><strong>{interview.scheduled.replace("T", " ")} · {recruitmentTimeZoneLabel(interview.timeZone)}</strong></div> : null}
          {interview.interviewer ? <div><span>Interviewer</span><strong>{names[interview.interviewer] ?? "Command"}</strong></div> : null}
          {interview.result.trim() ? <div className="recruitment-decision-review__wide"><span>Internal result summary</span><strong>{interview.result.trim()}</strong></div> : null}
          <p className="recruitment-terminal-warning">Internal interview notes and the result summary remain internal. The applicant-facing page receives the official disposition language.</p>
        </div>
      </PortalDialog>

      <PortalDialog
        open={Boolean(decision)}
        onClose={() => { if (!busy) { setDecision(null); setDecisionReason(""); } }}
        eyebrow="Application decision"
        title={decision === "Denied" ? `Deny ${application.full_name}'s application?` : `Accept ${application.full_name}'s application?`}
        description={decision === "Denied" ? "A documented reason is required." : "Acceptance advances the candidate to the required interview."}
        dismissOnBackdrop={!busy}
        footer={<><button className="portal-button portal-button--secondary" disabled={busy} onClick={() => { setDecision(null); setDecisionReason(""); }} type="button">Cancel</button><button className={`portal-button ${decision === "Denied" ? "portal-button--danger" : "portal-button--primary"}`} disabled={busy || (decision === "Denied" && decisionReason.trim().length < 4)} onClick={() => void confirmDecision()} type="button">{busy ? "Recording…" : decision === "Denied" ? "Confirm denial" : "Confirm acceptance"}</button></>}
      >
        <div className="recruitment-decision-review">
          <div><span>Applicant</span><strong>{application.full_name}</strong></div>
          <div><span>Application</span><strong>{applicationLabel(application.application_number)}</strong></div>
          <div><span>Decision</span><strong>{decision === "Denied" ? "Application Denied" : "Application Accepted"}</strong></div>
          {decision === "Denied" ? <label>Denial reason <em>Required</em><textarea required rows={5} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /><small>{decisionReason.trim().length} characters · minimum 4</small></label> : null}
        </div>
      </PortalDialog>
    </div>
  );
}