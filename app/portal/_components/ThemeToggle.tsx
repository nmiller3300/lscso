"use client";

import { useEffect, useState } from "react";

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

  function toggleTheme() {
    const nextTheme: PortalTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    const root = getPortalRoot();
    if (root) root.dataset.theme = nextTheme;

    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      // The selected theme still applies for the current page when storage is unavailable.
    }
  }

  return (
    <button
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      aria-pressed={theme === "dark"}
      className={compact ? "portal-theme-toggle portal-theme-toggle--compact" : "portal-theme-toggle"}
      onClick={toggleTheme}
      type="button"
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "◐"}</span>
      <strong>{theme === "dark" ? "Light" : "Dark"} mode</strong>
    </button>
  );
}
