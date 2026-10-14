import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { getSeasonalSettings, isSeasonalDesignPreview } from "@/lib/seasonal/server";
import { SeasonalControls } from "./SeasonalControls";

export default async function SeasonalAppearancePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || profile.rank !== "Sheriff") redirect("/portal/command/administration");
  const settings = await getSeasonalSettings();
  return (
    <PortalShell active="administration" eyebrow="Sheriff Administration" title="Seasonal Appearance"
      description="Manage the public website and personnel portal's seasonal identity. Changes are department-wide.">
      <SeasonalControls initial={settings} isPreview={isSeasonalDesignPreview} />
    </PortalShell>
  );
}
