"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PriorApplication = {
  id: string;
  applicationNumber: number;
  status: string;
  interviewStatus: string;
  interviewScheduledAt: string | null;
  interviewResult: string | null;
  submittedAt: string;
  matchBasis: string;
};

type Candidate = {
  profileId: string;
  personnelId: string;
  displayName: string;
  formerRank: string;
  deactivatedAt: string | null;
  credentialsLinked: boolean;
  lastCallSign: string | null;
  lastAssignment: string | null;
  separationTitle: string | null;
  separationNotes: string | null;
  guardianCount: number;
  trainingCount: number;
  certificationCount: number;
  awardCount: number;
  priorApplications: PriorApplication[];
};

type CaseEvent = {
  eventType: string;
  actorLabel: string | null;
  detail: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
};

type ReturnCase = {
  id: string;
  caseNumber: number;
  subjectProfileId: string;
  personnelId: string;
  displayName: string;
  caseType: "Rehire" | "Reinstatement";
  status: string;
  formerRank: string;
  proposedRank: string;
  statement: string;
  interviewRequirement: string;
  linkedApplicationId: string | null;
  interviewStatus: string;
  interviewScheduledAt: string | null;
  interviewerProfileId: string | null;
  interviewNotes: string | null;
  academyDisposition: string;
  ftoDisposition: string;
  decisionNotes: string | null;
  credentialsLinked: boolean;
  createdAt: string;
  decidedAt: string | null;
  completedAt: string | null;
  events: CaseEvent[];
};

type Reviewer = { profileId: string; displayName: string; rank: string };
type Workspace = { candidates: Candidate[]; cases: ReturnCase[]; reviewers: Reviewer[] };

type Props = { initialWorkspace: Workspace; actorRank: string };

const ranks = ["Sheriff","Undersheriff","Major","Captain","1st Lieutenant","Lieutenant","Sergeant","Corporal","Master Deputy","Deputy III","Deputy II","Deputy","Recruit"];
const entryDispositions = ["Required","Completed","Not Required","Waived"];

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function caseLabel(value: number) {
  return `RR-${String(value).padStart(4, "0")}`;
}

