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
  const [citizenId, setCitizenId] = useState("");
  const [characterName, setCharacterName] = useState(applicantName);
  const [licenseIdentifier, setLicenseIdentifier] = useState("");
  const [serverId, setServerId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdPersonnelId, setCreatedPersonnelId] = useState("");

  if (!eligible && !hired) return null;

  async function createRecruit() {
    if (!citizenId.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/applications/${applicationId}/hire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizenId: citizenId.trim(),
          characterName: characterName.trim(),
          licenseIdentifier: licenseIdentifier.trim(),
          serverId: serverId.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The Recruit record could not be created.");
      setCreatedPersonnelId(data?.hire?.personnelId || "");
      setConfirmOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Recruit record could not be created.");
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
          The applicant has been converted into an LSCSO Recruit personnel record. This application is now part of the permanent hiring record and can no longer be deleted as a test application.
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
            <h2>Interview passed — Recruit record ready</h2>
          </div>
          <span>Ready to hire</span>
        </div>
        <p>
          This is the actual hiring handoff. Completing it creates the applicant&apos;s LSCSO Recruit personnel record and links the FiveM identity below. It is different from accepting the application.
        </p>
        <div className="recruitment-control-grid">
          <label>
            FiveM citizen ID
            <input value={citizenId} onChange={(event) => setCitizenId(event.target.value)} placeholder="Required" />
          </label>
          <label>
            Character name
            <input value={characterName} onChange={(event) => setCharacterName(event.target.value)} placeholder={applicantName} />
          </label>
          <label>
            License identifier
            <input value={licenseIdentifier} onChange={(event) => setLicenseIdentifier(event.target.value)} placeholder="Optional" />
          </label>
          <label>
            Current server ID
            <input inputMode="numeric" value={serverId} onChange={(event) => setServerId(event.target.value)} placeholder="Optional" />
          </label>
        </div>
        {error ? <p className="application-error" role="alert">{error}</p> : null}
        <div className="recruitment-interview-actions">
          <button
            className="portal-button portal-button--primary"
            type="button"
            disabled={busy || !citizenId.trim()}
            onClick={() => {
              setError("");
              setConfirmOpen(true);
            }}
          >
            Create Recruit Record
          </button>
          <span className="is-ready">Passed interview requirement satisfied</span>
        </div>
      </section>

      <PortalDialog
        open={confirmOpen}
        onClose={() => { if (!busy) setConfirmOpen(false); }}
        eyebrow="Final hiring action"
        title={`Create Recruit record for ${applicantName}?`}
        description="This is the actual Recruit appointment. It creates a personnel record and FiveM identity link. After this succeeds, the application cannot be deleted as a test submission."
        dismissOnBackdrop={!busy}
        footer={
          <>
            <button className="portal-button portal-button--secondary" type="button" disabled={busy} onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="portal-button portal-button--primary" type="button" disabled={busy || !citizenId.trim()} onClick={() => void createRecruit()}>
              {busy ? "Creating Recruit…" : "Confirm Recruit Appointment"}
            </button>
          </>
        }
      >
        <div className="recruitment-decision-review">
          <div><span>Applicant</span><strong>{applicantName}</strong></div>
          <div><span>FiveM citizen ID</span><strong>{citizenId || "Not entered"}</strong></div>
          <div><span>Character name</span><strong>{characterName || applicantName}</strong></div>
          <p><strong>Do not use this final action for a disposable test application</strong> unless you intend to keep the resulting Recruit personnel record.</p>
          {error ? <p className="application-error" role="alert">{error}</p> : null}
        </div>
      </PortalDialog>
    </>
  );
}
