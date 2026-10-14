"use server";
import { updateTag, revalidatePath } from "next/cache";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVAILABLE_SEASONS, type Season } from "@/lib/seasonal/config";
import { SEASONAL_CACHE_TAG, isSeasonalDesignPreview } from "@/lib/seasonal/server";

export type SeasonActionState = { ok: boolean; message: string };
const state = (ok: boolean, message: string): SeasonActionState => ({ ok, message });

export async function saveSeasonalAppearance(_previous: SeasonActionState, form: FormData): Promise<SeasonActionState> {
  if (isSeasonalDesignPreview) return state(false, "This preview cannot change the live website.");
  const profile = await getCurrentPortalProfile();
  if (!profile || profile.rank !== "Sheriff") return state(false, "Only the Sheriff may change the website theme.");
  const theme = String(form.get("active_theme") ?? "");
  if (!AVAILABLE_SEASONS.includes(theme as typeof AVAILABLE_SEASONS[number])) {
    return state(false, "This seasonal theme has not been released yet.");
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("site_seasonal_appearance" as never)
      .update({ active_theme: theme as Season, updated_by: profile.id, updated_at: new Date().toISOString() } as never)
      .eq("id", "global").select("active_theme").single();
    if (error || !data) return state(false, "Could not change the theme. Please try again.");
    updateTag(SEASONAL_CACHE_TAG);
    revalidatePath("/", "layout");
    return state(true, theme === "standard"
      ? "LSCSO Original restored across the website."
      : "Halloween is now active across the website.");
  } catch {
    return state(false, "Could not change the theme. Please try again.");
  }
}
