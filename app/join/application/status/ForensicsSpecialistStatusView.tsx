import Image from "next/image";
import Link from "next/link";
import {
  DEFAULT_RECRUITMENT_TIME_ZONE,
  formatRecruitmentDateTime,
  normalizeRecruitmentTimeZone,
  recruitmentTimeZoneLabel,
} from "@/lib/recruitment/timezones";
import type { ApplicantMessage, ApplicantStatusRecord } from "./ApplicantStatusView";

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
    case "Passed": return "Completed · Selected";
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
      title: "Appointed as an LSCSO Forensics Specialist",
      message: "Your selection process is complete and your Forensics Specialist personnel appointment has been recorded.",
      next: "Continue with the portal-access and Forensic Services onboarding instructions provided by LSCSO personnel.",
      stage: 5,
      tone: "complete",
      actionLabel: "Portal onboarding",
    };
  }

  if (record.status === "Denied" || closureCode === "Application Denied") {
    return {
      eyebrow: "Application decision",
      title: "Application Not Selected",
      message: reason || "Your Forensics Specialist application was reviewed and was not selected to advance.",
      next: "This application is closed. No further action is required unless LSCSO contacts you.",
      stage: 2,
      tone: "closed",
      actionLabel: "Final disposition",
    };
  }

  if (record.interview_status === "Failed" || closureCode === "Interview Failed") {
    return {
      eyebrow: "Interview decision",
      title: "Interview Completed — Not Selected",
      message: reason || "Your Forensic Services interview was completed. After review, LSCSO did not select this application to advance to appointment.",
      next: "No further action is required on this application unless LSCSO contacts you.",
      stage: 4,
      tone: "closed",
      actionLabel: "Final disposition",
    };
  }

  if (record.status === "Withdrawn") {
    return {
      eyebrow: "Application withdrawn",
      title: "Application Withdrawn",
      message: "This Forensics Specialist application was withdrawn and is no longer active in the LSCSO selection process.",
      next: "No further action is available on this application.",
      stage: 2,
      tone: "closed",
      actionLabel: "Closed",
    };
  }

  if (record.status === "Archived" || closureCode) {
    const interviewReached = record.interview_status && record.interview_status !== "Not Scheduled";
    return {
      eyebrow: "Selection process closed",
      title: "Forensics Selection Process Closed",
      message: reason || "This Forensics Specialist selection process has been closed.",
      next: "No further action is available on this application unless LSCSO contacts you.",
      stage: interviewReached ? 4 : 2,
      tone: "closed",
      actionLabel: "Closed",
    };
  }

  if (record.status === "Accepted") {
    if (record.interview_status === "Passed") {
      return {
        eyebrow: "Interview decision",
        title: "Selected — Appointment Pending",
        message: "Your Forensic Services interview was completed successfully and you were selected to advance to the personnel appointment stage.",
        next: "No additional applicant action is required. Command must separately complete your Forensics Specialist appointment before portal onboarding begins.",
        stage: 5,
        tone: "accepted",
        actionLabel: "Await appointment",
      };
    }

    if (record.interview_status === "No Show") {
      return {
        eyebrow: "Interview attendance",
        title: "Interview Not Attended — Awaiting LSCSO Direction",
        message: "The scheduled Forensic Services interview was not attended. Your application remains open unless LSCSO separately closes the selection process.",
        next: "Continue monitoring this page and Discord for updated interview instructions or a new scheduled time.",
        stage: 3,
        tone: "review",
        actionLabel: "Await direction",
      };
    }

    if (record.interview_status === "Completed") {
      return {
        eyebrow: "Interview complete",
        title: "Interview Completed — Decision Pending",
        message: "Your required Forensic Services interview has been completed. Command has not yet recorded the final selection decision.",
        next: "No action is required while the interview decision is pending.",
        stage: 4,
        tone: "review",
        actionLabel: "Await decision",
      };
    }

    if (record.interview_status === "Scheduled") {
      return {
        eyebrow: "Interview scheduled",
        title: "Your Forensic Services Interview Is Scheduled",
        message: "Your written application was accepted and you have advanced to the required Forensics Specialist interview.",
        next: "Attend the interview at the official scheduled time shown below and be available in Discord shortly beforehand.",
        stage: 3,
        tone: "accepted",
        actionLabel: "Attend interview",
      };
    }

    return {
      eyebrow: "Advanced to interview",
      title: "Application Accepted — Interview Pending",
      message: "Your Forensics Specialist application was accepted and has advanced to the required interview stage.",
      next: "Wait for LSCSO to schedule your interview. The confirmed date, time, and timezone will appear here once recorded.",
      stage: 3,
      tone: "accepted",
      actionLabel: "Await scheduling",
    };
  }

  if (record.status === "Under Review" || record.status === "Interview") {
    return {
      eyebrow: "Command review",
      title: "Forensics Application Under Review",
      message: "Authorized LSCSO personnel are reviewing your Forensics Specialist candidate record and submitted responses.",
      next: "No action is required unless LSCSO contacts you for clarification.",
      stage: 2,
      tone: "review",
      actionLabel: "Await review",
    };
  }

  return {
    eyebrow: "Application received",
    title: "Forensics Specialist Application Received",
    message: "Your signed candidate packet has been received and entered into the LSCSO Forensic Services selection process.",
    next: "Keep this private tracking link and monitor Discord for any follow-up from LSCSO.",
    stage: 1,
    tone: "review",
    actionLabel: "Await review",
  };
}

