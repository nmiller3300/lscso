import type { PortalProfile } from "@/lib/supabase/portal-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const HIRING_DELEGATION = "Hiring Administration" as const;

export type HiringAuthorityProfile = Pick<PortalProfile, "id" | "access_tier">;

export async function hasHiringAuthority(profile: HiringAuthorityProfile | null | undefined) {
  if (!profile) return false;
  if (["Executive", "Command"].includes(profile.access_tier)) return true;

  const supabase = await createClient() as any;
  const now = new Date();
  const { data, error } = await supabase
    .from("personnel_delegations")
    .select("id,expires_at")
    .eq("profile_id", profile.id)
    .eq("delegation_type", HIRING_DELEGATION)
    .is("revoked_at", null)
    .lte("starts_at", now.toISOString());

  if (error) return false;
  return (data ?? []).some((item: any) => !item.expires_at || new Date(item.expires_at) > now);
}

export async function getHiringAuthorityPersonnel() {
  const admin = createAdminClient() as any;
  const now = new Date();
  const nowIso = now.toISOString();
  const [peopleResult, delegationsResult] = await Promise.all([
    admin
      .from("personnel_profiles")
      .select("id,display_name,rank,access_tier,status")
      .in("status", ["Active", "Acting"])
      .order("display_name"),
    admin
      .from("personnel_delegations")
      .select("profile_id,expires_at")
      .eq("delegation_type", HIRING_DELEGATION)
      .is("revoked_at", null)
      .lte("starts_at", nowIso),
  ]);

  if (peopleResult.error) throw peopleResult.error;
  if (delegationsResult.error) throw delegationsResult.error;

  const delegated = new Set(
    (delegationsResult.data ?? [])
      .filter((item: any) => !item.expires_at || new Date(item.expires_at) > now)
      .map((item: any) => item.profile_id),
  );

  return (peopleResult.data ?? []).filter(
    (person: any) => ["Executive", "Command"].includes(person.access_tier) || delegated.has(person.id),
  );
}
