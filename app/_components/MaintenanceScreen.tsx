"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Scope = "public_site" | "personnel_portal";
type Row = { scope: Scope; effective_mode: string; title: string | null; public_message: string | null; internal_message: string | null; scheduled_start: string | null; expected_end: string | null; updated_at: string };

function format(value: string | null) {
  if (!value) return "Not specified";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function MaintenanceScreen({ scope }: { scope: Scope }) {
  const [state, setState] = useState<Row | null>(null);
  const portal = scope === "personnel_portal";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/system/maintenance", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { states: Row[] };
        const next = payload.states.find((item) => item.scope === scope) ?? null;
        if (cancelled) return;
        setState(next);
        if (next?.effective_mode === "operational") window.location.replace(portal ? "/portal" : "/");
      } catch {}
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [portal, scope]);

  const message = portal ? state?.internal_message : state?.public_message;

  return (
    <main className={`maintenance-screen ${portal ? "maintenance-screen--portal" : "maintenance-screen--public"}`}>
      <div className="maintenance-screen__ambient" aria-hidden="true" />
      <section className="maintenance-screen__card">
        <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff’s Office patch" width={124} height={124} priority />
        <span>{portal ? "Personnel Operations" : "Los Santos County Sheriff’s Office"}</span>
        <h1>{portal ? "Personnel Operations temporarily offline" : "Website maintenance"}</h1>
        <p>{message || (portal ? "Scheduled maintenance is currently underway. Personnel records remain protected and no action is required from department personnel." : "The LSCSO public website is temporarily unavailable while scheduled improvements are completed.")}</p>
        <div className="maintenance-screen__status"><i aria-hidden="true" /><div><small>Current status</small><strong>Maintenance in progress</strong></div></div>
        <dl><div><dt>Started / scheduled</dt><dd>{format(state?.scheduled_start ?? null)}</dd></div><div><dt>Expected restoration</dt><dd>{format(state?.expected_end ?? null)}</dd></div><div><dt>Affected system</dt><dd>{portal ? "Personnel Operations Portal" : "LSCSO Public Website"}</dd></div></dl>
        <small className="maintenance-screen__refresh">Status checks automatically every 30 seconds.</small>
        {portal ? <Link className="maintenance-screen__executive" href="/portal/maintenance-access">Executive maintenance access <b>→</b></Link> : <Link className="maintenance-screen__executive" href="/portal">Personnel Portal <b>→</b></Link>}
      </section>
    </main>
  );
}
