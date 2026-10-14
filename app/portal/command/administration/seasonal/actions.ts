"use server";

import { updateTag, revalidatePath } from "next/cache";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SEASONAL_SETTINGS, EFFECT_NAMES, SEASONS, normalizeSeasonalSettings, type Season } from "@/lib/seasonal/config";
import { SEASONAL_CACHE_TAG } from "@/lib/seasonal/server";

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

export async function uploadSeasonalLogo(_previous: SeasonActionState, form: FormData): Promise<SeasonActionState> {
  try {
    const actor = await sheriffOnly();
    const season = String(form.get("season") ?? "") as Season;
    if (!SEASONS.includes(season) || season === "standard") return state(false, "Choose Halloween, Thanksgiving or Christmas.");
    const file = form.get("logo");
    if (!(file instanceof File) || !file.size) return state(false, "Choose an image file to upload.");
    const allowed: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif" };
    if (!allowed[file.type] || file.size > 3 * 1024 * 1024) return state(false, "Use a PNG, JPG, WebP or AVIF under 3 MB.");
    const admin = createAdminClient() as any;
    const path = season + "/patch-" + Date.now() + "." + allowed[file.type];
    const { error: uploadError } = await admin.storage.from("lscso-seasonal-logos").upload(
      path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000", upsert: false }
    );
    if (uploadError) throw uploadError;
    const { data: existing, error: loadError } = await admin.from("site_seasonal_appearance")
      .select("logos").eq("id","global").single();
    if (loadError) throw loadError;
    const logos = normalizeSeasonalSettings({ ...DEFAULT_SEASONAL_SETTINGS, logos: existing?.logos }).logos;
    const url = admin.storage.from("lscso-seasonal-logos").getPublicUrl(path).data.publicUrl;
    const { error: updateError } = await admin.from("site_seasonal_appearance")
      .update({ logos: { ...logos, [season]: url }, updated_by: actor.id, updated_at: new Date().toISOString() })
      .eq("id","global");
    if (updateError) throw updateError;
    refreshSeason();
    return state(true, season.charAt(0).toUpperCase() + season.slice(1) + " logo uploaded and available sitewide.");
  } catch (error) {
    return state(false, error instanceof Error ? error.message : "Could not upload the seasonal logo.");
  }
}
