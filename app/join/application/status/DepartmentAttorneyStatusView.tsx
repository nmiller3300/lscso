import Image from "next/image";
import Link from "next/link";
import {
  DEFAULT_RECRUITMENT_TIME_ZONE,
  formatRecruitmentDateTime,
  normalizeRecruitmentTimeZone,
  recruitmentTimeZoneLabel,
} from "@/lib/recruitment/timezones";
import { LocalDateTime } from "./[token]/LocalDateTime";
import type { ApplicantMessage } from "./ApplicantStatusView";

function applicationLabel(number: number | string) {
  return `APP-${String(number).padStart(4, "0")}`;
}

type CandidateView = {
  eyebrow: string;
  title: string;
  message: string;
  next: string;
  stage: number;
  tone: "review" | "accepted" | "closed" | "complete";
  actionLabel: string;
};

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

function viewFor(record: any): CandidateView {
  const closureCode = String(record.closure_code ?? "").trim();
  const reason = String(record.closure_reason ?? "").trim();
  const hired = record.status === "Hired" || Boolean(record.hired);

  if (hired) {
    return {
      eyebrow: "Appointment complete",
      title: "Appointed as Department Attorney",
      message: "Your selection process is complete and your Department Attorney personnel appointment has been recorded by LSCSO.",
      next: "Follow the portal-access and onboarding instructions provided by LSCSO personnel.",
      stage: 5,
      tone: "complete",
      actionLabel: "Onboarding",
    };
  }

  if (closureCode === "Interview Failed" || record.interview_status === "Failed") {
    return {
      eyebrow: "Interview decision",
      title: "Interview Completed — Not Selected",
      message: reason || "You completed the required Department Attorney interview. After review, LSCSO determined the interview did not meet the standard required to advance to appointment.",
      next: "No further action is required on this application. The interview was completed; this disposition reflects the selection decision, not a failure to attend or finish the interview.",
      stage: 4,
      tone: "closed",
      actionLabel: "Final disposition",
    };
  }

  if (closureCode === "Interview No Show" || (record.status === "Archived" && record.interview_status === "No Show")) {
    return {
      eyebrow: "Interview disposition",
      title: "Interview Not Attended — Process Closed",
      message: reason || "The scheduled interview was not attended and LSCSO closed this Department Attorney selection process.",
      next: "No further action is available on this application unless LSCSO contacts you.",
      stage: 3,
      tone: "closed",
      actionLabel: "Final disposition",
    };
  }

  if (record.status === "Denied" || closureCode === "Application Denied") {
    return {
      eyebrow: "Application decision",
      title: "Application Not Selected",
      message: reason || "Your written Department Attorney application was reviewed and was not selected to advance to interview.",
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
      message: "This Department Attorney application was withdrawn and is no longer active in the selection process.",
      next: "No further action is available on this application.",
      stage: 2,
      tone: "closed",
      actionLabel: "Closed",
    };
  }

  if (record.status === "Archived" || closureCode) {
    return {
      eyebrow: "Selection process closed",
      title: "Department Attorney Application Closed",
      message: reason || "This Department Attorney selection process has been closed.",
      next: "No further action is available on this application unless LSCSO contacts you.",
      stage: record.interview_status && record.interview_status !== "Not Scheduled" ? 4 : 2,
      tone: "closed",
      actionLabel: "Closed",
    };
  }

  if (record.status === "Accepted") {
    if (record.interview_status === "Passed") {
      return {
        eyebrow: "Interview decision",
        title: "Selected to Advance — Appointment Pending",
        message: "Your Department Attorney interview was completed and you were selected to advance to final personnel appointment.",
        next: "No action is required unless LSCSO contacts you. Command must complete the Department Attorney appointment before the process is final.",
        stage: 5,
        tone: "accepted",
        actionLabel: "Await appointment",
      };
    }
    if (record.interview_status === "No Show") {
      return {
        eyebrow: "Interview attendance",
        title: "Interview Not Attended — Awaiting LSCSO Direction",
        message: "The scheduled Department Attorney interview was not attended. Your application remains in the interview stage while LSCSO determines whether another interview will be scheduled or the process will be closed.",
        next: "No action is required unless LSCSO contacts you. Continue monitoring this page and Discord for updated interview instructions.",
        stage: 3,
        tone: "review",
        actionLabel: "Await direction",
      };
    }
    if (record.interview_status === "Completed") {
      return {
        eyebrow: "Interview complete",
        title: "Interview Completed — Decision Pending",
        message: "Your required Department Attorney interview has been completed. Command has not yet recorded the final selection decision.",
        next: "No action is required while the interview decision is pending. Continue monitoring this page and Discord.",
        stage: 4,
        tone: "review",
        actionLabel: "Await decision",
      };
    }
    if (record.interview_status === "Scheduled") {
      return {
        eyebrow: "Interview scheduled",
        title: "Your Department Attorney Interview Is Scheduled",
        message: "Your written application was accepted and you have advanced to the required interview stage.",
        next: "Attend the interview at the scheduled time shown below and be available in Discord shortly beforehand.",
        stage: 3,
        tone: "accepted",
        actionLabel: "Attend interview",
      };
    }
    return {
      eyebrow: "Advanced to interview",
      title: "Application Accepted — Interview Pending",
      message: "Your written Department Attorney application was accepted. You have advanced to the required interview stage.",
      next: "Wait for LSCSO to schedule your interview. The confirmed date, time, and timezone will appear here once recorded.",
      stage: 3,
      tone: "accepted",
      actionLabel: "Await scheduling",
    };
  }

  if (record.status === "Under Review") {
    return {
      eyebrow: "Command review",
      title: "Application Under Review",
      message: "Authorized LSCSO Command personnel are reviewing your Department Attorney application and written responses.",
      next: "No action is required unless LSCSO contacts you for clarification.",
      stage: 2,
      tone: "review",
      actionLabel: "Await review",
    };
  }

  return {
    eyebrow: "Application received",
    title: "Department Attorney Application Received",
    message: "Your signed candidate packet has been received and entered into the LSCSO selection process.",
    next: "Keep this private tracking link and monitor Discord for any follow-up from LSCSO.",
    stage: 1,
    tone: "review",
    actionLabel: "Await review",
  };
}

