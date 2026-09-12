import Image from "next/image";
import Link from "next/link";
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
  title: string;
  eyebrow: string;
  message: string;
  nextAction: string;
  currentStep: number;
  currentComplete?: boolean;
  terminal?: boolean;
  tone: "review" | "accepted" | "closed" | "complete";
};

function closureStep(record: ApplicantStatusRecord) {
  if (record.closure_code === "Offer Terminated" || record.offer_id) return 4;
  if (record.closure_code === "Interview No Show" || ["Scheduled", "Completed", "Passed", "Failed", "No Show"].includes(record.interview_status)) return 3;
  return 2;
}

function candidateView(record: ApplicantStatusRecord): CandidateView {
  if (record.hired || record.status === "Hired") {
    return {
      title: "Selection Process Complete",
      eyebrow: "Recruit appointment complete",
      message: "You have completed the LSCSO recruitment process and have been appointed as a Recruit.",
      nextAction: "Follow the onboarding and training instructions provided by LSCSO personnel.",
      currentStep: 5,
      currentComplete: true,
      tone: "complete",
    };
  }

  if (record.closure_reason) {
    return {
      title: record.closure_code === "Offer Terminated" ? "Employment Offer Terminated" : "Selection Process Closed",
      eyebrow: record.closure_code || "Candidate file closed",
      message: record.closure_reason,
      nextAction: "No further action is required for this application.",
      currentStep: closureStep(record),
      terminal: true,
      tone: "closed",
    };
  }

  if (record.status === "Denied") {
    return {
      title: "Selection Process Closed",
      eyebrow: "Final application decision",
      message: "Your application will not be moving forward in the current selection process.",
      nextAction: "No further action is required unless LSCSO Recruitment contacts you with additional information.",
      currentStep: 2,
      terminal: true,
      tone: "closed",
    };
  }

  if (record.status === "Withdrawn") {
    return {
      title: "Application Withdrawn",
      eyebrow: "Candidate file closed",
      message: "This candidate application has been withdrawn and is no longer active in the selection process.",
      nextAction: "No further action is required for this application.",
      currentStep: 2,
      terminal: true,
      tone: "closed",
    };
  }

  if (record.status === "Archived") {
    return {
      title: "Selection Process Closed",
      eyebrow: "Candidate file closed",
      message: "This candidate application is no longer active in the current recruitment process.",
      nextAction: "No further action is required for this application.",
      currentStep: closureStep(record),
      terminal: true,
      tone: "closed",
    };
  }

  if (record.status === "Accepted") {
    if (record.interview_status === "Scheduled") {
      return {
        title: "Interview Scheduled",
        eyebrow: "Application accepted",
        message: "Your written application has been accepted and your required interview has been scheduled.",
        nextAction: "Be available in Discord before the scheduled interview time and follow any instructions from Recruitment staff.",
        currentStep: 3,
        tone: "accepted",
      };
    }

    if (record.interview_status === "No Show") {
      return {
        title: "Selection Process Closed",
        eyebrow: "Interview no-show",
        message: "The selection process was closed because you did not attend the required scheduled interview.",
        nextAction: "No further action is required for this application.",
        currentStep: 3,
        terminal: true,
        tone: "closed",
      };
    }

    if (record.interview_status === "Failed") {
      return {
        title: "Interview Not Passed",
        eyebrow: "Interview result recorded",
        message: "Your required interview was not passed. Your application will not advance to employment offer or Recruit appointment.",
        nextAction: "No further action is required unless LSCSO Recruitment contacts you with additional information.",
        currentStep: 3,
        terminal: true,
        tone: "closed",
      };
    }

    if (record.interview_status === "Passed") {
      if (record.offer_status === "Accepted") {
        return {
          title: "Employment Offer Accepted",
          eyebrow: "Offer signed",
          message: "Your signed employment offer has been received by LSCSO.",
          nextAction: "No further action is required from you. Command Staff will complete your Recruit appointment.",
          currentStep: 4,
          currentComplete: true,
          tone: "accepted",
        };
      }
      if (record.offer_status === "Pending") {
        return {
          title: "Employment Offer Issued",
          eyebrow: "Action required",
          message: "LSCSO has issued your employment offer for the Recruit position.",
          nextAction: "Review the employment offer below, then electronically sign and accept it before the deadline shown.",
          currentStep: 4,
          tone: "accepted",
        };
      }
      if (record.offer_status === "Expired") {
        return {
          title: "Employment Offer Expired",
          eyebrow: "Offer deadline passed",
          message: "The employment offer issued for this application expired before it was accepted.",
          nextAction: "No further action is available on this offer. Contact LSCSO Recruitment only if directed to do so.",
          currentStep: 4,
          terminal: true,
          tone: "closed",
        };
      }
      return {
        title: "Interview Passed",
        eyebrow: "Employment decision pending",
        message: "Your required interview has been passed and recorded.",
        nextAction: "No action is required until LSCSO Command Staff issues your employment offer.",
        currentStep: 3,
        currentComplete: true,
        tone: "review",
      };
    }

    if (record.interview_status === "Completed") {
      return {
        title: "Interview Completed",
        eyebrow: "Interview result pending",
        message: "Your required interview has been completed and is awaiting a final recorded result.",
        nextAction: "No action is required right now.",
        currentStep: 3,
        tone: "review",
      };
    }

    return {
      title: "Application Accepted",
      eyebrow: "Written screening complete",
      message: "Your written application has been accepted. A required interview is the next stage of the process.",
      nextAction: "Watch Discord for contact from LSCSO Recruitment to schedule your interview.",
      currentStep: 2,
      currentComplete: true,
      tone: "accepted",
    };
  }

  if (record.status === "Under Review" || record.status === "Interview") {
    return {
      title: "Under Command Review",
      eyebrow: "Candidate packet active",
      message: "Your application is currently being reviewed by LSCSO Command Staff.",
      nextAction: "No action is required unless Recruitment contacts you for clarification or additional information.",
      currentStep: 1,
      tone: "review",
    };
  }

  return {
    title: "Application Received",
    eyebrow: "Candidate packet received",
    message: "Your Deputy Candidate Application has been received by the Los Santos County Sheriff's Office.",
    nextAction: "No action is required. Command Staff will review your application.",
    currentStep: 0,
    tone: "review",
  };
}

