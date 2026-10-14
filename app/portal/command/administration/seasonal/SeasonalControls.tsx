"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSeasonalAppearance, type SeasonActionState } from "./actions";
import { EFFECT_NAMES, SEASONS, SEASON_LABELS, type SeasonalSettings, type Season } from "@/lib/seasonal/config";
import "./seasonal-controls.css";

const initialState: SeasonActionState = { ok: false, message: "" };
const EFFECT_LABELS: Record<string, string> = {
  leaves: "Falling leaves",
  bats: "Flying bats",
  lightning: "Lightning in the distance",
  moon: "Moon and moving clouds",
  fog: "Rolling fog",
  pumpkins: "Glowing pumpkins",
  liquid: "Moving background",
};

export function SeasonalControls({ initial, isPreview = false }: { initial: SeasonalSettings; isPreview?: boolean }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Season>(initial.active_theme);
  const [intensity, setIntensity] = useState(initial.intensity);
  const [effects, setEffects] = useState(initial.effects);
  const [result, submit, pending] = useActionState(saveSeasonalAppearance, initialState);

  useEffect(() => {
    if (result.ok) {
      sessionStorage.removeItem("lscso-season-preview");
      window.dispatchEvent(new Event("lscso-season-preview"));
      router.refresh();
    }
  }, [result, router]);

  function preview(destination: string) {
    sessionStorage.setItem("lscso-season-preview", JSON.stringify({ active_theme: theme, intensity, effects, logos: initial.logos }));
    window.dispatchEvent(new Event("lscso-season-preview"));
    router.push(destination);
  }
  function clearPreview() {
    sessionStorage.removeItem("lscso-season-preview");
    window.dispatchEvent(new Event("lscso-season-preview"));
    router.refresh();
  }

  const patch = initial.logos[theme] || "/images/lscso-patch-color.png";
  return <div className="seasonal-admin">
    <section className="portal-panel seasonal-admin__lead">
      <div>
        <span>Website appearance</span>
        <h2>Set the season.</h2>
        <p>Change the colors, details, and decorations across the LSCSO website. The homepage layout stays exactly where it is.</p>
      </div>
      <div className={"seasonal-admin__swatch seasonal-admin__swatch--" + theme}>
        <img src={patch} alt="" width={112} height={112} />
        <strong>{SEASON_LABELS[theme]}</strong>
      </div>
    </section>
    {isPreview && <p role="status" className="seasonal-admin__preview-note">Try any combination below. Your choices only change what <strong>you</strong> see until a Sheriff publishes the finished design.</p>}
    <form action={submit} className="portal-panel seasonal-admin__form">
      <h3>Choose your website look</h3>
      <label className="seasonal-admin__field">Season
        <select name="active_theme" value={theme} onChange={(e) => setTheme(e.target.value as Season)}>
          {SEASONS.map((season) => <option value={season} key={season}>{SEASON_LABELS[season]}</option>)}
        </select>
      </label>
      <label className="seasonal-admin__field">Amount of movement
        <select name="intensity" value={intensity} onChange={(e) => setIntensity(e.target.value as SeasonalSettings["intensity"])}>
          <option value="low">A little</option><option value="medium">Normal</option><option value="high">A lot</option>
        </select>
      </label>
      <h3 className="seasonal-admin__subhead">Decorations</h3>
      <div className="seasonal-admin__effects">
        {EFFECT_NAMES.map((name) => <label key={name}>
          <input type="checkbox" name={"effect_" + name} checked={effects[name]} onChange={(e) => setEffects((old) => ({ ...old, [name]: e.target.checked }))} />
          <span>{EFFECT_LABELS[name]}</span>
        </label>)}
      </div>
      {result.message && <p className={result.ok ? "seasonal-admin__ok" : "seasonal-admin__error"} role="status">{result.message}</p>}
      <div className="seasonal-admin__actions">
        <button className="portal-button portal-button--secondary" type="button" onClick={() => preview("/portal")}>See portal login →</button>
        <button className="portal-button portal-button--secondary" type="button" onClick={() => preview("/")}>See homepage →</button>
        <button className="portal-button portal-button--secondary" type="button" onClick={() => preview("/join")}>See recruitment →</button>
        <button className="portal-button portal-button--secondary" type="button" onClick={() => preview("/join/application")}>See application →</button>
        <button className="portal-button portal-button--secondary" type="button" onClick={clearPreview}>Reset preview</button>
        {!isPreview && <button className="portal-button portal-button--primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Apply to website"}</button>}
      </div>
      <small>{isPreview ? "Nothing you do here changes the live LSCSO website." : "Preview changes only your own screen. Apply to website changes the design for everyone."}</small>
    </form>
    <section className="portal-panel seasonal-admin__form seasonal-admin__logo-preview">
      <h3>Department patches</h3>
      <div className="seasonal-admin__patch-row">
        <img src="/images/lscso-halloween.webp" alt="LSCSO Halloween patch" width={114} height={114} />
        <div><strong>Halloween patch — included</strong><p>Your official Halloween artwork is already installed. No upload needed. The standard patch returns automatically when the normal theme is selected.</p></div>
      </div>
    </section>
  </div>;
}
