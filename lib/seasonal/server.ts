import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SEASONAL_SETTINGS, normalizeSeasonalSettings } from "./config";

export const SEASONAL_CACHE_TAG = "lscso-seasonal-appearance";
export const isSeasonalDesignPreview = process.env.VERCEL_ENV !== "production";

export const getSeasonalSettings = unstable_cache(async () => {
  if (isSeasonalDesignPreview) {
    // Design branch is a harmless, read-only Halloween showcase.
    return { ...DEFAULT_SEASONAL_SETTINGS, active_theme: "halloween" as const };
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("site_seasonal_appearance" as never)
      .select("active_theme").eq("id", "global").maybeSingle();
    if (error || !data) return DEFAULT_SEASONAL_SETTINGS;
    return normalizeSeasonalSettings(data);
  } catch {
    // Never interrupt the public site if this optional setting is unavailable.
    return DEFAULT_SEASONAL_SETTINGS;
  }
}, ["lscso-seasonal-appearance-v3"], { revalidate: 60, tags: [SEASONAL_CACHE_TAG] });
