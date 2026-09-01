import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { ServiceRecordWorkspace } from "../../_components/ServiceRecordWorkspace";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

export default async function ServiceRecordsPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/personnel");
  const supabase = await createClient() as any;
  const [{ data: personnel }, { data: flags }, { data: awards }] = await Promise.all([
    supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,call_sign").in("status", ["Active", "Acting"]).order("display_name"),
    supabase.from("personnel_flags").select("id,profile_id,flag_type,notes,created_at").eq("active", true).order("created_at", { ascending: false }),
    supabase.from("personnel_awards").select("id,profile_id,award_name,citation,awarded_on").order("awarded_on", { ascending: false }).limit(50),
  ]);

  return (
    <PortalShell
      active="awards"
      eyebrow="Personnel administration · Service records"
      title="Service Records"
      description="Choose a member, select the action you need, and complete one clearly defined service-record task at a time."
    >
      <ServiceRecordWorkspace personnel={personnel ?? []} flags={flags ?? []} awards={awards ?? []} />
    </PortalShell>
  );
}
