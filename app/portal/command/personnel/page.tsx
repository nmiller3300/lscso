import { PortalShell } from "../../_components/PortalShell";
import { RosterWorkspace } from "../../_components/RosterWorkspace";
import type { PersonnelRecord } from "../../_data/model";
import { createClient } from "@/lib/supabase/server";

export default async function CommandPersonnelPage() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: assignments }, { data: certifications }, { data: guardians }] = await Promise.all([
    supabase.from("personnel_profiles").select("*").order("personnel_id"),
    supabase.from("call_sign_assignments").select("profile_id,call_sign,assigned_at,released_at").order("assigned_at", { ascending: false }),
    supabase.from("certifications").select("profile_id,status"),
    supabase.from("guardian_records").select("subject_profile_id,status"),
  ]);

  const personnel: PersonnelRecord[] = (profiles ?? []).map((profile) => ({
    profileId: profile.id,
    id: profile.personnel_id,
    displayName: profile.display_name,
    username: profile.username,
    callSign: profile.call_sign ?? "",
    callSignHistory: (assignments ?? [])
      .filter((assignment) => assignment.profile_id === profile.id && assignment.released_at)
      .map((assignment) => assignment.call_sign),
    rank: profile.rank,
    access: profile.access_tier as PersonnelRecord["access"],
    division: profile.division,
    supervisor: profile.supervisor_label,
    status: profile.status as PersonnelRecord["status"],
    certifications: (certifications ?? []).filter((item) => item.profile_id === profile.id && item.status === "Current").length,
    guardianOpen: (guardians ?? []).filter((item) => item.subject_profile_id === profile.id && !["Acknowledged", "Closed"].includes(item.status)).length,
    lastSession: profile.last_sign_in_at ? new Date(profile.last_sign_in_at).toLocaleString("en-US") : "Never",
    isTestAccount: profile.is_test_account,
    credentialsAssigned: profile.credentials_assigned ?? false,
  }));

  return (
    <PortalShell
      active="personnel"
      eyebrow="Department directory"
      title="Personnel & credentials"
      description="Search the roster, assign department credentials, and manage access within the approved rank structure."
    >
      <RosterWorkspace personnel={personnel} />
    </PortalShell>
  );
}
