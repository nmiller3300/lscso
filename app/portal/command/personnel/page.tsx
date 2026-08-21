import { redirect } from "next/navigation";
import { PersonnelDirectory } from "../../_components/PersonnelDirectory";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function CommandPersonnelPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }

  const supabase = await createClient();
  const { data: personnel } = await supabase
    .from("personnel_profiles")
    .select("personnel_id,display_name,rank,call_sign,division,status")
    .neq("status", "Deactivated")
    .order("display_name");

  return (
    <PortalShell
      active="personnel"
      eyebrow="Personnel"
      title="Personnel"
      description="Find, review, and manage authorized personnel records."
    >
      <PersonnelDirectory personnel={(personnel ?? []).map((member) => ({
        personnelId: member.personnel_id,
        displayName: member.display_name,
        rank: member.rank,
        callSign: member.call_sign,
        division: member.division,
        status: member.status,
      }))} />
    </PortalShell>
  );
}
