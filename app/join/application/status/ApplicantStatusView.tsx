import Image from "next/image";
import Link from "next/link";
import {
  formatRecruitmentDateTime,
  normalizeRecruitmentTimeZone,
  recruitmentTimeZoneLabel,
} from "@/lib/recruitment/timezones";
import { EmploymentOfferAcceptance } from "./EmploymentOfferAcceptance";
import { LocalDateTime } from "./[token]/LocalDateTime";

export type ApplicantStatusRecord = {
  application_number: number | string;
  applicant_name: string | null;
  status: string;
  interview_status: string;
  submitted_at: string;
  updated_at: string;
  interview_scheduled_at: string | null;
  applicant_timezone?: string | null;
  interview_timezone?: string | null;
  applicant_status_message: string | null;
  hired: boolean;
  closure_code?: string | null;
  closure_reason?: string | null;
  offer_id?: string | null;
  offer_status?: string | null;
  offer_title?: string | null;
  offer_terms?: string | null;
  offer_rank?: string | null;
  offer_issued_at?: string | null;
  offer_expires_at?: string | null;
  offer_accepted_at?: string | null;
  offer_signature_name?: string | null;
};

export type ApplicantMessage = {
  id: string;
  content: string;
  sent_at: string;
};

type CandidateView = {
  eyebrow: string;
  title: string;
  message: string;
  next: string;
  stage: number;
  tone: "review" | "accepted" | "closed" | "complete";
  actionLabel: string;
};

function applicationLabel(number: number | string) {
  return `APP-${String(number).padStart(4, "0")}`;
}

function publicInterviewStatus(status?: string | null) {
  switch (status) {
    case "Scheduled": return "Scheduled";
    case "Completed": return "Completed · Decision Pending";
    case "Passed": return "Completed · Selected to Advance";
    case "Failed": return "Completed · Not Selected";
    case "No Show": return "Not Attended";
    default: return "Not Scheduled";
  }
}

