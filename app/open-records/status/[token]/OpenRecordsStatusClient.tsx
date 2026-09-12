"use client";

import { useEffect, useMemo, useState } from "react";

const OPEN_RECORDS_ACT_URL = "https://lscso-gov.notion.site/San-Andreas-Open-Records-Act-OCSA-50-18-70-Series-3d9305c9558581be90f9e0059e76d13c";

type ReleaseFile = {
  id: string;
  file_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  released_at?: string | null;
  download_url?: string | null;
  deleted_at?: string | null;
};

type RequestStatus = {
  request_number: number;
  requester_name: string;
  requester_discord: string;
  subject_name?: string | null;
  subject_personnel_id?: string | null;
  records_description: string;
  status: string;
  disposition: string;
  created_at: string;
  response_due_at?: string | null;
  acknowledged_at?: string | null;
  fee_amount?: number | string | null;
  fee_status?: string | null;
  response_summary?: string | null;
  withholding_authority?: string | null;
  release_available_at?: string | null;
  release_expires_at?: string | null;
  completed_at?: string | null;
  files?: ReleaseFile[] | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Not yet recorded";
  return new Date(value).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatMoney(value?: number | string | null) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(amount) ? amount : 0);
}

function formatBytes(value?: number | null) {
  const bytes = Number(value ?? 0);
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countdown(expiresAt?: string | null, now = Date.now()) {
  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${hours}h ${minutes}m ${seconds}s remaining`;
}

export function OpenRecordsStatusClient({ request }: { request: RequestStatus }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!request.release_expires_at) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [request.release_expires_at]);

  const releaseCountdown = useMemo(() => countdown(request.release_expires_at, now), [request.release_expires_at, now]);
  const files = Array.isArray(request.files) ? request.files : [];
  const activeFiles = files.filter((file) => file.download_url && !file.deleted_at && releaseCountdown !== "Expired");
  const paymentRequired = Number(request.fee_amount ?? 0) > 0 && request.fee_status !== "Paid" && request.fee_status !== "Waived";

  return (
    <div className="open-records-status-workspace">
      <section className="open-records-status-hero">
        <div>
          <p className="section-kicker section-kicker--dark">Private Request Status</p>
          <h1>ORR-{String(request.request_number).padStart(5, "0")}</h1>
          <p>{request.requester_name} · Discord: {request.requester_discord}</p>
        </div>
        <div className="open-records-status-badge"><span>Status</span><strong>{request.status}</strong><small>{request.disposition}</small></div>
      </section>

      <div className="open-records-status-grid">
        <article><span>Submitted</span><strong>{formatDate(request.created_at)}</strong></article>
        <article><span>72-hour response due</span><strong>{formatDate(request.response_due_at)}</strong><small>{request.acknowledged_at ? `Acknowledged ${formatDate(request.acknowledged_at)}` : "Initial determination pending"}</small></article>
        <article><span>Assessed fee</span><strong>{formatMoney(request.fee_amount)}</strong><small>{request.fee_status || "Not Assessed"}</small></article>
        <article><span>Release window</span><strong>{releaseCountdown || "Not released"}</strong><small>{request.release_expires_at ? `Expires ${formatDate(request.release_expires_at)}` : "48-hour window begins when files are released"}</small></article>
      </div>

      {paymentRequired ? <section className="open-records-status-notice is-payment"><strong>In-city payment required</strong><p>LSCSO has assessed a fee of {formatMoney(request.fee_amount)}. Processing will remain paused until payment is made in city and confirmed by an authorized Records Custodian.</p></section> : null}

      <section className="open-records-status-card">
        <div className="open-records-form-heading"><p className="section-kicker section-kicker--dark">Original Request</p><h2>Records requested</h2></div>
        {(request.subject_name || request.subject_personnel_id) ? <p className="open-records-status-subject"><strong>Subject:</strong> {request.subject_name || "Not specified"}{request.subject_personnel_id ? ` · ${request.subject_personnel_id}` : ""}</p> : null}
        <p className="open-records-status-description">{request.records_description}</p>
      </section>

      {(request.response_summary || request.withholding_authority) ? <section className="open-records-status-card">
        <div className="open-records-form-heading"><p className="section-kicker section-kicker--dark">Custodian Determination</p><h2>Release decision</h2></div>
        {request.response_summary ? <p>{request.response_summary}</p> : null}
        {request.withholding_authority ? <div className="open-records-status-legal"><strong>Withholding / redaction authority</strong><p>{request.withholding_authority}</p></div> : null}
      </section> : null}

      {request.release_available_at ? <section className="open-records-status-card open-records-status-release">
        <div className="open-records-form-heading"><p className="section-kicker section-kicker--dark">Electronic Release</p><h2>{releaseCountdown === "Expired" ? "Release window expired" : "Your released records"}</h2></div>
        <p>Released {formatDate(request.release_available_at)}. Temporary release copies remain available for 48 hours and are then removed from active release storage.</p>
        {activeFiles.length ? <div className="open-records-download-list">{activeFiles.map((file) => <a href={file.download_url!} key={file.id} target="_blank" rel="noreferrer"><span><strong>{file.file_name}</strong><small>{[file.mime_type, formatBytes(file.size_bytes)].filter(Boolean).join(" · ")}</small></span><b>Download</b></a>)}</div> : <div className="open-records-status-notice"><strong>{releaseCountdown === "Expired" ? "Files are no longer available." : "No downloadable release files are currently available."}</strong><p>{releaseCountdown === "Expired" ? "The 48-hour release window has ended. The permanent request history remains on file, but temporary release copies are removed from active storage." : "If LSCSO has marked this request released, refresh this page after the files finish publishing."}</p></div>}
      </section> : null}

      <div className="open-records-status-actions">
        <a className="button button--outline" href={OPEN_RECORDS_ACT_URL} target="_blank" rel="noreferrer">View Open Records Act</a>
      </div>
    </div>
  );
}
