import { redirect } from "next/navigation";
import { FirstLoginOnboarding } from "../_components/FirstLoginOnboarding";
import { getCurrentPortalProfile, getPortalHome } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

export default async function PortalOnboardingPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/portal");

  return (
    <FirstLoginOnboarding
      displayName={profile.display_name}
      homeHref={getPortalHome(profile)}
      passwordRequired={userData.user.user_metadata?.must_change_password === true}
    />
  );
}
