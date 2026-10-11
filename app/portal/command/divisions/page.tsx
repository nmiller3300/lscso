import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";
import { DivisionAssignmentWorkspace } from "./DivisionAssignmentWorkspace";

const DIVISION_MANAGERS = new Set([
  "1st Lieutenant", "Captain", "Major", "Assistant Sheriff", "Undersheriff", "Sheriff",
]);

export default async function DivisionManagementPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal");
  if (!DIVISION_MANAGERS.has(profile.rank) || !["Command", "Executive"].includes(profile.access_tier)) {
    redirect("/portal/my-office");
  }

  const supabase = await createClient() as any;
  const { data: snapshot, error } = await supabase.rpc("get_roster_management_snapshot");

  if (error || !snapshot) {
    return (
      <PortalShell active="certifications" eyebrow="Personnel operations" title="Divisions & Assignments">
        <div className="portal-empty-state"><strong>Division assignments are temporarily unavailable.</strong>
          <span>{error?.message ?? "Could not load department assignments."}</span>
        </div>
      </PortalShell>
    );
  }

  const personnel = (snapshot.personnel ?? []).map((member: any) => ({
    id: member.profile_id,
    personnelId: member.personnel_id,
    displayName: member.display_name,
    rank: member.rank,
    callSign: member.call_sign,
    primaryAssignment: member.primary_assignment,
  }));
  const units = (snapshot.units ?? [])
    .filter((unit: any) => unit.unit_type === "Division" && unit.manageable)
    .map((unit: any) => ({ id: unit.id, name: unit.name, unitType: unit.unit_type }));
  const unitById = new Map((snapshot.units ?? []).map((unit: any) => [unit.id, unit]));
  const assignments = (snapshot.assignments ?? []).map((item: any) => {
    const unit: any = unitById.get(item.unit_id);
    return {
      id: item.id,
      profileId: item.profile_id,
      unitId: item.unit_id,
      unitName: item.unit_name,
      unitType: unit?.unit_type ?? "Organizational Unit",
      assignmentType: item.assignment_type,
      startsAt: item.starts_at,
      notes: item.notes,
    };
  });

  return (
    <PortalShell active="certifications" eyebrow="Personnel operations"
      title="Divisions & Assignments"
      description="Manage operational division memberships separately from rank, permissions, and training.">
      <DivisionAssignmentWorkspace personnel={personnel} units={units} assignments={assignments} />
    </PortalShell>
  );
}