export function ForensicsSpecialistStatusView({
  record,
  applicantMessages,
}: {
  record: ApplicantStatusRecord;
  applicantMessages: ApplicantMessage[];
}) {
  const view = viewFor(record);
  const interviewTimeZone = normalizeRecruitmentTimeZone(record.interview_timezone, DEFAULT_RECRUITMENT_TIME_ZONE);
  const interviewTime = record.interview_scheduled_at
    ? formatRecruitmentDateTime(record.interview_scheduled_at, interviewTimeZone)
    : null;
  const interviewStatus = publicInterviewStatus(record.interview_status);
  const hasInterviewRecord = record.status === "Accepted"
    || record.status === "Hired"
    || ["Scheduled", "Completed", "Passed", "Failed", "No Show"].includes(String(record.interview_status ?? ""));
  const communication = String(record.applicant_status_message ?? "").trim();

  const steps = [
    ["01", "Application", "Signed Forensics Specialist application received"],
    ["02", "Command Review", "Candidate record screening and decision"],
    ["03", "Interview", "Required Forensic Services interview"],
    ["04", "Selection", "Interview assessment and selection decision"],
    ["05", "Appointment", "Forensics Specialist personnel appointment and portal onboarding"],
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
                <strong>Forensic Services Recruitment</strong>
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

          <section className="attorney-candidate-progress" aria-label="Forensics Specialist selection progress">
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
                <div><span>Interview record</span><h2>Forensic Services interview</h2></div>
                <b>{interviewStatus}</b>
              </div>
              <div className="attorney-interview-grid">
                <article><span>Official scheduled time</span><strong>{interviewTime || "Not yet scheduled"}</strong><small>{interviewTime ? "This is the interview time recorded by LSCSO." : "LSCSO has not recorded an interview time yet."}</small></article>
                <article><span>Interview timezone</span><strong>{recruitmentTimeZoneLabel(interviewTimeZone)}</strong><small>The recorded time remains anchored to this timezone.</small></article>
                <article><span>Interview status</span><strong>{interviewStatus}</strong><small>{record.interview_status === "Passed" ? "The interview decision allows the candidate to advance to a separate Forensics Specialist appointment." : record.interview_status === "Failed" ? "The interview was completed and the candidate was not selected to advance." : record.interview_status === "No Show" ? "The scheduled interview was not attended. The selection process remains open unless LSCSO closes it separately." : "Continue monitoring this page for interview updates."}</small></article>
              </div>
            </section>
          ) : null}

          {communication || applicantMessages.length ? (
            <section className="attorney-message-card">
              <div className="attorney-section-heading"><div><span>Recruitment communication</span><h2>Messages from LSCSO</h2></div><b>{applicantMessages.length || 1}</b></div>
              <div className="attorney-message-list">
                {applicantMessages.length ? applicantMessages.map((message) => (
                  <article key={message.id}><span>LSCSO Recruitment</span><strong>{message.content}</strong><small>{new Date(message.sent_at).toLocaleString()}</small></article>
                )) : <article><span>LSCSO Recruitment</span><strong>{communication}</strong></article>}
              </div>
            </section>
          ) : null}

          <footer className="attorney-candidate-footer">
            <div><span>Candidate</span><strong>{record.applicant_name || "Forensics Specialist Applicant"}</strong></div>
            <div><span>Last updated</span><strong>{record.updated_at ? new Date(record.updated_at).toLocaleString() : "Not available"}</strong></div>
            <Link className="button button--outline" href="/join">Return to Join LSCSO</Link>
          </footer>
        </article>
      </section>
    </main>
  );
}
