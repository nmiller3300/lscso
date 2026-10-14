"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSeasonalAppearance, type SeasonActionState } from "./actions";
import { SEASONS, SEASON_LABELS, AVAILABLE_SEASONS, type SeasonalSettings, type Season } from "@/lib/seasonal/config";
import "./seasonal-controls.css";

const emptyState: SeasonActionState = { ok: false, message: "" };
export function SeasonalControls({ initial, isPreview = false }: { initial: SeasonalSettings; isPreview?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Season>(initial.active_theme);
  const [result, submit, pending] = useActionState(saveSeasonalAppearance, emptyState);
  useEffect(() => {
    if (!result.ok) return;
    sessionStorage.removeItem("lscso-season-preview");
    window.dispatchEvent(new Event("lscso-season-preview"));
    router.refresh();
  }, [result, router]);

  const selectedLogo = selected === "halloween" ? "/images/lscso-halloween.webp" : "/images/lscso-patch-color.png";
  const currentLogo = initial.active_theme === "halloween" ? "/images/lscso-halloween.webp" : "/images/lscso-patch-color.png";
  return <div className="seasonal-admin seasonal-simple">
    <section className="portal-panel seasonal-admin__lead">
      <div><span>Website appearance</span><h2>Seasonal Themes</h2>
        <p>Set the look of the entire LSCSO website, including the public pages, applications and personnel portal.</p>
      </div>
      <div className={"seasonal-admin__swatch seasonal-admin__swatch--" + initial.active_theme}>
        <img src={currentLogo} alt="" width={112} height={112}/>
        <strong>{SEASON_LABELS[initial.active_theme]}</strong>
        <small>Currently active</small>
      </div>
    </section>
    <form action={submit} className="portal-panel seasonal-admin__form">
      <h3>Choose a theme</h3>
      <label className="seasonal-admin__field">Website theme
        <select name="active_theme" value={selected} onChange={(e) => setSelected(e.target.value as Season)}>
          {SEASONS.map((season) => <option key={season} value={season} disabled={!AVAILABLE_SEASONS.includes(season as typeof AVAILABLE_SEASONS[number])}>
            {SEASON_LABELS[season]}{AVAILABLE_SEASONS.includes(season as typeof AVAILABLE_SEASONS[number]) ? "" : " — Coming soon"}
          </option>)}
        </select>
      </label>
      <div className="seasonal-simple__selection">
        <img src={selectedLogo} width={84} height={84} alt="Selected LSCSO patch"/>
        <div><strong>{SEASON_LABELS[selected]}</strong><p>{selected === "halloween"
          ? "Halloween colors, animations and artwork are applied together."
          : "Return to the original LSCSO website design."}</p></div>
      </div>
      {result.message && <p role="status" className={result.ok ? "seasonal-admin__ok" : "seasonal-admin__error"}>{result.message}</p>}
      {isPreview
        ? <p className="seasonal-admin__preview-note">This is a design preview. Theme changes are disabled here.</p>
        : <button type="submit" className="portal-button portal-button--primary" disabled={pending || selected === initial.active_theme}>{pending ? "Applying theme…" : selected === "standard" ? "Restore LSCSO Original" : "Activate Halloween"}</button>}
      <small>Only the Sheriff can change the website theme. The original design can be restored here at any time.</small>
    </form>
    <section className="portal-panel seasonal-simple__future">
      <h3>Upcoming seasonal themes</h3>
      <p>These seasons will be added later. They cannot be activated yet.</p>
      <div className="seasonal-simple__future-grid">
        {SEASONS.filter((season) => !AVAILABLE_SEASONS.includes(season as typeof AVAILABLE_SEASONS[number])).map((season) =>
          <div key={season}><strong>{SEASON_LABELS[season]}</strong><span>Coming soon</span></div>)}
      </div>
    </section>
  </div>;
}
