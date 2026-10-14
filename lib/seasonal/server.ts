import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SEASONAL_SETTINGS, normalizeSeasonalSettings } from "./config";

export const SEASONAL_CACHE_TAG = "lscso-seasonal-appearance";
// Fail closed: anything that isn't explicitly Vercel production is read-only.
// Preview cannot depend on the Git branch variable (which may be unavailable at runtime).
export const isSeasonalDesignPreview = process.env.VERCEL_ENV !== "production";
export const getSeasonalSettings = unstable_cache(async () => {
  // The feature-branch preview always showcases Halloween without requiring
  // a production database migration or writing to the live site's settings.
  if (isSeasonalDesignPreview) {
    return { ...DEFAULT_SEASONAL_SETTINGS, active_theme: "halloween" as const, intensity: "high" as const };
  }
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
}, ["lscso-seasonal-appearance-v2"], { revalidate: 300, tags: [SEASONAL_CACHE_TAG] });
