export const SEASONS = ["standard", "halloween", "thanksgiving", "christmas", "new-years", "valentines", "st-patricks"] as const;
export type Season = typeof SEASONS[number];
export const AVAILABLE_SEASONS = ["standard", "halloween"] as const;
export const EFFECT_NAMES = ["leaves", "bats", "lightning", "moon", "fog", "pumpkins", "liquid"] as const;
export type EffectName = typeof EFFECT_NAMES[number];
export type SeasonalEffects = Record<EffectName, boolean>;
export type SeasonalSettings = {
  active_theme: Season;
  intensity: "low" | "medium" | "high";
  effects: SeasonalEffects;
  logos: Partial<Record<Season, string>>;
};
export const DEFAULT_SEASONAL_SETTINGS: SeasonalSettings = {
  active_theme: "standard",
  intensity: "high",
  effects: { leaves: true, bats: true, lightning: true, moon: true, fog: true, pumpkins: true, liquid: true },
  logos: { halloween: "/images/lscso-halloween.webp" },
};
export const SEASON_LABELS: Record<Season, string> = {
  standard: "LSCSO Original",
  halloween: "Halloween",
  thanksgiving: "Thanksgiving",
  christmas: "Christmas",
  "new-years": "New Year's",
  valentines: "Valentine's Day",
  "st-patricks": "St. Patrick's Day",
};
// Holiday effects are part of the designed theme. There are no public or Sheriff-facing
// switches for individual effects. Unbuilt seasons cannot be activated.
export function normalizeSeasonalSettings(input: unknown): SeasonalSettings {
  const row = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const active_theme = AVAILABLE_SEASONS.includes(row.active_theme as typeof AVAILABLE_SEASONS[number])
    ? row.active_theme as SeasonalSettings["active_theme"] : "standard";
  return { ...DEFAULT_SEASONAL_SETTINGS, active_theme };
}
