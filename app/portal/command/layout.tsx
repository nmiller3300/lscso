import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { hasHiringAuthority } from "@/lib/authorization/hiring-authority";
import { getCurrentPortalProfile, getPortalHome } from "@/lib/supabase/portal-profile";
import { PortalProfileProvider } from "../_components/PortalProfileProvider";

export default async function CommandPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal");

  const hiringAuthority = await hasHiringAuthority(profile);
  const standardCommandWorkspace = ["Executive", "Command", "Supervisor", "Preliminary", "Attorney"].includes(profile.access_tier);
  if (!standardCommandWorkspace && !hiringAuthority) {
    redirect(getPortalHome(profile));
  }

  return <PortalProfileProvider profile={{ ...profile, hiring_authority: hiringAuthority }}>{children}</PortalProfileProvider>;
}
