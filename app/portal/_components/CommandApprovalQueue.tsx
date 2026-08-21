"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CommandApprovalItem = {
  databaseId: string;
  id: string;
  kind: "Guardian" | "Request";
  type: string;
  subject: string;
  submittedBy: string;
  priority: string;
  age: string;
  details: string;
  effectiveDate: string;
};

export function CommandApprovalQueue({ initialItems }: { initialItems: CommandApprovalItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [selectedItem, setSelectedItem] = useState<CommandApprovalItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  async function decideRequest(item: CommandApprovalItem, decision: "Approved" | "Denied") {
    if (reviewNotes.trim().length < 4) {
      setNotice("Enter a short Command review note before deciding this request.");
      return;
    }
    setPendingId(item.databaseId);
    const { error } = await createClient().rpc("review_personnel_request", {
      record_id: item.databaseId,
      decision,
      review_notes: reviewNotes.trim(),
    });
    setPendingId(null);

    if (error) {
      setNotice(error.message);
      return;
    }

    setItems((current) => current.filter((candidate) => candidate.databaseId !== item.databaseId));
    setSelectedItem(null);
    setReviewNotes("");
    setNotice(`${item.id} ${decision.toLowerCase()}. The member was notified and the action was audited.`);
    window.setTimeout(() => setNotice(""), 4200);
  }

  return (
    <>
      <div className="portal-approval-list">
        {items.map((item) => (
          <article key={item.id}>
            <span className={`portal-record-type portal-record-type--${item.type.toLowerCase().replaceAll(" ", "-")}`}>
              {item.type.slice(0, 2).toUpperCase()}
            </span>
            <div className="portal-approval-id">
              <strong>{item.id}</strong>
              <span>{item.type}</span>
            </div>
            <div>
              <strong>{item.subject}</strong>
              <span>{item.submittedBy}</span>
            </div>
            <span className={`portal-priority portal-priority--${item.priority.toLowerCase()}`}>
              {item.priority}
            </span>
            <small>{item.age}</small>
            {item.kind === "Guardian" ? (
              <Link href="/portal/command/guardians">Review →</Link>
            ) : (
              <button className="portal-approval-review-button" onClick={() => { setSelectedItem(item); setReviewNotes(""); }} type="button">Review →</button>
            )}
          </article>
        ))}
        {items.length === 0 ? (
          <div className="portal-empty-state"><strong>No command approvals are waiting.</strong></div>
        ) : null}
      </div>
      {selectedItem ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedItem(null); }}>
          <section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="request-review-title">
            <div className="portal-modal-heading">
              <div><span>{selectedItem.id} · {selectedItem.type}</span><h2 id="request-review-title">Review {selectedItem.subject}</h2></div>
              <button onClick={() => setSelectedItem(null)} type="button" aria-label="Close request review">×</button>
            </div>
            <div className="portal-request-review">
              <div><span>Submitted</span><strong>{selectedItem.age}</strong></div>
              <div><span>Preferred effective date</span><strong>{selectedItem.effectiveDate}</strong></div>
              <article><span>Member request</span><p>{selectedItem.details}</p></article>
              <label className="portal-call-sign-field">Command review note<textarea autoFocus onChange={(event) => setReviewNotes(event.target.value)} placeholder="Record the reason for approval or denial..." required rows={4} value={reviewNotes} /></label>
            </div>
            <div className="portal-modal-actions">
              <button className="portal-button portal-button--secondary" disabled={pendingId === selectedItem.databaseId} onClick={() => setSelectedItem(null)} type="button">Cancel</button>
              <button className="portal-button portal-button--danger" disabled={pendingId === selectedItem.databaseId || reviewNotes.trim().length < 4} onClick={() => decideRequest(selectedItem, "Denied")} type="button">{pendingId === selectedItem.databaseId ? "Saving…" : "Deny"}</button>
              <button className="portal-button portal-button--primary" disabled={pendingId === selectedItem.databaseId || reviewNotes.trim().length < 4} onClick={() => decideRequest(selectedItem, "Approved")} type="button">{pendingId === selectedItem.databaseId ? "Saving…" : "Approve"}</button>
            </div>
          </section>
        </div>
      ) : null}
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
