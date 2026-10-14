import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SEASONAL_SETTINGS, normalizeSeasonalSettings } from "./config";

export const SEASONAL_CACHE_TAG = "lscso-seasonal-appearance";
export const getSeasonalSettings = unstable_cache(async () => {
  try {
    const admin = createAdminClient() as any;
    const { data, error } = await admin.from("site_seasonal_appearance")
      .select("active_theme,intensity,effects,logos").eq("id", "global").maybeSingle();
    if (error || !data) return DEFAULT_SEASONAL_SETTINGS;
    return normalizeSeasonalSettings(data);
  } catch {
    // A missing migration or temporarily unavailable DB must not take the public site down.
    return DEFAULT_SEASONAL_SETTINGS;
  }
}, ["lscso-seasonal-appearance-v1"], { revalidate: 300, tags: [SEASONAL_CACHE_TAG] });
