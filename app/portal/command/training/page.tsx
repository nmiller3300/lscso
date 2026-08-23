import Link from "next/link";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function TrainingWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) return null;

  const supabase = await createClient() as any;
  const today = new Date();
  const ninetyDays = new Date(today);
  ninetyDays.setDate(today.getDate() + 90);

  const { data: accessRows } = await supabase.rpc("get_my_roster_access");
  const rosterAccess = accessRows?.[0];
  const canManageTraining = Boolean(rosterAccess?.can_manage_training);
  const canTrainAssigned = Boolean(rosterAccess?.can_train_assigned);

  let traineeQuery = supabase
    .from("training_progress")
    .select("id,profile_id,program_type,phase,status,progress_percent,started_on,updated_at,evaluator_profile_id,personnel_profiles!training_progress_profile_id_fkey(personnel_id,display_name,rank,call_sign),trainer:personnel_profiles!training_progress_evaluator_profile_id_fkey(personnel_id,display_name,rank,call_sign)")
    .in("status", ["Not Started", "In Progress", "Needs Improvement"])
    .order("updated_at", { ascending: false });

  if (!canManageTraining) traineeQuery = traineeQuery.eq("evaluator_profile_id", profile.id);

  const [trainees, expiring, pending, fieldTrainingOfficers] = await Promise.all([
    canManageTraining || canTrainAssigned ? traineeQuery : Promise.resolve({ data: [] }),
    supabase
      .from("certifications")
      .select("id,name,expires_on,profile_id,personnel_profiles!certifications_profile_id_fkey(personnel_id,display_name,rank,call_sign)")
      .eq("status", "Current")
      .not("expires_on", "is", null)
      .gte("expires_on", today.toISOString().slice(0, 10))
      .lte("expires_on", ninetyDays.toISOString().slice(0, 10))
      .order("expires_on", { ascending: true }),
    supabase
      .from("certifications")
      .select("id,name,status,created_at,profile_id,personnel_profiles!certifications_profile_id_fkey(personnel_id,display_name,rank,call_sign)")
      .in("status", ["Requested", "Pending"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("certifications")
      .select("id,profile_id,personnel_profiles!certifications_profile_id_fkey(personnel_id,display_name,rank,call_sign)")
      .eq("name", "Field Training Officer")
      .eq("status", "Current")
      .order("issued_on", { ascending: true }),
  ]);

  const traineeRows = trainees.data ?? [];
  const expiringRows = expiring.data ?? [];
  const pendingRows = pending.data ?? [];
  const ftoRows = fieldTrainingOfficers.data ?? [];

  return (
    <PortalShell
      active="training"
      eyebrow="Training"
      title="Training"
      description={canManageTraining ? "Department-wide FTO, training, and qualification oversight." : "Your authorized training and qualification workspace."}
      actions={canManageTraining ? <a className="portal-button portal-button--secondary" href="https://lscsoroster.vercel.app/manage" target="_blank" rel="noreferrer">Manage Personnel Operations</a> : undefined}
    >
      <div className="command-v2-workspace-grid">
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Qualifications</p><h2>Certifications</h2></div><span>{pendingRows.length} pending</span></div>
          <p className="command-v2-compact-copy">Issue, review, remove, and monitor LSCSO certifications.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--primary" href="/portal/command/certifications">Certification Center</Link>
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>FTO</p><h2>{canManageTraining ? "Department training board" : "My trainees"}</h2></div><span>{traineeRows.length}</span></div>
          <div className="command-v2-mini-list">
            {traineeRows.length ? traineeRows.map((row:any) => {
              const member = Array.isArray(row.personnel_profiles) ? row.personnel_profiles[0] : row.personnel_profiles;
              const trainer = Array.isArray(row.trainer) ? row.trainer[0] : row.trainer;
              return (
                <Link key={row.id} href={`/portal/command/personnel/${member?.personnel_id ?? ""}/training`}>
                  <div><strong>{member?.display_name ?? "Assigned trainee"}</strong><span>{row.program_type} · {row.phase} · {row.status}</span></div>
                  <div><strong>{row.progress_percent}%</strong><span>{trainer?.display_name ? `Trainer: ${trainer.display_name}` : member?.call_sign ?? member?.personnel_id ?? ""}</span></div>
                </Link>
              );
            }) : <p className="command-v2-compact-copy">No active training assignments.</p>}
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>FTO staffing</p><h2>Qualified FTOs</h2></div><span>{ftoRows.length}</span></div>
          <div className="command-v2-mini-list">
            {ftoRows.length ? ftoRows.slice(0, 8).map((row:any) => {
              const member = Array.isArray(row.personnel_profiles) ? row.personnel_profiles[0] : row.personnel_profiles;
              return <div key={row.id}><strong>{member?.display_name ?? "Personnel"}</strong><span>{member?.rank ?? ""} · {member?.call_sign ?? member?.personnel_id ?? ""}</span></div>;
            }) : <p className="command-v2-compact-copy">No FTO qualifications are currently recorded.</p>}
          </div>
          {canManageTraining ? <p className="command-v2-compact-copy" style={{ marginTop: 12 }}>Sheriff, Undersheriff, Major, and Captain may also serve as trainers through leadership authority.</p> : null}
        </section>

        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Readiness</p><h2>Expiring within 90 days</h2></div><span>{expiringRows.length}</span></div>
          <div className="command-v2-mini-list">
            {expiringRows.length ? expiringRows.slice(0, 8).map((row:any) => {
              const member = Array.isArray(row.personnel_profiles) ? row.personnel_profiles[0] : row.personnel_profiles;
              return (
                <Link key={row.id} href={`/portal/command/personnel/${member?.personnel_id ?? ""}/training`}>
                  <div><strong>{row.name}</strong><span>{member?.display_name ?? "Personnel"}</span></div>
                  <div><strong>{new Date(`${row.expires_on}T12:00:00`).toLocaleDateString()}</strong><span>Expires</span></div>
                </Link>
              );
            }) : <p className="command-v2-compact-copy">No certifications expire within 90 days.</p>}
          </div>
        </section>
      </div>

      {pendingRows.length ? (
        <section className="portal-panel" style={{ marginTop: 16 }}>
          <div className="portal-panel-heading"><div><p>Queue</p><h2>Certification requests</h2></div><span>{pendingRows.length}</span></div>
          <div className="command-v2-mini-list">
            {pendingRows.map((row:any) => {
              const member = Array.isArray(row.personnel_profiles) ? row.personnel_profiles[0] : row.personnel_profiles;
              return (
                <Link key={row.id} href="/portal/command/certifications">
                  <div><strong>{row.name}</strong><span>{member?.display_name ?? "Personnel"} · {row.status}</span></div>
                  <div><span>{new Date(row.created_at).toLocaleDateString()}</span></div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </PortalShell>
  );
}
