import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { RosterRowInteraction } from "../../../_components/RosterRowInteraction";
import { RosterWorkspace } from "../../../_components/RosterWorkspace";
import type { PersonnelRecord } from "../../../_data/model";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function FullRosterPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }
  const supabase = await createClient();
  const [{ data: profiles }, { data: assignments }, { data: certifications }, { data: guardians }] = await Promise.all([
    supabase.from("personnel_profiles").select("*").order("personnel_id"),
    supabase.from("call_sign_assignments").select("profile_id,call_sign,assigned_at,released_at").order("assigned_at", { ascending: false }),
    supabase.from("certifications").select("profile_id,status"),
    supabase.from("guardian_records").select("subject_profile_id,status"),
  ]);

  const personnel: PersonnelRecord[] = (profiles ?? []).map((member) => ({
    profileId: member.id,
    id: member.personnel_id,
    displayName: member.display_name,
    username: member.username,
    callSign: member.call_sign ?? "",
    callSignHistory: (assignments ?? [])
      .filter((assignment) => assignment.profile_id === member.id && assignment.released_at)
      .map((assignment) => assignment.call_sign),
    rank: member.rank,
    access: member.access_tier as PersonnelRecord["access"],
    division: member.division,
    supervisor: member.supervisor_label,
    status: member.status as PersonnelRecord["status"],
    certifications: (certifications ?? []).filter((item) => item.profile_id === member.id && item.status === "Current").length,
    guardianOpen: (guardians ?? []).filter((item) => item.subject_profile_id === member.id && !["Acknowledged", "Closed"].includes(item.status)).length,
    lastSession: member.last_sign_in_at ? new Date(member.last_sign_in_at).toLocaleString("en-US") : "Never",
    isTestAccount: member.is_test_account,
    credentialsAssigned: member.credentials_assigned ?? false,
  }));

  return (
    <PortalShell
      active="personnel"
      eyebrow="Personnel"
      title="Full roster"
      description="Department-wide roster and credential management."
    >
      <RosterRowInteraction />
      <RosterWorkspace personnel={personnel} />
    </PortalShell>
  );
}
