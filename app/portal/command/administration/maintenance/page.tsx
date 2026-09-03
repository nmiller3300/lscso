import { redirect } from "next/navigation";
import { MaintenanceControlCenter } from "../../../_components/MaintenanceControlCenter";
import { PortalShell } from "../../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function MaintenanceAdministrationPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || profile.access_tier !== "Executive") redirect("/portal/command/administration");
  return <PortalShell active="administration" eyebrow="Executive Administration" title="Maintenance Center" description="Schedule maintenance, notify users, control LSCSO service availability, and review the maintenance audit history."><MaintenanceControlCenter /></PortalShell>;
}
