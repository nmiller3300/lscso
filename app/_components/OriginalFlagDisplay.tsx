"use client";

import { useSeasonalAppearance, SeasonalLogo } from "./SeasonalExperience";

// An editorial flag treatment for the original LSCSO identity. The existing
// Halloween artwork is not affected. The composition follows the submitted
// black-and-gold LSCSO flag rather than stretching the old badge raster.
const flagStars = Array.from({ length: 48 }, (_, i) => i);
export function OriginalFlagDisplay({ className = "" }: { className?: string }) {
  const appearance = useSeasonalAppearance();
  if (appearance.active_theme !== "standard") return null;
  return (
    <div className={`original-agency-flag ${className}`} role="img" aria-label="Los Santos County Sheriff's Office black and gold flag motif">
      <div className="original-agency-flag__stripes" aria-hidden="true" />
      <div className="original-agency-flag__canton" aria-hidden="true">
        {flagStars.map(i => <span key={i} className="original-agency-flag__star">★</span>)}
      </div>
      <div className="original-agency-flag__insignia">
        <SeasonalLogo alt="" width={112} height={138} />
        <div className="original-agency-flag__department">
          <strong>LOS SANTOS COUNTY</strong>
          <span>SHERIFF'S OFFICE</span>
          <small>ESTABLISHED 1963</small>
        </div>
      </div>
    </div>
  );
}
