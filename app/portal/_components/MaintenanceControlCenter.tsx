"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PortalDialog } from "./PortalDialog";

type ActualScope = "public_site" | "personnel_portal";
type Scope = ActualScope | "entire_system";
type Mode = "operational" | "scheduled" | "maintenance";
type StateRow = { scope: ActualScope; mode: Mode; effective_mode: Mode; title: string | null; public_message: string | null; internal_message: string | null; scheduled_start: string | null; expected_end: string | null; updated_at: string };
type HistoryRow = { id: number; scope: string; previous_mode: string | null; next_mode: string; title: string | null; reason: string | null; actor_name: string | null; created_at: string };
type Change = { scope: Scope; mode: Mode; title: string; publicMessage: string; internalMessage: string; scheduledStart: string; expectedEnd: string; reason: string };
type AppliedChange = Change & { scope: ActualScope };

const emptyChange: Change = { scope: "personnel_portal", mode: "scheduled", title: "Scheduled maintenance", publicMessage: "The requested LSCSO service will be temporarily unavailable while scheduled improvements are completed.", internalMessage: "Scheduled maintenance will temporarily interrupt Personnel Operations. Save unfinished work before the maintenance window begins.", scheduledStart: "", expectedEnd: "", reason: "" };

const scopeDescriptions: Record<Scope, string> = {
  personnel_portal: "Portal only. The public website remains online.",
  public_site: "Public website only. The Personnel Portal remains online.",
  entire_system: "Entire website. The public site and Personnel Portal are taken offline together. Executive Command can still use the maintenance login to bypass the outage.",
};

function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function format(value: string | null) { return value ? new Date(value).toLocaleString() : "—"; }

