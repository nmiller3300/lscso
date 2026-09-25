import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const RECRUITMENT_STATUS_ID = "applications";

export type RecruitmentStatus = {
  isOpen: boolean;
  swornApplicationsOpen: boolean;
  departmentAttorneyApplicationsOpen: boolean;
  forensicsSpecialistApplicationsOpen: boolean;
  updatedAt: string | null;
};

function buildStatus(data: any, forensicsFallback = false): RecruitmentStatus {
  const swornApplicationsOpen = data?.applications_open === true;
  const departmentAttorneyApplicationsOpen = data?.department_attorney_applications_open === true;
  const forensicsSpecialistApplicationsOpen = typeof data?.forensics_specialist_applications_open === "boolean"
    ? data.forensics_specialist_applications_open
    : forensicsFallback;

  return {
    isOpen: swornApplicationsOpen || departmentAttorneyApplicationsOpen || forensicsSpecialistApplicationsOpen,
    swornApplicationsOpen,
    departmentAttorneyApplicationsOpen,
    forensicsSpecialistApplicationsOpen,
    updatedAt: data?.updated_at ?? null,
  };
}

export async function getRecruitmentStatus(): Promise<RecruitmentStatus> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;

  const primary = await supabase
    .from("recruitment_settings")
    .select("applications_open,department_attorney_applications_open,forensics_specialist_applications_open,updated_at")
    .eq("id", RECRUITMENT_STATUS_ID)
    .maybeSingle();

  if (!primary.error && primary.data) return buildStatus(primary.data);

  // Compatibility fallback: adding a new recruitment field must never make
  // existing Sworn or Department Attorney intake appear globally closed.
  const legacy = await supabase
    .from("recruitment_settings")
    .select("applications_open,department_attorney_applications_open,updated_at")
    .eq("id", RECRUITMENT_STATUS_ID)
    .maybeSingle();

  if (!legacy.error && legacy.data) return buildStatus(legacy.data, false);

  return {
    isOpen: false,
    swornApplicationsOpen: false,
    departmentAttorneyApplicationsOpen: false,
    forensicsSpecialistApplicationsOpen: false,
    updatedAt: null,
  };
}
