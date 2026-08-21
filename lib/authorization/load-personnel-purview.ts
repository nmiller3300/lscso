import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PortalProfile } from "@/lib/supabase/portal-profile";
import { hasStandingDepartmentAuthority } from "./lscso-authority";

export type PersonnelPurviewRow = {
  profileId: string;
  personnelId: string;
  displayName: string;
  rank: string;
  callSign: string | null;
  status: string;
  unitId: string | null;
  unitName: string | null;
  assignmentType: string | null;
  scope: string;
  authorityType: string;
};

export type PersonnelPurviewResult = {
  rows: PersonnelPurviewRow[];
  structuredAuthorityAvailable: boolean;
  standingDepartmentAuthority: boolean;
};

/**
 * Safe bridge while V2 is still preview-only.
 * If the V2 RPC does not exist yet, scoped personnel receive no inferred access.
 * Captain+ standing authority is reported separately and never inferred from the
 * legacy supervisor_label string.
 */
export async function loadPersonnelPurview(profile: PortalProfile): Promise<PersonnelPurviewResult> {
  const standingDepartmentAuthority = hasStandingDepartmentAuthority(profile.rank as any);
  const supabase = await createClient() as any;

  try {
    const { data, error } = await supabase.rpc("get_personnel_in_my_purview");
    if (error) {
      return { rows: [], structuredAuthorityAvailable: false, standingDepartmentAuthority };
    }

    return {
      structuredAuthorityAvailable: true,
      standingDepartmentAuthority,
      rows: (data ?? []).map((row:any) => ({
        profileId: row.profile_id,
        personnelId: row.personnel_id,
        displayName: row.display_name,
        rank: row.rank,
        callSign: row.call_sign,
        status: row.status,
        unitId: row.organizational_unit_id,
        unitName: row.organizational_unit_name,
        assignmentType: row.assignment_type,
        scope: row.scope,
        authorityType: row.authority_type,
      })),
    };
  } catch {
    return { rows: [], structuredAuthorityAvailable: false, standingDepartmentAuthority };
  }
}
