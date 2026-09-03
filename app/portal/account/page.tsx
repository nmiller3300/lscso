import Link from "next/link";
import { redirect } from "next/navigation";
import { FiveMConnectionPanel } from "../_components/FiveMConnectionPanel";
import { PortalProfileProvider } from "../_components/PortalProfileProvider";
import { PortalShell } from "../_components/PortalShell";
import { getCurrentPortalProfile, getPortalHome } from "@/lib/supabase/portal-profile";

export default async function PortalAccountPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal");

  const homeHref = getPortalHome(profile);
  const audience = profile.access_tier === "Deputy" ? "deputy" : "command";

  return (
    <PortalProfileProvider profile={profile}>
      <PortalShell
        active="overview"
        audience={audience}
        eyebrow="Secure account"
        title="Account connections"
        description="Manage services connected to your LSCSO personnel account."
        actions={
          <Link className="portal-button portal-button--secondary" href={homeHref}>
            Back to portal
          </Link>
        }
      >
        <FiveMConnectionPanel />
      </PortalShell>
    </PortalProfileProvider>
  );
}
