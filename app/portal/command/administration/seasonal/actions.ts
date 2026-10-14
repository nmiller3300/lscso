"use server";

import { updateTag, revalidatePath } from "next/cache";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { EFFECT_NAMES, SEASONS, type Season } from "@/lib/seasonal/config";
import { SEASONAL_CACHE_TAG, isSeasonalDesignPreview } from "@/lib/seasonal/server";

export type SeasonActionState = { ok: boolean; message: string };
const state = (ok: boolean, message: string): SeasonActionState => ({ ok, message });

async function sheriffOnly() {
  const profile = await getCurrentPortalProfile();
  if (!profile || profile.rank !== "Sheriff") throw new Error("Only the active Sheriff may manage seasonal appearance.");
  return profile;
}

function refreshSeason() {
  updateTag(SEASONAL_CACHE_TAG);
  revalidatePath("/", "layout");
}

export async function saveSeasonalAppearance(_previous: SeasonActionState, form: FormData): Promise<SeasonActionState> {
  try {
    // Check deployment before even reading identity; previews never attempt database writes.
    if (isSeasonalDesignPreview) return state(false, "This is a design preview. No department settings were changed.");
    const actor = await sheriffOnly();
    const theme = String(form.get("active_theme") ?? "");
    const intensity = String(form.get("intensity") ?? "");
    if (!SEASONS.includes(theme as Season)) return state(false, "Choose a valid seasonal theme.");
    if (!["low", "medium", "high"].includes(intensity)) return state(false, "Choose a valid effect intensity.");
    const effects = Object.fromEntries(EFFECT_NAMES.map((name) => [name, form.get("effect_" + name) === "on"]));
    const admin = createAdminClient() as any;
    const { error } = await admin.from("site_seasonal_appearance").update({
      active_theme: theme, intensity, effects, updated_by: actor.id, updated_at: new Date().toISOString(),
    }).eq("id", "global");
    if (error) throw error;
    refreshSeason();
    return state(true, "Seasonal appearance published to the entire LSCSO website.");
  } catch (error) {
    return state(false, error instanceof Error ? error.message : "Unable to save seasonal appearance.");
  }
}

