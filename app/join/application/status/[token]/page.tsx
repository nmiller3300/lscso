import { createHash } from "node:crypto";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LocalDateTime } from "./LocalDateTime";
import "../../application.css";
import "./status.css";
import "./communications.css";

export const metadata: Metadata = {
  title: "Application Status",
  description: "Private LSCSO recruitment application status.",
  robots: { index: false, follow: false },
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

type ApplicantStatusRecord = {
  application_number: number | string;
  applicant_name: string | null;
  status: string;
  interview_status: string;
  submitted_at: string;
  updated_at: string;
  interview_scheduled_at: string | null;
  applicant_status_message: string | null;
  hired: boolean;
};

type ApplicantMessage = {
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
  terminal?: boolean;
  tone: "review" | "accepted" | "closed" | "complete";
};

function candidateView(record: ApplicantStatusRecord): CandidateView {
  if (record.hired || record.status === "Hired") {
    return {
      title: "Selection Process Complete",
      eyebrow: "Recruit selection complete",
      message: "Congratulations. You have completed the LSCSO recruitment process and have been selected to enter the department as a Recruit.",
      nextAction: "Follow the onboarding and training instructions provided by LSCSO personnel.",
      currentStep: 4,
      tone: "complete",
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
      title: "Application Archived",
      eyebrow: "Candidate file archived",
      message: "This candidate application is no longer active in the current recruitment process.",
      nextAction: "Contact LSCSO Recruitment if you believe this status is incorrect.",
      currentStep: 2,
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

    if (["Completed", "Passed", "Failed"].includes(record.interview_status)) {
      return {
        title: "Interview Completed — Final Review",
        eyebrow: "Recruitment review in progress",
        message: "Your interview has been recorded and the selection process is in final Command review.",
        nextAction: "No action is required right now. Recruitment staff will contact you when the final disposition is recorded.",
        currentStep: 3,
        tone: "review",
      };
    }

    if (record.interview_status === "No Show") {
      return {
        title: "Interview Follow-Up Required",
        eyebrow: "Application accepted",
        message: "Your application remains in the interview stage, but the scheduled interview was recorded as a no-show.",
        nextAction: "Contact LSCSO Recruitment on Discord to determine whether the interview will be rescheduled.",
        currentStep: 3,
        tone: "accepted",
      };
    }

    return {
      title: "Application Accepted",
      eyebrow: "Written screening complete",
      message: "Your written application has been accepted. This does not constitute a Recruit appointment. A required interview is the next stage of the process.",
      nextAction: "Watch Discord for contact from LSCSO Recruitment to schedule your interview.",
      currentStep: 2,
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
    message: "Your Deputy Candidate Application has been received by the Los Santos County Sheriff's Office and entered into the Command review queue.",
    nextAction: "No action is required. Command Staff will review your application and update this page when the screening stage changes.",
    currentStep: 0,
    tone: "review",
  };
}

const steps = [
  ["01", "Application Received", "Candidate packet submitted"],
  ["02", "Command Review", "Captain+ written screening"],
  ["03", "Application Decision", "Accepted or closed"],
  ["04", "Interview", "Required candidate interview"],
  ["05", "Selection Complete", "Recruit appointment / final disposition"],
] as const;

function applicationLabel(number: number | string) {
  return `APP-${String(number).padStart(4, "0")}`;
}

export default async function ApplicantStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rawToken = String(token ?? "").trim();
  const tokenHash = rawToken.length >= 32 && rawToken.length <= 160
    ? createHash("sha256").update(rawToken).digest("hex")
    : "";

  const supabase = await createClient() as any;
  const { data, error } = tokenHash
    ? await supabase.rpc("get_recruitment_application_status", { p_tracking_token_hash: tokenHash }).maybeSingle()
    : { data: null, error: null };

  const record = !error && data ? data as ApplicantStatusRecord : null;

  if (!record) {
    return (
      <main className="application-status-page">
        <section className="application-status-hero">
          <div className="site-shell application-status-invalid">
            <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={140} height={140} priority />
            <p>LSCSO Recruitment</p>
            <h1>Private status link unavailable.</h1>
            <span>This tracking link is invalid, incomplete, or no longer associated with an active candidate record. For privacy, application details are not available without the original private tracking link.</span>
            <Link className="button" href="/join">Return to Join LSCSO</Link>
          </div>
        </section>
      </main>
    );
  }

  const { data: messageData } = await supabase.rpc("get_recruitment_application_messages", {
    p_tracking_token_hash: tokenHash,
  });
  const applicantMessages = (Array.isArray(messageData) ? messageData : []) as ApplicantMessage[];
  const view = candidateView(record);

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
                <div>
                  <span>Recruitment communications</span>
                  <h2>Messages from LSCSO Recruitment</h2>
                </div>
                <strong>{applicantMessages.length} {applicantMessages.length === 1 ? "message" : "messages"}</strong>
              </div>
              <div className="application-status-communications__history">
                {applicantMessages.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>LSCSO Recruitment</strong>
                      <span><LocalDateTime value={item.sent_at} /></span>
                    </div>
                    <p>{item.content}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="application-status-next-action">
            <span>Your next action</span>
            <h2>{view.nextAction}</h2>
            {record.interview_scheduled_at && record.status === "Accepted" ? (
              <p>Scheduled interview: <strong><LocalDateTime value={record.interview_scheduled_at} /></strong> <small>(shown in your device&apos;s local time)</small></p>
            ) : null}
          </section>

          <section className="application-status-timeline" aria-label="Recruitment timeline">
            {steps.map(([number, title, description], index) => {
              const complete = index < view.currentStep || (index === view.currentStep && view.tone === "complete");
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
              <p>This link acts as the key to your candidate-facing recruitment status. Do not post or share it publicly. Internal Command notes, interviewer notes, and internal decision reasoning are never displayed here.</p>
            </div>
            <Link className="button button--outline" href="/join">Join LSCSO</Link>
          </section>
        </div>
      </section>
    </main>
  );
}
