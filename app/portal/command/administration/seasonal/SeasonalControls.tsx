"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSeasonalAppearance, uploadSeasonalLogo, type SeasonActionState } from "./actions";
import { EFFECT_NAMES, SEASONS, SEASON_LABELS, type SeasonalSettings, type Season } from "@/lib/seasonal/config";
import "./seasonal-controls.css";

const initialState: SeasonActionState = { ok: false, message: "" };
const EFFECT_LABELS: Record<string, string> = {
  leaves: "Drifting autumn leaves", bats: "Bat flyovers", lightning: "Distant lightning",
  moon: "Moonlight & moving clouds", fog: "Rolling mist", pumpkins: "Glowing pumpkins",
  liquid: "Fluid background lighting",
};

export function SeasonalControls({ initial }: { initial: SeasonalSettings }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Season>(initial.active_theme);
  const [intensity, setIntensity] = useState(initial.intensity);
  const [effects, setEffects] = useState(initial.effects);
  const [result, submit, pending] = useActionState(saveSeasonalAppearance, initialState);
  const [logoResult, submitLogo, uploading] = useActionState(uploadSeasonalLogo, initialState);
  useEffect(() => {
    if (result.ok) {
      sessionStorage.removeItem("lscso-season-preview");
      window.dispatchEvent(new Event("lscso-season-preview"));
      router.refresh();
    }
  }, [result, router]);

  function preview() {
    sessionStorage.setItem("lscso-season-preview", JSON.stringify({ active_theme: theme, intensity, effects, logos: initial.logos }));
    window.dispatchEvent(new Event("lscso-season-preview"));
    router.push("/portal");
  }
  function clearPreview() {
    sessionStorage.removeItem("lscso-season-preview");
    window.dispatchEvent(new Event("lscso-season-preview"));
    router.refresh();
  }

  return <div className="seasonal-admin">
    <section className="portal-panel seasonal-admin__lead">
      <div><span>Department visual identity</span><h2>Set the season.</h2><p>The selected design updates public pages, recruitment, the login experience and personnel workspaces. The existing homepage hero remains unchanged.</p></div>
      <div className={"seasonal-admin__swatch seasonal-admin__swatch--" + theme} aria-hidden="true"><span>LSCSO</span><strong>{SEASON_LABELS[theme]}</strong></div>
    </section>
    <form action={submit} className="portal-panel seasonal-admin__form">
      <h3>Theme and atmosphere</h3>
      <label className="seasonal-admin__field">Website theme
        <select name="active_theme" value={theme} onChange={(e) => setTheme(e.target.value as Season)}>
          {SEASONS.map((season) => <option value={season} key={season}>{SEASON_LABELS[season]}</option>)}
        </select>
      </label>
      <label className="seasonal-admin__field">Atmospheric effect intensity
        <select name="intensity" value={intensity} onChange={(e) => setIntensity(e.target.value as SeasonalSettings["intensity"])}>
          <option value="low">Subtle</option><option value="medium">Cinematic</option><option value="high">Full atmosphere</option>
        </select>
      </label>
      <div className="seasonal-admin__effects">
        {EFFECT_NAMES.map((name) => <label key={name}>
          <input type="checkbox" name={"effect_" + name} checked={effects[name]} onChange={(e) => setEffects((value) => ({ ...value, [name]: e.target.checked }))} />
          <span>{EFFECT_LABELS[name]}</span>
        </label>)}
      </div>
      {result.message && <p className={result.ok ? "seasonal-admin__ok" : "seasonal-admin__error"} role="status">{result.message}</p>}
      <div className="seasonal-admin__actions">
        <button className="portal-button portal-button--secondary" type="button" onClick={preview}>Preview on portal →</button>
        <button className="portal-button portal-button--secondary" type="button" onClick={clearPreview}>Exit my preview</button>
        <button className="portal-button portal-button--primary" type="submit" disabled={pending}>{pending ? "Publishing…" : "Publish website theme"}</button>
      </div>
      <small>Preview is visible only in this browser session. Publish changes the theme for everyone.</small>
    </form>
    <form action={submitLogo} className="portal-panel seasonal-admin__form">
      <h3>Official seasonal patches</h3>
      <p>Upload the actual LSCSO holiday artwork. It replaces the standard patch in seasonal branding locations without altering the permanent logo.</p>
      <label className="seasonal-admin__field">Holiday<select name="season" defaultValue="halloween"><option value="halloween">Halloween</option><option value="thanksgiving">Thanksgiving</option><option value="christmas">Christmas</option></select></label>
      <label className="seasonal-admin__field">Seasonal patch (PNG/JPG/WebP/AVIF, up to 3 MB)<input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/avif" required /></label>
      {logoResult.message && <p className={logoResult.ok ? "seasonal-admin__ok" : "seasonal-admin__error"} role="status">{logoResult.message}</p>}
      <button className="portal-button portal-button--primary" disabled={uploading}>{uploading ? "Uploading…" : "Upload seasonal patch"}</button>
    </form>
  </div>;
}
