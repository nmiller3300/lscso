"use client";

import Link from "next/link";
import { useSeasonalAppearance } from "./SeasonalExperience";

/** The original agency identity rail is intentionally not part of Halloween. */
export function OriginalAgencyRail() {
  const appearance = useSeasonalAppearance();
  if (appearance.active_theme !== "standard") return null;

  return (
    <section className="brand-agency-rail" aria-label="LSCSO public services">
      <div className="brand-agency-rail__inner">
        <div className="brand-agency-rail__identity">
          <strong>Los Santos County</strong>
          <span>Integrity · Service · Accountability</span>
        </div>
        <Link className="brand-agency-rail__link" href="/office-of-the-sheriff">
          <small>Department</small>
          Office of the Sheriff ↗
        </Link>
        <Link className="brand-agency-rail__link" href="/open-records">
          <small>Public access</small>
          Records & Requests ↗
        </Link>
        <Link className="brand-agency-rail__link" href="/join">
          <small>Careers</small>
          Become a Deputy ↗
        </Link>
      </div>
    </section>
  );
}