const steps = [
  ["01", "Application Received", "Candidate packet submitted"],
  ["02", "Command Review", "Written screening"],
  ["03", "Application Decision", "Accepted or closed"],
  ["04", "Interview", "Required interview"],
  ["05", "Employment Offer", "Review and signature"],
  ["06", "Recruit Appointment", "Selection complete"],
] as const;

function applicationLabel(number: number | string) {
  return `APP-${String(number).padStart(4, "0")}`;
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
  const view = candidateView(record);
  const showOffer = Boolean(record.offer_id && record.offer_status && record.offer_title && record.offer_terms && record.offer_issued_at);

  return (
    <main className="application-status-page">
      <section className="application-status-hero">
        <div className="site-shell">
          <div className="application-status-masthead">
            <div>
              <p className="section-kicker">Careers & Recruitment · Candidate Status</p>
              <span className={`application-status-badge application-status-badge--${view.tone}`}>{view.eyebrow}</span>
              <h1>{view.title}</h1>
              <p className="application-status-intro">{view.message}</p>
            </div>
            <aside className="application-status-seal">
              <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={145} height={145} priority />
              <span>Private Candidate Record</span>
              <strong>{applicationLabel(record.application_number)}</strong>
              <small>{record.applicant_name || "LSCSO Applicant"}</small>
            </aside>
          </div>

          <section className="application-status-summary" aria-label="Current candidate status">
            <article><span>Current status</span><strong>{view.title}</strong></article>
            <article><span>Last updated</span><strong><LocalDateTime value={record.updated_at} /></strong></article>
            <article><span>Application submitted</span><strong><LocalDateTime value={record.submitted_at} /></strong></article>
          </section>

          {applicantMessages.length ? (
            <section className="application-status-communications" aria-label="Recruitment communications">
              <div className="application-status-communications__heading">
                <div><span>Recruitment communications</span><h2>Messages from LSCSO Recruitment</h2></div>
                <strong>{applicantMessages.length} {applicantMessages.length === 1 ? "message" : "messages"}</strong>
              </div>
              <div className="application-status-communications__history">
                {applicantMessages.map((item) => (
                  <article key={item.id}>
                    <div><strong>LSCSO Recruitment</strong><span><LocalDateTime value={item.sent_at} /></span></div>
                    <p>{item.content}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {showOffer ? (
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
          ) : null}

          <section className="application-status-next-action">
            <span>Your next action</span>
            <h2>{view.nextAction}</h2>
            {record.interview_scheduled_at && record.status === "Accepted" && record.interview_status === "Scheduled" ? (
              <p>Scheduled interview: <strong><LocalDateTime value={record.interview_scheduled_at} /></strong> <small>(shown in your device&apos;s local time)</small></p>
            ) : null}
          </section>

          <section className="application-status-timeline" aria-label="Recruitment timeline">
            {steps.map(([number, title, description], index) => {
              const complete = index < view.currentStep || (index === view.currentStep && Boolean(view.currentComplete));
              const current = index === view.currentStep;
              const className = [
                complete ? "is-complete" : "",
                current ? "is-current" : "",
                current && view.terminal ? "is-terminal" : "",
              ].filter(Boolean).join(" ");
              return (
                <article className={className} key={number}>
                  <div><span>{complete ? "✓" : number}</span></div>
                  <section><strong>{title}</strong><small>{description}</small></section>
                </article>
              );
            })}
          </section>

          <section className="application-status-privacy">
            <div>
              <span>Private tracking link</span>
              <strong>Keep this page bookmarked.</strong>
              <p>This link is private. Internal Command notes and interview notes are not displayed here.</p>
            </div>
            <Link className="button button--outline" href="/join">Join LSCSO</Link>
          </section>
        </div>
      </section>
    </main>
  );
}
