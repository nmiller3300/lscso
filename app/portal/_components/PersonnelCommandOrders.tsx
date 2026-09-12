"use client";

import { useState } from "react";
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

const when = (value: string | null) => value
  ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
  : "Not set";

export function PersonnelCommandOrders({ initialOrders }: { initialOrders: PersonnelOrderItem[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [pendingId, setPendingId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function acknowledge(item: PersonnelOrderItem) {
    if (pendingId) return;
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
    window.setTimeout(() => setNotice(""), 4000);
  }

  const required = orders.filter((item) => item.acknowledgmentRequired && !item.acknowledgedAt);

  return <>
    {required.length ? <section className="portal-panel" style={{ marginBottom: 16 }}>
      <div className="portal-panel-heading"><div><p>Action required</p><h2>Orders awaiting acknowledgment</h2></div><span>{required.length}</span></div>
      <div className="deputy-request-history">{required.map((item) => <article key={item.id}><span>CO</span><div><strong>CO-{String(item.orderNumber).padStart(4, "0")} · {item.title}</strong><small>Effective {when(item.effectiveAt)}{item.acknowledgmentDueAt ? ` · Acknowledge by ${when(item.acknowledgmentDueAt)}` : ""}</small><p>{item.body}</p></div><button className="portal-button portal-button--primary" disabled={pendingId === item.id} onClick={() => acknowledge(item)} type="button">{pendingId === item.id ? "Saving…" : "Acknowledge"}</button></article>)}</div>
    </section> : null}

    <section className="portal-panel">
      <div className="portal-panel-heading"><div><p>Department directives</p><h2>Active Command Orders</h2></div><span>{orders.length}</span></div>
      <div className="deputy-request-history">{orders.map((item) => <article key={item.id}><span>CO</span><div><strong>CO-{String(item.orderNumber).padStart(4, "0")} · {item.title}</strong><small>{item.targetAudience} · Effective {when(item.effectiveAt)} · Issued by {item.issuer}</small><p>{item.body}</p>{item.acknowledgmentRequired ? <small>{item.acknowledgedAt ? `Acknowledged ${when(item.acknowledgedAt)}` : "Acknowledgment required"}</small> : null}</div><b>{item.acknowledgmentRequired ? (item.acknowledgedAt ? "Acknowledged" : "Required") : "Active"}</b></article>)}{!orders.length ? <div className="portal-empty-state"><strong>No active Command Orders.</strong></div> : null}</div>
    </section>
    {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    {error ? <div className="portal-toast" role="alert">{error}</div> : null}
  </>;
}