export function DepartmentAttorneyStatusView({ record, applicantMessages }: { record: any; applicantMessages: ApplicantMessage[] }) {
  const view = viewFor(record);
  const communication = String(record.applicant_status_message ?? "").trim();
  const interviewTimeZone = normalizeRecruitmentTimeZone(record.interview_timezone, DEFAULT_RECRUITMENT_TIME_ZONE);
  const interviewTime = record.interview_scheduled_at
    ? formatRecruitmentDateTime(record.interview_scheduled_at, interviewTimeZone)
    : null;
  const interviewStatus = publicInterviewStatus(record.interview_status);
  const hasInterviewRecord = record.status === "Accepted"
    || record.status === "Hired"
    || ["Scheduled", "Completed", "Passed", "Failed", "No Show"].includes(String(record.interview_status ?? ""))
    || ["Interview Failed", "Interview No Show"].includes(String(record.closure_code ?? ""));

  const steps = [
    ["01", "Application", "Signed Department Attorney packet received"],
    ["02", "Command Review", "Written application and legal-counsel screening"],
    ["03", "Interview", "Required Department Attorney interview"],
    ["04", "Decision", "Interview assessment and selection decision"],
    ["05", "Appointment", "Final personnel appointment if selected"],
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
                <strong>Department Attorney Selection</strong>
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

          <section className="attorney-candidate-progress" aria-label="Department Attorney selection progress">
            {steps.map(([number, title, description], index) => {
              const stageNumber = index + 1;
              const complete = stageNumber < view.stage || (view.stage === 5 && stageNumber === 5 && view.tone === "complete");
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
                <div><span>Interview record</span><h2>Department Attorney interview</h2></div>
                <b>{interviewStatus}</b>
              </div>
              <div className="attorney-interview-grid">
                <article>
                  <span>Scheduled time</span>
                  <strong>{interviewTime || "Not yet scheduled"}</strong>
                  {interviewTime ? <small>This is the official interview time.</small> : <small>LSCSO has not recorded an interview time yet.</small>}
                </article>
                <article>
                  <span>Interview timezone</span>
                  <strong>{recruitmentTimeZoneLabel(interviewTimeZone)}</strong>
                  <small>The scheduled time is anchored to this timezone and will not shift based on the device viewing this page.</small>
                </article>
                <article>
                  <span>Interview status</span>
                  <strong>{interviewStatus}</strong>
                  <small>{record.interview_status === "Failed"
                    ? "The interview was completed. This status means the applicant was not selected to advance after the interview assessment."
                    : record.interview_status === "No Show"
                      ? record.status === "Archived" || Boolean(record.closure_code)
                        ? "The scheduled interview was not attended and the selection process was closed."
                        : "The scheduled interview was not attended. The application remains open unless LSCSO separately closes it."
                      : record.interview_status === "Passed"
                        ? "The interview decision allows the applicant to advance to final appointment."
                        : record.interview_status === "Completed"
                          ? "The interview is complete and the selection decision is still pending."
                          : "The interview remains an active step in the selection process."}</small>
                </article>
              </div>
            </section>
          ) : null}

          <section className="attorney-candidate-details">
            <div className="attorney-section-heading"><div><span>Candidate record</span><h2>Application details</h2></div></div>
            <div className="attorney-detail-grid">
              <article><span>Applicant</span><strong>{record.applicant_name || "LSCSO Applicant"}</strong></article>
              <article><span>Role</span><strong>Department Attorney</strong></article>
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
