"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "lscso:portal-sidebar";

export function PortalSidebarController() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const app = buttonRef.current?.closest<HTMLElement>(".portal-app");
    if (!app) return;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    const next = saved === "collapsed" || (saved === null && window.innerWidth < 1180);
    setCollapsed(next);
    app.dataset.sidebarCollapsed = next ? "true" : "false";
  }, []);

  const toggle = () => {
    const app = buttonRef.current?.closest<HTMLElement>(".portal-app");
    const next = !collapsed;
    setCollapsed(next);
    if (app) app.dataset.sidebarCollapsed = next ? "true" : "false";
    window.localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
  };

  return (
    <button
      ref={buttonRef}
      className="portal-sidebar-collapse"
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Expand portal navigation" : "Collapse portal navigation"}
      aria-pressed={collapsed}
      title={collapsed ? "Expand navigation" : "Collapse navigation"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={collapsed ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
      </svg>
    </button>
  );
}
