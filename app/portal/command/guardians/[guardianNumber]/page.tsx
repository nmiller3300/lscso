import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";

type GuardianRecordPageProps = {
  params: Promise<{ guardianNumber: string }>;
};

export default async function GuardianRecordPage({ params }: GuardianRecordPageProps) {
  const { guardianNumber } = await params;
  const numeric = Number(guardianNumber);
  if (!Number.isFinite(numeric)) notFound();

  const supabase = await createClient() as any;
  const { data: record } = await supabase.from("guardian_records").select("*").eq("guardian_number", numeric).maybeSingle();
  if (!record) notFound();

  const [{ data: subject }, { data: author }] = await Promise.all([
    supabase.from("personnel_profiles").select("personnel_id,display_name,rank,call_sign").eq("id", record.subject_profile_id).maybeSingle(),
    supabase.from("personnel_profiles").select("display_name,rank,call_sign").eq("id", record.author_profile_id).maybeSingle(),
  ]);

  return (
    <PortalShell
      active="guardians"
      eyebrow={`Guardian G-${String(record.guardian_number).padStart(4, "0")}`}
      title={record.title}
      description={`${record.record_type} · ${record.status}`}
      actions={<><Link className="portal-button portal-button--secondary" href="/portal/command/guardians">Back to Guardians</Link><Link className="portal-button portal-button--primary" href="/portal/command/guardians/manage">Open management</Link></>}
    >
      <div className="command-v2-workspace-grid">
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Subject</p><h2>{subject?.display_name ?? "Restricted personnel"}</h2></div><span>{subject?.personnel_id ?? ""}</span></div>
          <p className="command-v2-compact-copy">{subject?.rank ?? ""}{subject?.call_sign ? ` · ${subject.call_sign}` : ""}</p>
        </section>
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Issued by</p><h2>{author?.display_name ?? "Department personnel"}</h2></div></div>
          <p className="command-v2-compact-copy">{author?.rank ?? ""}{author?.call_sign ? ` · ${author.call_sign}` : ""}</p>
        </section>
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Status</p><h2>{record.status}</h2></div></div>
          <p className="command-v2-compact-copy">Incident {new Date(record.incident_at).toLocaleString()}</p>
        </section>
      </div>

      <section className="portal-panel command-v2-record-body">
        <div className="portal-panel-heading"><div><p>Guardian record</p><h2>Record details</h2></div></div>
        <dl className="command-v2-record-detail-list">
          {record.location ? <><dt>Location</dt><dd>{record.location}</dd></> : null}
          {record.policy_reference ? <><dt>Policy reference</dt><dd>{record.policy_reference}</dd></> : null}
          {record.observed_behavior ? <><dt>Observed behavior</dt><dd>{record.observed_behavior}</dd></> : null}
          {record.expected_standard ? <><dt>Expected standard</dt><dd>{record.expected_standard}</dd></> : null}
          {record.action_taken ? <><dt>Action taken</dt><dd>{record.action_taken}</dd></> : null}
          {record.follow_up_plan ? <><dt>Follow-up</dt><dd>{record.follow_up_plan}</dd></> : null}
          {record.employee_response ? <><dt>Employee response</dt><dd>{record.employee_response}</dd></> : null}
        </dl>
      </section>
    </PortalShell>
  );
}
