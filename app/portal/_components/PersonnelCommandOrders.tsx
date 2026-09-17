"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type PersonnelOrderItem = {
  id: string;
  orderNumber: number;
  title: string;
  body: string;
  issuer: string;
  targetAudience: string;
  acknowledgmentRequired: boolean;
  acknowledgmentDueAt: string | null;
  effectiveAt: string;
  acknowledgedAt: string | null;
};

const orderDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

const when = (value: string | null) => {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : orderDateFormatter.format(date);
};

const isEffectiveAt = (item: PersonnelOrderItem, now: number) => {
  const effectiveAt = new Date(item.effectiveAt).getTime();
  if (Number.isNaN(effectiveAt)) return true;
  // During SSR and the first hydration pass, use the same deterministic state.
  // The real clock is applied immediately after mount.
  return now === 0 || effectiveAt <= now;
};

export function PersonnelCommandOrders({ initialOrders }: { initialOrders: PersonnelOrderItem[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [pendingId, setPendingId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(0);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function acknowledge(item: PersonnelOrderItem) {
    if (pendingId || !isEffectiveAt(item, Date.now())) return;
    setPendingId(item.id);
    setError("");
    const { data, error: rpcError } = await (createClient() as any).rpc("acknowledge_command_order", { p_order_id: item.id });
    setPendingId("");
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setOrders((current) => current.map((row) => row.id === item.id ? { ...row, acknowledgedAt: data ?? new Date().toISOString() } : row));
    setNotice(`CO-${String(item.orderNumber).padStart(4, "0")} acknowledged.`);
    router.refresh();
    window.setTimeout(() => setNotice(""), 4000);
  }

  const safeOrders = Array.isArray(orders) ? orders.filter((item) => item && item.id) : [];
  const required = safeOrders.filter((item) => isEffectiveAt(item, clock) && item.acknowledgmentRequired && !item.acknowledgedAt);
  const scheduled = safeOrders.filter((item) => !isEffectiveAt(item, clock));
  const current = safeOrders.filter((item) => isEffectiveAt(item, clock));

  return <>
    {required.length ? <section className="portal-panel" style={{ marginBottom: 16 }}>
      <div className="portal-panel-heading"><div><p>Action required</p><h2>Orders awaiting acknowledgment</h2></div><span>{required.length}</span></div>
      <div className="deputy-request-history">{required.map((item) => <article key={item.id}><span>CO</span><div><strong>CO-{String(item.orderNumber).padStart(4, "0")} · {item.title || "Untitled Command Order"}</strong><small>Effective {when(item.effectiveAt)}{item.acknowledgmentDueAt ? ` · Acknowledge by ${when(item.acknowledgmentDueAt)}` : ""}</small><p>{item.body || "No directive text was provided."}</p></div><button className="portal-button portal-button--primary" disabled={pendingId === item.id} onClick={() => acknowledge(item)} type="button">{pendingId === item.id ? "Saving…" : "Acknowledge"}</button></article>)}</div>
    </section> : null}

    {scheduled.length ? <section className="portal-panel" style={{ marginBottom: 16 }}>
      <div className="portal-panel-heading"><div><p>Scheduled directives</p><h2>Upcoming Command Orders</h2></div><span>{scheduled.length}</span></div>
      <div className="deputy-request-history">{scheduled.map((item) => <article key={item.id}><span>CO</span><div><strong>CO-{String(item.orderNumber).padStart(4, "0")} · {item.title || "Untitled Command Order"}</strong><small>{item.targetAudience || "Assigned personnel"} · Becomes effective {when(item.effectiveAt)} · Issued by {item.issuer || "Command"}</small><p>{item.body || "No directive text was provided."}</p>{item.acknowledgmentRequired ? <small>Acknowledgment will become available when the order takes effect{item.acknowledgmentDueAt ? ` · Due ${when(item.acknowledgmentDueAt)}` : ""}</small> : null}</div><b>Scheduled</b></article>)}</div>
    </section> : null}

    <section className="portal-panel">
      <div className="portal-panel-heading"><div><p>Department directives</p><h2>Active Command Orders</h2></div><span>{current.length}</span></div>
      <div className="deputy-request-history">{current.map((item) => <article key={item.id}><span>CO</span><div><strong>CO-{String(item.orderNumber).padStart(4, "0")} · {item.title || "Untitled Command Order"}</strong><small>{item.targetAudience || "Assigned personnel"} · Effective {when(item.effectiveAt)} · Issued by {item.issuer || "Command"}</small><p>{item.body || "No directive text was provided."}</p>{item.acknowledgmentRequired ? <small>{item.acknowledgedAt ? `Acknowledged ${when(item.acknowledgedAt)}` : "Acknowledgment required"}</small> : null}</div><b>{item.acknowledgmentRequired ? (item.acknowledgedAt ? "Acknowledged" : "Required") : "Active"}</b></article>)}{!current.length ? <div className="portal-empty-state"><strong>No active Command Orders.</strong></div> : null}</div>
    </section>
    {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    {error ? <div className="portal-toast" role="alert">{error}</div> : null}
  </>;
}
