"use client";

import { createContext, useContext, useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_SEASONAL_SETTINGS, normalizeSeasonalSettings, type SeasonalSettings } from "@/lib/seasonal/config";

const SeasonalContext = createContext<SeasonalSettings>(DEFAULT_SEASONAL_SETTINGS);
const PREVIEW_KEY = "lscso-season-preview";

export function useSeasonalAppearance() { return useContext(SeasonalContext); }

function readPreview(fallback: SeasonalSettings) {
  try {
    const raw = sessionStorage.getItem(PREVIEW_KEY);
    return raw ? normalizeSeasonalSettings(JSON.parse(raw)) : fallback;
  } catch { return fallback; }
}

function Pumpkin({ side, index }: { side: "left" | "right"; index: number }) {
  const shape = "pumpkin-shade-" + index, glow = "pumpkin-glow-" + index;
  return <div className={"seasonal-pumpkin seasonal-pumpkin--" + side}>
    <svg viewBox="0 0 220 192" role="presentation" focusable="false">
      <defs>
        <radialGradient id={shape} cx="40%" cy="28%" r="72%">
          <stop offset="0" stopColor="#ffb348"/><stop offset=".38" stopColor="#ef6b14"/>
          <stop offset=".78" stopColor="#b03a0d"/><stop offset="1" stopColor="#541a12"/>
        </radialGradient>
        <radialGradient id={glow}><stop offset="0" stopColor="#ffdd85"/><stop offset=".6" stopColor="#ff8a1c"/><stop offset="1" stopColor="#ff8a1c" stopOpacity=".1"/></radialGradient>
      </defs>
      <ellipse cx="110" cy="170" rx="91" ry="13" fill="#060209" opacity=".58"/>
      <path d="M105 40 Q96 21 107 9 Q120 21 117 43" stroke="#40502d" strokeWidth="14" strokeLinecap="round" fill="none"/>
      <path d="M109 41 C44 17 12 78 30 135 C47 188 170 193 191 135 C211 76 169 20 109 41Z" fill={`url(#${shape})`} stroke="#832809" strokeWidth="3"/>
      <path d="M103 42 C61 39 45 88 56 137 C62 168 87 177 108 179" fill="none" stroke="#8b2b0e" strokeWidth="8" opacity=".56"/>
      <path d="M119 43 C159 35 181 78 169 139 C164 168 144 178 115 180" fill="none" stroke="#7e280f" strokeWidth="8" opacity=".55"/>
      <path d="M107 48 C89 63 85 143 109 179 C131 146 134 71 107 48Z" fill="#ff9c27" opacity=".10"/>
      <path d="M52 104 L84 92 L81 119 Z M137 119 L135 91 L169 104 Z" fill="#200b10" stroke="#ffaf34" strokeWidth="3"/>
      <path d="M105 122 L92 137 L116 135 Z" fill="#240d11" stroke="#ffb14f" strokeWidth="2"/>
      <path d="M63 141 Q111 166 160 140 L148 159 L134 154 L120 167 L103 159 L88 164 L75 151Z" fill="#1a0710" stroke="#ffac3a" strokeWidth="3"/>
      <path d="M56 105 L82 96 L79 112 Z M139 112 L138 96 L166 105 Z M69 147 Q110 163 152 147" fill={`url(#${glow})`} opacity=".72"/>
      <ellipse cx="85" cy="70" rx="32" ry="17" fill="#ffdd93" opacity=".09"/>
    </svg>
  </div>;
}

function Bat({ index }: { index: number }) {
  return <svg className={"seasonal-bat seasonal-bat--" + index} viewBox="0 0 120 62" aria-hidden="true">
    <path d="M60 19 Q52 8 49 13 L48 23 Q31 7 6 14 Q18 20 10 29 Q28 24 31 36 Q39 28 48 34 Q51 45 60 42 Q69 45 72 34 Q81 28 89 36 Q92 24 110 29 Q102 20 114 14 Q89 7 72 23 L71 13 Q68 8 60 19Z" fill="currentColor"/>
  </svg>;
}

