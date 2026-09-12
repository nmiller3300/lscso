import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { OpenRecordsRequestManager } from "./OpenRecordsRequestManager";
import {
  GEORGIA_OPEN_RECORDS_CITATION,
  GEORGIA_RESPONSE_RULE,
  SAN_ANDREAS_OPEN_RECORDS_CITATION,
  SAN_ANDREAS_RESPONSE_RULE,
} from "@/lib/open-records/legal";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import "./open-records-admin.css";

function shortDate(value: string) {
  return new Date(value).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function OpenRecordsAdministrationPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");

  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from("open_records_requests")
    .select("id,request_number,requester_first_name,requester_last_name,requester_email,requester_phone,requester_organization,subject_name,subject_personnel_id,records_description,preferred_delivery,status,internal_notes,response_summary,created_at,acknowledged_at,completed_at")
    .order("created_at", { ascending: false });

  const requests = error ? [] : (data ?? []);
  const openCount = requests.filter((row: any) => !["Completed", "Closed", "Denied"].includes(row.status)).length;
  const submittedCount = requests.filter((row: any) => row.status === "Submitted").length;

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration · Public Records"
      title="Open Records Requests"
      description="Receive, review, document, and close public records requests while preserving the applicable legal basis for production, withholding, and redaction."
      actions={<><Link className="portal-button portal-button--secondary" href="/portal/command/administration">Back to Administration</Link><Link className="portal-button portal-button--primary" href="/open-records" target="_blank">Open Public Form</Link></>}
    >
      <div className="deputy-summary-grid command-v2-record-metrics open-records-admin-metrics">
        <article><span>Total requests</span><strong>{String(requests.length).padStart(2, "0")}</strong><small>Permanent intake</small></article>
        <article><span>Open</span><strong>{String(openCount).padStart(2, "0")}</strong><small>Not completed</small></article>
        <article><span>New</span><strong>{String(submittedCount).padStart(2, "0")}</strong><small>Needs acknowledgment</small></article>
      </div>

      <section className="portal-panel open-records-admin-law">
        <div className="portal-panel-heading"><div><p>Custodian standard</p><h2>Legal framework</h2></div></div>
        <div className="open-records-admin-law-grid">
          <article><strong>United States · Georgia</strong><span>{GEORGIA_OPEN_RECORDS_CITATION}</span><p>{GEORGIA_RESPONSE_RULE}</p></article>
          <article><strong>State of San Andreas · RP analog</strong><span>{SAN_ANDREAS_OPEN_RECORDS_CITATION}</span><p>{SAN_ANDREAS_RESPONSE_RULE}</p></article>
        </div>
        <p className="command-v2-compact-copy">A three-business-day rule is not a blanket command to release every requested document within three days. Available records should be produced promptly; when review takes longer, the custodian should timely describe the responsive records, give the expected production timeline/cost where applicable, and cite the specific legal basis for any withholding or redaction.</p>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Records custodian queue</p><h2>{requests.length ? `${requests.length} requests` : "No requests yet"}</h2></div></div>
        {error ? <div className="portal-empty-state"><strong>Open records requests could not be loaded.</strong><span>The database migration may still need to be applied.</span></div> : null}
        {!error && !requests.length ? <div className="portal-empty-state"><strong>No public open records requests have been submitted.</strong><span>New requests from the public website will appear here.</span></div> : null}
        <div className="open-records-admin-list">
          {requests.map((row: any) => (
            <article className="open-records-admin-request" key={row.id}>
              <header>
                <div><span>ORR-{String(row.request_number).padStart(5, "0")}</span><h3>{row.requester_first_name} {row.requester_last_name}</h3><p>{row.requester_organization || "Individual requester"} · {row.requester_email}{row.requester_phone ? ` · ${row.requester_phone}` : ""}</p></div>
                <div><b>{row.status}</b><small>Received {shortDate(row.created_at)}</small>{row.acknowledged_at ? <small>Acknowledged {shortDate(row.acknowledged_at)}</small> : <small>Three-business-day response rule pending</small>}</div>
              </header>
              <div className="open-records-admin-request-body">
                <div><strong>Requested records</strong><p>{row.records_description}</p></div>
                <div className="open-records-admin-request-meta">
                  <span><b>Subject</b>{row.subject_name || "Not specified"}{row.subject_personnel_id ? ` · ${row.subject_personnel_id}` : ""}</span>
                  <span><b>Delivery</b>{row.preferred_delivery}</span>
                </div>
              </div>
              <OpenRecordsRequestManager request={{ id: row.id, requestNumber: row.request_number, status: row.status, internalNotes: row.internal_notes ?? "", responseSummary: row.response_summary ?? "" }} />
            </article>
          ))}
        </div>
      </section>
    </PortalShell>
  );
}
