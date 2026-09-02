import "server-only";
import { createClient } from "./server";
import type { PortalProfile } from "./portal-types";
export type { PortalProfile } from "./portal-types";

export async function getCurrentPortalProfile(): Promise<PortalProfile | null> {
  const supabase = await createClient() as any;
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) return null;

  const { data, error } = await supabase
    .from("personnel_profiles")
    .select(
      "id,auth_user_id,personnel_id,username,display_name,greeting_name,rank,access_tier,call_sign,division,supervisor_label,status,is_test_account,credentials_assigned,probation_started_at,probation_ends_at",
    )
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (error || !data || !["Active", "Acting"].includes(data.status)) return null;
  return data as PortalProfile;
}

export function getPortalHome(profile: PortalProfile) {
  if (profile.access_tier === "Deputy") return "/portal/personnel";
  if (["Supervisor", "Preliminary"].includes(profile.access_tier)) return "/portal/command/guardians";
  return "/portal/command";
}
