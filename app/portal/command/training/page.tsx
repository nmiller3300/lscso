import Link from "next/link";
import { TrainingAssignmentLauncher } from "./TrainingAssignmentLauncher";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const activeStatuses = ["Not Started", "In Progress", "Needs Improvement"];

export default async function TrainingWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) return null;
  const supabase = await createClient() as any;
  const { data: accessRows } = await supabase.rpc("get_my_roster_access");
  const canManageTraining = Boolean(accessRows?.[0]?.can_manage_training);
  const canTrainAssigned = Boolean(accessRows?.[0]?.can_train_assigned);

  let activeQuery = supabase.from("training_progress")
    .select("id,profile_id,program_type,phase,status,progress_percent,updated_at,evaluator_profile_id,trainee:personnel_profiles!training_progress_profile_id_fkey(personnel_id,display_name,rank,call_sign),trainer:personnel_profiles!training_progress_evaluator_profile_id_fkey(display_name)")
    .in("status",activeStatuses).neq("program_type","FTO").order("updated_at",{ascending:false});
  if (!canManageTraining) activeQuery = activeQuery.eq("evaluator_profile_id",profile.id);

  const [trainingResult,personnelResult,historyResult] = await Promise.all([
    canManageTraining || canTrainAssigned ? activeQuery : Promise.resolve({data:[]}),
    canManageTraining ? supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,call_sign,status").in("status",["Active","Acting"]).order("display_name") : Promise.resolve({data:[]}),
    canManageTraining || canTrainAssigned ? supabase.from("personnel_training_records").select("id,profile_id,record_type,category,title,provider,completed_on,verification_status,personnel:personnel_profiles!personnel_training_records_profile_id_fkey(personnel_id,display_name)").neq("category","FTO").order("created_at",{ascending:false}).limit(12) : Promise.resolve({data:[]}),
  ]);
  const active = trainingResult.data ?? [];
  const history = historyResult.data ?? [];
  const personnel = (personnelResult.data ?? []).map((member:any)=>({
    id:member.id,personnelId:member.personnel_id,displayName:member.display_name,
    rank:member.rank,callSign:member.call_sign
  }));
  const attention = active.filter((item:any)=>item.status==="Needs Improvement").length;
  const one = (value:any)=>Array.isArray(value)?value[0]:value;
  return (
    <PortalShell active="training" eyebrow="Personnel development" title="Department Training"
      description="Academy, remedial, and continuing education. Division assignments are managed separately."
      actions={canManageTraining ? <TrainingAssignmentLauncher personnel={personnel} /> : undefined}>
      <div className="portal-metric-grid portal-training-metrics">
        <article className="portal-metric portal-metric--gold"><span>Active training</span><strong>{active.length}</strong><small>Current department programs</small></article>
        <article className="portal-metric"><span>Needs attention</span><strong>{attention}</strong><small>Training requiring review</small></article>
        <article className="portal-metric"><span>Recent history</span><strong>{history.length}</strong><small>Permanent training records</small></article>
      </div>
      <section className="portal-panel portal-training-board">
        <div className="portal-panel-heading"><div><p>Current assignments</p><h2>Department training board</h2></div><span>{active.length}</span></div>
        <div className="command-v2-personnel-results portal-training-trainee-list">
          {active.length ? active.map((item:any)=>{
            const trainee=one(item.trainee);const trainer=one(item.trainer);
            return <Link key={item.id} href={`/portal/command/personnel/${trainee?.personnel_id ?? ""}/training`}>
              <div><strong>{trainee?.display_name ?? "Personnel"}</strong><span>{item.program_type} · {item.phase} · {item.status}</span></div>
              <div className="portal-training-progress-value"><strong>{item.progress_percent}%</strong><span>{trainer?.display_name ?? "Trainer unassigned"}</span></div>
            </Link>;
          }):<div className="portal-empty-state"><strong>No active department training.</strong></div>}
        </div>
      </section>
      <section className="portal-panel portal-training-history-board">
        <div className="portal-panel-heading"><div><p>Service record</p><h2>Recent training history</h2></div><span>{history.length}</span></div>
        <div className="command-v2-mini-list portal-training-list">
          {history.length ? history.map((item:any)=>{const member=one(item.personnel);return <Link key={item.id} href={`/portal/command/personnel/${member?.personnel_id ?? ""}/training`}>
            <div><strong>{item.title}</strong><span>{member?.display_name ?? "Personnel"} · {item.record_type}</span></div>
            <div><strong>{item.verification_status}</strong><span>{item.completed_on ?? item.provider ?? "On file"}</span></div>
          </Link>}):<div className="portal-empty-state"><strong>No training history recorded.</strong></div>}
        </div>
      </section>
    </PortalShell>
  );
}
