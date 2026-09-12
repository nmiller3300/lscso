"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PortalDialog } from "../../../_components/PortalDialog";

export function ApplicationClosureControl({
  applicationId,
  applicantName,
  closed,
  hired,
  closureCode,
  closureReason,
  closedAt,
}: {
  applicationId: string;
  applicantName: string;
  closed: boolean;
  hired: boolean;
  closureCode?: string | null;
  closureReason?: string | null;
  closedAt?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (hired) return null;

  async function closeApplication() {
    if (busy || reason.trim().length < 4) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", reason: reason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The application could not be closed.");
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The application could not be closed.");
    } finally {
      setBusy(false);
    }
  }

  if (closed) {
    return (
      <section className="portal-panel recruitment-closure-record">
        <div className="portal-panel-heading">
          <div><p>Recruitment disposition</p><h2>Selection process closed</h2></div>
          <b className="recruitment-status recruitment-status--denied">Closed</b>
        </div>
        <div className="recruitment-denial-record__reason">
          <span>{closureCode || "Closure reason"}</span>
          <p>{closureReason || "No applicant-facing closure reason was recorded."}</p>
        </div>
        {closedAt ? <small>Closed {new Date(closedAt).toLocaleString()}</small> : null}
      </section>
    );
  }

  return (
    <>
      <section className="portal-panel recruitment-closure-control">
        <div className="portal-panel-heading">
          <div><p>Manual disposition</p><h2>Close selection process</h2></div>
          <span>Applicant-visible reason required</span>
        </div>
        <button className="portal-button portal-button--danger" type="button" onClick={() => { setError(""); setOpen(true); }}>
          Close Application
        </button>
      </section>

      <PortalDialog
        open={open}
        onClose={() => { if (!busy) setOpen(false); }}
        eyebrow="Recruitment closure"
        title={`Close ${applicantName}'s application?`}
        description="This ends the current selection process. The reason entered below will be shown on the applicant's private tracking page."
        dismissOnBackdrop={!busy}
        footer={
          <>
            <button className="portal-button portal-button--secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
            <button className="portal-button portal-button--danger" type="button" disabled={busy || reason.trim().length < 4} onClick={() => void closeApplication()}>
              {busy ? "Closing…" : "Close Selection Process"}
            </button>
          </>
        }
      >
        <label className="recruitment-wide-label">Closure reason <em>Shown to applicant</em><textarea rows={5} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter the reason the selection process is being closed." /></label>
        {error ? <p className="application-error" role="alert">{error}</p> : null}
      </PortalDialog>
    </>
  );
}
