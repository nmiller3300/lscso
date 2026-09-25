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
  DEFAULT_RECRUITMENT_TIME_ZONE,
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

export function ForensicsSpecialistReview({ application, reviewers, names, notes, history, applicantMessages }: any) {
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
  const initialInterviewTimeZone = normalizeRecruitmentTimeZone(application.interview_timezone, DEFAULT_RECRUITMENT_TIME_ZONE);
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

  async function appointSpecialist() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/applications/${application.id}/forensics-appointment`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The Forensics Specialist appointment could not be completed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Forensics Specialist appointment could not be completed.");
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
    if (await save(interviewPayload())) setInterviewDisposition(null);
  }

  function prepareAnotherInterview() {
    setError("");
    setInterview({ ...interview, status: "Scheduled", scheduled: "", timeZone: DEFAULT_RECRUITMENT_TIME_ZONE, result: "" });
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
    const ok = await save({ action: "decision", status: decision, reason: decision === "Denied" ? decisionReason.trim() : "" });
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
  const interviewPassed = application.interview_status === "Passed";
  const appointmentEligible = isAccepted && interviewPassed && !isHired && !isClosed;
  const interviewNeedsSchedule = interview.status === "Scheduled" && !interview.scheduled;
  const interviewNeedsFinalDetails = ["Passed", "Failed"].includes(interview.status) && (!interview.interviewer || interview.result.trim().length < 3);
  const interviewRecordReady = !interviewNeedsSchedule && !interviewNeedsFinalDetails;
  const nextAction = applicationNextAction(application.status, application.interview_status, isHired, "Forensics Specialist");

  return (
    <div className="recruitment-review recruitment-review--workflow">
      {error ? <p className="application-error" role="alert">{error}</p> : null}

      <section className="portal-panel recruitment-applicant recruitment-applicant--command">
        <div className="recruitment-applicant__identity">
          <p>Forensics Specialist candidate record</p>
          <h2>{application.full_name}</h2>
          <span>{applicationLabel(application.application_number)} · submitted {new Date(application.submitted_at ?? application.created_at).toLocaleString()}</span>
        </div>
        <dl>
          <div><dt>Discord</dt><dd>{application.discord_username}</dd></div>
          <div><dt>Applicant timezone</dt><dd>{application.timezone || "Not recorded"}</dd></div>
          <div><dt>Application</dt><dd><b className={`recruitment-status recruitment-status--${application.status.toLowerCase().replaceAll(" ", "-")}`}>{isClosed ? "Closed" : applicationStatusLabel(application.status)}</b></dd></div>
          <div><dt>Assigned reviewer</dt><dd>{names[application.reviewer_profile_id] ?? "Unassigned"}</dd></div>
          <div><dt>Interview</dt><dd>{application.interview_status ?? "Not Scheduled"}</dd></div>
          <div><dt>Appointment</dt><dd>{isHired ? "Forensics Specialist appointed" : "Not completed"}</dd></div>
          <div><dt>Portal access</dt><dd>Standard LSCSO personnel portal</dd></div>
          <div><dt>Division</dt><dd>Forensic Services</dd></div>
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
          <div className="portal-panel-heading"><div><p>Command screening</p><h2>Forensics application review</h2></div><span>Audited</span></div>
          <div className="recruitment-control-grid recruitment-control-grid--review">
            <label>Assigned reviewer<select value={reviewer} onChange={(event) => setReviewer(event.target.value)}><option value="">Select reviewer</option>{reviewers.map((person: any) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><button className="portal-button" disabled={busy || !reviewer} onClick={() => void save({ action: "assign_reviewer", reviewerProfileId: reviewer })}>Assign reviewer</button></label>
            <label>Screening stage<select value={status} onChange={(event) => setStatus(event.target.value)}>{APPLICATION_REVIEW_STATUSES.map((item) => <option key={item}>{item}</option>)}</select><button className="portal-button" disabled={busy || status === application.status} onClick={() => void save({ action: "status", status })}>Update stage</button></label>
            <div className="recruitment-final-decision recruitment-final-decision--application"><span>Application decision</span><div><button className="portal-button portal-button--primary" disabled={busy} onClick={() => { setError(""); setDecision("Accepted"); }}>Accept Application</button><button className="portal-button portal-button--danger" disabled={busy} onClick={() => { setError(""); setDecision("Denied"); }}>Deny with reason</button></div></div>
          </div>
        </section>
      ) : null}

      {isDenied ? (
        <section className="portal-panel recruitment-denial-record">
          <div className="portal-panel-heading"><div><p>Application disposition</p><h2>Denied</h2></div><b className="recruitment-status recruitment-status--denied">Denied</b></div>
          <div className="recruitment-denial-record__reason"><span>Denial reason</span><p>{application.decision_notes || "Reason unavailable."}</p></div>
          <dl><div><dt>Decision recorded</dt><dd>{application.decided_at ? new Date(application.decided_at).toLocaleString() : "Not recorded"}</dd></div><div><dt>Recorded by</dt><dd>{names[application.decided_by_profile_id] ?? "Command"}</dd></div></dl>
        </section>
      ) : null}

      {isAccepted || isHired ? (
        <>
          <section className="portal-panel recruitment-interview-panel">
            <div className="portal-panel-heading"><div><p>Required Forensic Services interview</p><h2>{isHired ? "Interview completed" : "Interview scheduling & selection"}</h2></div><b className={`recruitment-status recruitment-status--${String(application.interview_status ?? "not-scheduled").toLowerCase().replaceAll(" ", "-")}`}>{application.interview_status ?? "Not Scheduled"}</b></div>
            <div className="recruitment-interview-flow" aria-label="Forensics Specialist interview workflow">
              <article className={interview.status !== "Not Scheduled" ? "is-complete" : "is-current"}><span>01</span><div><strong>Schedule</strong><small>Set the interview time and assigned interviewer.</small></div></article>
              <article className={["Completed", "Passed", "Failed", "No Show"].includes(interview.status) ? "is-complete" : interview.status === "Scheduled" ? "is-current" : ""}><span>02</span><div><strong>Conduct</strong><small>Evaluate evidence handling, objectivity, technical judgment, and communication.</small></div></article>
              <article className={["Passed", "Failed", "No Show"].includes(interview.status) ? "is-current" : ""}><span>03</span><div><strong>Decision</strong><small>Pass makes the candidate eligible for a separate specialist appointment.</small></div></article>
            </div>

            {application.interview_status === "No Show" && interview.status === "No Show" ? <div className="recruitment-no-show-recovery"><div><p>No-show recorded</p><strong>The selection process is still open.</strong><span>Offer another interview, or use the separate closure control if Command decides to end the process.</span></div><button className="portal-button portal-button--primary" onClick={prepareAnotherInterview} type="button">Prepare another interview</button></div> : null}

            <div className="recruitment-control-grid">
              <label>Interview stage / outcome<select value={interview.status} onChange={(event) => setInterview({ ...interview, status: event.target.value })} disabled={isHired}>{INTERVIEW_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Interviewer<select value={interview.interviewer} onChange={(event) => setInterview({ ...interview, interviewer: event.target.value })} disabled={isHired}><option value="">Not assigned</option>{reviewers.map((person: any) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <label>Interview timezone<select value={interview.timeZone} onChange={(event) => setInterview({ ...interview, timeZone: event.target.value })} disabled={isHired}>{RECRUITMENT_TIMEZONES.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select><small>Eastern Time is the LSCSO default.</small></label>
              <label>Scheduled date & time<input type="datetime-local" value={interview.scheduled} onChange={(event) => setInterview({ ...interview, scheduled: event.target.value })} disabled={isHired} /><small>{interview.scheduled ? `${interview.scheduled.replace("T", " ")} · ${recruitmentTimeZoneLabel(interview.timeZone)}` : `Enter the date/time in ${recruitmentTimeZoneLabel(interview.timeZone)}.`}</small></label>
              <label>Result summary<input value={interview.result} onChange={(event) => setInterview({ ...interview, result: event.target.value })} placeholder="Required for Pass / Fail only" disabled={isHired} /></label>
            </div>
            {application.interview_scheduled_at ? <div className="recruitment-interview-time-summary"><span>Saved interview time</span><strong>{formatRecruitmentDateTime(application.interview_scheduled_at, application.interview_timezone || DEFAULT_RECRUITMENT_TIME_ZONE)}</strong><small>{recruitmentTimeZoneLabel(application.interview_timezone || DEFAULT_RECRUITMENT_TIME_ZONE)}</small></div> : null}
            <label className="recruitment-wide-label">Panel / interview notes<textarea rows={5} value={interview.notes} onChange={(event) => setInterview({ ...interview, notes: event.target.value })} disabled={isHired} /></label>
            {!isHired ? <div className="recruitment-interview-actions"><button className={`portal-button ${interview.status === "Failed" ? "portal-button--danger" : "portal-button--primary"}`} disabled={busy || !interviewRecordReady} onClick={() => void saveInterview()}>{interview.status === "No Show" ? "Review no-show record" : interview.status === "Failed" ? "Review final disposition" : "Save interview record"}</button><span className={interviewPassed ? "is-ready" : ""}>{interviewPassed ? "✓ Interview passed — specialist appointment is now available below." : "A Forensics Specialist appointment requires a Passed interview."}</span></div> : null}
          </section>

          <section className={`portal-panel recruitment-next-action ${isHired ? "is-complete" : appointmentEligible ? "is-interview" : "is-review"}`}>
            <div className="portal-panel-heading"><div><p>Personnel appointment</p><h2>Forensics Specialist · Forensic Services</h2></div><b className={`recruitment-status ${isHired ? "recruitment-status--accepted" : ""}`}>{isHired ? "Appointed" : appointmentEligible ? "Ready" : "Locked"}</b></div>
            <p>{isHired ? "The personnel record has been created. The member uses the standard LSCSO personnel portal with Forensics Specialist as the position and Forensic Services as the division." : "This is a separate personnel action from accepting the application. It becomes available only after the required interview is recorded as Passed."}</p>
            {!isHired ? <button className="portal-button portal-button--primary" type="button" disabled={busy || !appointmentEligible} onClick={() => void appointSpecialist()}>{busy ? "Processing…" : "Appoint Forensics Specialist"}</button> : null}
          </section>
        </>
      ) : (!isDenied && !isClosed ? <section className="portal-panel recruitment-interview-locked"><div><p>Interview stage</p><h2>Locked until application acceptance.</h2></div></section> : null)}

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

      <PortalDialog open={Boolean(interviewDisposition)} onClose={() => { if (!busy) setInterviewDisposition(null); }} eyebrow={interviewDisposition === "No Show" ? "Interview attendance" : "Final interview disposition"} title={interviewDisposition === "No Show" ? `Record ${application.full_name} as an interview no-show?` : `Record ${application.full_name} as not selected after interview?`} description={interviewDisposition === "No Show" ? "This records that the scheduled interview was not attended. The case remains open so Command can reschedule or close it separately." : "This records that the interview was completed but the candidate was not selected to advance."} dismissOnBackdrop={!busy} footer={<><button className="portal-button portal-button--secondary" disabled={busy} onClick={() => setInterviewDisposition(null)} type="button">Cancel</button><button className={`portal-button ${interviewDisposition === "No Show" ? "portal-button--primary" : "portal-button--danger"}`} disabled={busy || !interviewRecordReady} onClick={() => void confirmInterviewDisposition()} type="button">{busy ? "Recording…" : interviewDisposition === "No Show" ? "Record no show" : "Confirm final disposition"}</button></>}>
        <div className="recruitment-decision-review"><div><span>Applicant</span><strong>{application.full_name}</strong></div><div><span>Application</span><strong>{applicationLabel(application.application_number)}</strong></div><div><span>Disposition</span><strong>{interviewDisposition === "No Show" ? "Interview No Show · Process Open" : "Interview Completed · Not Selected"}</strong></div>{interview.result.trim() ? <div className="recruitment-decision-review__wide"><span>Internal result summary</span><strong>{interview.result.trim()}</strong></div> : null}</div>
      </PortalDialog>

      <PortalDialog open={Boolean(decision)} onClose={() => { if (!busy) { setDecision(null); setDecisionReason(""); } }} eyebrow="Application decision" title={decision === "Denied" ? `Deny ${application.full_name}'s Forensics application?` : `Accept ${application.full_name}'s Forensics application?`} description={decision === "Denied" ? "A documented reason is required." : "Acceptance advances the candidate to the required Forensic Services interview. It does not appoint them."} dismissOnBackdrop={!busy} footer={<><button className="portal-button portal-button--secondary" disabled={busy} onClick={() => { setDecision(null); setDecisionReason(""); }} type="button">Cancel</button><button className={`portal-button ${decision === "Denied" ? "portal-button--danger" : "portal-button--primary"}`} disabled={busy || (decision === "Denied" && decisionReason.trim().length < 4)} onClick={() => void confirmDecision()} type="button">{busy ? "Recording…" : decision === "Denied" ? "Confirm denial" : "Confirm acceptance"}</button></>}>
        <div className="recruitment-decision-review"><div><span>Applicant</span><strong>{application.full_name}</strong></div><div><span>Application</span><strong>{applicationLabel(application.application_number)}</strong></div><div><span>Decision</span><strong>{decision === "Denied" ? "Application Denied" : "Application Accepted · Interview Required"}</strong></div>{decision === "Denied" ? <label>Denial reason <em>Required</em><textarea required rows={5} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /><small>{decisionReason.trim().length} characters · minimum 4</small></label> : null}</div>
      </PortalDialog>
    </div>
  );
}
