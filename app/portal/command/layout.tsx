import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentPortalProfile, getPortalHome } from "@/lib/supabase/portal-profile";
import { PortalProfileProvider } from "../_components/PortalProfileProvider";

export default async function CommandPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal");
  if (!["Executive", "Command", "Supervisor", "Preliminary"].includes(profile.access_tier)) {
    redirect(getPortalHome(profile));
  }

  return <PortalProfileProvider profile={profile}>{children}</PortalProfileProvider>;
}
