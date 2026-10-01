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

function exportFilename(header: string | null, fallback: string) {
  if (!header) return fallback;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try { return decodeURIComponent(encoded[1].replace(/["']/g, "")); } catch {}
  }
  const simple = /filename="?([^";]+)"?/i.exec(header);
  return simple?.[1]?.trim() || fallback;
}

export function PersonnelFileExportDialog({ personnelId, displayName, rank, initialKind = "internal", onClose }: Props) {
  const [kind, setKind] = useState<PersonnelFileExportKind>(initialKind);
  const [destination, setDestination] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  const openRecords = kind === "open-records";
  const destinationLabel = openRecords ? "Requesting party / ORR reference" : "Destination department / agency";
  const destinationPlaceholder = openRecords ? "Requester, organization, or ORR-00000" : "Receiving department or agency";

  useEffect(() => {
    setKind(initialKind);
    setDestination("");
    setExportError("");
    setExportNotice("");
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

  async function createPdf() {
    if (destination.trim().length < 2 || exporting) return;
    setExporting(true);
    setExportError("");
    setExportNotice("");
    try {
      const wireExportType = kind === "internal" ? "normal" : kind;
      const query = new URLSearchParams({
        exportType: wireExportType,
        recipient: destination.trim(),
        sections: sectionsByKind[kind],
      });
      const response = await fetch(`/api/portal/personnel/${encodeURIComponent(personnelId)}/record-export?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "The personnel file could not be generated.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exportFilename(response.headers.get("content-disposition"), `${personnelId}-${kind}-personnel-file.pdf`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportNotice("Personnel file created. Your PDF download has started.");
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : "The personnel file could not be generated.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="portal-modal-backdrop personnel-export-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !exporting) onClose(); }}>
      <section className="portal-modal personnel-export-dialog" role="dialog" aria-modal="true" aria-labelledby="personnel-file-export-title">
        <div className="portal-modal-heading personnel-export-heading">
          <div><span>Official personnel file release</span><h2 id="personnel-file-export-title">Export Personnel File</h2></div>
          <button disabled={exporting} onClick={onClose} type="button" aria-label="Close">×</button>
        </div>

        <p className="personnel-export-subject"><strong>{displayName}</strong> · {personnelId}{rank ? ` · ${rank}` : ""}</p>

        <fieldset className="personnel-export-types" disabled={exporting}>
          <legend>File type</legend>
          <div className="personnel-export-type-grid">
            {(Object.keys(labels) as PersonnelFileExportKind[]).map((option) => (
              <button aria-pressed={kind === option} className={kind === option ? "is-active" : ""} key={option} onClick={() => setKind(option)} type="button">
                <span>{shortLabels[option]}</span><strong>{labels[option]}</strong>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="personnel-export-profile"><strong>Selected release profile</strong><p>{profileDescriptions[kind]}</p></div>

        <label className="personnel-export-destination">
          <span>{destinationLabel}</span>
          <input autoFocus disabled={exporting} value={destination} onChange={(event) => setDestination(event.target.value)} maxLength={160} placeholder={destinationPlaceholder} />
        </label>

        <div className="personnel-export-notice-preview">
          <strong>{notice.title}</strong>
          <span>{destination.trim() ? `Prepared for: ${destination.trim()}` : `Prepared for: [${destinationPlaceholder}]`}</span>
          <span>This record concerns {displayName}.</span>
          <p>{notice.body}</p>
        </div>

        {openRecords ? <div className="personnel-export-ocsa-preview"><strong>Open Records authority</strong><span>{SAN_ANDREAS_OPEN_RECORDS_CITATION}</span><p>{SAN_ANDREAS_EXEMPTION_RULE}</p></div> : null}
        {exportError ? <div className="portal-form-error" role="alert">{exportError}</div> : null}
        {exportNotice ? <div className="portal-form-success" role="status"><strong>Export complete</strong><span>{exportNotice}</span></div> : null}

        <div className="portal-modal-actions personnel-export-actions">
          <button className="portal-button portal-button--secondary" disabled={exporting} onClick={onClose} type="button">{exportNotice ? "Close" : "Cancel"}</button>
          <button className="portal-button portal-button--primary" disabled={exporting || destination.trim().length < 2} onClick={() => void createPdf()} type="button">{exporting ? "Creating PDF…" : `Create ${shortLabels[kind]} PDF`}</button>
        </div>
      </section>
    </div>
  );
}
