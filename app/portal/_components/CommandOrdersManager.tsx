"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type CommandOrderRecipient = {
  profileId: string;
  name: string;
  acknowledgedAt: string | null;
};

export type CommandOrderItem = {
  id: string;
  orderNumber: number;
  title: string;
  body: string;
  issuer: string;
  targetAudience: string;
  acknowledgmentRequired: boolean;
  acknowledgmentDueAt: string | null;
  effectiveAt: string;
  status: string;
  createdAt: string;
  acknowledgedCount: number;
  targetCount: number;
  recipients?: CommandOrderRecipient[];
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

const localInput = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const isScheduledAt = (item: CommandOrderItem, now: number) => {
  if (item.status !== "Active") return false;
  const effectiveAt = new Date(item.effectiveAt).getTime();
  if (Number.isNaN(effectiveAt)) return false;
  return now !== 0 && effectiveAt > now;
};

const displayStatus = (item: CommandOrderItem, now: number) => isScheduledAt(item, now) ? "Scheduled" : item.status;

export function CommandOrdersManager({ initialOrders }: { initialOrders: CommandOrderItem[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CommandOrderItem | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(0);

  useEffect(() => { setOrders(initialOrders); }, [initialOrders]);
  useEffect(() => {
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const safeOrders = useMemo(() => Array.isArray(orders) ? orders.filter((item) => item && item.id) : [], [orders]);
  const metrics = useMemo(() => ({
    active: safeOrders.filter((item) => item.status === "Active" && !isScheduledAt(item, clock)).length,
    scheduled: safeOrders.filter((item) => isScheduledAt(item, clock)).length,
    drafts: safeOrders.filter((item) => item.status === "Draft").length,
    awaiting: safeOrders.filter((item) => item.status === "Active" && !isScheduledAt(item, clock) && item.acknowledgmentRequired && (item.acknowledgedCount ?? 0) < (item.targetCount ?? 0)).length,
    rescinded: safeOrders.filter((item) => item.status === "Rescinded").length,
  }), [clock, safeOrders]);

  function beginCreate() {
    setEditing(null);
    setError("");
    setOpen(true);
  }

  function beginEdit(item: CommandOrderItem) {
    setEditing(item);
    setError("");
    setOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();
    const target = String(form.get("target") ?? "All Personnel");
    const acknowledgmentRequired = form.get("ackRequired") === "on";
    const due = String(form.get("ackDue") ?? "").trim();
    const effective = String(form.get("effective") ?? "").trim();
    const publish = !editing && form.get("publish") === "on";

    if (title.length < 4 || body.length < 10) {
      setError("Enter the order title and directive.");
      return;
    }

    const effectiveDate = effective ? new Date(effective) : new Date();
    const dueDate = acknowledgmentRequired && due ? new Date(due) : null;
    if (Number.isNaN(effectiveDate.getTime()) || (dueDate && Number.isNaN(dueDate.getTime()))) {
      setError("Enter valid order dates.");
      return;
    }
    const effectiveIso = effectiveDate.toISOString();
    const dueIso = dueDate ? dueDate.toISOString() : null;
    if (dueIso && dueDate!.getTime() < effectiveDate.getTime()) {
      setError("Acknowledgment due date cannot be before the order becomes effective.");
      return;
    }

    setPending(true);
    setError("");
    setNotice("");
    const supabase = createClient() as any;
    const payload = editing
      ? {
          p_order_id: editing.id,
          p_title: title,
          p_body: body,
          p_target_audience: target,
          p_acknowledgment_required: acknowledgmentRequired,
          p_acknowledgment_due_at: dueIso,
          p_effective_at: effectiveIso,
        }
      : {
          p_title: title,
          p_body: body,
          p_target_audience: target,
          p_acknowledgment_required: acknowledgmentRequired,
          p_acknowledgment_due_at: dueIso,
          p_effective_at: effectiveIso,
          p_publish: publish,
        };
    const rpc = editing ? "update_command_order" : "create_command_order";
    const { error: rpcError } = await supabase.rpc(rpc, payload);
    setPending(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setOpen(false);
    setEditing(null);
    setNotice(editing ? "Draft Command Order updated." : publish ? "Command Order published." : "Command Order saved as draft.");
    router.refresh();
    window.setTimeout(() => setNotice(""), 4500);
  }

  async function action(item: CommandOrderItem, kind: "publish" | "rescind") {
    if (pending) return;
    if (kind === "rescind" && !window.confirm(`Rescind CO-${String(item.orderNumber).padStart(4, "0")}? Personnel will be notified.`)) return;

    setPending(true);
    setError("");
    const rpc = kind === "publish" ? "publish_command_order" : "rescind_command_order";
    const { data, error: rpcError } = await (createClient() as any).rpc(rpc, { p_order_id: item.id });
    setPending(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setOrders((current) => current.map((row) => row.id === item.id ? { ...row, status: data?.status ?? (kind === "publish" ? "Active" : "Rescinded") } : row));
    setNotice(kind === "publish" ? "Command Order published and personnel notified." : "Command Order rescinded and personnel notified.");
    router.refresh();
    window.setTimeout(() => setNotice(""), 4500);
  }

  return <>
    <section className="portal-panel" style={{ marginBottom: 16 }}>
      <div className="portal-panel-heading">
        <div><p>Internal directives</p><h2>Command Orders</h2></div>
        <button className="portal-button portal-button--primary" onClick={beginCreate} type="button">New Command Order</button>
      </div>
      <div className="portal-metric-grid">
        <article className="portal-metric portal-metric--gold"><span>Active</span><strong>{metrics.active}</strong><small>{metrics.scheduled ? `${metrics.scheduled} scheduled` : "Current directives"}</small></article>
        <article className="portal-metric"><span>Drafts</span><strong>{metrics.drafts}</strong><small>Editable before publication</small></article>
        <article className="portal-metric"><span>Awaiting acknowledgment</span><strong>{metrics.awaiting}</strong><small>Orders with outstanding signatures</small></article>
        <article className="portal-metric"><span>Archive</span><strong>{metrics.rescinded}</strong><small>Rescinded orders</small></article>
      </div>
    </section>

    <section className="portal-panel">
      <div className="portal-panel-heading"><div><p>Permanent archive</p><h2>Order ledger</h2></div><span>{safeOrders.length} total</span></div>
      <div className="deputy-request-history">
        {safeOrders.map((item) => {
          const recipients = Array.isArray(item.recipients) ? item.recipients : [];
          const outstanding = recipients.filter((recipient) => !recipient.acknowledgedAt);
          return <article key={item.id}>
            <span>CO</span>
            <div>
              <strong>CO-{String(item.orderNumber).padStart(4, "0")} · {item.title || "Untitled Command Order"}</strong>
              <small>{displayStatus(item, clock)} · {item.targetAudience || "Assigned personnel"} · Effective {when(item.effectiveAt)} · Issued by {item.issuer || "Command"}</small>
              <p>{item.body || "No directive text was provided."}</p>
              {item.acknowledgmentRequired ? <>
                <small>Acknowledged {item.acknowledgedCount ?? 0}/{item.targetCount ?? recipients.length}{item.acknowledgmentDueAt ? ` · Due ${when(item.acknowledgmentDueAt)}` : ""}</small>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer" }}>Acknowledgment roster · {outstanding.length} outstanding</summary>
                  <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    {recipients.map((recipient) => <small key={recipient.profileId}>{recipient.name || "Personnel member"} — {recipient.acknowledgedAt ? `Acknowledged ${when(recipient.acknowledgedAt)}` : "Outstanding"}</small>)}
                    {!recipients.length ? <small>No eligible personnel are currently assigned to this audience.</small> : null}
                  </div>
                </details>
              </> : null}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b>{displayStatus(item, clock)}</b>
              {item.status === "Draft" ? <button className="portal-button portal-button--secondary" disabled={pending} onClick={() => beginEdit(item)} type="button">Edit</button> : null}
              {item.status === "Draft" ? <button className="portal-button portal-button--secondary" disabled={pending} onClick={() => action(item, "publish")} type="button">Publish</button> : null}
              {item.status !== "Rescinded" ? <button className="portal-button portal-button--danger" disabled={pending} onClick={() => action(item, "rescind")} type="button">Rescind</button> : null}
            </div>
          </article>;
        })}
        {!safeOrders.length ? <div className="portal-empty-state"><strong>No Command Orders have been created.</strong></div> : null}
      </div>
    </section>

    {open ? <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !pending) { setOpen(false); setEditing(null); } }}>
      <section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="command-order-title">
        <div className="portal-modal-heading">
          <div><span>Department directive</span><h2 id="command-order-title">{editing ? `Edit CO-${String(editing.orderNumber).padStart(4, "0")}` : "New Command Order"}</h2></div>
          <button disabled={pending} onClick={() => { setOpen(false); setEditing(null); }} type="button" aria-label="Close">×</button>
        </div>
        <form onSubmit={save}>
          <div className="portal-form-grid">
            <label>Title<input name="title" defaultValue={editing?.title ?? ""} maxLength={140} required /></label>
            <label>Audience<select name="target" defaultValue={editing?.targetAudience ?? "All Personnel"}><option>All Personnel</option><option>Supervisors & Command</option><option>Command Only</option></select></label>
            <label>Effective date/time<input name="effective" type="datetime-local" defaultValue={localInput(editing?.effectiveAt ?? null)} /></label>
            <label>Acknowledgment due<input name="ackDue" type="datetime-local" defaultValue={localInput(editing?.acknowledgmentDueAt ?? null)} /></label>
          </div>
          <label className="portal-call-sign-field">Directive<textarea name="body" rows={8} required defaultValue={editing?.body ?? ""} placeholder="State the order clearly and directly." /></label>
          <label className="portal-checkbox-row"><input name="ackRequired" type="checkbox" defaultChecked={editing?.acknowledgmentRequired ?? false} /><span><strong>Require personnel acknowledgment</strong></span></label>
          {!editing ? <label className="portal-checkbox-row"><input name="publish" type="checkbox" defaultChecked /><span><strong>Publish immediately</strong></span></label> : null}
          {editing ? <div className="portal-form-note">Drafts can be edited freely. Once published, rescind and issue a replacement order to preserve the official record.</div> : null}
          {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
          <div className="portal-modal-actions">
            <button className="portal-button portal-button--secondary" disabled={pending} onClick={() => { setOpen(false); setEditing(null); }} type="button">Cancel</button>
            <button className="portal-button portal-button--primary" disabled={pending} type="submit">{pending ? "Saving…" : editing ? "Save Draft" : "Save Order"}</button>
          </div>
        </form>
      </section>
    </div> : null}

    {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    {!open && error ? <div className="portal-toast" role="alert">{error}</div> : null}
  </>;
}
