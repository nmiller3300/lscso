"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type MaintenanceScope = "public_site" | "personnel_portal";
type MaintenanceRow = {
  scope: MaintenanceScope;
  mode: "operational" | "scheduled" | "maintenance";
  effective_mode: "operational" | "scheduled" | "maintenance";
  title: string | null;
  public_message: string | null;
  internal_message: string | null;
  scheduled_start: string | null;
  expected_end: string | null;
  updated_at: string;
};

function formatTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function MaintenanceNotice({ scope, variant }: { scope: MaintenanceScope; variant: "public" | "portal" }) {
  const pathname = usePathname();
  const [row, setRow] = useState<MaintenanceRow | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/system/maintenance", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { states: MaintenanceRow[] };
        const next = payload.states.find((item) => item.scope === scope) ?? null;
        if (!cancelled) setRow(next);
      } catch {}
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [scope]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const minutesUntil = useMemo(() => {
    if (!row?.scheduled_start) return null;
    return Math.ceil((new Date(row.scheduled_start).getTime() - now) / 60_000);
  }, [now, row?.scheduled_start]);

  useEffect(() => {
    if (!row) return;
    if (row.effective_mode === "maintenance" && pathname !== "/maintenance" && pathname !== "/portal/maintenance" && pathname !== "/portal/maintenance-access") {
      window.location.reload();
      return;
    }
    if (row.mode !== "scheduled" || minutesUntil === null || minutesUntil > 10 || minutesUntil < 0) return;
    const key = `lscso-maintenance-notice:${scope}:${row.updated_at}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "shown");
    setPopupOpen(true);
  }, [minutesUntil, pathname, row, scope]);

  if (!row || row.mode !== "scheduled" || !row.scheduled_start || minutesUntil === null || minutesUntil < 0) return null;
  if (pathname === "/maintenance" || pathname === "/portal/maintenance") return null;

  const urgent = minutesUntil <= 10;
  const critical = minutesUntil <= 5;
  const message = variant === "portal" ? row.internal_message : row.public_message;
  const starts = formatTime(row.scheduled_start);
  const ends = formatTime(row.expected_end);

  return (
    <>
      <aside className={`maintenance-notice maintenance-notice--${variant} ${urgent ? "is-urgent" : ""} ${critical ? "is-critical" : ""}`} role="status" aria-live="polite">
        <span className="maintenance-notice__pulse" aria-hidden="true" />
        <div><small>{critical ? "Maintenance begins soon" : "Scheduled maintenance"}</small><strong>{row.title || "LSCSO system maintenance"}</strong><p>{message || `Maintenance is scheduled for ${starts}.`}</p></div>
        <div className="maintenance-notice__time"><strong>{minutesUntil <= 0 ? "Starting now" : `${minutesUntil} min`}</strong><span>{starts}{ends ? ` → ${ends}` : ""}</span></div>
      </aside>
      {popupOpen ? (
        <div className="maintenance-popup-backdrop" role="presentation">
          <section className="maintenance-popup" role="dialog" aria-modal="true" aria-labelledby={`maintenance-popup-${scope}`}>
            <span>LSCSO scheduled maintenance</span>
            <h2 id={`maintenance-popup-${scope}`}>{row.title || "System maintenance begins soon"}</h2>
            <p>{message || "Save any unfinished work before the scheduled maintenance window begins."}</p>
            <dl><div><dt>Begins</dt><dd>{starts}</dd></div>{ends ? <div><dt>Expected restoration</dt><dd>{ends}</dd></div> : null}</dl>
            <button type="button" onClick={() => setPopupOpen(false)}>I understand</button>
          </section>
        </div>
      ) : null}
    </>
  );
}
