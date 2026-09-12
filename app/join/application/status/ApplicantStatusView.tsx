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

type TimelineStep = {
  number: string;
  title: string;
  description: string;
};

function closureStep(record: ApplicantStatusRecord) {
  if (record.closure_code === "Offer Terminated" || record.offer_id) return 4;
  if (
    record.closure_code === "Interview No Show"
    || record.closure_code === "Interview Failed"
    || ["Scheduled", "Completed", "Passed", "Failed", "No Show"].includes(record.interview_status)
  ) return 3;
  return 2;
}

function shortReason(reason?: string | null) {
  const clean = String(reason ?? "").trim();
  if (!clean) return "";
  return clean.length > 180 ? `${clean.slice(0, 177)}…` : clean;
}

function candidateView(record: ApplicantStatusRecord): CandidateView {
  if (record.hired || record.status === "Hired") {
    return {
      title: "Hired — Recruit Appointment Complete",
      eyebrow: "Selected and appointed",
      message: "You were selected and have been appointed as an LSCSO Recruit.",
      nextAction: "Follow the onboarding and training instructions provided by LSCSO personnel.",
      currentStep: 5,
      currentComplete: true,
      tone: "complete",
    };
  }

  const reason = String(record.closure_reason ?? "").trim();
  const closureCode = String(record.closure_code ?? "").trim();

  if (closureCode === "Application Denied" || record.status === "Denied") {
    return {
      title: "Not Selected",
      eyebrow: "Application denied",
      message: reason
        ? `You were not selected to continue in the LSCSO recruitment process. Reason: ${reason}`
        : "You were not selected to continue in the LSCSO recruitment process. A specific denial reason is not available on this record.",
      nextAction: "This application is closed. No further action is available on this application.",
      currentStep: 2,
      terminal: true,
      tone: "closed",
    };
  }

  if (closureCode === "Interview Failed" || record.interview_status === "Failed") {
    return {
      title: "Not Selected — Interview Failed",
      eyebrow: "Interview failed",
      message: reason
        ? `You were not selected because you did not pass the required interview. Reason: ${reason}`
        : "You were not selected because you did not pass the required interview.",
      nextAction: "This application is closed. You will not advance to an employment offer or Recruit appointment.",
      currentStep: 3,
      terminal: true,
      tone: "closed",
    };
  }

  if (closureCode === "Interview No Show" || record.interview_status === "No Show") {
    return {
      title: "Not Selected — Interview No Show",
      eyebrow: "No show · process closed",
      message: reason || "You were not selected because you did not attend the required scheduled interview.",
      nextAction: "This application is closed. No second interview will be scheduled for this application.",
      currentStep: 3,
      terminal: true,
      tone: "closed",
    };
  }

  if (closureCode === "Offer Terminated") {
    return {
      title: "Not Selected — Employment Offer Terminated",
      eyebrow: "Offer terminated · process closed",
      message: reason
        ? `Your employment offer was terminated and you were not selected for appointment. Reason: ${reason}`
        : "Your employment offer was terminated and you were not selected for appointment.",
      nextAction: "This application is closed. The terminated offer can no longer be accepted.",
      currentStep: 4,
      terminal: true,
      tone: "closed",
    };
  }

  if (closureCode === "Command Closure" || (record.status === "Archived" && reason)) {
    return {
      title: "Selection Process Closed — Not Selected",
      eyebrow: "Closed by LSCSO Recruitment",
      message: reason ? `You were not selected. Reason: ${reason}` : "Your selection process was closed by LSCSO Recruitment.",
      nextAction: "This application is closed. No further action is available on this application.",
      currentStep: closureStep(record),
      terminal: true,
      tone: "closed",
    };
  }

  if (record.status === "Withdrawn" || closureCode === "Application Withdrawn") {
    return {
      title: "Application Withdrawn",
      eyebrow: "Application closed",
      message: "Your application was withdrawn and is no longer active in the LSCSO recruitment process.",
      nextAction: "No further action is available on this application.",
      currentStep: 2,
      terminal: true,
      tone: "closed",
    };
  }

  if (record.status === "Archived") {
    return {
      title: "Selection Process Closed",
      eyebrow: "Application closed",
      message: reason || "Your application is no longer active in the LSCSO recruitment process.",
      nextAction: "No further action is available on this application.",
      currentStep: closureStep(record),
      terminal: true,
      tone: "closed",
    };
  }

  if (record.status === "Accepted") {
    if (record.interview_status === "Scheduled") {
      return {
        title: "Application Accepted — Interview Scheduled",
        eyebrow: "Selected to continue",
        message: "Your written application was accepted. You have been selected to continue to the required interview.",
        nextAction: "Attend the scheduled interview. Be available in Discord before the scheduled time.",
        currentStep: 3,
        tone: "accepted",
      };
    }

    if (record.interview_status === "Passed") {
      if (record.offer_status === "Accepted") {
        return {
          title: "Employment Offer Accepted",
          eyebrow: "Offer signed and accepted",
          message: "You signed and accepted the LSCSO employment offer. Command Staff must now complete your Recruit appointment.",
          nextAction: "No further action is required from you unless LSCSO contacts you.",
          currentStep: 4,
          currentComplete: true,
          tone: "accepted",
        };
      }
      if (record.offer_status === "Pending") {
        return {
          title: "Employment Offer Issued — Signature Required",
          eyebrow: "Action required",
          message: "You passed the required interview and LSCSO issued you an employment offer for the Recruit position.",
          nextAction: "Review the employment offer below, then sign and accept it before the listed deadline.",
          currentStep: 4,
          tone: "accepted",
        };
      }
      if (record.offer_status === "Expired") {
        return {
          title: "Not Selected — Employment Offer Expired",
          eyebrow: "Offer expired",
          message: "Your employment offer expired before you accepted it. The expired offer can no longer be signed.",
          nextAction: "No further action is available on this offer unless LSCSO Recruitment issues a new offer.",
          currentStep: 4,
          terminal: true,
          tone: "closed",
        };
      }
      if (record.offer_status === "Terminated") {
        return {
          title: "Not Selected — Employment Offer Terminated",
          eyebrow: "Offer terminated",
          message: reason || "Your employment offer was terminated by LSCSO Recruitment.",
          nextAction: "This application is closed. The terminated offer can no longer be accepted.",
          currentStep: 4,
          terminal: true,
          tone: "closed",
        };
      }
      return {
        title: "Interview Passed — Employment Offer Pending",
        eyebrow: "Interview passed",
        message: "You passed the required interview. LSCSO Command Staff has not yet issued your employment offer.",
        nextAction: "No action is required until an employment offer is issued.",
        currentStep: 3,
        currentComplete: true,
        tone: "review",
      };
    }

    if (record.interview_status === "Completed") {
      return {
        title: "Interview Completed — Result Pending",
        eyebrow: "Interview completed",
        message: "Your required interview is complete. Command Staff has not yet recorded a Pass or Fail result.",
        nextAction: "No action is required while the interview result is pending.",
        currentStep: 3,
        tone: "review",
      };
    }

    return {
      title: "Application Accepted — Interview Required",
      eyebrow: "Selected to continue",
      message: "Your written application was accepted. You have been selected to continue to the required interview stage.",
      nextAction: "Wait for LSCSO Recruitment to contact you on Discord with interview scheduling information.",
      currentStep: 2,
      currentComplete: true,
      tone: "accepted",
    };
  }

  if (record.status === "Under Review" || record.status === "Interview") {
    return {
      title: "Application Under Command Review",
      eyebrow: "Decision pending",
      message: "LSCSO Command Staff is reviewing your written application. No selection decision has been made yet.",
      nextAction: "No action is required unless Recruitment contacts you for clarification.",
      currentStep: 1,
      tone: "review",
    };
  }

  return {
    title: "Application Received — Review Pending",
    eyebrow: "Application submitted",
    message: "LSCSO received your Deputy Candidate Application. Command Staff has not reviewed it yet.",
    nextAction: "No action is required while your application waits for Command review.",
    currentStep: 0,
    tone: "review",
  };
}

