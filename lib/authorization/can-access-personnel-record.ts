import "server-only";
import type { PortalProfile } from "@/lib/supabase/portal-profile";
import { loadPersonnelPurview } from "./load-personnel-purview";

export type PersonnelRecordAccess = {
  allowed: boolean;
  reason: "department" | "purview" | "unavailable" | "denied";
};

/**
 * Command-facing personnel-record visibility for V2.
 * Captain+ standing authority is department-wide.
 * Department Attorney has department-wide read access for legal counsel duties,
 * but this does not grant operational Command authority or write privileges.
 * 1st Lieutenant and below require an active structured purview path.
 * Self-service access belongs in My Info and is intentionally not granted here.
 */
export async function canAccessPersonnelRecord(profile: PortalProfile, targetPersonnelId: string): Promise<PersonnelRecordAccess> {
  const normalizedTarget = targetPersonnelId.trim().toUpperCase();
  if (!normalizedTarget) return { allowed: false, reason: "denied" };

  if (profile.access_tier === "Attorney" && profile.rank === "Department Attorney") {
    return { allowed: true, reason: "department" };
  }

  const purview = await loadPersonnelPurview(profile);
  if (purview.standingDepartmentAuthority) {
    return { allowed: true, reason: "department" };
  }

  if (!purview.structuredAuthorityAvailable) {
    return { allowed: false, reason: "unavailable" };
  }

  const inPurview = purview.rows.some((row) => row.personnelId.toUpperCase() === normalizedTarget);
  return inPurview ? { allowed: true, reason: "purview" } : { allowed: false, reason: "denied" };
}
