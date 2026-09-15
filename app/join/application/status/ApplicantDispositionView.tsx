import Image from "next/image";
import Link from "next/link";
import type { ApplicantMessage, ApplicantStatusRecord } from "./ApplicantStatusView";
import { LocalDateTime } from "./[token]/LocalDateTime";

function applicationLabel(number: number | string) {
  return `APP-${String(number).padStart(4, "0")}`;
}

function dispositionOutcome(record: ApplicantStatusRecord) {
  const closureCode = String(record.closure_code ?? "").trim();
  if (closureCode) return closureCode;
  if (record.interview_status === "No Show") return "Interview No Show";
  if (record.interview_status === "Failed") return "Interview Failed";
  if (record.offer_status === "Expired") return "Employment Offer Expired";
  if (record.offer_status === "Terminated") return "Employment Offer Terminated";
  if (record.status === "Denied") return "Application Denied";
  if (record.status === "Withdrawn") return "Application Withdrawn";
  return "Selection Process Closed";
}

function dispositionReason(record: ApplicantStatusRecord) {
  const reason = String(record.closure_reason ?? "").trim();
  if (reason) return reason;
  if (record.interview_status === "No Show") return "The selection process was closed because the applicant did not attend the required scheduled interview.";
  if (record.interview_status === "Failed") return "The selection process was closed because the required interview was not successfully completed.";
  if (record.offer_status === "Expired") return "The employment offer expired before acceptance was completed.";
  if (record.offer_status === "Terminated") return "The employment offer was terminated and the recruitment process was closed.";
  if (record.status === "Denied") return "The applicant was not selected to continue in the LSCSO recruitment process.";
  if (record.status === "Withdrawn") return "The application was withdrawn and is no longer active in the LSCSO recruitment process.";
  return "This recruitment process has been closed and no further action is available on this application.";
}

export function ApplicantDispositionView({
  record,
  applicantMessages,
}: {
  record: ApplicantStatusRecord;
  applicantMessages: ApplicantMessage[];
}) {
  const outcome = dispositionOutcome(record);
  const reason = dispositionReason(record);
  const communication = String(record.applicant_status_message ?? "").trim();

  return (
    <main className="application-status-page application-disposition-page">
      <section className="application-status-hero application-disposition-hero">
        <div className="site-shell">
          <article className="application-disposition-document">
            <header className="application-disposition-header">
              <div className="application-disposition-agency">
                <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={132} height={132} priority />
                <div>
                  <p>Los Santos County Sheriff&apos;s Office</p>
                  <span>Careers &amp; Recruitment</span>
                </div>
              </div>
              <div className="application-disposition-classification">
                <span>Private applicant record</span>
                <strong>{applicationLabel(record.application_number)}</strong>
              </div>
            </header>

            <section className="application-disposition-titleblock">
              <p>Final Disposition</p>
              <h1>{outcome}</h1>
              <span>This private record constitutes the formal disposition of this application.</span>
            </section>

            <section className="application-disposition-facts" aria-label="Disposition details">
              <article><span>Applicant</span><strong>{record.applicant_name || "LSCSO Applicant"}</strong></article>
              <article><span>Application</span><strong>{applicationLabel(record.application_number)}</strong></article>
              <article><span>Application status</span><strong>{record.status}</strong></article>
              <article><span>Interview status</span><strong>{record.interview_status || "Not applicable"}</strong></article>
              <article><span>Effective / recorded</span><strong><LocalDateTime value={record.updated_at} /></strong></article>
              <article><span>Application submitted</span><strong><LocalDateTime value={record.submitted_at} /></strong></article>
            </section>

            <section className="application-disposition-finding">
              <span>Disposition finding</span>
              <h2>{outcome}</h2>
              <p>{reason}</p>
            </section>

            {communication ? (
              <section className="application-disposition-communication">
                <span>Final communication</span>
                <h2>Notice to applicant</h2>
                <p>{communication}</p>
              </section>
            ) : null}

            {record.interview_scheduled_at ? (
              <section className="application-disposition-recordline">
                <span>Scheduled interview</span>
                <strong><LocalDateTime value={record.interview_scheduled_at} /></strong>
              </section>
            ) : null}

            {applicantMessages.length ? (
              <section className="application-disposition-history" aria-label="Recruitment communications">
                <div className="application-disposition-section-heading">
                  <div><span>Communication record</span><h2>Messages from LSCSO Recruitment</h2></div>
                  <strong>{applicantMessages.length} {applicantMessages.length === 1 ? "message" : "messages"}</strong>
                </div>
                <div>
                  {applicantMessages.map((item) => (
                    <article key={item.id}>
                      <header><strong>LSCSO Recruitment</strong><span><LocalDateTime value={item.sent_at} /></span></header>
                      <p>{item.content}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <footer className="application-disposition-footer">
              <div>
                <span>Disposition status</span>
                <strong>Closed · Final for this application</strong>
                <p>This page is accessible only through the applicant&apos;s private tracking link. Internal Command notes and protected personnel information are not displayed.</p>
              </div>
              <Link className="button button--outline" href="/join">Return to Join LSCSO</Link>
            </footer>
          </article>
        </div>
      </section>
    </main>
  );
}
