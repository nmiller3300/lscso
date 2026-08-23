import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { RosterPersonnelControls } from "../../../_components/RosterPersonnelControls";
import { RosterRowInteraction } from "../../../_components/RosterRowInteraction";
import { RosterWorkspace } from "../../../_components/RosterWorkspace";
import type { PersonnelRecord } from "../../../_data/model";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const PERSONNEL_CHANGE_APPROVERS = new Set(["Sheriff", "Undersheriff", "Major"]);
const ACTIVE_TRAINING_STATUSES = new Set(["Not Started", "In Progress", "Needs Improvement"]);

export default async function FullRosterPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }

  const supabase = await createClient() as any;
  const [
    { data: profiles },
    { data: callSigns },
    { data: certifications },
    { data: guardians },
    { data: unitAssignments },
    { data: training },
    { data: delegations },
    { data: leave },
    { data: careerEvents },
  ] = await Promise.all([
    supabase.from("personnel_profiles").select("*").order("personnel_id"),
    supabase.from("call_sign_assignments").select("profile_id,call_sign,assigned_at,released_at").order("assigned_at", { ascending: false }),
    supabase.from("certifications").select("profile_id,status,name,expires_on"),
    supabase.from("guardian_records").select("subject_profile_id,status"),
    supabase
      .from("personnel_unit_assignments")
      .select("profile_id,assignment_type,starts_at,ends_at,organizational_units(name)")
      .is("ends_at", null)
      .order("starts_at", { ascending: false }),
    supabase
      .from("training_progress")
      .select("profile_id,program_type,phase,status,progress_percent,evaluator_profile_id,updated_at,trainer:personnel_profiles!training_progress_evaluator_profile_id_fkey(display_name)")
      .order("updated_at", { ascending: false }),
    supabase
      .from("personnel_delegations")
      .select("profile_id,delegation_type,expires_at,revoked_at")
      .is("revoked_at", null),
    supabase
      .from("leave_requests")
      .select("profile_id,leave_type,status,starts_on,expected_return_on")
      .eq("status", "Approved")
      .order("starts_on", { ascending: false }),
    supabase
      .from("personnel_career_events")
      .select("profile_id,event_type,title,effective_at")
      .order("effective_at", { ascending: false }),
  ]);

  const primaryAssignment = new Map<string, string>();
  const assignmentCount = new Map<string, number>();
  for (const assignment of unitAssignments ?? []) {
    assignmentCount.set(assignment.profile_id, (assignmentCount.get(assignment.profile_id) ?? 0) + 1);
    if (assignment.assignment_type !== "Primary" || primaryAssignment.has(assignment.profile_id)) continue;
    const unit = Array.isArray(assignment.organizational_units) ? assignment.organizational_units[0] : assignment.organizational_units;
    if (unit?.name) primaryAssignment.set(assignment.profile_id, unit.name);
  }

  const activeTraining = new Map<string, any>();
  for (const row of training ?? []) {
    if (!ACTIVE_TRAINING_STATUSES.has(row.status) || activeTraining.has(row.profile_id)) continue;
    activeTraining.set(row.profile_id, row);
  }

  const activeDelegations = new Map<string, number>();
  const now = Date.now();
  for (const row of delegations ?? []) {
    if (row.expires_at && new Date(row.expires_at).getTime() <= now) continue;
    activeDelegations.set(row.profile_id, (activeDelegations.get(row.profile_id) ?? 0) + 1);
  }

  const currentLeave = new Map<string, any>();
  const today = new Date().toISOString().slice(0, 10);
  for (const row of leave ?? []) {
    if (currentLeave.has(row.profile_id)) continue;
    if (row.starts_on <= today && row.expected_return_on >= today) currentLeave.set(row.profile_id, row);
  }

  const latestCareer = new Map<string, any>();
  for (const row of careerEvents ?? []) {
    if (!latestCareer.has(row.profile_id)) latestCareer.set(row.profile_id, row);
  }

  const personnel: PersonnelRecord[] = (profiles ?? []).map((member:any) => ({
    profileId: member.id,
    id: member.personnel_id,
    displayName: member.display_name,
    username: member.username,
    callSign: member.call_sign ?? "",
    callSignHistory: (callSigns ?? [])
      .filter((assignment:any) => assignment.profile_id === member.id && assignment.released_at)
      .map((assignment:any) => assignment.call_sign),
    rank: member.rank,
    access: member.access_tier as PersonnelRecord["access"],
    division: primaryAssignment.get(member.id) ?? member.division ?? "Unassigned",
    supervisor: member.supervisor_label,
    status: member.status as PersonnelRecord["status"],
    certifications: (certifications ?? []).filter((item:any) => item.profile_id === member.id && item.status === "Current").length,
    guardianOpen: (guardians ?? []).filter((item:any) => item.subject_profile_id === member.id && !["Acknowledged", "Closed"].includes(item.status)).length,
    lastSession: member.last_sign_in_at ? new Date(member.last_sign_in_at).toLocaleString("en-US") : "Never",
    isTestAccount: member.is_test_account,
    credentialsAssigned: member.credentials_assigned ?? false,
  }));

  const changeablePersonnel = (profiles ?? [])
    .filter((member:any) => member.id !== profile.id)
    .map((member:any) => ({
      profileId: member.id,
      personnelId: member.personnel_id,
      displayName: member.display_name,
      rank: member.rank,
      status: member.status,
    }));

  const operationalPersonnel = (profiles ?? []).filter((member:any) => member.status !== "Deactivated" && !member.is_test_account);

  return (
    <PortalShell
      active="personnel"
      eyebrow="Personnel"
      title="Full roster"
      description="Department-wide roster, personnel facts, and credential management. Shared organizational and training information is synchronized with Personnel Operations."
      actions={<a className="portal-button portal-button--secondary" href="https://lscsoroster.vercel.app" target="_blank" rel="noreferrer">Open live roster</a>}
    >
      <section className="portal-panel" style={{ marginBottom: 16 }}>
        <div className="portal-panel-heading">
          <div><p>Shared personnel core</p><h2>Department personnel overview</h2></div>
          <span>{operationalPersonnel.length} active records</span>
        </div>
        <p className="command-v2-compact-copy">This view is informational. Personnel Operations remains the central roster editor while existing Command Portal account and credential controls stay here.</p>
        <div className="command-v2-mini-list" style={{ marginTop: 14 }}>
          {operationalPersonnel.map((member:any) => {
            const memberCerts = (certifications ?? []).filter((item:any) => item.profile_id === member.id && item.status === "Current");
            const ftoQualified = memberCerts.some((item:any) => item.name === "Field Training Officer" && (!item.expires_on || item.expires_on >= today));
            const trainingRow = activeTraining.get(member.id);
            const trainer = trainingRow ? (Array.isArray(trainingRow.trainer) ? trainingRow.trainer[0] : trainingRow.trainer) : null;
            const leaveRow = currentLeave.get(member.id);
            const career = latestCareer.get(member.id);
            const displayStatus = member.status === "Suspended" ? "Suspended" : leaveRow ? "LOA" : member.status;
            return (
              <Link href={`/portal/command/personnel/${member.personnel_id}`} key={member.id}>
                <div>
                  <strong>{member.call_sign || member.personnel_id} · {member.rank} {member.display_name}</strong>
                  <span>{primaryAssignment.get(member.id) ?? member.division ?? "Unassigned"} · {displayStatus} · {memberCerts.length} certifications · {assignmentCount.get(member.id) ?? 0} assignments</span>
                </div>
                <div>
                  <strong>{trainingRow ? `${trainingRow.phase} · ${trainingRow.progress_percent}%` : ftoQualified ? "FTO Qualified" : "No active training"}</strong>
                  <span>{trainingRow && trainer?.display_name ? `Trainer: ${trainer.display_name}` : `${activeDelegations.get(member.id) ?? 0} delegated roles`}{career ? ` · Latest: ${career.event_type}` : ""}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {PERSONNEL_CHANGE_APPROVERS.has(profile.rank) ? <RosterPersonnelControls members={changeablePersonnel} /> : null}
      <RosterRowInteraction />
      <RosterWorkspace personnel={personnel} />
    </PortalShell>
  );
}
