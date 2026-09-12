"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ReleaseFile = { id: string; file_name: string; mime_type: string | null; size_bytes: number; uploaded_at: string };
type RequestRow = {
  id: string;
  requestNumber: number;
  status: string;
  disposition: string;
  feeAmount: number;
  feeStatus: string;
  responseSummary: string;
  withholdingAuthority: string;
  internalNotes: string;
  paymentReference: string;
  releaseAvailableAt: string | null;
  releaseExpiresAt: string | null;
  files: ReleaseFile[];
};

const reviewStages = ["Under Initial Review", "Records Collection", "Redaction & Legal Review", "Ready for Release"];
const dispositions = ["Pending", "Granted", "Partially Granted", "Denied"];

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function OpenRecordsCustodianManager({ request }: { request: RequestRow }) {
  const router = useRouter();
  const [status, setStatus] = useState(reviewStages.includes(request.status) ? request.status : "Under Initial Review");
  const [disposition, setDisposition] = useState(request.disposition || "Pending");
  const [feeAmount, setFeeAmount] = useState(String(request.feeAmount ?? 0));
  const [paymentReference, setPaymentReference] = useState(request.paymentReference);
  const [responseSummary, setResponseSummary] = useState(request.responseSummary);
  const [withholdingAuthority, setWithholdingAuthority] = useState(request.withholdingAuthority);
  const [internalNotes, setInternalNotes] = useState(request.internalNotes);
  const [files, setFiles] = useState<ReleaseFile[]>(request.files);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function action(name: string, extra: Record<string, unknown> = {}) {
    setBusy(name);
    setMessage("");
    try {
      const response = await fetch(`/api/portal/open-records/${encodeURIComponent(request.id)}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: name, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The Records Custodian action could not be completed.");
      setMessage("Saved");
      router.refresh();
      window.setTimeout(() => setMessage(""), 1800);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The Records Custodian action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("upload");
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/portal/open-records/${encodeURIComponent(request.id)}/files`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The release file could not be uploaded.");
      setFiles((current) => [...current, data.file]);
      setMessage("File uploaded");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The release file could not be uploaded.");
    } finally {
      setBusy("");
    }
  }

  async function removeFile(fileId: string) {
    setBusy(`delete-${fileId}`);
    setMessage("");
    try {
      const response = await fetch(`/api/portal/open-records/${encodeURIComponent(request.id)}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The release file could not be removed.");
      setFiles((current) => current.filter((file) => file.id !== fileId));
      setMessage("File removed");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The release file could not be removed.");
    } finally {
      setBusy("");
    }
  }

  const finalState = ["Released", "Denied", "Expired", "Closed"].includes(request.status);
  const paymentReady = request.feeStatus === "Paid" || request.feeStatus === "Waived" || request.feeAmount === 0;

  return (
    <div className="open-records-custodian-controls">
      <section className="open-records-custodian-section">
        <div><span>Step 1</span><strong>Acknowledge & assess</strong></div>
        <div className="open-records-custodian-action-row">
          <button className="portal-button portal-button--secondary" type="button" disabled={Boolean(busy) || finalState || request.status !== "Submitted"} onClick={() => void action("acknowledge")}>Acknowledge Request</button>
          <label className="open-records-fee-field"><span>Processing fee</span><input type="number" min="0" step="0.01" value={feeAmount} onChange={(event) => setFeeAmount(event.target.value)} /></label>
          <button className="portal-button portal-button--secondary" type="button" disabled={Boolean(busy) || finalState} onClick={() => void action("assess_fee", { fee_amount: feeAmount })}>Assess / Waive Fee</button>
        </div>
        <p className="command-v2-compact-copy">Current: ${Number(request.feeAmount ?? 0).toFixed(2)} · {request.feeStatus}. A non-zero assessed fee places the request on hold until in-city payment is confirmed.</p>
      </section>

      <section className="open-records-custodian-section">
        <div><span>Step 2</span><strong>Confirm in-city payment</strong></div>
        <div className="open-records-custodian-action-row">
          <label className="open-records-payment-field"><span>Payment / city reference</span><input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} maxLength={240} placeholder="Optional transaction or receipt reference" /></label>
          <button className="portal-button portal-button--secondary" type="button" disabled={Boolean(busy) || finalState || request.feeStatus !== "Awaiting Payment"} onClick={() => void action("confirm_payment", { payment_reference: paymentReference })}>Confirm Payment</button>
        </div>
      </section>

      <section className="open-records-custodian-section">
        <div><span>Step 3</span><strong>Collection, redaction & legal review</strong></div>
        <div className="open-records-custodian-grid">
          <label>Review stage<select value={status} onChange={(event) => setStatus(event.target.value)}>{reviewStages.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Disposition<select value={disposition} onChange={(event) => setDisposition(event.target.value)}>{dispositions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="is-wide">Requester-facing response / release summary<textarea value={responseSummary} onChange={(event) => setResponseSummary(event.target.value)} rows={3} maxLength={8000} placeholder="What is being produced, what remains pending, or what was withheld?" /></label>
          <label className="is-wide">Legal authority for withholding / redaction<textarea value={withholdingAuthority} onChange={(event) => setWithholdingAuthority(event.target.value)} rows={2} maxLength={4000} placeholder="Required for partial grants and denials. Cite OCSA and/or applicable Georgia reference." /></label>
          <label className="is-wide">Internal custodian notes<textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows={3} maxLength={8000} placeholder="Internal only. Never displayed to the requester." /></label>
        </div>
        <div className="open-records-custodian-action-row"><button className="portal-button portal-button--primary" type="button" disabled={Boolean(busy) || finalState} onClick={() => void action("save_review", { status, disposition, response_summary: responseSummary, withholding_authority: withholdingAuthority, internal_notes: internalNotes })}>Save Custodian Review</button><button className="portal-button portal-button--secondary" type="button" disabled={Boolean(busy) || finalState} onClick={() => void action("deny", { response_summary: responseSummary, withholding_authority: withholdingAuthority, internal_notes: internalNotes })}>Deny Request</button></div>
      </section>

      <section className="open-records-custodian-section">
        <div><span>Step 4</span><strong>Stage approved release files</strong></div>
        <p className="command-v2-compact-copy">Files may be uploaded only after an assessed fee is paid or waived. Each file is limited to 25 MB and remains private until the custodian publishes the release.</p>
        <label className={`portal-button portal-button--secondary open-records-upload-button ${!paymentReady || finalState ? "is-disabled" : ""}`}>Upload Release File<input type="file" disabled={!paymentReady || finalState || Boolean(busy)} onChange={(event) => void upload(event)} accept=".pdf,.jpg,.jpeg,.png,.txt,.csv,.zip,.docx,.xlsx" /></label>
        {files.length ? <div className="open-records-staged-files">{files.map((file) => <article key={file.id}><span><strong>{file.file_name}</strong><small>{file.mime_type || "File"} · {bytes(file.size_bytes)}</small></span><button type="button" disabled={Boolean(busy) || finalState} onClick={() => void removeFile(file.id)}>{busy === `delete-${file.id}` ? "Removing…" : "Remove"}</button></article>)}</div> : <div className="portal-empty-state"><strong>No release files staged.</strong><span>Upload the final redacted files that are approved for requester access.</span></div>}
      </section>

      <section className="open-records-custodian-section open-records-release-section">
        <div><span>Step 5</span><strong>Publish the 48-hour release</strong></div>
        <p className="command-v2-compact-copy">Publishing creates secure download links, starts the 48-hour expiration window, records the releasing custodian, and makes the approved files visible on the requester’s private tracking page.</p>
        <div className="open-records-custodian-action-row"><button className="portal-button portal-button--primary" type="button" disabled={Boolean(busy) || finalState || !paymentReady || !files.length || !["Granted", "Partially Granted"].includes(disposition)} onClick={() => void action("release", { disposition, response_summary: responseSummary, withholding_authority: withholdingAuthority })}>{busy === "release" ? "Publishing…" : "Publish Release Files"}</button>{request.releaseAvailableAt ? <span>Released · expires {request.releaseExpiresAt ? new Date(request.releaseExpiresAt).toLocaleString() : "after 48 hours"}</span> : null}</div>
      </section>

      {message ? <p className={`open-records-custodian-message ${message === "Saved" || message.includes("uploaded") || message.includes("removed") ? "is-success" : ""}`} role="status">{message}</p> : null}
    </div>
  );
}
