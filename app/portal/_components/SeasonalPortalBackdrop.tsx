"use client";

import { useSeasonalAppearance } from "@/app/_components/SeasonalExperience";
import { SeasonalLiquidCanvas } from "@/app/_components/SeasonalLiquidCanvas";
import { PortalCinematicBackdrop } from "./PortalCinematicBackdrop";
import { PortalResponsiveCinematicBackdrop } from "./PortalResponsiveCinematicBackdrop";

export function SeasonalPortalBackdrop() {
  const { active_theme, effects, intensity } = useSeasonalAppearance();
  return active_theme === "halloween" && effects.liquid ? <SeasonalLiquidCanvas intensity={intensity}/> :
    <><PortalCinematicBackdrop/><PortalResponsiveCinematicBackdrop/></>;
}
