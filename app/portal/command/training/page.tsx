import Link from "next/link";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const ACTIVE_TRAINING_STATUSES = ["Not Started", "In Progress", "Needs Improvement"];

function relationOne(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TrainingWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) return null;

  const supabase = await createClient() as any;
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const ninetyDays = new Date(today);
  ninetyDays.setDate(today.getDate() + 90);
  const ninetyDayKey = ninetyDays.toISOString().slice(0, 10);

  const { data: accessRows } = await supabase.rpc("get_my_roster_access");
  const rosterAccess = accessRows?.[0];
  const canManageTraining = Boolean(rosterAccess?.can_manage_training);
  const canTrainAssigned = Boolean(rosterAccess?.can_train_assigned);

  let activeTrainingQuery = supabase
    .from("training_progress")
    .select("id,profile_id,program_type,phase,status,progress_percent,started_on,updated_at,evaluator_profile_id,trainee:personnel_profiles!training_progress_profile_id_fkey(personnel_id,display_name,rank,call_sign),trainer:personnel_profiles!training_progress_evaluator_profile_id_fkey(personnel_id,display_name,rank,call_sign)")
    .in("status", ACTIVE_TRAINING_STATUSES)
    .order("updated_at", { ascending: false });

  if (!canManageTraining) activeTrainingQuery = activeTrainingQuery.eq("evaluator_profile_id", profile.id);

  const [trainingResult, ftoResult, expiringResult, pendingResult] = await Promise.all([
    canManageTraining || canTrainAssigned ? activeTrainingQuery : Promise.resolve({ data: [] }),
    supabase
      .from("certifications")
      .select("id,profile_id,expires_on,personnel_profiles!certifications_profile_id_fkey(id,personnel_id,display_name,rank,call_sign,status)")
      .eq("name", "Field Training Officer")
      .eq("status", "Current")
      .order("issued_on", { ascending: true }),
    supabase
      .from("certifications")
      .select("id,name,expires_on,profile_id,personnel_profiles!certifications_profile_id_fkey(personnel_id,display_name,rank,call_sign)")
      .eq("status", "Current")
      .not("expires_on", "is", null)
      .gte("expires_on", todayKey)
      .lte("expires_on", ninetyDayKey)
      .order("expires_on", { ascending: true }),
    supabase
      .from("certifications")
      .select("id,name,status,created_at,profile_id,personnel_profiles!certifications_profile_id_fkey(personnel_id,display_name,rank,call_sign)")
      .in("status", ["Requested", "Pending"])
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const trainingRows = trainingResult.data ?? [];
  const currentFtoRows = (ftoResult.data ?? []).filter((row: any) => !row.expires_on || row.expires_on >= todayKey);
  const expiringRows = expiringResult.data ?? [];
  const pendingRows = pendingResult.data ?? [];

  const trainers = currentFtoRows
    .map((row: any) => {
      const member = relationOne(row.personnel_profiles);
      if (!member || !["Active", "Acting"].includes(member.status)) return null;
      return {
        id: row.profile_id,
        personnelId: member.personnel_id,
        displayName: member.display_name,
        rank: member.rank,
        callSign: member.call_sign,
        activeTrainees: trainingRows.filter((training: any) => training.evaluator_profile_id === row.profile_id).length,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.displayName.localeCompare(b.displayName));

  const needsAttention = trainingRows.filter((row: any) => row.status === "Needs Improvement").length;
  const unassignedTraining = trainingRows.filter((row: any) => !row.evaluator_profile_id).length;

  return (
    <PortalShell
      active="training"
      eyebrow="Training"
      title="Training"
      description={canManageTraining ? "Department training, FTO assignment, progression, and qualification oversight." : "Your authorized FTO and training workspace."}
    >
      <div className="portal-metric-grid portal-training-metrics">
        <article className="portal-metric portal-metric--gold"><span>{canManageTraining ? "Active trainees" : "My active trainees"}</span><strong>{trainingRows.length}</strong><small>Current training records</small></article>
        <article className="portal-metric"><span>FTO authorized</span><strong>{trainers.length}</strong><small>Current Field Training Officer certifications</small></article>
        <article className={`portal-metric ${needsAttention ? "portal-metric--warning" : ""}`}><span>Needs attention</span><strong>{needsAttention}</strong><small>Training records requiring review</small></article>
        <article className="portal-metric"><span>{canManageTraining ? "Unassigned trainees" : "Certification queue"}</span><strong>{canManageTraining ? unassignedTraining : pendingRows.length}</strong><small>{canManageTraining ? "No trainer assigned" : "Pending certification requests"}</small></article>
      </div>

      <section className="portal-panel portal-training-board">
        <div className="portal-panel-heading">
          <div><p>Training progression</p><h2>{canManageTraining ? "Active training board" : "My assigned trainees"}</h2></div>
          <span>{trainingRows.length}</span>
        </div>
        <p className="command-v2-compact-copy">Current trainee assignments, trainers, phases, status, and progress from the shared personnel record.</p>

        <div className="command-v2-personnel-results portal-training-trainee-list">
          {trainingRows.length ? trainingRows.map((row: any) => {
            const trainee = relationOne(row.trainee);
            const trainer = relationOne(row.trainer);
            return (
              <Link key={row.id} href={`/portal/command/personnel/${trainee?.personnel_id ?? ""}/training`}>
                <div>
                  <strong>{trainee?.call_sign ?? trainee?.personnel_id ?? "Trainee"} · {trainee?.display_name ?? "Assigned trainee"}</strong>
                  <span>{row.program_type} · {row.phase} · {row.status}</span>
                </div>
                <div className="portal-training-progress-value">
                  <strong>{row.progress_percent}%</strong>
                  <span>{trainer?.display_name ? `Trainer: ${trainer.display_name}` : "Trainer unassigned"}</span>
                </div>
              </Link>
            );
          }) : <div className="portal-empty-state"><strong>No active training records.</strong><span>{canManageTraining ? "New trainee assignments will appear here when training begins." : "Personnel assigned to you for training will appear here."}</span></div>}
        </div>
      </section>

      <div className="portal-training-grid">
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>FTO program</p><h2>Authorized FTOs</h2></div><span>{trainers.length}</span></div>
          <p className="command-v2-compact-copy">FTO permissions exist only while the member holds a current Field Training Officer certification.</p>
          <div className="command-v2-mini-list portal-training-list">
            {trainers.length ? trainers.map((trainer: any) => (
              <Link key={trainer.id} href={`/portal/command/personnel/${trainer.personnelId}/training`}>
                <div>
                  <strong>{trainer.callSign ?? trainer.personnelId} · {trainer.displayName}</strong>
                  <span>{trainer.rank} · FTO Authorized</span>
                </div>
                <div><strong>{trainer.activeTrainees}</strong><span>Active trainee{trainer.activeTrainees === 1 ? "" : "s"}</span></div>
              </Link>
            )) : <div className="portal-empty-state"><strong>No current FTO certifications found.</strong></div>}
          </div>
        </section>

        <section className="portal-panel portal-training-certification-launcher">
          <div className="portal-panel-heading"><div><p>Qualifications</p><h2>Certification Center</h2></div><span>{pendingRows.length} pending</span></div>
          <p className="command-v2-compact-copy">Issue, review, revoke, and monitor department certifications. Field Training Officer status controls FTO permissions automatically.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--primary" href="/portal/command/certifications">Open Certification Center</Link>
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Readiness</p><h2>Expiring within 90 days</h2></div><span>{expiringRows.length}</span></div>
          <div className="command-v2-mini-list portal-training-list">
            {expiringRows.length ? expiringRows.slice(0, 8).map((row: any) => {
              const member = relationOne(row.personnel_profiles);
              return (
                <Link key={row.id} href={`/portal/command/personnel/${member?.personnel_id ?? ""}/training`}>
                  <div><strong>{row.name}</strong><span>{member?.display_name ?? "Personnel"}</span></div>
                  <div><strong>{new Date(`${row.expires_on}T12:00:00`).toLocaleDateString()}</strong><span>Expires</span></div>
                </Link>
              );
            }) : <div className="portal-empty-state"><strong>No certifications expire within 90 days.</strong></div>}
          </div>
        </section>
      </div>

      {pendingRows.length ? (
        <section className="portal-panel portal-training-pending">
          <div className="portal-panel-heading"><div><p>Certification review</p><h2>Pending requests</h2></div><span>{pendingRows.length}</span></div>
          <div className="command-v2-mini-list portal-training-list">
            {pendingRows.map((row: any) => {
              const member = relationOne(row.personnel_profiles);
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
