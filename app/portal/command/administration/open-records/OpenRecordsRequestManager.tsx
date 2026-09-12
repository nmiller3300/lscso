"use client";

import { useState } from "react";

const statuses = ["Submitted","Acknowledged","In Review","Awaiting Payment","Ready","Partially Granted","Denied","Completed","Closed"];

type RequestRow = {
  id: string;
  requestNumber: number;
  status: string;
  internalNotes: string;
  responseSummary: string;
};

export function OpenRecordsRequestManager({ request }: { request: RequestRow }) {
  const [status, setStatus] = useState(request.status);
  const [internalNotes, setInternalNotes] = useState(request.internalNotes);
  const [responseSummary, setResponseSummary] = useState(request.responseSummary);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/portal/open-records/${encodeURIComponent(request.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, internal_notes: internalNotes, response_summary: responseSummary }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The request could not be updated.");
      setMessage("Saved");
      window.setTimeout(() => setMessage(""), 1800);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The request could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="open-records-command-controls">
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Response / release summary<textarea value={responseSummary} onChange={(event) => setResponseSummary(event.target.value)} rows={3} maxLength={8000} placeholder="What was produced, withheld, redacted, or still pending?" /></label>
      <label>Internal custodian notes<textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows={3} maxLength={8000} placeholder="Internal review notes; never shown to the requester." /></label>
      <div className="open-records-command-actions"><button className="portal-button portal-button--primary" type="button" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Request"}</button>{message ? <span>{message}</span> : null}</div>
    </div>
  );
}
