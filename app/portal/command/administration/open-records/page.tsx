import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { OpenRecordsCustodianManager } from "./OpenRecordsCustodianManager";
import {
  GEORGIA_OPEN_RECORDS_CITATION,
  GEORGIA_RESPONSE_RULE,
  SAN_ANDREAS_CUSTODIAN_RULE,
  SAN_ANDREAS_OPEN_RECORDS_CITATION,
  SAN_ANDREAS_RESPONSE_RULE,
} from "@/lib/open-records/legal";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import "./open-records-admin.css";

const CUSTODIAN_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain", "1st Lieutenant"]);

function shortDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not recorded";
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(amount) ? amount : 0);
}

export default async function OpenRecordsAdministrationPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !CUSTODIAN_RANKS.has(profile.rank)) redirect("/portal/command/administration");

  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from("open_records_requests")
    .select("id,request_number,requester_first_name,requester_last_name,requester_email,requester_discord,requester_phone,requester_organization,subject_name,subject_personnel_id,records_description,status,disposition,fee_amount,fee_status,payment_reference,internal_notes,response_summary,withholding_authority,created_at,response_due_at,acknowledged_at,payment_confirmed_at,release_available_at,release_expires_at,completed_at")
    .order("created_at", { ascending: false });

  const requests = error ? [] : (data ?? []);
  const { data: fileRows } = requests.length
    ? await supabase.from("open_records_request_files").select("id,request_id,file_name,mime_type,size_bytes,uploaded_at,deleted_at").in("request_id", requests.map((row: any) => row.id)).is("deleted_at", null).order("uploaded_at", { ascending: true })
    : { data: [] };

  const filesByRequest = new Map<string, any[]>();
  for (const file of fileRows ?? []) filesByRequest.set(file.request_id, [...(filesByRequest.get(file.request_id) ?? []), file]);

  const openCount = requests.filter((row: any) => !["Released", "Denied", "Expired", "Closed"].includes(row.status)).length;
  const newCount = requests.filter((row: any) => row.status === "Submitted").length;
  const paymentCount = requests.filter((row: any) => row.fee_status === "Awaiting Payment").length;
  const overdueCount = requests.filter((row: any) => !row.acknowledged_at && row.response_due_at && new Date(row.response_due_at).getTime() < Date.now()).length;

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration · Records Custodian"
      title="Open Records Requests"
      description="First Lieutenant+ workspace for statutory response, fee assessment, payment confirmation, collection, redaction, release, and permanent request history."
      actions={<><Link className="portal-button portal-button--secondary" href="/portal/command/administration">Back to Administration</Link><Link className="portal-button portal-button--primary" href="/open-records" target="_blank">Open Public Form</Link></>}
    >
      <div className="deputy-summary-grid command-v2-record-metrics open-records-admin-metrics">
        <article><span>Open requests</span><strong>{String(openCount).padStart(2, "0")}</strong><small>{requests.length} lifetime intake</small></article>
        <article><span>New</span><strong>{String(newCount).padStart(2, "0")}</strong><small>Needs custodian review</small></article>
        <article><span>Awaiting payment</span><strong>{String(paymentCount).padStart(2, "0")}</strong><small>In-city payment hold</small></article>
        <article><span>72h overdue</span><strong>{String(overdueCount).padStart(2, "0")}</strong><small>Initial determination not recorded</small></article>
      </div>

      <section className="portal-panel open-records-admin-law">
        <div className="portal-panel-heading"><div><p>Custodian standard</p><h2>Governing framework</h2></div><span>{profile.rank}</span></div>
        <div className="open-records-admin-law-grid">
          <article><strong>United States · Georgia</strong><span>{GEORGIA_OPEN_RECORDS_CITATION}</span><p>{GEORGIA_RESPONSE_RULE}</p></article>
          <article><strong>State of San Andreas · OCSA</strong><span>{SAN_ANDREAS_OPEN_RECORDS_CITATION}</span><p>{SAN_ANDREAS_RESPONSE_RULE}</p></article>
        </div>
        <p className="command-v2-compact-copy">{SAN_ANDREAS_CUSTODIAN_RULE} Original requester content is preserved; custodians add only workflow, fee, payment, legal-review, and release information.</p>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Records custodian queue</p><h2>{requests.length ? `${requests.length} requests` : "No requests yet"}</h2></div></div>
        {error ? <div className="portal-empty-state"><strong>Open Records Requests could not be loaded.</strong><span>The Open Records database migrations may still need to be applied.</span></div> : null}
        {!error && !requests.length ? <div className="portal-empty-state"><strong>No Open Records Requests have been submitted.</strong><span>New public requests will appear here.</span></div> : null}
        <div className="open-records-admin-list">
          {requests.map((row: any) => {
            const overdue = !row.acknowledged_at && row.response_due_at && new Date(row.response_due_at).getTime() < Date.now();
            return (
              <article className="open-records-admin-request" key={row.id}>
                <header>
                  <div><span>ORR-{String(row.request_number).padStart(5, "0")}</span><h3>{row.requester_first_name} {row.requester_last_name}</h3><p>Discord: {row.requester_discord || "Not recorded"} · {row.requester_email}{row.requester_organization ? ` · ${row.requester_organization}` : ""}</p></div>
                  <div><b>{row.status}</b><small>{row.disposition}</small><small className={overdue ? "is-overdue" : ""}>72h due: {shortDate(row.response_due_at)}</small></div>
                </header>
                <div className="open-records-admin-request-body">
                  <div><strong>Original request</strong><p>{row.records_description}</p></div>
                  <div className="open-records-admin-request-meta">
                    <span><b>Subject</b>{row.subject_name || "Not specified"}{row.subject_personnel_id ? ` · ${row.subject_personnel_id}` : ""}</span>
                    <span><b>Fee</b>{money(row.fee_amount)} · {row.fee_status}</span>
                    <span><b>Received</b>{shortDate(row.created_at)}</span>
                    <span><b>Payment</b>{row.payment_confirmed_at ? `Confirmed ${shortDate(row.payment_confirmed_at)}` : "Not confirmed"}</span>
                    {row.release_available_at ? <span><b>Release</b>{shortDate(row.release_available_at)} · expires {shortDate(row.release_expires_at)}</span> : null}
                  </div>
                </div>
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
                  files: filesByRequest.get(row.id) ?? [],
                }} />
              </article>
            );
          })}
        </div>
      </section>
    </PortalShell>
  );
}