function viewFor(record: ApplicantStatusRecord): CandidateView {
  const closureCode = String(record.closure_code ?? "").trim();
  const reason = String(record.closure_reason ?? "").trim();

  if (record.hired || record.status === "Hired") {
    return {
      eyebrow: "Appointment complete",
      title: "Appointed to the Los Santos County Sheriff’s Office",
      message: "Your selection process is complete and your LSCSO personnel appointment has been recorded.",
      next: "Follow the portal-access, onboarding, and training instructions provided by LSCSO personnel.",
      stage: 6,
      tone: "complete",
      actionLabel: "Onboarding",
    };
  }

  if (closureCode === "Interview Failed" || record.interview_status === "Failed") {
    return {
      eyebrow: "Interview decision",
      title: "Interview Completed — Not Selected",
      message: reason || "You completed the required interview. After review, LSCSO determined the interview did not meet the standard required to advance in the selection process.",
      next: "No further action is required on this application. This disposition means the interview was completed and a selection decision was made; it does not mean you failed to attend or finish the interview.",
      stage: 4,
      tone: "closed",
      actionLabel: "Final disposition",
    };
  }

  if (closureCode === "Interview No Show" || record.interview_status === "No Show") {
    return {
      eyebrow: "Interview disposition",
      title: "Interview Not Attended — Process Closed",
      message: reason || "The required scheduled interview was not attended, so this selection process was closed.",
      next: "No further action is available on this application unless LSCSO contacts you.",
      stage: 3,
      tone: "closed",
      actionLabel: "Final disposition",
    };
  }

  if (closureCode === "Offer Terminated" || record.offer_status === "Terminated") {
    return {
      eyebrow: "Employment offer closed",
      title: "Employment Offer Terminated — Process Closed",
      message: reason || "Your employment offer was terminated and this recruitment process has been closed.",
      next: "No further action is available on this application unless LSCSO Recruitment contacts you.",
      stage: 5,
      tone: "closed",
      actionLabel: "Final disposition",
    };
  }

  if (record.offer_status === "Expired") {
    return {
      eyebrow: "Employment offer expired",
      title: "Employment Offer Expired",
      message: "The employment offer deadline passed before the offer was accepted.",
      next: "No action is available on the expired offer unless LSCSO Recruitment issues a new offer or contacts you with additional instructions.",
      stage: 5,
      tone: "closed",
      actionLabel: "Offer expired",
    };
  }

  if (record.status === "Denied" || closureCode === "Application Denied") {
    return {
      eyebrow: "Application decision",
      title: "Application Not Selected",
      message: reason || "Your written application was reviewed and was not selected to advance to interview.",
      next: "This application is closed. No further action is required unless LSCSO contacts you.",
      stage: 2,
      tone: "closed",
      actionLabel: "Final disposition",
    };
  }

  if (record.status === "Withdrawn") {
    return {
      eyebrow: "Application withdrawn",
      title: "Application Withdrawn",
      message: "This application was withdrawn and is no longer active in the LSCSO selection process.",
      next: "No further action is available on this application.",
      stage: 2,
      tone: "closed",
      actionLabel: "Closed",
    };
  }

  if (record.status === "Archived" || closureCode) {
    const interviewReached = record.interview_status && record.interview_status !== "Not Scheduled";
    const offerReached = Boolean(record.offer_id || record.offer_status);
    return {
      eyebrow: "Selection process closed",
      title: "Recruitment Process Closed",
      message: reason || "This LSCSO recruitment process has been closed.",
      next: "No further action is available on this application unless LSCSO contacts you.",
      stage: offerReached ? 5 : interviewReached ? 4 : 2,
      tone: "closed",
      actionLabel: "Closed",
    };
  }

  if (record.status === "Accepted") {
    if (record.interview_status === "Passed") {
      if (record.offer_status === "Accepted") {
        return {
          eyebrow: "Employment offer accepted",
          title: "Offer Accepted — Appointment Pending",
          message: "Your interview was completed successfully and your employment offer has been signed and accepted.",
          next: "No further action is required unless LSCSO contacts you. Command must complete the final personnel appointment.",
          stage: 6,
          tone: "accepted",
          actionLabel: "Await appointment",
        };
      }
      if (record.offer_status === "Pending") {
        return {
          eyebrow: "Action required",
          title: "Employment Offer Issued — Signature Required",
          message: "You were selected to advance after the interview and LSCSO has issued an employment offer.",
          next: "Review the employment offer below and sign it before the listed deadline if you wish to accept the appointment.",
          stage: 5,
          tone: "accepted",
          actionLabel: "Review & sign offer",
        };
      }
      return {
        eyebrow: "Interview decision",
        title: "Selected to Advance — Employment Offer Pending",
        message: "Your interview was completed and you were selected to advance to the employment-offer stage.",
        next: "No action is required until LSCSO issues the employment offer. Continue monitoring this page and Discord.",
        stage: 5,
        tone: "accepted",
        actionLabel: "Await offer",
      };
    }

    if (record.interview_status === "Completed") {
      return {
        eyebrow: "Interview complete",
        title: "Interview Completed — Decision Pending",
        message: "Your required interview has been completed. Command has not yet recorded the final selection decision.",
        next: "No action is required while the interview decision is pending. Continue monitoring this page and Discord.",
        stage: 4,
        tone: "review",
        actionLabel: "Await decision",
      };
    }

    if (record.interview_status === "Scheduled") {
      return {
        eyebrow: "Interview scheduled",
        title: "Your LSCSO Interview Is Scheduled",
        message: "Your written application was accepted and you have advanced to the required interview stage.",
        next: "Attend the interview at the official scheduled time shown below and be available in Discord shortly beforehand.",
        stage: 3,
        tone: "accepted",
        actionLabel: "Attend interview",
      };
    }

    return {
      eyebrow: "Advanced to interview",
      title: "Application Accepted — Interview Pending",
      message: "Your written application was accepted. You have advanced to the required interview stage.",
      next: "Wait for LSCSO to schedule your interview. The confirmed date, time, and timezone will appear here once recorded.",
      stage: 3,
      tone: "accepted",
      actionLabel: "Await scheduling",
    };
  }

  if (record.status === "Under Review" || record.status === "Interview") {
    return {
      eyebrow: "Command review",
      title: "Application Under Review",
      message: "Authorized LSCSO personnel are reviewing your written application and submitted responses.",
      next: "No action is required unless LSCSO contacts you for clarification.",
      stage: 2,
      tone: "review",
      actionLabel: "Await review",
    };
  }

  return {
    eyebrow: "Application received",
    title: "Sworn Personnel Application Received",
    message: "Your signed application has been received and entered into the LSCSO recruitment process.",
    next: "Keep this private tracking link and monitor Discord for any follow-up from LSCSO Recruitment.",
    stage: 1,
    tone: "review",
    actionLabel: "Await review",
  };
}

