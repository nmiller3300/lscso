"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PortalDialog } from "../../../_components/PortalDialog";

export function RecruitHireHandoff({
  applicationId,
  applicantName,
  eligible,
  hired,
  offerRank,
}: {
  applicationId: string;
  applicantName: string;
  eligible: boolean;
  hired: boolean;
  offerRank?: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdPersonnelId, setCreatedPersonnelId] = useState("");
  const appointmentRank = offerRank?.trim() || "";

  if (!eligible && !hired) return null;

  async function createAppointment() {
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
      if (!response.ok) throw new Error(data.error || "The personnel record could not be created.");
      setCreatedPersonnelId(data?.hire?.personnelId || "");
      setConfirmOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The personnel record could not be created.");
    } finally {
      setBusy(false);
    }
  }

  if (hired) {
    return (
      <section className="portal-panel recruitment-hire-handoff recruitment-hire-handoff--complete">
        <div className="portal-panel-heading">
          <div><p>Personnel appointment</p><h2>{appointmentRank ? `${appointmentRank} personnel record created` : "Personnel record created"}</h2></div>
          <span>Complete</span>
        </div>
        {createdPersonnelId ? <p><strong>Personnel ID:</strong> {createdPersonnelId}</p> : null}
      </section>
    );
  }

  return (
    <>
      <section className="portal-panel recruitment-hire-handoff recruitment-hire-handoff--ready">
        <div className="portal-panel-heading">
          <div><p>Final personnel appointment</p><h2>Employment offer accepted</h2></div>
          <span>Ready to appoint</span>
        </div>
        {error ? <p className="application-error" role="alert">{error}</p> : null}
        <button className="portal-button portal-button--primary" type="button" disabled={busy} onClick={() => { setError(""); setConfirmOpen(true); }}>
          {appointmentRank ? `Create ${appointmentRank} Personnel Record` : "Create Personnel Record"}
        </button>
      </section>

      <PortalDialog
        open={confirmOpen}
        onClose={() => { if (!busy) setConfirmOpen(false); }}
        eyebrow="Final hiring action"
        title={appointmentRank ? `Appoint ${applicantName} as LSCSO ${appointmentRank}?` : `Complete ${applicantName}'s LSCSO appointment?`}
        description="Creates the LSCSO personnel record at the rank accepted in the employment offer. FiveM/computer integration remains disabled."
        dismissOnBackdrop={!busy}
        footer={
          <>
            <button className="portal-button portal-button--secondary" type="button" disabled={busy} onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="portal-button portal-button--primary" type="button" disabled={busy} onClick={() => void createAppointment()}>
              {busy ? "Creating…" : appointmentRank ? `Confirm ${appointmentRank} Appointment` : "Confirm Appointment"}
            </button>
          </>
        }
      >
        <div className="recruitment-decision-review">
          <div><span>Applicant</span><strong>{applicantName}</strong></div>
          {appointmentRank ? <div><span>Portal rank</span><strong>{appointmentRank}</strong></div> : null}
          <div><span>Employment offer</span><strong>Signed & accepted</strong></div>
          <div><span>FiveM / computer action</span><strong>None</strong></div>
          {error ? <p className="application-error" role="alert">{error}</p> : null}
        </div>
      </PortalDialog>
    </>
  );
}
