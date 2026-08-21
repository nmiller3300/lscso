import { redirect } from "next/navigation";
import { CertificationWorkspace } from "../../_components/CertificationWorkspace";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

export default async function CertificationCenterPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command", "Supervisor", "Preliminary"].includes(profile.access_tier)) redirect("/portal/personnel");
  const supabase = await createClient();
  const [{ data: personnel }, { data: catalog }, { data: certifications }] = await Promise.all([
    supabase.from("personnel_profiles").select("id,display_name,rank,call_sign").in("status", ["Active", "Acting"]).order("display_name"),
    supabase.from("certification_catalog").select("name").eq("active", true).order("name"),
    supabase.from("certifications").select("id,profile_id,name,status,issuer,issued_on,expires_on,notes").order("created_at", { ascending: false }),
  ]);
  return (
    <PortalShell
      active="certifications"
      eyebrow="Professional standards · Qualifications"
      title="Certification Center"
      description="Supervisors may recommend certifications. Command and Executive personnel issue the final credential."
    >
      <CertificationWorkspace personnel={personnel ?? []} catalog={(catalog ?? []).map((item) => item.name)} certifications={certifications ?? []} />
    </PortalShell>
  );
}
