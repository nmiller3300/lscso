"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const RECENT_KEY = "lscso.command.recent-personnel:v1";
const exportSections = [
  ["career", "Career / service history"],
  ["assignments", "Assignments"],
  ["certifications", "Certifications"],
  ["training", "Training"],
  ["awards", "Awards / recognition"],
  ["guardians", "Guardian record"],
  ["administrative", "Administrative flags"],
] as const;

type PersonnelRecordUtilitiesProps = {
  personnelId: string;
  displayName: string;
};

export function PersonnelRecordUtilities({ personnelId, displayName }: PersonnelRecordUtilitiesProps) {
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [purpose, setPurpose] = useState("Lateral transfer personnel record request");
  const [sections, setSections] = useState<string[]>(exportSections.map(([id]) => id));

  useEffect(() => {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      const recentIds = Array.isArray(recent) ? recent.filter((item) => typeof item === "string") : [];
      localStorage.setItem(RECENT_KEY, JSON.stringify([personnelId, ...recentIds.filter((id) => id !== personnelId)].slice(0, 6)));
    } catch {}
  }, [personnelId]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  function toggleSection(id: string) {
    setSections((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function exportPdf() {
    if (purpose.trim().length < 3 || !sections.length) return;
    const query = new URLSearchParams({ purpose: purpose.trim(), sections: sections.join(",") });
    window.location.href = `/api/portal/personnel/${encodeURIComponent(personnelId)}/record-export?${query.toString()}`;
    setExportOpen(false);
  }

  return (
    <>
      <section className="portal-panel personnel-record-qol" aria-label={`Quick actions for ${displayName}`}>
        <div className="portal-panel-heading">
          <div><p>Common tasks</p><h2>What do you need to do?</h2></div>
          <span>{personnelId}</span>
        </div>
        <div className="personnel-record-qol-actions">
          <Link className="portal-button portal-button--primary" href={`/portal/command/guardians?q=${encodeURIComponent(personnelId)}`}>Create Guardian</Link>
          <button className="portal-button portal-button--secondary" onClick={() => setExportOpen(true)} type="button">Export Personnel PDF</button>
          <Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${personnelId}/documents#send-letter`}>Send welcome letter</Link>
          <Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${personnelId}/administration#assignments`}>Manage assignments</Link>
          <Link className="portal-button portal-button--secondary" href="/portal/command/certifications">Issue certification</Link>
          <button className="portal-button portal-button--secondary" onClick={copyLink} type="button">{copied ? "Copied" : "Copy direct link"}</button>
        </div>
      </section>

      {exportOpen ? <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setExportOpen(false); }}>
        <section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="personnel-export-title">
          <div className="portal-modal-heading"><div><span>Official record release</span><h2 id="personnel-export-title">Export Personnel PDF</h2></div><button onClick={() => setExportOpen(false)} type="button" aria-label="Close">×</button></div>
          <label className="portal-call-sign-field">Release purpose<input value={purpose} onChange={(event) => setPurpose(event.target.value)} maxLength={180} /></label>
          <div className="portal-form-grid" style={{ marginTop: 12 }}>
            {exportSections.map(([id, label]) => <label className="portal-checkbox-row" key={id}><input checked={sections.includes(id)} onChange={() => toggleSection(id)} type="checkbox" /><span><strong>{label}</strong></span></label>)}
          </div>
          <div className="portal-modal-actions"><button className="portal-button portal-button--secondary" onClick={() => setExportOpen(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={purpose.trim().length < 3 || !sections.length} onClick={exportPdf} type="button">Download PDF</button></div>
        </section>
      </div> : null}
    </>
  );
}
