export const SEASONS = ["standard", "halloween", "thanksgiving", "christmas"] as const;
export type Season = typeof SEASONS[number];
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
  intensity: "medium",
  effects: { leaves: true, bats: true, lightning: true, moon: true, fog: true, pumpkins: true, liquid: true },
  logos: { halloween: "/images/lscso-halloween.webp" },
};
export const SEASON_LABELS: Record<Season, string> = {
  standard: "Standard LSCSO", halloween: "Halloween", thanksgiving: "Thanksgiving", christmas: "Christmas",
};
export function normalizeSeasonalSettings(input: unknown): SeasonalSettings {
  const row = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const rawEffects = row.effects && typeof row.effects === "object" ? row.effects as Record<string, unknown> : {};
  const rawLogos = row.logos && typeof row.logos === "object" ? row.logos as Record<string, unknown> : {};
  const active_theme = SEASONS.includes(row.active_theme as Season) ? row.active_theme as Season : "standard";
  const intensity = ["low","medium","high"].includes(String(row.intensity)) ? row.intensity as SeasonalSettings["intensity"] : "medium";
  const effects = Object.fromEntries(EFFECT_NAMES.map((name) => [name, typeof rawEffects[name] === "boolean" ? rawEffects[name] : true])) as SeasonalEffects;
  const logos: Partial<Record<Season, string>> = { ...DEFAULT_SEASONAL_SETTINGS.logos };
  for (const season of SEASONS) {
    if (typeof rawLogos[season] === "string" && (/^https:\/\//.test(rawLogos[season]) || /^\/images\/[-a-z0-9.]+$/.test(rawLogos[season]))) logos[season] = rawLogos[season] as string;
  }
  return { active_theme, intensity, effects, logos };
}
