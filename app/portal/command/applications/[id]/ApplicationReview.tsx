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
import { PortalDialog } from "../../../_components/PortalDialog";
import { ApplicationDynamicAnswers } from "./ApplicationDynamicAnswers";
import { ApplicantStatusMessage } from "./ApplicantStatusMessage";
import { EmploymentOfferManager } from "./EmploymentOfferManager";
import { RecruitHireHandoff } from "./RecruitHireHandoff";

type Decision = "Accepted" | "Denied";

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
  const [interview, setInterview] = useState({
    status: application.interview_status ?? "Not Scheduled",
    interviewer: application.interviewer_profile_id ?? "",
    scheduled: application.interview_scheduled_at ? application.interview_scheduled_at.slice(0, 16) : "",
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
          <p>Candidate record</p>
          <h2>{application.full_name}</h2>
          <span>{applicationLabel(application.application_number)} · submitted {new Date(application.submitted_at ?? application.created_at).toLocaleString()}</span>
        </div>
        <dl>
          <div><dt>Discord</dt><dd>{application.discord_username}</dd></div>
          <div><dt>Timezone</dt><dd>{application.timezone}</dd></div>
          <div><dt>Application</dt><dd><b className={`recruitment-status recruitment-status--${application.status.toLowerCase().replaceAll(" ", "-")}`}>{isClosed ? "Closed" : applicationStatusLabel(application.status)}</b></dd></div>
          <div><dt>Assigned reviewer</dt><dd>{names[application.reviewer_profile_id] ?? "Unassigned"}</dd></div>
          <div><dt>Interview</dt><dd>{application.interview_status ?? "Not Scheduled"}</dd></div>
          <div><dt>Employment offer</dt><dd>{offerStatus ?? "Not issued"}</dd></div>
          <div><dt>Recruit record</dt><dd>{isHired ? "Created" : "Not created"}</dd></div>
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
              <div><p>Required interview</p><h2>{isHired ? "Interview completed" : "Interview scheduling & result"}</h2></div>
              <b className={`recruitment-status recruitment-status--${String(application.interview_status ?? "not-scheduled").toLowerCase().replaceAll(" ", "-")}`}>{application.interview_status ?? "Not Scheduled"}</b>
            </div>
            <div className="recruitment-control-grid">
              <label>
                Interview status
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
                Scheduled date & time
                <input type="datetime-local" value={interview.scheduled} onChange={(event) => setInterview({ ...interview, scheduled: event.target.value })} disabled={isHired || Boolean(offer)} />
              </label>
              <label>
                Result summary
                <input value={interview.result} onChange={(event) => setInterview({ ...interview, result: event.target.value })} placeholder="Required for Pass / Fail" disabled={isHired || Boolean(offer)} />
              </label>
            </div>
            <label className="recruitment-wide-label">Interview notes<textarea rows={5} value={interview.notes} onChange={(event) => setInterview({ ...interview, notes: event.target.value })} disabled={isHired || Boolean(offer)} /></label>
            {!isHired && !offer ? (
              <div className="recruitment-interview-actions">
                <button
                  className="portal-button portal-button--primary"
                  disabled={busy || !interviewRecordReady}
                  onClick={() => void save({ action: "interview", interviewStatus: interview.status, interviewerProfileId: interview.interviewer, scheduledAt: interview.scheduled ? new Date(interview.scheduled).toISOString() : "", notes: interview.notes, result: interview.result })}
                >
                  Save interview record
                </button>
                <span className={interviewPassed ? "is-ready" : ""}>
                  {interview.status === "No Show"
                    ? "No Show closes the selection process immediately."
                    : interviewNeedsSchedule
                      ? "Enter the interview date and time."
                      : interviewNeedsFinalDetails
                        ? "Pass / Fail requires interviewer and result summary."
                        : interviewPassed
                          ? "✓ Interview passed — issue the employment offer below."
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
