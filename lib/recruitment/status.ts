import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const RECRUITMENT_STATUS_ID = "applications";

export type RecruitmentStatus = {
  isOpen: boolean;
  updatedAt: string | null;
};

export async function getRecruitmentStatus(): Promise<RecruitmentStatus> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;

  const { data, error } = await supabase
    .from("recruitment_settings")
    .select("applications_open,updated_at")
    .eq("id", RECRUITMENT_STATUS_ID)
    .maybeSingle();

  if (error || !data) return { isOpen: false, updatedAt: null };

  return {
    isOpen: data.applications_open === true,
    updatedAt: data.updated_at ?? null,
  };
}
