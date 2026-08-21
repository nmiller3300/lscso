"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LeaveItem = { id: string; request_number: number; display_name: string; leave_type: string; starts_on: string; expected_return_on: string; notes: string | null; status: string };

export function LeaveApprovalQueue({ items }: { items: LeaveItem[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function decide(item: LeaveItem, decision: "Approved" | "Denied") {
    setPending(item.id);
    const { error } = await createClient().rpc("review_leave_request", {
      record_id: item.id,
      decision,
      review_notes: notes[item.id]?.trim() || null,
    });
    setPending(null);
    if (error) { setNotice(error.message); return; }
    setNotice(`LOA-${String(item.request_number).padStart(4, "0")} ${decision.toLowerCase()}.`);
    router.refresh();
    window.setTimeout(() => setNotice(""), 3600);
  }

  return (
    <>
      <div className="deputy-request-history">
        {items.map((item) => (
          <article key={item.id}>
            <span>LOA</span>
            <div><strong>{item.display_name} · {item.leave_type}</strong><small>LOA-{String(item.request_number).padStart(4, "0")} · {new Date(item.starts_on).toLocaleDateString()} → {new Date(item.expected_return_on).toLocaleDateString()}{item.notes ? ` · ${item.notes}` : ""}</small></div>
            <div className="portal-inline-actions">
              <input aria-label="Review note" onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Review note" value={notes[item.id] ?? ""} />
              <button disabled={pending === item.id} onClick={() => decide(item, "Approved")} type="button">Approve</button>
              <button disabled={pending === item.id} onClick={() => decide(item, "Denied")} type="button">Deny</button>
            </div>
          </article>
        ))}
        {!items.length ? <div className="portal-empty-state"><strong>No LOA requests are awaiting review.</strong></div> : null}
      </div>
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
