import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { PublicPsaControl } from "../../_components/PublicPsaControl";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function PublicPsaPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");

  return (
    <PortalShell
      active="psa"
      eyebrow="Public website · Communications"
      title="Public PSA"
      description="Publish, edit, or remove the emergency-style Public Safety Notice banner shown on the LSCSO homepage."
    >
      <PublicPsaControl />
    </PortalShell>
  );
}
