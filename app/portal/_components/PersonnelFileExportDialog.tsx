"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SAN_ANDREAS_EXEMPTION_RULE,
  SAN_ANDREAS_OPEN_RECORDS_CITATION,
} from "@/lib/open-records/legal";

export type PersonnelFileExportKind = "internal" | "lateral" | "open-records";

const sectionsByKind: Record<PersonnelFileExportKind, string> = {
  internal: "career,assignments,certifications,training,awards,guardians,administrative",
  lateral: "career,assignments,certifications,training,awards,guardians",
  "open-records": "career,assignments,certifications,training,awards",
};

const labels: Record<PersonnelFileExportKind, string> = {
  internal: "Internal Personnel File",
  lateral: "Lateral Transfer Personnel File",
  "open-records": "Open Records Request Personnel File",
};

const shortLabels: Record<PersonnelFileExportKind, string> = {
  internal: "Internal",
  lateral: "Lateral Transfer",
  "open-records": "Open Records Request",
};

const profileDescriptions: Record<PersonnelFileExportKind, string> = {
  internal: "Full LSCSO internal personnel record. Includes service history, assignments, training, certifications, recognition, finalized Guardian/accountability history, administrative flags, probation details, supervisory information, and internal classification data.",
  lateral: "Authorized inter-agency employment/background packet. Includes service history, assignments, training, certifications, recognition, and finalized accountability history while excluding internal administrative flags and Portal/access-control metadata.",
  "open-records": "Public-release review copy. Excludes Guardian/accountability material, administrative flags, internal access data, and internal narrative notes. Final Records Custodian redaction and releasability review is still required before disclosure.",
};

type Props = {
  personnelId: string;
  displayName: string;
  rank?: string;
  initialKind?: PersonnelFileExportKind;
  onClose: () => void;
};

export function PersonnelFileExportDialog({ personnelId, displayName, rank, initialKind = "internal", onClose }: Props) {
  const [kind, setKind] = useState<PersonnelFileExportKind>(initialKind);
  const [destination, setDestination] = useState("");
  const openRecords = kind === "open-records";
  const destinationLabel = openRecords ? "Requesting party / ORR reference" : "Destination department / agency";
  const destinationPlaceholder = openRecords ? "Requester, organization, or ORR-00000" : "Receiving department or agency";

  useEffect(() => {
    setKind(initialKind);
    setDestination("");
  }, [initialKind, personnelId]);

  const notice = useMemo(() => {
    if (kind === "internal") {
      return {
        title: "INTERNAL PERSONNEL FILE",
        body: "Official LSCSO departmental personnel record. This export may contain confidential, sensitive, accountability, administrative, probation, and access-classification information and is not approved for public release.",
      };
    }
    if (kind === "lateral") {
      return {
        title: "LATERAL TRANSFER PERSONNEL FILE",
        body: "Prepared for authorized inter-agency employment or background review. Internal administrative flags and Portal/access-control metadata are excluded from this profile.",
      };
    }
    return {
      title: "OPEN RECORDS RELEASE COPY",
      body: "Prepared for OCSA open-records review. A Records Custodian must complete final redaction and releasability review before any external disclosure.",
    };
  }, [kind]);

  function createPdf() {
    if (destination.trim().length < 2) return;
    const wireExportType = kind === "internal" ? "normal" : kind;
    const query = new URLSearchParams({
      exportType: wireExportType,
      recipient: destination.trim(),
      sections: sectionsByKind[kind],
    });
    window.location.href = `/api/portal/personnel/${encodeURIComponent(personnelId)}/record-export?${query.toString()}`;
    onClose();
  }

  return (
    <div className="portal-modal-backdrop personnel-export-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="portal-modal personnel-export-dialog" role="dialog" aria-modal="true" aria-labelledby="personnel-file-export-title">
        <div className="portal-modal-heading personnel-export-heading">
          <div><span>Official personnel file release</span><h2 id="personnel-file-export-title">Export Personnel File</h2></div>
          <button onClick={onClose} type="button" aria-label="Close">×</button>
        </div>

        <p className="personnel-export-subject"><strong>{displayName}</strong> · {personnelId}{rank ? ` · ${rank}` : ""}</p>

        <fieldset className="personnel-export-types">
          <legend>File type</legend>
          <div className="personnel-export-type-grid">
            {(Object.keys(labels) as PersonnelFileExportKind[]).map((option) => (
              <button
                aria-pressed={kind === option}
                className={kind === option ? "is-active" : ""}
                key={option}
                onClick={() => setKind(option)}
                type="button"
              >
                <span>{shortLabels[option]}</span>
                <strong>{labels[option]}</strong>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="personnel-export-profile"><strong>Selected release profile</strong><p>{profileDescriptions[kind]}</p></div>

        <label className="personnel-export-destination">
          <span>{destinationLabel}</span>
          <input
            autoFocus
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            maxLength={160}
            placeholder={destinationPlaceholder}
          />
        </label>

        <div className="personnel-export-notice-preview">
          <strong>{notice.title}</strong>
          <span>{destination.trim() ? `Prepared for: ${destination.trim()}` : `Prepared for: [${destinationPlaceholder}]`}</span>
          <span>This record concerns {displayName}.</span>
          <p>{notice.body}</p>
        </div>

        {openRecords ? <div className="personnel-export-ocsa-preview">
          <strong>Open Records authority</strong>
          <span>{SAN_ANDREAS_OPEN_RECORDS_CITATION}</span>
          <p>{SAN_ANDREAS_EXEMPTION_RULE}</p>
        </div> : null}

        <div className="portal-modal-actions personnel-export-actions">
          <button className="portal-button portal-button--secondary" onClick={onClose} type="button">Cancel</button>
          <button className="portal-button portal-button--primary" disabled={destination.trim().length < 2} onClick={createPdf} type="button">Create {shortLabels[kind]} PDF</button>
        </div>
      </section>
    </div>
  );
}
