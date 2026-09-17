import Image from "next/image";
import Link from "next/link";
import { LocalDateTime } from "./[token]/LocalDateTime";
import type { ApplicantMessage } from "./ApplicantStatusView";

function applicationLabel(number: number | string) {
  return `APP-${String(number).padStart(4, "0")}`;
}

function viewFor(record: any) {
  const closed = record.status === "Archived" || record.status === "Denied" || record.status === "Withdrawn" || Boolean(record.closure_code);
  const hired = record.status === "Hired" || Boolean(record.hired);

  if (hired) {
    return {
      eyebrow: "Appointment complete",
      title: "Appointed — Department Attorney",
      message: "Your Department Attorney appointment with the Los Santos County Sheriff’s Office has been completed.",
      next: "Follow the portal-access and onboarding instructions provided by LSCSO Command personnel.",
      step: 5,
      tone: "accepted",
    };
  }

  if (closed) {
    const reason = String(record.closure_reason ?? "").trim();
    const interviewClosure = ["Interview Failed", "Interview No Show"].includes(String(record.closure_code ?? ""));
    return {
      eyebrow: record.status === "Withdrawn" ? "Application withdrawn" : interviewClosure ? "Interview disposition" : "Selection process closed",
      title: record.status === "Denied" ? "Not Selected" : record.closure_code === "Interview Failed" ? "Not Selected — Interview Failed" : record.closure_code === "Interview No Show" ? "Not Selected — Interview No Show" : "Department Attorney Application Closed",
      message: reason || (record.status === "Withdrawn"
        ? "This application was withdrawn and is no longer active."
        : "This Department Attorney selection process has been closed."),
      next: "No further action is available on this application unless LSCSO contacts you.",
      step: interviewClosure ? 4 : 3,
      tone: "closed",
    };
  }

  if (record.status === "Accepted") {
    if (record.interview_status === "Passed") {
      return {
        eyebrow: "Interview passed",
        title: "Interview Passed — Appointment Pending",
        message: "You passed the required Department Attorney interview. Command has not yet completed the final personnel appointment.",
        next: "No action is required from you unless LSCSO contacts you. Continue monitoring Discord and this private status page.",
        step: 4,
        tone: "accepted",
      };
    }
    if (record.interview_status === "Completed") {
      return {
        eyebrow: "Interview completed",
        title: "Interview Completed — Result Pending",
        message: "Your required Department Attorney interview is complete. Command has not yet recorded a final Pass or Fail result.",
        next: "No action is required while the interview result is pending.",
        step: 4,
        tone: "review",
      };
    }
    if (record.interview_status === "Scheduled") {
      return {
        eyebrow: "Interview scheduled",
        title: "Application Accepted — Interview Scheduled",
        message: "Your written Department Attorney application was accepted and your required interview has been scheduled.",
        next: "Attend the scheduled interview and be available in Discord before the appointment time.",
        step: 4,
        tone: "accepted",
      };
    }
    return {
      eyebrow: "Application accepted",
      title: "Application Accepted — Interview Required",
      message: "Your written Department Attorney application was accepted. You have advanced to the required interview stage.",
      next: "Wait for LSCSO Command to contact you with interview scheduling information.",
      step: 3,
      tone: "accepted",
    };
  }

  if (record.status === "Under Review") {
    return {
      eyebrow: "Command screening",
      title: "Department Attorney Application Under Review",
      message: "Your application is being reviewed by authorized LSCSO Command personnel.",
      next: "No action is required from you right now. Watch this private page and Discord for any LSCSO communication.",
      step: 2,
      tone: "review",
    };
  }

  return {
    eyebrow: "Application received",
    title: "Department Attorney Application Submitted",
    message: "Your signed candidate packet has been received and is waiting for Command review.",
    next: "Keep this private tracking link and monitor Discord for any follow-up from LSCSO.",
    step: 1,
    tone: "review",
  };
}

export function DepartmentAttorneyStatusView({ record, applicantMessages }: { record: any; applicantMessages: ApplicantMessage[] }) {
  const view = viewFor(record);
  const communication = String(record.applicant_status_message ?? "").trim();
  const steps = [
    ["01", "Submitted", "Signed Department Attorney packet received"],
    ["02", "Command Review", "Legal-counsel screening and written application review"],
    ["03", "Application Decision", "Accepted to interview or final disposition"],
    ["04", "Interview", "Required Department Attorney interview"],
    ["05", "Appointment", "Final Department Attorney personnel appointment"],
  ];

  return (
    <main className="application-status-page attorney-status-page">
      <section className="application-status-hero attorney-status-hero">
        <div className="site-shell">
          <article className={`attorney-status-card attorney-status-card--${view.tone}`}>
            <header className="attorney-status-header">
              <div className="attorney-status-agency">
                <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={118} height={118} priority />
                <div><p>Los Santos County Sheriff&apos;s Office</p><strong>Department Attorney Application</strong><span>Private candidate status</span></div>
              </div>
              <div className="attorney-status-number"><span>Application</span><strong>{applicationLabel(record.application_number)}</strong></div>
            </header>

            <section className="attorney-status-title">
              <p>{view.eyebrow}</p>
              <h1>{view.title}</h1>
              <span>{view.message}</span>
            </section>

            <div className="attorney-status-timeline" aria-label="Department Attorney application progress">
              {steps.map(([number, title, description], index) => {
                const stepNumber = index + 1;
                const complete = stepNumber < view.step || (stepNumber === view.step && view.tone === "accepted" && view.step === 5);
                const current = stepNumber === view.step;
                return <article key={number} className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}><span>{complete ? "✓" : number}</span><div><strong>{title}</strong><small>{description}</small></div></article>;
              })}
            </div>

            <section className="attorney-status-facts">
              <article><span>Applicant</span><strong>{record.applicant_name || "LSCSO Applicant"}</strong></article>
              <article><span>Role</span><strong>Department Attorney</strong></article>
              <article><span>Application</span><strong>{record.status}</strong></article>
              <article><span>Interview</span><strong>{record.interview_status || "Not Scheduled"}</strong></article>
              {record.interview_scheduled_at ? <article><span>Interview time</span><strong><LocalDateTime value={record.interview_scheduled_at} /></strong></article> : null}
              <article><span>Submitted</span><strong><LocalDateTime value={record.submitted_at} /></strong></article>
              <article><span>Last updated</span><strong><LocalDateTime value={record.updated_at} /></strong></article>
            </section>

            <section className="attorney-status-next">
              <span>What happens next</span>
              <h2>{view.next}</h2>
            </section>

            {communication ? <section className="attorney-status-message"><span>Message from LSCSO</span><p>{communication}</p></section> : null}

            {applicantMessages.length ? (
              <section className="attorney-status-messages">
                <div><span>Communication record</span><h2>Messages from LSCSO</h2></div>
                {applicantMessages.map((item) => <article key={item.id}><header><strong>LSCSO Recruitment</strong><span><LocalDateTime value={item.sent_at} /></span></header><p>{item.content}</p></article>)}
              </section>
            ) : null}

            <footer className="attorney-status-footer">
              <p>This page is private. Keep the tracking link secure and do not post it publicly.</p>
              <Link className="button button--outline" href="/join">Return to Join LSCSO</Link>
            </footer>
          </article>
        </div>
      </section>
    </main>
  );
}
