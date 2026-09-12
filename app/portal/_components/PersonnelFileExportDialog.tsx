"use client";

import { useEffect, useState } from "react";

export type PersonnelFileExportKind = "lateral" | "normal" | "open-records";

const COMPLETE_RECORD_SECTIONS = "career,assignments,certifications,training,awards,guardians,administrative";
const OPEN_RECORDS_SECTIONS = "career,assignments,certifications,training,awards";

const labels: Record<PersonnelFileExportKind, string> = {
  lateral: "Lateral Transfer Personnel File",
  normal: "Normal Personnel File",
  "open-records": "Open Records Request Personnel File",
};

type Props = {
  personnelId: string;
  displayName: string;
  rank?: string;
  kind: PersonnelFileExportKind;
  onClose: () => void;
};

export function PersonnelFileExportDialog({ personnelId, displayName, rank, kind, onClose }: Props) {
  const [destination, setDestination] = useState("");
  const openRecords = kind === "open-records";

  useEffect(() => setDestination(""), [kind, personnelId]);

  function createPdf() {
    if (destination.trim().length < 2) return;
    const query = new URLSearchParams({
      exportType: kind,
      recipient: destination.trim(),
      sections: openRecords ? OPEN_RECORDS_SECTIONS : COMPLETE_RECORD_SECTIONS,
    });
    window.location.href = `/api/portal/personnel/${encodeURIComponent(personnelId)}/record-export?${query.toString()}`;
    onClose();
  }

  return (
    <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="portal-modal portal-modal--compact personnel-export-dialog" role="dialog" aria-modal="true" aria-labelledby="personnel-file-export-title">
        <div className="portal-modal-heading">
          <div><span>Official personnel file release</span><h2 id="personnel-file-export-title">{labels[kind]}</h2></div>
          <button onClick={onClose} type="button" aria-label="Close">×</button>
        </div>
        <p className="personnel-export-subject"><strong>{displayName}</strong> · {personnelId}{rank ? ` · ${rank}` : ""}</p>
        <label className="portal-call-sign-field">
          {openRecords ? "Requesting agency / requester" : "Destination department / agency"}
          <input
            autoFocus
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            maxLength={160}
            placeholder={openRecords ? "Agency, organization, or requesting party" : "Receiving department or agency"}
          />
        </label>
        <div className="personnel-export-notice-preview">
          <strong>{openRecords ? "OPEN RECORDS RELEASE COPY" : `ATTENTION: ${destination.trim() || "[destination department / agency]"}`}</strong>
          <span>This record concerns {displayName}.</span>
          <p>{openRecords
            ? "This version is prepared for open-records/public-records release review. Internal Guardian and administrative-flag material is excluded, and a final releasability/redaction review is still required before disclosure."
            : "This file is for official departmental use and may contain confidential, sensitive, or legally protected information. Public requests must be handled through the applicable open-records/public-records process."}</p>
        </div>
        <div className="portal-modal-actions">
          <button className="portal-button portal-button--secondary" onClick={onClose} type="button">Cancel</button>
          <button className="portal-button portal-button--primary" disabled={destination.trim().length < 2} onClick={createPdf} type="button">Create PDF</button>
        </div>
      </section>
    </div>
  );
}
