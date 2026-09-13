"use client";

import { useEffect, useState } from "react";
import { GlassBlobToggle } from "./GlassBlobToggle";

type PortalTheme = "light" | "dark";

const THEME_KEY = "lscso.portal.theme:v1";

function getPortalRoot() {
  return document.getElementById("lscso-portal-root");
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<PortalTheme>("light");

  useEffect(() => {
    const current = getPortalRoot()?.dataset.theme;
    if (current === "dark" || current === "light") setTheme(current);
  }, []);

  function applyTheme(nextTheme: PortalTheme) {
    setTheme(nextTheme);
    const root = getPortalRoot();
    if (root) root.dataset.theme = nextTheme;

    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      // The selected theme still applies for the current page when storage is unavailable.
    }
  }

  const dark = theme === "dark";

  return (
    <div className={`${compact ? "portal-theme-toggle portal-theme-toggle--compact" : "portal-theme-toggle"} portal-theme-toggle--glass`}>
      <span className="portal-theme-toggle__icon" aria-hidden="true">{dark ? "☾" : "☀"}</span>
      <div className="portal-theme-toggle__copy">
        <strong>{dark ? "Dark mode" : "Light mode"}</strong>
        {!compact ? <small>Portal appearance</small> : null}
      </div>
      <GlassBlobToggle
        checked={dark}
        label="Use dark portal mode"
        onChange={(checked) => applyTheme(checked ? "dark" : "light")}
      />
    </div>
  );
}
