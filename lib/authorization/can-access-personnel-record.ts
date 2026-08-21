import "server-only";
import type { PortalProfile } from "@/lib/supabase/portal-profile";
import { loadPersonnelPurview } from "./load-personnel-purview";

export type PersonnelRecordAccess = {
  allowed: boolean;
  reason: "self" | "department" | "purview" | "unavailable" | "denied";
};

/**
 * Personnel-record visibility for V2.
 * Captain+ standing authority is department-wide.
 * 1st Lieutenant and below require an active structured purview path.
 * A member may always access their own record through the appropriate personal portal.
 * Legacy division/supervisor text is never used as authorization evidence.
 */
export async function canAccessPersonnelRecord(profile: PortalProfile, targetPersonnelId: string): Promise<PersonnelRecordAccess> {
  const normalizedTarget = targetPersonnelId.trim().toUpperCase();
  if (!normalizedTarget) return { allowed: false, reason: "denied" };

  if (profile.personnel_id.toUpperCase() === normalizedTarget) {
    return { allowed: true, reason: "self" };
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
