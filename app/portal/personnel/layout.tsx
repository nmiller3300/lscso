import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentPortalProfile, getPortalHome } from "@/lib/supabase/portal-profile";
import { PortalProfileProvider } from "../_components/PortalProfileProvider";

export default async function PersonnelPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal");
  if (profile.access_tier !== "Deputy") redirect(getPortalHome(profile));

  return <PortalProfileProvider profile={profile}>{children}</PortalProfileProvider>;
}