export function RehireReinstatementWorkspace({ initialWorkspace, actorRank }: Props) {
  const supabase = useMemo(() => createClient() as any, []);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [candidateId, setCandidateId] = useState(initialWorkspace.candidates[0]?.profileId ?? "");
  const [caseType, setCaseType] = useState<"Rehire" | "Reinstatement">("Reinstatement");
  const [proposedRank, setProposedRank] = useState("");
  const [interviewRequirement, setInterviewRequirement] = useState("Not Required");
  const [linkedApplicationId, setLinkedApplicationId] = useState("");
  const [academyDisposition, setAcademyDisposition] = useState("");
  const [ftoDisposition, setFtoDisposition] = useState("");
  const [statement, setStatement] = useState("");
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [scheduleTimes, setScheduleTimes] = useState<Record<string,string>>({});
  const [interviewers, setInterviewers] = useState<Record<string,string>>({});
  const [caseNotes, setCaseNotes] = useState<Record<string,string>>({});

  const candidate = workspace.candidates.find((item) => item.profileId === candidateId) ?? null;
  const actorIndex = ranks.indexOf(actorRank);
  const availableRanks = useMemo(() => {
    if (!candidate) return [];
    const formerIndex = ranks.indexOf(candidate.formerRank);
    return ranks.filter((rank, index) => rank !== "Sheriff" && index >= formerIndex && (actorIndex < 0 || index > actorIndex));
  }, [actorIndex, candidate]);

  useEffect(() => {
    if (!candidate) return;
    if (!availableRanks.includes(proposedRank)) setProposedRank(availableRanks[0] ?? "");
    if (linkedApplicationId && !candidate.priorApplications.some((item) => item.id === linkedApplicationId)) setLinkedApplicationId("");
  }, [availableRanks, candidate, linkedApplicationId, proposedRank]);

  async function refresh() {
    const { data, error: rpcError } = await supabase.rpc("get_rehire_reinstatement_workspace");
    if (rpcError) throw rpcError;
    setWorkspace((data ?? { candidates: [], cases: [], reviewers: [] }) as Workspace);
  }

  async function run(key: string, action: () => Promise<{ error?: { message?: string } | null }>, success: string) {
    if (pending) return;
    setPending(key);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (result.error) throw new Error(result.error.message || "The requested action could not be completed.");
      await refresh();
      setNotice(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The requested action could not be completed.");
    } finally {
      setPending("");
    }
  }

  async function openReview() {
    if (!candidate || !proposedRank || !academyDisposition || !ftoDisposition || statement.trim().length < 10) {
      setError("Select the return rank and training dispositions, then enter the reason for review.");
      return;
    }
    if (interviewRequirement === "Waived - Prior Interview") {
      const linked = candidate.priorApplications.find((item) => item.id === linkedApplicationId);
      if (!linked || linked.interviewStatus !== "Passed") {
        setError("A previously passed LSCSO interview must be linked before waiving a new interview.");
        return;
      }
    }
    await run("open", () => supabase.rpc("open_rehire_reinstatement_case", {
      p_subject_profile_id: candidate.profileId,
      p_case_type: caseType,
      p_proposed_rank: proposedRank,
      p_interview_requirement: interviewRequirement,
      p_linked_application_id: linkedApplicationId || null,
      p_statement: statement.trim(),
      p_academy_disposition: academyDisposition,
      p_fto_disposition: ftoDisposition,
    }), `${caseType} review opened for ${candidate.displayName}.`);
    setStatement("");
  }

  const openCases = workspace.cases.filter((item) => ["Under Review","Interview Required","Approved"].includes(item.status));
  const completedCases = workspace.cases.filter((item) => !["Under Review","Interview Required","Approved"].includes(item.status));

  return (
    <>
      <div className="deputy-summary-grid" style={{ marginBottom: 16 }}>
        <article><span>Separated personnel</span><strong>{String(workspace.candidates.length).padStart(2,"0")}</strong><small>Available for review</small></article>
        <article><span>Open reviews</span><strong>{String(openCases.length).padStart(2,"0")}</strong><small>Pending Executive action</small></article>
        <article><span>Interview required</span><strong>{String(openCases.filter((item) => item.status === "Interview Required").length).padStart(2,"0")}</strong><small>Return interviews</small></article>
        <article><span>Approved</span><strong>{String(openCases.filter((item) => item.status === "Approved").length).padStart(2,"0")}</strong><small>Awaiting return</small></article>
      </div>

      <section className="portal-panel" style={{ marginBottom: 16 }}>
        <div className="portal-panel-heading"><div><p>Executive return review</p><h2>Open rehire / reinstatement case</h2></div><span>Sheriff · Undersheriff</span></div>
        {!workspace.candidates.length ? <div className="portal-empty-state"><strong>No separated personnel are currently on file.</strong></div> : (
          <>
            <div className="portal-form-grid" style={{ marginTop: 16 }}>
              <label>Former member<select value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>{workspace.candidates.map((item) => <option key={item.profileId} value={item.profileId}>{item.personnelId} · {item.formerRank} {item.displayName}</option>)}</select></label>
              <label>Return type<select value={caseType} onChange={(event) => { const value = event.target.value as "Rehire"|"Reinstatement"; setCaseType(value); setInterviewRequirement(value === "Rehire" ? "Required" : "Not Required"); }}><option>Reinstatement</option><option>Rehire</option></select></label>
              <label>Return rank<select value={proposedRank} onChange={(event) => setProposedRank(event.target.value)}>{availableRanks.map((rank) => <option key={rank}>{rank}</option>)}</select></label>
              <label>Interview<select value={interviewRequirement} onChange={(event) => setInterviewRequirement(event.target.value)}><option>Required</option><option>Waived - Prior Interview</option><option>Not Required</option></select></label>
              <label>Academy disposition<select value={academyDisposition} onChange={(event) => setAcademyDisposition(event.target.value)}><option value="">Select disposition</option>{entryDispositions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>FTO disposition<select value={ftoDisposition} onChange={(event) => setFtoDisposition(event.target.value)}><option value="">Select disposition</option>{entryDispositions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label style={{ gridColumn: "1 / -1" }}>Prior LSCSO application / interview<select value={linkedApplicationId} onChange={(event) => setLinkedApplicationId(event.target.value)}><option value="">None linked</option>{candidate?.priorApplications.map((item) => <option key={item.id} value={item.id}>APP-{String(item.applicationNumber).padStart(4,"0")} · {item.status} · Interview {item.interviewStatus} · {item.matchBasis}</option>)}</select></label>
              <label style={{ gridColumn: "1 / -1" }}>Executive review basis<textarea rows={4} value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Why is this member being considered for return?" /></label>
            </div>
            {candidate ? (
              <div className="command-v2-inline-state" style={{ marginTop: 14 }}>
                <strong>{candidate.lastCallSign ?? candidate.personnelId} · {candidate.formerRank} {candidate.displayName}</strong>
                <span>{candidate.lastAssignment ?? "No prior assignment"} · {candidate.guardianCount} Guardian · {candidate.trainingCount} training · {candidate.certificationCount} certifications · {candidate.awardCount} awards · {candidate.priorApplications.length} prior application(s)</span>
                {candidate.separationNotes ? <span>Separation: {candidate.separationNotes}</span> : null}
              </div>
            ) : null}
            <div className="command-v2-action-row" style={{ marginTop: 16 }}><button className="portal-button portal-button--primary" disabled={pending === "open"} onClick={() => void openReview()} type="button">{pending === "open" ? "Opening…" : "Open return review"}</button></div>
          </>
        )}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Return cases</p><h2>Active review</h2></div><span>{openCases.length} open</span></div>
        <div className="command-v2-mini-list" style={{ marginTop: 14 }}>
          {openCases.map((item) => {
            const notes = caseNotes[item.id] ?? "";
            const defaultInterviewer = interviewers[item.id] ?? workspace.reviewers[0]?.profileId ?? "";
            return (
              <div key={item.id} style={{ alignItems: "stretch", display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>{caseLabel(item.caseNumber)} · {item.displayName}</strong><span>{item.status}</span></div>
                <small>{item.caseType} · {item.formerRank} → {item.proposedRank} · Interview: {item.interviewRequirement} / {item.interviewStatus}</small>
                <small>Academy: {item.academyDisposition} · FTO: {item.ftoDisposition}</small>
                <p>{item.statement}</p>

                {item.status === "Interview Required" && item.interviewStatus === "Not Scheduled" ? (
                  <div className="portal-form-grid" style={{ marginTop: 10 }}>
                    <label>Interview date/time<input type="datetime-local" value={scheduleTimes[item.id] ?? ""} onChange={(event) => setScheduleTimes((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
                    <label>Interviewer<select value={defaultInterviewer} onChange={(event) => setInterviewers((current) => ({ ...current, [item.id]: event.target.value }))}>{workspace.reviewers.map((reviewer) => <option value={reviewer.profileId} key={reviewer.profileId}>{reviewer.rank} {reviewer.displayName}</option>)}</select></label>
                    <div className="command-v2-action-row"><button className="portal-button portal-button--primary" disabled={!scheduleTimes[item.id] || !defaultInterviewer || pending === `schedule-${item.id}`} onClick={() => void run(`schedule-${item.id}`, () => supabase.rpc("schedule_rehire_reinstatement_interview", { p_case_id: item.id, p_scheduled_at: new Date(scheduleTimes[item.id]).toISOString(), p_interviewer_profile_id: defaultInterviewer }), `${caseLabel(item.caseNumber)} interview scheduled.`)} type="button">Schedule interview</button></div>
                  </div>
                ) : null}

                {item.status === "Interview Required" && item.interviewStatus === "Scheduled" ? (
                  <div style={{ marginTop: 10 }}>
                    <strong>Interview scheduled · {dateLabel(item.interviewScheduledAt)}</strong>
                    <label className="portal-call-sign-field" style={{ marginTop: 8 }}>Result note<textarea rows={3} value={notes} onChange={(event) => setCaseNotes((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
                    <div className="command-v2-action-row" style={{ marginTop: 8 }}>
                      <button className="portal-button portal-button--primary" disabled={notes.trim().length < 4 || pending.startsWith("interview-")} onClick={() => void run(`interview-${item.id}`, () => supabase.rpc("record_rehire_reinstatement_interview", { p_case_id: item.id, p_result: "Passed", p_notes: notes.trim() }), "Return interview passed. Case moved to Executive decision.")} type="button">Pass interview</button>
                      <button className="portal-button portal-button--danger" disabled={notes.trim().length < 4 || pending.startsWith("interview-")} onClick={() => void run(`interview-${item.id}`, () => supabase.rpc("record_rehire_reinstatement_interview", { p_case_id: item.id, p_result: "Failed", p_notes: notes.trim() }), "Return interview failed. Case closed.")} type="button">Fail interview</button>
                      <button className="portal-button portal-button--danger" disabled={notes.trim().length < 4 || pending.startsWith("interview-")} onClick={() => void run(`interview-${item.id}`, () => supabase.rpc("record_rehire_reinstatement_interview", { p_case_id: item.id, p_result: "No Show", p_notes: notes.trim() }), "No show recorded. Case closed.")} type="button">No show</button>
                    </div>
                  </div>
                ) : null}

                {item.status === "Under Review" ? (
                  <div style={{ marginTop: 10 }}>
                    <label className="portal-call-sign-field">Executive decision note<textarea rows={3} value={notes} onChange={(event) => setCaseNotes((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
                    <div className="command-v2-action-row" style={{ marginTop: 8 }}>
                      <button className="portal-button portal-button--primary" disabled={notes.trim().length < 4 || pending.startsWith("decide-")} onClick={() => void run(`decide-${item.id}`, () => supabase.rpc("decide_rehire_reinstatement_case", { p_case_id: item.id, p_decision: "Approved", p_notes: notes.trim() }), `${caseLabel(item.caseNumber)} approved.`)} type="button">Approve return</button>
                      <button className="portal-button portal-button--danger" disabled={notes.trim().length < 4 || pending.startsWith("decide-")} onClick={() => void run(`decide-${item.id}`, () => supabase.rpc("decide_rehire_reinstatement_case", { p_case_id: item.id, p_decision: "Denied", p_notes: notes.trim() }), `${caseLabel(item.caseNumber)} denied.`)} type="button">Deny return</button>
                    </div>
                  </div>
                ) : null}

                {item.status === "Approved" ? (
                  <div style={{ marginTop: 10 }}>
                    {item.credentialsLinked ? <div className="command-v2-action-row"><button className="portal-button portal-button--primary" disabled={pending === `complete-${item.id}`} onClick={() => void run(`complete-${item.id}`, () => supabase.rpc("complete_rehire_reinstatement_case", { p_case_id: item.id, p_notes: notes.trim() || null }), `${item.caseType} completed. Existing personnel record returned to active service.`)} type="button">Complete {item.caseType.toLowerCase()}</button></div> : <div className="portal-form-error"><strong>Credentials required before return.</strong><span>Restore or assign the member&apos;s account, then complete this case.</span><Link href="/portal/command/administration/accounts">Open Personnel Accounts →</Link></div>}
                  </div>
                ) : null}

                <details style={{ marginTop: 10 }}><summary>Case history · {item.events.length}</summary><div className="personnel-compact-records" style={{ marginTop: 8 }}>{item.events.map((event, index) => <div key={`${event.createdAt}-${index}`}><strong>{event.eventType}</strong><span>{dateLabel(event.createdAt)}{event.actorLabel ? ` · ${event.actorLabel}` : ""}</span>{event.detail ? <small>{event.detail}</small> : null}</div>)}</div></details>
              </div>
            );
          })}
          {!openCases.length ? <div className="portal-empty-state"><strong>No active return reviews.</strong></div> : null}
        </div>
      </section>

      {completedCases.length ? <section className="portal-panel" style={{ marginTop: 16 }}><div className="portal-panel-heading"><div><p>History</p><h2>Closed return reviews</h2></div><span>{completedCases.length}</span></div><div className="command-v2-mini-list">{completedCases.slice(0,20).map((item) => <div key={item.id}><strong>{caseLabel(item.caseNumber)} · {item.displayName}</strong><span>{item.status} · {item.caseType} · {item.formerRank} → {item.proposedRank}</span>{item.decisionNotes ? <small>{item.decisionNotes}</small> : null}</div>)}</div></section> : null}

      {error ? <div className="portal-toast" role="alert">{error}</div> : null}
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