export function ApplicantStatusView({
  record,
  applicantMessages,
  trackingToken,
}: {
  record: ApplicantStatusRecord;
  applicantMessages: ApplicantMessage[];
  trackingToken?: string;
}) {
  const view = viewFor(record);
  const communication = String(record.applicant_status_message ?? "").trim();
  const interviewTimeZone = normalizeRecruitmentTimeZone(record.interview_timezone || record.applicant_timezone);
  const interviewTime = record.interview_scheduled_at
    ? formatRecruitmentDateTime(record.interview_scheduled_at, interviewTimeZone)
    : null;
  const interviewStatus = publicInterviewStatus(record.interview_status);
  const hasInterviewRecord = record.status === "Accepted"
    || record.status === "Hired"
    || ["Scheduled", "Completed", "Passed", "Failed", "No Show"].includes(String(record.interview_status ?? ""))
    || ["Interview Failed", "Interview No Show"].includes(String(record.closure_code ?? ""));
  const showOffer = Boolean(record.offer_id && record.offer_status && record.offer_title && record.offer_terms && record.offer_issued_at);

  const steps = [
    ["01", "Application", "Signed Sworn Personnel application received"],
    ["02", "Command Review", "Written application screening and decision"],
    ["03", "Interview", "Required LSCSO candidate interview"],
    ["04", "Decision", "Interview assessment and selection decision"],
    ["05", "Employment Offer", "Formal offer if selected to advance"],
    ["06", "Appointment", "Final LSCSO personnel appointment"],
  ];

  return (
    <main className="application-status-page attorney-status-page">
      <section className="attorney-candidate-shell">
        <article className={`attorney-candidate-card attorney-candidate-card--${view.tone}`}>
          <header className="attorney-candidate-header">
            <div className="attorney-candidate-agency">
              <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={88} height={88} priority />
              <div>
                <p>Los Santos County Sheriff&apos;s Office</p>
                <strong>Sworn Personnel Recruitment</strong>
                <span>Private candidate portal</span>
              </div>
            </div>
            <div className="attorney-candidate-number"><span>Application</span><strong>{applicationLabel(record.application_number)}</strong></div>
          </header>

          <section className="attorney-candidate-overview">
            <div className="attorney-candidate-overview__copy">
              <span className="attorney-candidate-kicker">{view.eyebrow}</span>
              <h1>{view.title}</h1>
              <p>{view.message}</p>
            </div>
            <aside className="attorney-candidate-action">
              <span>Current action</span>
              <strong>{view.actionLabel}</strong>
              <p>{view.next}</p>
            </aside>
          </section>

          <section className="attorney-candidate-progress candidate-progress--six" aria-label="LSCSO recruitment progress">
            {steps.map(([number, title, description], index) => {
              const stageNumber = index + 1;
              const complete = stageNumber < view.stage || (view.stage === 6 && stageNumber === 6 && view.tone === "complete");
              const current = stageNumber === view.stage && !complete;
              return (
                <article key={number} className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}>
                  <span>{complete ? "✓" : number}</span>
                  <div><strong>{title}</strong><small>{description}</small></div>
                </article>
              );
            })}
          </section>

          {hasInterviewRecord ? (
            <section className="attorney-interview-card">
              <div className="attorney-section-heading">
                <div><span>Interview record</span><h2>LSCSO candidate interview</h2></div>
                <b>{interviewStatus}</b>
              </div>
              <div className="attorney-interview-grid">
                <article>
                  <span>Official scheduled time</span>
                  <strong>{interviewTime || "Not yet scheduled"}</strong>
                  {interviewTime ? <small>This is the interview time recorded by LSCSO.</small> : <small>LSCSO has not recorded an interview time yet.</small>}
                </article>
                <article>
                  <span>Interview timezone</span>
                  <strong>{recruitmentTimeZoneLabel(interviewTimeZone)}</strong>
                  <small>The interview time is anchored to this timezone and does not change based on the device viewing this page.</small>
                </article>
                <article>
                  <span>Interview status</span>
                  <strong>{interviewStatus}</strong>
                  <small>{record.interview_status === "Failed"
                    ? "The interview was completed. This status means the applicant was not selected to advance after the interview assessment."
                    : record.interview_status === "No Show"
                      ? "This status means the scheduled interview was not attended."
                      : record.interview_status === "Passed"
                        ? "The interview decision allows the applicant to advance to the employment-offer stage."
                        : record.interview_status === "Completed"
                          ? "The interview is complete and the selection decision is still pending."
                          : "The interview remains an active step in the recruitment process."}</small>
                </article>
              </div>
            </section>
          ) : null}

          {showOffer ? (
            <div className="candidate-offer-wrap">
              <EmploymentOfferAcceptance
                trackingToken={trackingToken}
                offerId={record.offer_id!}
                status={record.offer_status!}
                title={record.offer_title!}
                rank={record.offer_rank || "Recruit"}
                terms={record.offer_terms!}
                issuedAt={record.offer_issued_at!}
                expiresAt={record.offer_expires_at}
                acceptedAt={record.offer_accepted_at}
                signatureName={record.offer_signature_name}
              />
            </div>
          ) : null}

          <section className="attorney-candidate-details">
            <div className="attorney-section-heading"><div><span>Candidate record</span><h2>Application details</h2></div></div>
            <div className="attorney-detail-grid">
              <article><span>Applicant</span><strong>{record.applicant_name || "LSCSO Applicant"}</strong></article>
              <article><span>Track</span><strong>Sworn Personnel</strong></article>
              <article><span>Application status</span><strong>{record.status}</strong></article>
              <article><span>Applicant timezone</span><strong>{record.applicant_timezone || "Not recorded"}</strong></article>
              <article><span>Submitted</span><strong><LocalDateTime value={record.submitted_at} /></strong></article>
              <article><span>Last updated</span><strong><LocalDateTime value={record.updated_at} /></strong></article>
            </div>
          </section>

          {communication ? (
            <section className="attorney-candidate-message">
              <span>Current message from LSCSO</span>
              <p>{communication}</p>
            </section>
          ) : null}

          {applicantMessages.length ? (
            <section className="attorney-candidate-messages">
              <div className="attorney-section-heading"><div><span>Communications</span><h2>Messages from LSCSO</h2></div></div>
              <div className="attorney-message-list">
                {applicantMessages.map((item) => (
                  <article key={item.id}>
                    <header><strong>LSCSO Recruitment</strong><span><LocalDateTime value={item.sent_at} /></span></header>
                    <p>{item.content}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <footer className="attorney-candidate-footer">
            <p>This page is private and tied to your application. Keep the tracking link secure.</p>
            <Link className="button button--outline" href="/join">Return to Join LSCSO</Link>
          </footer>
        </article>
      </section>
    </main>
  );
}