function timelineSteps(record: ApplicantStatusRecord, view: CandidateView): TimelineStep[] {
  const reason = shortReason(record.closure_reason);
  const acceptedDecision = record.status === "Accepted" || record.status === "Hired" || Boolean(record.hired)
    || ["Scheduled", "Completed", "No Show", "Passed", "Failed"].includes(record.interview_status)
    || Boolean(record.offer_id);

  const decisionTitle = record.status === "Denied" || record.closure_code === "Application Denied"
    ? "Not Selected"
    : acceptedDecision
      ? "Application Accepted"
      : "Application Decision Pending";
  const decisionDescription = record.status === "Denied" || record.closure_code === "Application Denied"
    ? reason ? `Reason: ${reason}` : "Application denied by LSCSO Command Staff"
    : acceptedDecision
      ? "Selected to continue to the required interview"
      : "Command Staff has not made a selection decision";

  let interviewTitle = "Interview — Locked";
  let interviewDescription = "Available only after the written application is accepted";
  switch (record.interview_status) {
    case "Scheduled":
      interviewTitle = "Interview Scheduled";
      interviewDescription = "Required interview date and time recorded";
      break;
    case "Completed":
      interviewTitle = "Interview Completed — Result Pending";
      interviewDescription = "Command Staff has not recorded Pass or Fail yet";
      break;
    case "Passed":
      interviewTitle = "Interview Passed";
      interviewDescription = "Cleared to move to the employment-offer stage";
      break;
    case "Failed":
      interviewTitle = "Interview Failed — Not Selected";
      interviewDescription = reason ? `Reason: ${reason}` : "Required interview was not passed";
      break;
    case "No Show":
      interviewTitle = "No Show — Process Closed";
      interviewDescription = reason || "Required scheduled interview was not attended";
      break;
    default:
      if (record.status === "Accepted") {
        interviewTitle = "Interview Required — Not Yet Scheduled";
        interviewDescription = "Written application accepted; interview still required";
      }
      break;
  }

  let offerTitle = "Employment Offer — Locked";
  let offerDescription = "Available only after the required interview is passed";
  if (record.interview_status === "Passed" && !record.offer_status) {
    offerTitle = "Employment Offer — Not Yet Issued";
    offerDescription = "Interview passed; waiting on LSCSO Command Staff";
  }
  if (record.offer_status === "Pending") {
    offerTitle = "Employment Offer Issued — Signature Required";
    offerDescription = "Applicant must review, sign, and accept the offer";
  }
  if (record.offer_status === "Accepted") {
    offerTitle = "Employment Offer Signed & Accepted";
    offerDescription = "Applicant acceptance received by LSCSO";
  }
  if (record.offer_status === "Expired") {
    offerTitle = "Employment Offer Expired — Not Accepted";
    offerDescription = "Offer deadline passed before applicant acceptance";
  }
  if (record.offer_status === "Terminated" || record.closure_code === "Offer Terminated") {
    offerTitle = "Employment Offer Terminated — Process Closed";
    offerDescription = reason ? `Reason: ${reason}` : "Offer terminated by LSCSO Recruitment";
  }

  let appointmentTitle = "Recruit Appointment — Locked";
  let appointmentDescription = "Requires a passed interview and accepted employment offer";
  if (record.offer_status === "Accepted" && !record.hired && record.status !== "Hired") {
    appointmentTitle = "Recruit Appointment — Pending Command Completion";
    appointmentDescription = "Employment offer accepted; final appointment not yet recorded";
  }
  if (record.hired || record.status === "Hired") {
    appointmentTitle = "Appointed as LSCSO Recruit";
    appointmentDescription = "Recruitment process completed successfully";
  }

  const steps: TimelineStep[] = [
    { number: "01", title: "Application Submitted", description: "Received by LSCSO Recruitment" },
    {
      number: "02",
      title: "Command Review",
      description: view.currentStep > 1 ? "Written application review completed" : view.currentStep === 1 ? "Command Staff is reviewing the written application" : "Waiting for Command Staff review",
    },
    { number: "03", title: decisionTitle, description: decisionDescription },
    { number: "04", title: interviewTitle, description: interviewDescription },
    { number: "05", title: offerTitle, description: offerDescription },
    { number: "06", title: appointmentTitle, description: appointmentDescription },
  ];

  if (view.terminal && view.currentStep === 2 && record.closure_code === "Command Closure") {
    steps[2] = { number: "03", title: "Selection Process Closed — Not Selected", description: reason ? `Reason: ${reason}` : "Closed by LSCSO Recruitment" };
  }
  if (view.terminal && view.currentStep === 3 && record.closure_code === "Command Closure") {
    steps[3] = { number: "04", title: "Selection Process Closed — Not Selected", description: reason ? `Reason: ${reason}` : "Closed by LSCSO Recruitment" };
  }
  if (view.terminal && view.currentStep === 4 && record.closure_code === "Command Closure") {
    steps[4] = { number: "05", title: "Selection Process Closed — Not Selected", description: reason ? `Reason: ${reason}` : "Closed by LSCSO Recruitment" };
  }

  return steps;
}

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
  const steps = timelineSteps(record, view);
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
            <span>{view.terminal ? "Disposition" : "Your next action"}</span>
            <h2>{view.nextAction}</h2>
            {record.interview_scheduled_at && record.status === "Accepted" && record.interview_status === "Scheduled" ? (
              <p>Scheduled interview: <strong><LocalDateTime value={record.interview_scheduled_at} /></strong> <small>(shown in your device&apos;s local time)</small></p>
            ) : null}
          </section>

          <section className="application-status-timeline" aria-label="Recruitment timeline">
            {steps.map(({ number, title, description }, index) => {
              const complete = index < view.currentStep || (index === view.currentStep && Boolean(view.currentComplete));
              const current = index === view.currentStep;
              const className = [
                complete ? "is-complete" : "",
                current ? "is-current" : "",
                current && view.terminal ? "is-terminal" : "",
              ].filter(Boolean).join(" ");
              return (
                <article className={className} key={number}>
                  <div><span>{current && view.terminal ? "×" : complete ? "✓" : number}</span></div>
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
