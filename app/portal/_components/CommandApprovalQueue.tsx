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
};

export function CommandApprovalQueue({ initialItems }: { initialItems: CommandApprovalItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function decideRequest(item: CommandApprovalItem, decision: "Approved" | "Denied") {
    setPendingId(item.databaseId);
    const { error } = await createClient().rpc("review_personnel_request", {
      record_id: item.databaseId,
      decision,
      review_notes: `${decision} through the Command decision queue.`,
    });
    setPendingId(null);

    if (error) {
      setNotice(error.message);
      return;
    }

    setItems((current) => current.filter((candidate) => candidate.databaseId !== item.databaseId));
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
              <div className="portal-approval-actions">
                <button disabled={pendingId === item.databaseId} onClick={() => decideRequest(item, "Denied")} type="button">Deny</button>
                <button className="is-primary" disabled={pendingId === item.databaseId} onClick={() => decideRequest(item, "Approved")} type="button">Approve</button>
              </div>
            )}
          </article>
        ))}
        {items.length === 0 ? (
          <div className="portal-empty-state"><strong>No command approvals are waiting.</strong></div>
        ) : null}
      </div>
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
