import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import "./open-records-admin.css";

const CUSTODIAN_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain", "1st Lieutenant"]);
const FINAL_STATUSES = new Set(["Released", "Denied", "Expired", "Closed"]);

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
    .select("id,request_number,requester_first_name,requester_last_name,requester_discord,requester_organization,subject_name,subject_personnel_id,status,disposition,fee_amount,fee_status,created_at,response_due_at,acknowledged_at")
    .order("created_at", { ascending: false });

  const requests = error ? [] : (data ?? []);
  const openCount = requests.filter((row: any) => !FINAL_STATUSES.has(row.status)).length;
  const newCount = requests.filter((row: any) => row.status === "Submitted").length;
  const paymentCount = requests.filter((row: any) => row.fee_status === "Awaiting Payment").length;
  const overdueCount = requests.filter((row: any) => !row.acknowledged_at && row.response_due_at && new Date(row.response_due_at).getTime() < Date.now()).length;

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration · Records Custodian"
      title="Open Records Requests"
      description="Open the queue, select a request, then complete the custodian workflow on its dedicated request screen."
      actions={<><Link className="portal-button portal-button--secondary" href="/portal/command/administration">Back to Administration</Link><Link className="portal-button portal-button--primary" href="/open-records" target="_blank">Open Public Form</Link></>}
    >
      <div className="deputy-summary-grid command-v2-record-metrics open-records-admin-metrics">
        <article><span>Open requests</span><strong>{String(openCount).padStart(2, "0")}</strong><small>{requests.length} lifetime intake</small></article>
        <article><span>New</span><strong>{String(newCount).padStart(2, "0")}</strong><small>Needs custodian review</small></article>
        <article><span>Awaiting payment</span><strong>{String(paymentCount).padStart(2, "0")}</strong><small>In-city payment hold</small></article>
        <article><span>72h overdue</span><strong>{String(overdueCount).padStart(2, "0")}</strong><small>Initial determination not recorded</small></article>
      </div>

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Records custodian queue</p><h2>{requests.length ? `${requests.length} requests` : "No requests yet"}</h2></div><span>{profile.rank}</span></div>
        {error ? <div className="portal-empty-state"><strong>Open Records Requests could not be loaded.</strong><span>The records queue is temporarily unavailable.</span></div> : null}
        {!error && !requests.length ? <div className="portal-empty-state"><strong>No Open Records Requests have been submitted.</strong><span>New public requests will appear here.</span></div> : null}
        <div className="open-records-admin-list">
          {requests.map((row: any) => {
            const overdue = !row.acknowledged_at && row.response_due_at && new Date(row.response_due_at).getTime() < Date.now();
            const subject = row.subject_name || row.subject_personnel_id
              ? [row.subject_name, row.subject_personnel_id].filter(Boolean).join(" · ")
              : "No specific subject";
            return (
              <Link className="open-records-queue-card" href={`/portal/command/administration/open-records/${row.id}`} key={row.id}>
                <div className="open-records-queue-primary">
                  <span>ORR-{String(row.request_number).padStart(5, "0")}</span>
                  <h3>{row.requester_first_name} {row.requester_last_name}</h3>
                  <p>{row.requester_discord ? `Discord: ${row.requester_discord}` : "Discord not recorded"}{row.requester_organization ? ` · ${row.requester_organization}` : ""}</p>
                  <small>{subject}</small>
                </div>
                <div className="open-records-queue-status">
                  <b>{row.status}</b>
                  <span>{row.disposition}</span>
                  <small className={overdue ? "is-overdue" : ""}>72h due {shortDate(row.response_due_at)}</small>
                  <small>{money(row.fee_amount)} · {row.fee_status}</small>
                </div>
                <div className="open-records-queue-open">Open Request <span aria-hidden="true">→</span></div>
              </Link>
            );
          })}
        </div>
      </section>
    </PortalShell>
  );
}
