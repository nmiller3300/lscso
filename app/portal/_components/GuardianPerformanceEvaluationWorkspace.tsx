"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

type PersonnelOption = {
  id: string;
  personnelId: string;
  displayName: string;
  rank: string;
  callSign: string | null;
  division: string;
  authorityLabel: string;
};

type EvaluationRecord = {
  id: string;
  guardianNumber: number;
  subjectProfileId: string;
  subjectName: string;
  subjectPersonnelId: string;
  authorName: string;
  status: string;
  title: string;
  issuedAt: string;
  followUpDueAt: string | null;
  acknowledgedAt: string | null;
  evaluationKind: string;
  periodStart: string;
  periodEnd: string;
  overallAverage: number;
  overallRating: string;
};

type RatingKey =
  | "professionalConduct"
  | "policyKnowledge"
  | "communication"
  | "judgmentDecisionMaking"
  | "reportDocumentation"
  | "officerSafetyTactics"
  | "initiativeReliability"
  | "teamworkLeadership";

const ratingFields: Array<{ key: RatingKey; label: string; detail: string }> = [
  { key: "professionalConduct", label: "Professional Conduct", detail: "Integrity, demeanor, accountability" },
  { key: "policyKnowledge", label: "Policy Knowledge", detail: "Department policy and procedure" },
  { key: "communication", label: "Communication", detail: "Radio, interpersonal, chain of command" },
  { key: "judgmentDecisionMaking", label: "Judgment & Decision-Making", detail: "Reasoning, discretion, sound decisions" },
  { key: "reportDocumentation", label: "Reports & Documentation", detail: "Accuracy, completeness, timeliness" },
  { key: "officerSafetyTactics", label: "Officer Safety & Tactics", detail: "Awareness, control, safe practices" },
  { key: "initiativeReliability", label: "Initiative & Reliability", detail: "Readiness, ownership, follow-through" },
  { key: "teamworkLeadership", label: "Teamwork & Leadership", detail: "Team contribution and leadership behavior" },
];

const ratingLabels: Record<number, string> = {
  1: "Unsatisfactory",
  2: "Needs Improvement",
  3: "Meets Expectations",
  4: "Exceeds Expectations",
  5: "Exceptional",
};

const evaluationKinds = ["Routine", "Probationary", "Annual", "Promotion Readiness", "Special"];

function dateInput(date: Date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 10);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString();
}

function overallLabel(average: number) {
  if (average >= 4.5) return "Exceptional";
  if (average >= 3.75) return "Exceeds Expectations";
  if (average >= 2.75) return "Meets Expectations";
  if (average >= 1.75) return "Needs Improvement";
  return "Unsatisfactory";
}

function initialRatings(): Record<RatingKey, number> {
  return {
    professionalConduct: 3,
    policyKnowledge: 3,
    communication: 3,
    judgmentDecisionMaking: 3,
    reportDocumentation: 3,
    officerSafetyTactics: 3,
    initiativeReliability: 3,
    teamworkLeadership: 3,
  };
}

