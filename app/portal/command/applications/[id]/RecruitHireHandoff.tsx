"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PortalDialog } from "../../../_components/PortalDialog";

export function RecruitHireHandoff({
  applicationId,
  applicantName,
  eligible,
  hired,
}: {
  applicationId: string;
  applicantName: string;
  eligible: boolean;
  hired: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdPersonnelId, setCreatedPersonnelId] = useState("");

  if (!eligible && !hired) return null;

  async function createRecruit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/applications/${applicationId}/hire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The Recruit personnel record could not be created.");
      setCreatedPersonnelId(data?.hire?.personnelId || "");
      setConfirmOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Recruit personnel record could not be created.");
    } finally {
      setBusy(false);
    }
  }

  if (hired) {
    return (
      <section className="portal-panel recruitment-hire-handoff recruitment-hire-handoff--complete">
        <div className="portal-panel-heading">
          <div><p>Recruit appointment</p><h2>Recruit personnel record created</h2></div>
          <span>Complete</span>
        </div>
        <p>
          The applicant has been added to LSCSO personnel as a Recruit. No FiveM, QBox, or computer-system link was created.
        </p>
        {createdPersonnelId ? <p><strong>Personnel ID:</strong> {createdPersonnelId}</p> : null}
      </section>
    );
  }

  return (
    <>
      <section className="portal-panel recruitment-hire-handoff recruitment-hire-handoff--ready">
        <div className="portal-panel-heading">
          <div>
            <p>Final Recruit appointment</p>
            <h2>Interview passed — Recruit personnel record ready</h2>
          </div>
          <span>Ready to appoint</span>
        </div>
        <p>
          This is the actual website hiring action. It creates an LSCSO personnel record for {applicantName} at the rank of Recruit.
          Computer/FiveM integration is currently disabled and is not part of this action.
        </p>
        {error ? <p className="application-error" role="alert">{error}</p> : null}
        <div className="recruitment-interview-actions">
          <button
            className="portal-button portal-button--primary"
            type="button"
            disabled={busy}
            onClick={() => {
              setError("");
              setConfirmOpen(true);
            }}
          >
            Create Recruit Personnel Record
          </button>
          <span className="is-ready">Passed interview requirement satisfied</span>
        </div>
      </section>

      <PortalDialog
        open={confirmOpen}
        onClose={() => { if (!busy) setConfirmOpen(false); }}
        eyebrow="Final hiring action"
        title={`Appoint ${applicantName} as an LSCSO Recruit?`}
        description="This creates the permanent website personnel record. It does not connect to FiveM or the computer script. After it succeeds, this application can no longer be deleted as a disposable test submission."
        dismissOnBackdrop={!busy}
        footer={
          <>
            <button className="portal-button portal-button--secondary" type="button" disabled={busy} onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="portal-button portal-button--primary" type="button" disabled={busy} onClick={() => void createRecruit()}>
              {busy ? "Creating Recruit…" : "Confirm Recruit Appointment"}
            </button>
          </>
        }
      >
        <div className="recruitment-decision-review">
          <div><span>Applicant</span><strong>{applicantName}</strong></div>
          <div><span>Portal rank</span><strong>Recruit</strong></div>
          <div><span>Computer / FiveM action</span><strong>None</strong></div>
          <p><strong>Testing?</strong> If you only want to inspect the Passed applicant view, stop here and use the Sheriff/Undersheriff delete control instead of creating a personnel record.</p>
          {error ? <p className="application-error" role="alert">{error}</p> : null}
        </div>
      </PortalDialog>
    </>
  );
}
