"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { APPLICATION_CERTIFICATION_TEXT, APPLICATION_STATUSES, INTERVIEW_STATUSES, applicationLabel, applicationQuestions } from "@/lib/recruitment/application";
import { PortalDialog } from "../../../_components/PortalDialog";

type Decision = "Accepted" | "Denied";

export function ApplicationReview({ application, reviewers, names, notes, history }: any) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(application.status);
  const [reviewer, setReviewer] = useState(application.reviewer_profile_id ?? "");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [interview, setInterview] = useState({ status: application.interview_status, interviewer: application.interviewer_profile_id ?? "", scheduled: application.interview_scheduled_at ? application.interview_scheduled_at.slice(0,16) : "", notes: application.interview_notes ?? "", result: application.interview_result ?? "" });

  async function save(payload: any) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/portal/applications/${application.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The application could not be updated.");
      router.refresh(); return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The application could not be updated. Please try again."); return false; }
    finally { setBusy(false); }
  }
  async function noteSubmit(event: FormEvent) { event.preventDefault(); if (await save({ action: "note", content: note })) setNote(""); }
  async function confirmDecision() {
    if (!decision) return;
    if (decision === "Denied" && decisionReason.trim().length < 4) { setError("Enter a denial reason before recording the final decision."); return; }
    const ok = await save({ action: "decision", status: decision, reason: decision === "Denied" ? decisionReason.trim() : "" });
    if (ok) { setDecision(null); setDecisionReason(""); }
  }

  const grouped = applicationQuestions.reduce((acc:any,[section,key,label]) => { (acc[section] ??= []).push([key,label]); return acc; }, {});
  const certificationText = application.applicant_certification_text || APPLICATION_CERTIFICATION_TEXT;
  const signed = Boolean(application.applicant_signature_name && application.applicant_signed_at);

  return <div className="recruitment-review">
    {error ? <p className="application-error" role="alert">{error}</p> : null}
    <section className="portal-panel recruitment-applicant"><div><p>Applicant information</p><h2>{application.full_name}</h2><span>{applicationLabel(application.application_number)} · submitted {new Date(application.submitted_at ?? application.created_at).toLocaleString()}</span></div><dl><div><dt>Discord</dt><dd>{application.discord_username}</dd></div><div><dt>Timezone</dt><dd>{application.timezone}</dd></div><div><dt>Current status</dt><dd><b className={`recruitment-status recruitment-status--${application.status.toLowerCase().replaceAll(" ","-")}`}>{application.status}</b></dd></div><div><dt>Assigned reviewer</dt><dd>{names[application.reviewer_profile_id] ?? "Unassigned"}</dd></div></dl></section>
    <section className="portal-panel recruitment-controls"><div className="portal-panel-heading"><div><p>Command review controls</p><h2>Workflow</h2></div><span>Changes are audited</span></div><div className="recruitment-control-grid"><label>Assigned reviewer<select value={reviewer} onChange={(e) => setReviewer(e.target.value)}><option value="">Select reviewer</option>{reviewers.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="portal-button" disabled={busy || !reviewer} onClick={() => void save({ action: "assign_reviewer", reviewerProfileId: reviewer })}>Assign reviewer</button></label><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}>{APPLICATION_STATUSES.filter((item) => !["Accepted","Denied"].includes(item)).map((item) => <option key={item}>{item}</option>)}</select><button className="portal-button" disabled={busy} onClick={() => void save({ action: "status", status })}>Update status</button></label><div className="recruitment-final-decision"><span>Final decision</span><p>Final decisions are recorded in the application audit trail.</p><div><button className="portal-button portal-button--primary" disabled={busy} onClick={() => { setError(""); setDecision("Accepted"); }}>Accept applicant</button><button className="portal-button portal-button--danger" disabled={busy} onClick={() => { setError(""); setDecision("Denied"); }}>Deny applicant</button></div></div></div></section>
    <section className="portal-panel"><div className="portal-panel-heading"><div><p>Applicant certification</p><h2>Electronic signature</h2></div><b className={`recruitment-status ${signed ? "recruitment-status--accepted" : "recruitment-status--denied"}`}>{signed ? "Signed" : "Signature unavailable"}</b></div><div className="recruitment-signature-record"><p>{certificationText}</p><dl><div><dt>Signed by</dt><dd>{application.applicant_signature_name || "Not recorded"}</dd></div><div><dt>Signed at</dt><dd>{application.applicant_signed_at ? new Date(application.applicant_signed_at).toLocaleString() : "Not recorded"}</dd></div><div><dt>Method</dt><dd>{application.applicant_signature_method || "Not recorded"}</dd></div></dl></div></section>
    <section className="portal-panel"><div className="portal-panel-heading"><div><p>Interview tracking</p><h2>Interview record</h2></div></div><div className="recruitment-control-grid"><label>Interview status<select value={interview.status} onChange={(e) => setInterview({...interview,status:e.target.value})}>{INTERVIEW_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Interviewer<select value={interview.interviewer} onChange={(e) => setInterview({...interview,interviewer:e.target.value})}><option value="">Not assigned</option>{reviewers.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Scheduled date & time<input type="datetime-local" value={interview.scheduled} onChange={(e) => setInterview({...interview,scheduled:e.target.value})}/></label><label>Result<input value={interview.result} onChange={(e) => setInterview({...interview,result:e.target.value})} placeholder="Interview result"/></label></div><label className="recruitment-wide-label">Interview notes<textarea rows={4} value={interview.notes} onChange={(e) => setInterview({...interview,notes:e.target.value})}/></label><button className="portal-button" disabled={busy} onClick={() => void save({ action:"interview", interviewStatus:interview.status, interviewerProfileId:interview.interviewer, scheduledAt:interview.scheduled ? new Date(interview.scheduled).toISOString() : "", notes:interview.notes, result:interview.result })}>Save interview record</button></section>
    <section className="portal-panel"><div className="portal-panel-heading"><div><p>Internal notes</p><h2>Chronological notes</h2></div></div><form onSubmit={noteSubmit}><label className="recruitment-wide-label">Add an internal note<textarea required rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="portal-button" disabled={busy}>Add note</button></form><div className="recruitment-notes">{notes.map((item:any) => <article key={item.id}><strong>{names[item.author_profile_id] ?? "Command"}</strong><span>{new Date(item.created_at).toLocaleString()}</span><p>{item.content}</p></article>)}{!notes.length ? <div className="portal-empty-state"><strong>No internal notes recorded.</strong></div> : null}</div></section>
    <section className="portal-panel"><div className="portal-panel-heading"><div><p>Submitted application</p><h2>Answers</h2></div></div>{Object.entries(grouped).map(([section,questions]:any) => <div className="recruitment-answer-section" key={section}><h3>{section}</h3>{questions.map(([key,label]:any) => <article key={key}><strong>{label}</strong><p>{String(application[key] ?? "Not provided")}</p></article>)}</div>)}</section>
    <section className="portal-panel"><div className="portal-panel-heading"><div><p>Application history</p><h2>Audit trail</h2></div></div><div className="recruitment-history">{history.map((item:any) => <article key={item.id}><strong>{item.event_type}</strong><span>{names[item.actor_profile_id] ?? "System"} · {new Date(item.created_at).toLocaleString()}</span>{Object.keys(item.details ?? {}).length ? <small>{Object.entries(item.details).map(([key,value]) => `${key.replaceAll("_"," ")}: ${String(value)}`).join(" · ")}</small> : null}</article>)}</div></section>

    <PortalDialog open={Boolean(decision)} onClose={() => { if (!busy) { setDecision(null); setDecisionReason(""); } }} eyebrow="Final hiring decision" title={`${decision === "Denied" ? "Deny" : "Accept"} ${application.full_name}?`} description="This decision is recorded permanently in the application audit history." dismissOnBackdrop={!busy} footer={<><button className="portal-button portal-button--secondary" disabled={busy} onClick={() => { setDecision(null); setDecisionReason(""); }} type="button">Cancel</button><button className={`portal-button ${decision === "Denied" ? "portal-button--danger" : "portal-button--primary"}`} disabled={busy} onClick={() => void confirmDecision()} type="button">{busy ? "Recording…" : `Confirm ${decision === "Denied" ? "denial" : "acceptance"}`}</button></>}>
      <div className="recruitment-decision-review"><div><span>Applicant</span><strong>{application.full_name}</strong></div><div><span>Application</span><strong>{applicationLabel(application.application_number)}</strong></div><div><span>Decision</span><strong>{decision}</strong></div>{decision === "Denied" ? <label>Denial reason<textarea rows={4} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Document the reason for the final denial decision." /></label> : <p>Confirm that Command has completed the required review before recording acceptance.</p>}</div>
    </PortalDialog>
  </div>;
}
