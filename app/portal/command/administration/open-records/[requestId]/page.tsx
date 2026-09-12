import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "../../../../_components/PortalShell";
import { OpenRecordsCustodianManager } from "../OpenRecordsCustodianManager";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import "../open-records-admin.css";

const CUSTODIAN_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain", "1st Lieutenant"]);

function shortDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not recorded";
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(amount) ? amount : 0);
}

export default async function OpenRecordsRequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !CUSTODIAN_RANKS.has(profile.rank)) redirect("/portal/command/administration");

  const { requestId } = await params;
  const supabase = await createClient() as any;
  const { data: row, error } = await supabase
    .from("open_records_requests")
    .select("id,request_number,requester_first_name,requester_last_name,requester_email,requester_discord,requester_phone,requester_organization,subject_name,subject_personnel_id,records_description,status,disposition,fee_amount,fee_status,payment_reference,internal_notes,response_summary,withholding_authority,created_at,response_due_at,acknowledged_at,payment_confirmed_at,release_available_at,release_expires_at,completed_at")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !row) notFound();

  const { data: fileRows } = await supabase
    .from("open_records_request_files")
    .select("id,request_id,file_name,mime_type,size_bytes,uploaded_at,deleted_at")
    .eq("request_id", row.id)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: true });

  const overdue = !row.acknowledged_at && row.response_due_at && new Date(row.response_due_at).getTime() < Date.now();
  const requestLabel = `ORR-${String(row.request_number).padStart(5, "0")}`;

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration · Records Custodian"
      title={`${requestLabel} · ${row.requester_first_name} ${row.requester_last_name}`}
      description="Dedicated request workspace for review, fee assessment, payment confirmation, records preparation, and final release."
      actions={<Link className="portal-button portal-button--secondary" href="/portal/command/administration/open-records">Back to Request Queue</Link>}
    >
      <div className="deputy-summary-grid command-v2-record-metrics open-records-detail-metrics">
        <article><span>Status</span><strong className="open-records-metric-text">{row.status}</strong><small>{row.disposition}</small></article>
        <article><span>Assessed fee</span><strong className="open-records-metric-text">{money(row.fee_amount)}</strong><small>{row.fee_status}</small></article>
        <article><span>72h response due</span><strong className={`open-records-metric-date ${overdue ? "is-overdue" : ""}`}>{shortDate(row.response_due_at)}</strong><small>{row.acknowledged_at ? `Acknowledged ${shortDate(row.acknowledged_at)}` : "Not yet acknowledged"}</small></article>
        <article><span>Release</span><strong className="open-records-metric-text">{row.release_available_at ? "Published" : "Not published"}</strong><small>{row.release_expires_at ? `Expires ${shortDate(row.release_expires_at)}` : "48-hour window not started"}</small></article>
      </div>

      <section className="portal-panel open-records-request-detail">
        <div className="portal-panel-heading"><div><p>Original request</p><h2>{requestLabel}</h2></div><span>{profile.rank}</span></div>
        <div className="open-records-detail-grid">
          <article className="open-records-detail-request">
            <strong>Records requested</strong>
            <p>{row.records_description}</p>
          </article>
          <div className="open-records-detail-meta">
            <article><span>Requester</span><strong>{row.requester_first_name} {row.requester_last_name}</strong><small>{row.requester_email}</small></article>
            <article><span>Discord</span><strong>{row.requester_discord || "Not recorded"}</strong><small>{row.requester_phone || "No phone provided"}</small></article>
            <article><span>Organization</span><strong>{row.requester_organization || "Not provided"}</strong><small>Received {shortDate(row.created_at)}</small></article>
            <article><span>Subject</span><strong>{row.subject_name || "Not specified"}</strong><small>{row.subject_personnel_id || "No personnel ID"}</small></article>
          </div>
        </div>
      </section>

      <section className="portal-panel open-records-custodian-workspace">
        <div className="portal-panel-heading"><div><p>Custodian workflow</p><h2>Process this request</h2></div></div>
        <OpenRecordsCustodianManager request={{
          id: row.id,
          requestNumber: row.request_number,
          status: row.status,
          disposition: row.disposition,
          feeAmount: Number(row.fee_amount ?? 0),
          feeStatus: row.fee_status,
          responseSummary: row.response_summary ?? "",
          withholdingAuthority: row.withholding_authority ?? "",
          internalNotes: row.internal_notes ?? "",
          paymentReference: row.payment_reference ?? "",
          releaseAvailableAt: row.release_available_at,
          releaseExpiresAt: row.release_expires_at,
          files: fileRows ?? [],
        }} />
      </section>
    </PortalShell>
  );
}
