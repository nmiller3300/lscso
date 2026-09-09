"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PortalDialog } from "../../../_components/PortalDialog";

export function DeleteApplicationButton({
  applicationId,
  applicationNumber,
  applicantName,
}: {
  applicationId: string;
  applicationNumber: string;
  applicantName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = confirmation.trim().toUpperCase() === applicationNumber.toUpperCase();

  async function removeApplication() {
    if (!matches || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/applications/${applicationId}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmation.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The application could not be deleted.");
      setOpen(false);
      router.push("/portal/command/applications");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The application could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="portal-button portal-button--danger"
        type="button"
        onClick={() => {
          setConfirmation("");
          setError("");
          setOpen(true);
        }}
      >
        Delete test / invalid application
      </button>

      <PortalDialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        eyebrow="Administrative cleanup"
        title={`Delete ${applicationNumber}?`}
        description="This permanently removes the application, its private tracking link, applicant communications, internal notes, and recruitment history. Accepted and interview-stage applications may still be deleted as long as no Recruit/personnel record has been created."
        dismissOnBackdrop={!busy}
        footer={
          <>
            <button className="portal-button portal-button--secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="portal-button portal-button--danger" type="button" disabled={busy || !matches} onClick={() => void removeApplication()}>
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
          </>
        }
      >
        <div className="recruitment-decision-review">
          <div><span>Applicant</span><strong>{applicantName}</strong></div>
          <div><span>Application</span><strong>{applicationNumber}</strong></div>
          <label>
            Type <strong>{applicationNumber}</strong> to confirm
            <input
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={applicationNumber}
            />
          </label>
          {error ? <p className="application-error" role="alert">{error}</p> : null}
        </div>
      </PortalDialog>
    </>
  );
}