function Leaves({ count }: { count: number }) {
  return <div className="seasonal-leaf-field" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => {
      const style = {
        "--leaf-left": ((i * 47 + 11) % 103) + "%",
        "--leaf-delay": "-" + ((i * 3.7) % 22) + "s",
        "--leaf-duration": (15 + (i * 7) % 16) + "s",
        "--leaf-size": (13 + (i * 5) % 16) + "px",
        "--leaf-shift": (((i * 11) % 23) - 11) + "vw",
      } as CSSProperties;
      return <svg style={style} className={"seasonal-leaf seasonal-leaf--" + (i % 3)} key={i} viewBox="0 0 30 30" focusable="false">
        <path d="M14 3 C9 10 3 8 5 16 C8 22 14 20 16 27 C22 20 23 16 25 12 C20 12 17 7 14 3Z" fill="currentColor"/>
        <path d="M16 26 L15 11 M15 17 L9 13 M15 19 L21 14" stroke="#512414" strokeWidth=".9" opacity=".65" fill="none"/>
      </svg>;
    })}
  </div>;
}

function HalloweenAtmosphere({ intensity, effects, area }: { intensity: SeasonalSettings["intensity"]; effects: SeasonalSettings["effects"]; area: string }) {
  const showcase = ["home", "login", "recruitment"].includes(area);
  const interior = area === "interior" || area === "application";
  const counts = { low: 7, medium: 14, high: 26 };
  return <div className={"seasonal-atmosphere seasonal-atmosphere--" + area} aria-hidden="true">
    {effects.moon && showcase && <div className="seasonal-moon"><div className="seasonal-moon__face"/><div className="seasonal-moon__cloud"/></div>}
    {effects.fog && !interior && <div className="seasonal-mist seasonal-mist--one"/>}
    {effects.fog && showcase && <div className="seasonal-mist seasonal-mist--two"/>}
    {effects.lightning && showcase && <div className="seasonal-storm"/>}
    {effects.leaves && <Leaves count={interior ? (intensity === "high" ? 7 : 4) : counts[intensity]}/>}
    {effects.bats && showcase && <><Bat index={1}/><Bat index={2}/><Bat index={3}/></>}
    {effects.pumpkins && showcase && <><Pumpkin side="left" index={1}/><Pumpkin side="right" index={2}/></>}
  </div>;
}

export function SeasonalExperience({ initial, children }: { initial: SeasonalSettings; children: ReactNode }) {
  const [current, setCurrent] = useState(initial);
  const [preview, setPreview] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const sync = () => {
      const hasPreview = !!sessionStorage.getItem(PREVIEW_KEY);
      setPreview(hasPreview);
      setCurrent(readPreview(initial));
    };
    sync();
    window.addEventListener("lscso-season-preview", sync);
    return () => window.removeEventListener("lscso-season-preview", sync);
  }, [initial]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.season = current.active_theme;
    root.dataset.seasonIntensity = current.intensity;
    root.dataset.seasonEffects = Object.entries(current.effects).filter(([, enabled]) => enabled).map(([name]) => name).join(" ");
  }, [current]);

  const area = pathname === "/" ? "home" : pathname === "/portal" ? "login" :
    pathname.startsWith("/portal") ? "interior" :
    pathname === "/join" ? "recruitment" :
    pathname.startsWith("/join/application") ? "application" : "public";
  const halloween = current.active_theme === "halloween";
  const thanksgiving = current.active_theme === "thanksgiving";
  function endPreview() {
    sessionStorage.removeItem(PREVIEW_KEY);
    setCurrent(initial);
    setPreview(false);
  }

  return <SeasonalContext.Provider value={current}>
    {children}
    {halloween && <HalloweenAtmosphere intensity={current.intensity} effects={current.effects} area={area}/>}
    {thanksgiving && current.effects.leaves && <div className="seasonal-atmosphere seasonal-atmosphere--public" aria-hidden="true"><Leaves count={current.intensity === "high" ? 21 : 10}/></div>}
    {preview && <div className="seasonal-preview-bar"><strong>Season preview · Only visible to you</strong><button onClick={endPreview} type="button">Exit preview ×</button></div>}
  </SeasonalContext.Provider>;
}

export function SeasonalLogo({ width, height, alt, className, style }: { width: number; height: number; alt: string; className?: string; style?: CSSProperties }) {
  const appearance = useSeasonalAppearance();
  const src = appearance.logos[appearance.active_theme] || "/images/lscso-patch-color.png";
  return <img className={className} src={src} width={width} height={height} alt={alt} style={{ objectFit: "contain", ...style }} />;
}
