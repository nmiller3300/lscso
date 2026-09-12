import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelTrainingControls } from "./PersonnelTrainingControls";
import { PersonnelRecordHeader } from "../../../../_components/PersonnelRecordHeader";
import { PortalShell } from "../../../../_components/PortalShell";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };

const ACTIVE_TRAINING_STATUSES = ["Not Started", "In Progress", "Needs Improvement"];

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

  const [{ data: rosterAccessRows }, certs, training, history, requirements] = await Promise.all([
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
    supabase
      .from("personnel_training_records")
      .select("id,record_type,category,title,provider,completed_on,verification_status,notes,source_document_reference,created_at")
      .eq("profile_id", member.id)
      .order("completed_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("training_requirement_dispositions")
      .select("id,requirement,disposition,reason,effective_at")
      .eq("profile_id", member.id)
      .order("effective_at", { ascending: false }),
  ]);

  const trainingRows = training.data ?? [];
  const trainingIds = trainingRows.map((item: any) => item.id);
  const { data: trainingEvents } = trainingIds.length
    ? await supabase
        .from("training_events")
        .select("id,training_progress_id,event_type,phase,status,progress_percent,notes,created_at,trainer:personnel_profiles!training_events_trainer_profile_id_fkey(display_name,rank)")
        .in("training_progress_id", trainingIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const currentCertifications = (certs.data ?? []).filter((item: any) => item.status === "Current");
  const ftoQualified = currentCertifications.some((item: any) => item.name === "Field Training Officer" && (!item.expires_on || item.expires_on >= new Date().toISOString().slice(0, 10)));
  const activeTrainingRows = trainingRows.filter((item: any) => ACTIVE_TRAINING_STATUSES.includes(item.status));
  const activeTraining = activeTrainingRows[0];
  const rosterAccess = rosterAccessRows?.[0];
  const canManageTraining = Boolean(rosterAccess?.can_manage_training);
  const historyRows = history.data ?? [];
  const requirementRows = requirements.data ?? [];
  const currentRequirement = (requirement: string) => requirementRows.find((item: any) => item.requirement === requirement);
  const academyRequirement = currentRequirement("Academy");
  const ftoRequirement = currentRequirement("FTO");

  const editableRecords = activeTrainingRows.map((item: any) => {
    const trainer = Array.isArray(item.trainer) ? item.trainer[0] : item.trainer;
    return {
      id: item.id,
      programType: item.program_type,
      phase: item.phase,
      status: item.status,
      progressPercent: item.progress_percent,
      evaluatorProfileId: item.evaluator_profile_id,
      trainerName: trainer?.display_name ?? null,
    };
  });

  return (
    <PortalShell
      active="personnel"
      eyebrow={`${member.personnel_id} · Training`}
      title={`${member.display_name} · Training`}
      actions={(
        <>
          <Link className="portal-button portal-button--secondary" href="/portal/command/training">Training & FTO</Link>
          <Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}`}>Back to Record</Link>
        </>
      )}
    >
      <PersonnelRecordHeader personnelId={member.personnel_id} displayName={member.display_name} rank={member.rank} callSign={member.call_sign} assignment={member.division} status={member.status} active="training" />

      <section className="portal-panel" style={{ marginBottom: 16 }}>
        <div className="portal-panel-heading">
          <div><p>Training status</p><h2>Current Readiness</h2></div>
          <span>{activeTraining ? activeTraining.status : "No active training"}</span>
        </div>
        <div className="command-v2-workspace-grid">
          <div className="portal-panel">
            <div className="portal-panel-heading"><div><p>FTO qualification</p><h2>{ftoQualified ? "Authorized" : "Not Authorized"}</h2></div></div>
          </div>
          <div className="portal-panel">
            <div className="portal-panel-heading"><div><p>Active trainer</p><h2>{activeTraining ? ((Array.isArray(activeTraining.trainer) ? activeTraining.trainer[0] : activeTraining.trainer)?.display_name ?? "Unassigned") : "None"}</h2></div></div>
          </div>
          <div className="portal-panel">
            <div className="portal-panel-heading"><div><p>Permanent history</p><h2>{historyRows.length} Record{historyRows.length === 1 ? "" : "s"}</h2></div></div>
          </div>
        </div>
      </section>

      <section className="portal-panel training-entry-requirements">
        <div className="portal-panel-heading"><div><p>Entry training</p><h2>Academy & FTO Requirements</h2></div></div>
        <div className="training-requirement-grid">
          {[{ label: "Academy", row: academyRequirement }, { label: "FTO", row: ftoRequirement }].map(({ label, row }) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{row?.disposition ?? "Not Recorded"}</strong>
              <small>{row?.reason ?? "No entry-training disposition is on file."}</small>
              {row?.effective_at ? <b>{dateLabel(row.effective_at)}</b> : null}
            </article>
          ))}
        </div>
      </section>

      <PersonnelTrainingControls
        memberId={member.id}
        memberName={member.display_name}
        currentProfileId={profile.id}
        canManageTraining={canManageTraining}
        activeRecords={editableRecords}
      />

      <div className="personnel-record-two-column">
        <section className="portal-panel personnel-record-wide">
          <div className="portal-panel-heading"><div><p>Permanent personnel record</p><h2>Training History</h2></div><span>{historyRows.length}</span></div>
          <div className="training-history-list">
            {historyRows.length ? historyRows.map((item: any) => (
              <article key={item.id}>
                <div className="training-history-list__mark">{item.category === "FTO" ? "FTO" : "TRN"}</div>
                <div>
                  <span>{item.record_type} · {item.category}</span>
                  <strong>{item.title}</strong>
                  <small>{item.provider}{item.completed_on ? ` · ${dateLabel(item.completed_on)}` : " · Completion date not recorded"}</small>
                  {item.notes ? <p>{item.notes}</p> : null}
                  {item.source_document_reference ? <small>Source: {item.source_document_reference}</small> : null}
                </div>
                <b>{item.verification_status}</b>
              </article>
            )) : <div className="portal-empty-state"><strong>No permanent training history is on file.</strong></div>}
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Program progression</p><h2>Training Records</h2></div><span>{trainingRows.length}</span></div>
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
            }) : <div className="portal-empty-state"><strong>No Academy, FTO, remedial, or continuing-education progression records.</strong></div>}
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Recorded activity</p><h2>Training Activity</h2></div><span>{trainingEvents?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(trainingEvents ?? []).length ? (trainingEvents ?? []).slice(0, 20).map((item:any) => {
              const trainer = Array.isArray(item.trainer) ? item.trainer[0] : item.trainer;
              return (
                <div key={item.id}>
                  <strong>{item.event_type}</strong>
                  <span>{item.phase ?? "No phase"} · {item.status ?? "No status"}{item.progress_percent !== null ? ` · ${item.progress_percent}%` : ""} · {dateLabel(item.created_at)}</span>
                  {trainer?.display_name ? <small>Trainer: {trainer.display_name}</small> : null}
                  {item.notes ? <small>{item.notes}</small> : null}
                </div>
              );
            }) : <div className="portal-empty-state"><strong>No training activity has been recorded yet.</strong></div>}
          </div>
        </section>

        <section className="portal-panel personnel-record-wide">
          <div className="portal-panel-heading"><div><p>Qualifications</p><h2>Certifications</h2></div><span>{certs.data?.length ?? 0}</span></div>
          <div className="personnel-certification-grid personnel-certification-grid--command">
            {(certs.data ?? []).length ? (certs.data ?? []).map((item:any) => <article key={item.id}><span>{item.status}</span><strong>{item.name}</strong><small>{item.certificate_number ?? "No certificate number"}</small><dl><div><dt>Issued</dt><dd>{dateLabel(item.issued_on) ?? "Pending"}</dd></div><div><dt>Expires</dt><dd>{item.expires_on ? dateLabel(item.expires_on) : "No expiration"}</dd></div></dl></article>) : <div className="portal-empty-state"><strong>No certification records.</strong></div>}
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
