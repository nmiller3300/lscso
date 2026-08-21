import { redirect } from "next/navigation";
import { CertificationWorkspace } from "../../_components/CertificationWorkspace";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

export default async function CertificationCenterPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal");
  const supabase = await createClient() as any;
  const { data: canRequest } = await supabase.rpc("can_request_certifications");
  if (!canRequest) redirect("/portal/personnel");

  const [{ data: personnel }, { data: catalog }, { data: certifications }] = await Promise.all([
    supabase.rpc("certification_request_candidates"),
    supabase.from("certification_catalog").select("name").eq("active", true).order("name"),
    supabase.from("certifications").select("id,profile_id,name,status,issuer,issued_on,expires_on,notes").order("created_at", { ascending: false }),
  ]);

  return (
    <PortalShell
      active="certifications"
      eyebrow="Professional standards · Qualifications"
      title="Certification Center"
      description="FTOs and supervisors may recommend certifications. Command and Executive personnel issue the final credential."
    >
      <CertificationWorkspace personnel={personnel ?? []} catalog={(catalog ?? []).map((item: any) => item.name)} certifications={certifications ?? []} />
    </PortalShell>
  );
}