export function GuardianPerformanceEvaluationWorkspace() {
  const currentProfile = usePortalProfile();
  const today = new Date();
  const priorMonth = new Date(today);
  priorMonth.setDate(priorMonth.getDate() - 30);

  const [personnel, setPersonnel] = useState<PersonnelOption[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [evaluationKind, setEvaluationKind] = useState("Routine");
  const [periodStart, setPeriodStart] = useState(dateInput(priorMonth));
  const [periodEnd, setPeriodEnd] = useState(dateInput(today));
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [ratings, setRatings] = useState<Record<RatingKey, number>>(initialRatings);
  const [strengths, setStrengths] = useState("");
  const [improvementAreas, setImprovementAreas] = useState("");
  const [goals, setGoals] = useState("");
  const [supervisorSummary, setSupervisorSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const average = useMemo(() => {
    const values = Object.values(ratings);
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [ratings]);
  const overall = overallLabel(average);
  const selectedMember = personnel.find((member) => member.id === selectedMemberId) ?? null;
  const memberHistory = selectedMemberId ? evaluations.filter((evaluation) => evaluation.subjectProfileId === selectedMemberId) : [];
  const awaiting = evaluations.filter((evaluation) => evaluation.status === "Awaiting Acknowledgment").length;

  async function load() {
    setLoading(true);
    setError("");
    const supabase = createClient() as any;
    const [
      { data: profileRows, error: profileError },
      { data: purviewRows, error: purviewError },
      { data: evaluationRows, error: evaluationError },
    ] = await Promise.all([
      supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,call_sign,division,status").neq("status", "Deactivated").order("personnel_id"),
      supabase.rpc("get_personnel_in_my_purview"),
      supabase.from("guardian_records").select("id,guardian_number,subject_profile_id,author_profile_id,status,title,issued_at,created_at,follow_up_due_at,acknowledged_at,structured_fields").eq("record_type", "Performance Evaluation").order("created_at", { ascending: false }),
    ]);

    if (profileError || purviewError || evaluationError) {
      setError(profileError?.message ?? purviewError?.message ?? evaluationError?.message ?? "Performance evaluations could not be loaded.");
      setLoading(false);
      return;
    }

    const profiles = new Map((profileRows ?? []).map((profile: any) => [profile.id, profile]));
    const purview = new Map<string, { row: any; labels: Set<string> }>();
    for (const row of purviewRows ?? []) {
      if (!row.profile_id || row.profile_id === currentProfile.id) continue;
      const unit = row.organizational_unit_name || (row.scope === "department" ? "Department-wide" : "Direct assignment");
      const authority = row.authority_type || "Supervisory authority";
      const label = row.scope === "department" ? "Department-wide command authority" : `${unit} · ${authority}`;
      const existing = purview.get(row.profile_id);
      if (existing) existing.labels.add(label);
      else purview.set(row.profile_id, { row, labels: new Set([label]) });
    }

    const options: PersonnelOption[] = [...purview.values()].map(({ row, labels }) => {
      const profile = profiles.get(row.profile_id) as any;
      return {
        id: row.profile_id,
        personnelId: profile?.personnel_id ?? row.personnel_id ?? "",
        displayName: profile?.display_name ?? row.display_name ?? "Personnel",
        rank: profile?.rank ?? row.rank ?? "Personnel",
        callSign: profile?.call_sign ?? row.call_sign ?? null,
        division: profile?.division ?? row.organizational_unit_name ?? "Unassigned",
        authorityLabel: [...labels].join(" / "),
      };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName));

    const names = new Map((profileRows ?? []).map((profile: any) => [profile.id, profile]));
    const rows: EvaluationRecord[] = (evaluationRows ?? []).map((record: any) => {
      const subject = names.get(record.subject_profile_id) as any;
      const author = names.get(record.author_profile_id) as any;
      const fields = record.structured_fields && typeof record.structured_fields === "object" ? record.structured_fields : {};
      return {
        id: record.id,
        guardianNumber: Number(record.guardian_number),
        subjectProfileId: record.subject_profile_id,
        subjectName: subject?.display_name ?? "Restricted personnel",
        subjectPersonnelId: subject?.personnel_id ?? "",
        authorName: author?.display_name ?? "Command",
        status: record.status,
        title: record.title,
        issuedAt: record.issued_at ?? record.created_at,
        followUpDueAt: record.follow_up_due_at,
        acknowledgedAt: record.acknowledged_at,
        evaluationKind: String(fields.evaluation_kind ?? "Performance"),
        periodStart: String(fields.period_start ?? ""),
        periodEnd: String(fields.period_end ?? ""),
        overallAverage: Number(fields.overall_average ?? 0),
        overallRating: String(fields.overall_rating ?? "Not rated"),
      };
    });

    setPersonnel(options);
    setEvaluations(rows);
    if (!selectedMemberId && options.length === 1) setSelectedMemberId(options[0].id);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function submitEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setNotice("");
    if (!selectedMemberId) return setError("Select the personnel member being evaluated.");
    if (!periodStart || !periodEnd) return setError("Enter the evaluation period.");
    if (new Date(`${periodEnd}T12:00:00`) < new Date(`${periodStart}T12:00:00`)) return setError("Evaluation period end must be on or after the start date.");
    if (strengths.trim().length < 4) return setError("Document the member's strengths.");
    if (improvementAreas.trim().length < 4) return setError("Document improvement areas or state that none were identified.");
    if (goals.trim().length < 4) return setError("Document the next-period goals.");
    if (supervisorSummary.trim().length < 10) return setError("Enter the supervisor's overall assessment.");

    setSubmitting(true);
    const supabase = createClient() as any;
    const { data, error: rpcError } = await supabase.rpc("create_performance_evaluation", {
      p_subject_profile_id: selectedMemberId,
      p_evaluation_kind: evaluationKind,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_professional_conduct: ratings.professionalConduct,
      p_policy_knowledge: ratings.policyKnowledge,
      p_communication: ratings.communication,
      p_judgment_decision_making: ratings.judgmentDecisionMaking,
      p_report_documentation: ratings.reportDocumentation,
      p_officer_safety_tactics: ratings.officerSafetyTactics,
      p_initiative_reliability: ratings.initiativeReliability,
      p_teamwork_leadership: ratings.teamworkLeadership,
      p_strengths: strengths.trim(),
      p_improvement_areas: improvementAreas.trim(),
      p_goals: goals.trim(),
      p_supervisor_summary: supervisorSummary.trim(),
      p_follow_up_due_at: followUpDueAt ? new Date(followUpDueAt).toISOString() : null,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const guardianNumber = data?.guardian_number ? `G-${String(data.guardian_number).padStart(4, "0")}` : "Performance evaluation";
    setNotice(`${guardianNumber} issued to ${selectedMember?.displayName ?? "personnel"}. Member acknowledgment is now pending.`);
    setStrengths("");
    setImprovementAreas("");
    setGoals("");
    setSupervisorSummary("");
    setFollowUpDueAt("");
    setRatings(initialRatings());
    await load();
  }

  if (loading) return <section className="portal-panel"><div className="portal-empty-state"><strong>Loading performance evaluations…</strong></div></section>;

  return (
    <div className="command-v2-directory">
      <section className="deputy-summary-grid command-v2-record-metrics">
        <article><span>Evaluations</span><strong>{String(evaluations.length).padStart(2, "0")}</strong><small>Permanent Guardian records</small></article>
        <article><span>Awaiting acknowledgment</span><strong>{String(awaiting).padStart(2, "0")}</strong><small>Member action required</small></article>
        <article><span>Current rating</span><strong>{average.toFixed(2)}</strong><small>{overall}</small></article>
        <article><span>Disciplinary points</span><strong>00</strong><small>Evaluations are non-disciplinary</small></article>
      </section>

      <form onSubmit={submitEvaluation}>
        <section className="portal-panel" style={{ marginBottom: 16 }}>
          <div className="portal-panel-heading"><div><p>Guardian · Performance</p><h2>Issue Performance Evaluation</h2></div><span>Direct supervisor record</span></div>
          <div className="portal-form-protection" style={{ marginTop: 14 }}><strong>Non-disciplinary Guardian record</strong><span>Performance evaluations carry zero disciplinary points. The member must acknowledge receipt and may attach a written response.</span></div>

          <div className="portal-form-grid" style={{ marginTop: 18 }}>
            <label>
              Personnel member
              <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} required>
                <option value="">Select personnel</option>
                {personnel.map((member) => <option key={member.id} value={member.id}>{member.rank} {member.displayName} · {member.callSign ?? member.personnelId}</option>)}
              </select>
              <small>{selectedMember?.authorityLabel ?? "Only personnel within your supervisory authority are available."}</small>
            </label>
            <label>
              Evaluation type
              <select value={evaluationKind} onChange={(event) => setEvaluationKind(event.target.value)}>{evaluationKinds.map((kind) => <option key={kind}>{kind}</option>)}</select>
            </label>
            <label>
              Review period start
              <input max={dateInput(today)} onChange={(event) => setPeriodStart(event.target.value)} required type="date" value={periodStart} />
            </label>
            <label>
              Review period end
              <input max={dateInput(today)} min={periodStart} onChange={(event) => setPeriodEnd(event.target.value)} required type="date" value={periodEnd} />
            </label>
            <label>
              Follow-up date <span>Optional</span>
              <input onChange={(event) => setFollowUpDueAt(event.target.value)} type="datetime-local" value={followUpDueAt} />
            </label>
          </div>
        </section>

        <section className="portal-panel" style={{ marginBottom: 16 }}>
          <div className="portal-panel-heading"><div><p>1–5 rating scale</p><h2>Performance Categories</h2></div><span>{average.toFixed(2)} · {overall}</span></div>
          <div className="portal-form-grid" style={{ marginTop: 16 }}>
            {ratingFields.map((field) => (
              <label key={field.key}>
                {field.label}
                <select value={ratings[field.key]} onChange={(event) => setRatings((current) => ({ ...current, [field.key]: Number(event.target.value) }))}>
                  {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} — {ratingLabels[value]}</option>)}
                </select>
                <small>{field.detail}</small>
              </label>
            ))}
          </div>
          <div className="portal-form-protection" style={{ marginTop: 14 }}><strong>{overall} · {average.toFixed(2)} / 5.00</strong><span>Overall rating is calculated from all eight categories and stored with the evaluation.</span></div>
        </section>

        <section className="portal-panel" style={{ marginBottom: 16 }}>
          <div className="portal-panel-heading"><div><p>Supervisor assessment</p><h2>Evaluation Narrative</h2></div></div>
          <div className="portal-form-grid" style={{ marginTop: 16 }}>
            <label style={{ gridColumn: "1 / -1" }}>
              Overall assessment
              <textarea maxLength={6000} onChange={(event) => setSupervisorSummary(event.target.value)} placeholder="Summarize performance during this review period." required rows={5} value={supervisorSummary} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Strengths
              <textarea maxLength={6000} onChange={(event) => setStrengths(event.target.value)} placeholder="Document demonstrated strengths and positive performance." required rows={4} value={strengths} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Improvement areas
              <textarea maxLength={6000} onChange={(event) => setImprovementAreas(event.target.value)} placeholder="Document development areas, or state that none were identified." required rows={4} value={improvementAreas} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Goals / next-period expectations
              <textarea maxLength={6000} onChange={(event) => setGoals(event.target.value)} placeholder="Set clear goals or expectations for the next review period." required rows={4} value={goals} />
            </label>
          </div>
          {error ? <div className="portal-form-error" role="alert" style={{ marginTop: 14 }}>{error}</div> : null}
          {notice ? <div className="portal-form-protection" role="status" style={{ marginTop: 14 }}><strong>Evaluation issued</strong><span>{notice}</span></div> : null}
          <div className="command-v2-action-row" style={{ marginTop: 16 }}>
            <button className="portal-button portal-button--primary" disabled={submitting || !personnel.length} type="submit">{submitting ? "Issuing…" : "Issue evaluation"}</button>
            <Link className="portal-button portal-button--secondary" href="/portal/command/guardians">Back to Guardians</Link>
          </div>
        </section>
      </form>

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Permanent record</p><h2>{selectedMember ? `${selectedMember.displayName} · Evaluation History` : "Performance Evaluation History"}</h2></div><span>{selectedMember ? memberHistory.length : evaluations.length} records</span></div>
        <div className="command-v2-personnel-results" style={{ marginTop: 12 }}>
          {(selectedMember ? memberHistory : evaluations).map((evaluation) => (
            <Link href={`/portal/command/guardians/${evaluation.guardianNumber}`} key={evaluation.id}>
              <div><strong>G-{String(evaluation.guardianNumber).padStart(4, "0")} · {evaluation.evaluationKind}</strong><span>{evaluation.subjectName} · {dateLabel(evaluation.periodStart)} – {dateLabel(evaluation.periodEnd)} · {evaluation.authorName}</span></div>
              <div><span>{evaluation.overallAverage.toFixed(2)} · {evaluation.overallRating}</span><b>{evaluation.status}</b></div>
            </Link>
          ))}
          {!(selectedMember ? memberHistory : evaluations).length ? <div className="portal-empty-state"><strong>No performance evaluations are on file.</strong></div> : null}
        </div>
      </section>
    </div>
  );
}
