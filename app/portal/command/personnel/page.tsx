import { redirect } from "next/navigation";
import { PersonnelDirectory } from "../../_components/PersonnelDirectory";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { getPersonnelProbationState } from "@/lib/personnel/probation";

export default async function CommandPersonnelPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }

  const supabase = await createClient() as any;
  const [{ data: personnel }, { data: assignments }] = await Promise.all([
    supabase
      .from("personnel_profiles")
      .select("id,personnel_id,display_name,rank,call_sign,division,status,probation_ends_at")
      .neq("status", "Deactivated")
      .order("display_name"),
    supabase
      .from("personnel_unit_assignments")
      .select("profile_id,assignment_type,starts_at,organizational_units(name)")
      .eq("assignment_type", "Primary")
      .is("ends_at", null)
      .order("starts_at", { ascending: false }),
  ]);

  const primaryAssignment = new Map<string, string>();
  for (const assignment of assignments ?? []) {
    if (primaryAssignment.has(assignment.profile_id)) continue;
    const unit = Array.isArray(assignment.organizational_units) ? assignment.organizational_units[0] : assignment.organizational_units;
    if (unit?.name) primaryAssignment.set(assignment.profile_id, unit.name);
  }

  const now = Date.now();

  return (
    <PortalShell
      active="personnel"
      eyebrow="Personnel"
      title="Personnel"
      description="Find, review, and manage authorized personnel records."
    >
      <PersonnelDirectory personnel={(personnel ?? []).map((member:any) => {
        const probation = getPersonnelProbationState(member.probation_ends_at, now);
        return {
          personnelId: member.personnel_id,
          displayName: member.display_name,
          rank: member.rank,
          callSign: member.call_sign,
          division: primaryAssignment.get(member.id) ?? member.division ?? "Unassigned",
          status: member.status,
          probationary: probation.active,
          probationEndsAt: probation.endsAt,
          probationDaysRemaining: probation.daysRemaining,
        };
      })} />
    </PortalShell>
  );
}
