import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { PortalProfileProvider } from "../_components/PortalProfileProvider";

export default async function MyOfficeLayout({ children }: Readonly<{ children: ReactNode }>) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal");

  return <PortalProfileProvider profile={profile}>{children}</PortalProfileProvider>;
}