export function MaintenanceControlCenter() {
  const [states, setStates] = useState<StateRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [form, setForm] = useState<Change>(emptyChange);
  const [pendingChange, setPendingChange] = useState<Change | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient() as any;
    const [response, historyResult] = await Promise.all([
      fetch("/api/system/maintenance", { cache: "no-store" }),
      supabase.rpc("get_system_maintenance_history", { p_limit: 20 }),
    ]);
    if (response.ok) {
      const payload = await response.json() as { states: StateRow[] };
      setStates(payload.states ?? []);
    }
    if (!historyResult.error) setHistory(historyResult.data ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const hasMaintenance = useMemo(() => states.some((item) => item.effective_mode === "maintenance"), [states]);

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.mode === "scheduled" && !form.scheduledStart) { setNotice("Select a scheduled start time before reviewing this change."); return; }
    if (form.reason.trim().length < 4) { setNotice("Enter a short administrative reason for the maintenance change."); return; }
    setPendingChange(form);
  }

  function restore(scope: ActualScope) {
    setPendingChange({ ...emptyChange, scope, mode: "operational", title: "Service restored", publicMessage: "LSCSO service has returned to normal operations.", internalMessage: "LSCSO service has returned to normal operations.", reason: "Maintenance completed and service restored." });
  }

  function operationalReset(scope: ActualScope, reason: string): AppliedChange {
    return {
      ...emptyChange,
      scope,
      mode: "operational",
      title: "Service available",
      publicMessage: "LSCSO service is operating normally.",
      internalMessage: "LSCSO service is operating normally.",
      scheduledStart: "",
      expectedEnd: "",
      reason,
    };
  }

  function buildChanges(change: Change): AppliedChange[] {
    if (change.scope === "entire_system") {
      return [
        { ...change, scope: "public_site" },
        { ...change, scope: "personnel_portal" },
      ];
    }

    const target: AppliedChange = { ...change, scope: change.scope };
    if (change.mode === "operational") return [target];

    // Scope choices are exclusive by design. Selecting Portal Only or Public Website Only
    // must not leave the other half of the site stuck in a previous maintenance state.
    const otherScope: ActualScope = change.scope === "personnel_portal" ? "public_site" : "personnel_portal";
    const otherState = states.find((item) => item.scope === otherScope);
    if (!otherState || otherState.mode === "operational") return [target];

    return [
      target,
      operationalReset(otherScope, `${label(change.scope)} maintenance selected; unaffected service restored automatically.`),
    ];
  }

  async function applyChange(change: AppliedChange) {
    const supabase = createClient() as any;
    return supabase.rpc("set_system_maintenance_state", {
      p_scope: change.scope,
      p_mode: change.mode,
      p_title: change.title || null,
      p_public_message: change.publicMessage || null,
      p_internal_message: change.internalMessage || null,
      p_scheduled_start: change.mode === "operational" || !change.scheduledStart ? null : new Date(change.scheduledStart).toISOString(),
      p_expected_end: change.mode === "operational" || !change.expectedEnd ? null : new Date(change.expectedEnd).toISOString(),
      p_reason: change.reason || null,
    });
  }

  async function confirm() {
    if (!pendingChange) return;
    setBusy(true); setNotice("");

    const changes = buildChanges(pendingChange);
    for (const change of changes) {
      const { error } = await applyChange(change);
      if (error) {
        setBusy(false);
        setNotice(`Could not update ${label(change.scope)}: ${error.message}`);
        await load();
        return;
      }
    }

    setBusy(false);
    setPendingChange(null);
    setNotice(
      pendingChange.mode === "operational"
        ? "Service restored to normal operations."
        : pendingChange.scope === "entire_system"
          ? "Entire website maintenance state updated. Public Website and Personnel Portal are now synchronized."
          : `${pendingChange.scope === "personnel_portal" ? "Personnel Portal" : "Public Website"} maintenance state updated; the other service remains operational.`,
    );
    setForm(emptyChange);
    await load();
  }

  return (
    <div className="maintenance-control-center">
      <section className="portal-panel maintenance-control-status">
        <div className="portal-panel-heading"><div><p>Live system state</p><h2>LSCSO services</h2></div><span>{hasMaintenance ? "Maintenance active" : "Systems available"}</span></div>
        <div className="maintenance-scope-grid">
          {states.map((item) => <article className={`is-${item.effective_mode}`} key={item.scope}><span>{label(item.scope)}</span><strong>{label(item.effective_mode)}</strong><p>{item.scope === "personnel_portal" ? item.internal_message : item.public_message}</p><dl><div><dt>Start</dt><dd>{format(item.scheduled_start)}</dd></div><div><dt>Expected end</dt><dd>{format(item.expected_end)}</dd></div></dl><button type="button" disabled={item.effective_mode === "operational"} onClick={() => restore(item.scope)}>Restore operational</button></article>)}
        </div>
      </section>

      <section className="portal-panel maintenance-control-form">
        <div className="portal-panel-heading"><div><p>Executive control</p><h2>Schedule or activate maintenance</h2></div><span>Audited</span></div>
        <p className="personnel-section-intro">Scheduled state warns users before the start time. At the scheduled start, the affected service automatically enters its maintenance screen until Executive Command restores it.</p>
        <form onSubmit={review}>
          <div className="portal-form-grid">
            <label>Scope<select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as Scope })}><option value="personnel_portal">Personnel Portal Only</option><option value="public_site">Public Website Only</option><option value="entire_system">Entire Website</option></select></label>
            <label>Mode<select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value as Mode })}><option value="scheduled">Scheduled maintenance</option><option value="maintenance">Maintenance now</option><option value="operational">Restore operational</option></select></label>
            <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label>Administrative reason<input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Why this change is being made" /></label>
            <label>Scheduled start<input type="datetime-local" disabled={form.mode !== "scheduled"} value={form.scheduledStart} onChange={(event) => setForm({ ...form, scheduledStart: event.target.value })} /></label>
            <label>Expected restoration<input type="datetime-local" disabled={form.mode === "operational"} value={form.expectedEnd} onChange={(event) => setForm({ ...form, expectedEnd: event.target.value })} /></label>
          </div>
          <div className="command-v2-inline-state" role="note"><strong>{form.scope === "personnel_portal" ? "Portal Only" : form.scope === "public_site" ? "Public Website Only" : "Entire Website"}</strong><span>{scopeDescriptions[form.scope]}</span></div>
          <label className="maintenance-control-wide">Public message<textarea rows={3} value={form.publicMessage} onChange={(event) => setForm({ ...form, publicMessage: event.target.value })} /></label>
          <label className="maintenance-control-wide">Internal Portal message<textarea rows={3} value={form.internalMessage} onChange={(event) => setForm({ ...form, internalMessage: event.target.value })} /></label>
          {notice ? <div className="command-v2-inline-state" role="status"><strong>Maintenance Center</strong><span>{notice}</span></div> : null}
          <div className="command-v2-action-row"><button className="portal-button portal-button--primary" type="submit">Review maintenance change</button></div>
        </form>
      </section>

      <section className="portal-panel maintenance-history">
        <div className="portal-panel-heading"><div><p>Audit history</p><h2>Maintenance events</h2></div><span>{history.length} recent</span></div>
        <div>{history.map((item) => <article key={item.id}><div><strong>{label(item.scope)}</strong><span>{label(item.previous_mode || "unknown")} → {label(item.next_mode)}</span></div><div><strong>{item.title || "Maintenance state change"}</strong><span>{item.reason || "No reason recorded"}</span></div><div><strong>{item.actor_name || "System"}</strong><span>{new Date(item.created_at).toLocaleString()}</span></div></article>)}{!history.length ? <div className="portal-empty-state"><strong>No maintenance events recorded yet.</strong></div> : null}</div>
      </section>

      <PortalDialog open={Boolean(pendingChange)} onClose={() => { if (!busy) setPendingChange(null); }} eyebrow="Executive maintenance control" title="Confirm system state change" description="This action is recorded in the maintenance audit history and may immediately affect LSCSO users." dismissOnBackdrop={!busy} footer={<><button className="portal-button portal-button--secondary" disabled={busy} type="button" onClick={() => setPendingChange(null)}>Cancel</button><button className="portal-button portal-button--primary" disabled={busy} type="button" onClick={() => void confirm()}>{busy ? "Applying…" : "Confirm change"}</button></>}>
        {pendingChange ? <div className="maintenance-confirmation"><div><span>Scope</span><strong>{pendingChange.scope === "personnel_portal" ? "Personnel Portal Only" : pendingChange.scope === "public_site" ? "Public Website Only" : "Entire Website"}</strong></div><div><span>New state</span><strong>{label(pendingChange.mode)}</strong></div>{pendingChange.scheduledStart ? <div><span>Scheduled start</span><strong>{new Date(pendingChange.scheduledStart).toLocaleString()}</strong></div> : null}<p>{pendingChange.reason}</p></div> : null}
      </PortalDialog>
    </div>
  );
}
