import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { RosterPersonnelControls } from "../../../_components/RosterPersonnelControls";
import { RosterRowInteraction } from "../../../_components/RosterRowInteraction";
import { RosterWorkspace } from "../../../_components/RosterWorkspace";
import type { PersonnelRecord } from "../../../_data/model";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const PERSONNEL_CHANGE_APPROVERS = new Set(["Sheriff", "Undersheriff", "Major"]);

export default async function FullRosterPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }
  const supabase = await createClient() as any;
  const [{ data: profiles }, { data: callSigns }, { data: certifications }, { data: guardians }, { data: unitAssignments }] = await Promise.all([
    supabase.from("personnel_profiles").select("*").order("personnel_id"),
    supabase.from("call_sign_assignments").select("profile_id,call_sign,assigned_at,released_at").order("assigned_at", { ascending: false }),
    supabase.from("certifications").select("profile_id,status,name"),
    supabase.from("guardian_records").select("subject_profile_id,status"),
    supabase
      .from("personnel_unit_assignments")
      .select("profile_id,assignment_type,starts_at,ends_at,organizational_units(name)")
      .is("ends_at", null)
      .order("starts_at", { ascending: false }),
  ]);

  const primaryAssignment = new Map<string, string>();
  for (const assignment of unitAssignments ?? []) {
    if (assignment.assignment_type !== "Primary" || primaryAssignment.has(assignment.profile_id)) continue;
    const unit = Array.isArray(assignment.organizational_units) ? assignment.organizational_units[0] : assignment.organizational_units;
    if (unit?.name) primaryAssignment.set(assignment.profile_id, unit.name);
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

  return (
    <PortalShell
      active="personnel"
      eyebrow="Personnel"
      title="Full roster"
      description="Department-wide roster and credential management. Organizational assignments are synchronized with Personnel Operations."
      actions={<a className="portal-button portal-button--secondary" href="https://lscsoroster.vercel.app" target="_blank" rel="noreferrer">Open live roster</a>}
    >
      {PERSONNEL_CHANGE_APPROVERS.has(profile.rank) ? <RosterPersonnelControls members={changeablePersonnel} /> : null}
      <RosterRowInteraction />
      <RosterWorkspace personnel={personnel} />
    </PortalShell>
  );
}
