import { redirect } from "next/navigation";
import { CertificationWorkspace } from "../../_components/CertificationWorkspace";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

export default async function CertificationCenterPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal");
  const supabase = await createClient() as any;
  const [{ data: canRequest }, { data: canManage }] = await Promise.all([
    supabase.rpc("can_request_certifications"),
    supabase.rpc("can_manage_roster_certifications"),
  ]);
  if (!canRequest && !canManage) redirect("/portal/personnel");

  const [{ data: personnel }, { data: catalog }, { data: certifications }] = await Promise.all([
    supabase.rpc("certification_request_candidates"),
    supabase.from("certification_catalog").select("name").eq("active", true).order("name"),
    supabase.from("certifications").select("id,profile_id,name,status,issuer,certificate_number,issued_on,expires_on,notes").order("created_at", { ascending: false }),
  ]);

  return (
    <PortalShell
      active="certifications"
      eyebrow="Professional standards · Qualifications"
      title="Certification Center"
      description="Authorized trainers and supervisors may recommend qualifications. Personnel with certification administration authority may issue or correct final credentials."
    >
      <CertificationWorkspace
        personnel={personnel ?? []}
        catalog={(catalog ?? []).map((item: any) => item.name)}
        certifications={certifications ?? []}
        canManageCertifications={Boolean(canManage)}
      />
    </PortalShell>
  );
}
