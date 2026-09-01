import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelRecordHeader } from "../../../../_components/PersonnelRecordHeader";
import { PortalShell } from "../../../../_components/PortalShell";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };

function dateLabel(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.length === 10 ? `${value}T12:00:00` : value;
  return new Date(normalized).toLocaleDateString();
}

export default async function PersonnelTrainingPage({ params }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  const { personnelId } = await params;
  const access = await canAccessPersonnelRecord(profile, personnelId);
  if (!access.allowed) redirect("/portal/command/supervision");

  const supabase = await createClient() as any;
  const { data: member } = await supabase
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,call_sign,division,status")
    .eq("personnel_id", personnelId.toUpperCase())
    .maybeSingle();
  if (!member) notFound();

  const [{ data: rosterAccessRows }, certs, training] = await Promise.all([
    supabase.rpc("get_my_roster_access"),
    supabase
      .from("certifications")
      .select("id,name,certificate_number,status,issued_on,expires_on")
      .eq("profile_id", member.id)
      .order("issued_on", { ascending: false }),
    supabase
      .from("training_progress")
      .select("id,program_type,phase,status,progress_percent,started_on,completed_on,evaluation_notes,evaluator_profile_id,trainer:personnel_profiles!training_progress_evaluator_profile_id_fkey(personnel_id,display_name,rank,call_sign)")
      .eq("profile_id", member.id)
      .order("created_at", { ascending: false }),
  ]);

  const trainingRows = training.data ?? [];
  const trainingIds = trainingRows.map((item: any) => item.id);
  const { data: trainingEvents } = trainingIds.length
    ? await supabase
        .from("training_events")
        .select("id,training_progress_id,event_type,phase,status,progress_percent,notes,created_at")
        .in("training_progress_id", trainingIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const currentCertifications = (certs.data ?? []).filter((item: any) => item.status === "Current");
  const ftoQualified = currentCertifications.some((item: any) => item.name === "Field Training Officer" && (!item.expires_on || item.expires_on >= new Date().toISOString().slice(0, 10)));
  const activeTraining = trainingRows.find((item: any) => ["Not Started", "In Progress", "Needs Improvement"].includes(item.status));
  const rosterAccess = rosterAccessRows?.[0];
  const canManageTraining = Boolean(rosterAccess?.can_manage_training || rosterAccess?.can_train_assigned);

  return (
    <PortalShell
      active="personnel"
      eyebrow={`${member.personnel_id} · Training`}
      title={`${member.display_name} · Training`}
      description="Qualifications, FTO assignment, training progression, and recorded training activity."
      actions={(
        <>
          {canManageTraining ? <a className="portal-button portal-button--secondary" href="https://lscsoroster.vercel.app/manage" target="_blank" rel="noreferrer">Open Personnel Operations</a> : null}
          <Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}`}>Back to record</Link>
        </>
      )}
    >
      <PersonnelRecordHeader personnelId={member.personnel_id} displayName={member.display_name} rank={member.rank} callSign={member.call_sign} assignment={member.division} status={member.status} active="training" />

      <section className="portal-panel" style={{ marginBottom: 16 }}>
        <div className="portal-panel-heading">
          <div><p>Training status</p><h2>Current readiness</h2></div>
          <span>{activeTraining ? activeTraining.status : "No active training"}</span>
        </div>
        <div className="command-v2-workspace-grid">
          <div className="portal-panel">
            <div className="portal-panel-heading"><div><p>FTO permissions</p><h2>{ftoQualified ? "Authorized" : "Not authorized"}</h2></div></div>
            <p className="command-v2-compact-copy">A current Field Training Officer certification is the sole source of FTO permissions.</p>
          </div>
          <div className="portal-panel">
            <div className="portal-panel-heading"><div><p>Active trainer</p><h2>{activeTraining ? ((Array.isArray(activeTraining.trainer) ? activeTraining.trainer[0] : activeTraining.trainer)?.display_name ?? "Unassigned") : "None"}</h2></div></div>
            <p className="command-v2-compact-copy">{activeTraining ? `${activeTraining.program_type} · ${activeTraining.phase} · ${activeTraining.progress_percent}%` : "No active training assignment is recorded."}</p>
          </div>
          <div className="portal-panel">
            <div className="portal-panel-heading"><div><p>Qualifications</p><h2>{currentCertifications.length} current</h2></div></div>
            <p className="command-v2-compact-copy">Current department certifications and readiness qualifications.</p>
          </div>
        </div>
      </section>

      <div className="personnel-record-two-column">
        <section className="portal-panel personnel-record-wide">
          <div className="portal-panel-heading"><div><p>Qualifications</p><h2>Certifications</h2></div><span>{certs.data?.length ?? 0}</span></div>
          <div className="personnel-certification-grid personnel-certification-grid--command">
            {(certs.data ?? []).length ? (certs.data ?? []).map((item:any) => <article key={item.id}><span>{item.status}</span><strong>{item.name}</strong><small>{item.certificate_number ?? "No certificate number"}</small><dl><div><dt>Issued</dt><dd>{dateLabel(item.issued_on) ?? "Pending"}</dd></div><div><dt>Expires</dt><dd>{item.expires_on ? dateLabel(item.expires_on) : "No expiration"}</dd></div></dl></article>) : <p className="command-v2-compact-copy">No certification records.</p>}
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Progression</p><h2>Training records</h2></div><span>{trainingRows.length}</span></div>
          <div className="command-v2-mini-list">
            {trainingRows.length ? trainingRows.map((item:any) => {
              const trainer = Array.isArray(item.trainer) ? item.trainer[0] : item.trainer;
              return (
                <div key={item.id}>
                  <div>
                    <strong>{item.program_type} · {item.phase}</strong>
                    <span>{item.status} · {item.progress_percent}%{trainer?.display_name ? ` · Trainer: ${trainer.display_name}` : ""}</span>
                    <small>{item.started_on ? `Started ${dateLabel(item.started_on)}` : "Start date not recorded"}{item.completed_on ? ` · Completed ${dateLabel(item.completed_on)}` : ""}</small>
                    {item.evaluation_notes ? <small>{item.evaluation_notes}</small> : null}
                  </div>
                </div>
              );
            }) : <p className="command-v2-compact-copy">No training progression records.</p>}
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Activity</p><h2>Training history</h2></div><span>{trainingEvents?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(trainingEvents ?? []).length ? (trainingEvents ?? []).slice(0, 12).map((item:any) => (
              <div key={item.id}>
                <strong>{item.event_type}</strong>
                <span>{item.phase ?? "No phase"} · {item.status ?? "No status"}{item.progress_percent !== null ? ` · ${item.progress_percent}%` : ""} · {dateLabel(item.created_at)}</span>
                {item.notes ? <small>{item.notes}</small> : null}
              </div>
            )) : <p className="command-v2-compact-copy">No training activity has been recorded yet.</p>}
          </div>
        </section>

        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Management</p><h2>Certification Center</h2></div></div>
          <p className="command-v2-compact-copy">Issue, review, or manage qualifications through the existing certification workflow.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href="/portal/command/certifications">Open Certification Center</Link></div>
        </section>
      </div>
    </PortalShell>
  );
}
