import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getRecruitmentStatus } from "@/lib/recruitment/status";
import "./join-experience.css";
import "./join-forensics-polish.css";

export const metadata: Metadata = {
  title: "Join LSCSO",
  description: "Apply for Sworn Personnel, Forensics Specialist, or Department Attorney with the Los Santos County Sheriff’s Office.",
};

export const revalidate = 0;

const standards = [
  ["01", "Judgment", "Make sound decisions based on the information available and be able to explain them."],
  ["02", "Accountability", "Take responsibility for your actions, follow policy, and respond appropriately to correction."],
  ["03", "Communication", "Communicate clearly in writing, over the radio, and with coworkers and the public."],
  ["04", "Professionalism", "Maintain professional conduct and represent the Sheriff’s Office appropriately."],
  ["05", "Teamwork", "Work effectively within the chain of command and support other personnel."],
  ["06", "Development", "Complete required training and maintain the knowledge and skills expected for the position."],
];

const selectionSteps = [
  ["01", "Application Submitted", "Complete the application for the position you are seeking."],
  ["02", "Command Review", "LSCSO Command reviews the completed application."],
  ["03", "Interview", "Selected applicants are contacted to complete the interview process."],
  ["04", "Selection Decision", "Command records the outcome of the interview and application review."],
  ["05", "Offer or Appointment", "The final hiring or appointment step is completed for the selected role."],
  ["06", "Onboarding", "Selected personnel receive the access, orientation, and training required for their position."],
];

export default async function JoinPage() {
  const recruitment = await getRecruitmentStatus();
  const swornOpen = recruitment.swornApplicationsOpen;
  const forensicsOpen = recruitment.forensicsSpecialistApplicationsOpen;
  const attorneyOpen = recruitment.departmentAttorneyApplicationsOpen;

  return (
    <main className="join-experience">
      <section className="join-experience__hero" aria-labelledby="join-hero-title">
        <div className="join-experience__atmosphere" aria-hidden="true">
          <span className="join-experience__orbit join-experience__orbit--one" />
          <span className="join-experience__orbit join-experience__orbit--two" />
          <span className="join-experience__beam join-experience__beam--gold" />
          <span className="join-experience__beam join-experience__beam--steel" />
        </div>

        <Image
          className="join-experience__watermark"
          src="/images/lscso-patch-color.png"
          alt=""
          width={900}
          height={900}
          priority
          aria-hidden="true"
        />

        <div className="site-shell join-experience__hero-shell">
          <div className="join-experience__hero-grid">
            <div className="join-experience__hero-copy">
              <div className="join-experience__signal"><i /> Applications {recruitment.isOpen ? "open" : "closed"}</div>
              <h1 id="join-hero-title">Join the Los Santos County Sheriff&apos;s Office.</h1>
              <p>Review the open positions below and select the role you want to apply for. Each position has its own application and review process.</p>
              <div className="join-experience__hero-actions">
                {recruitment.isOpen ? <Link className="join-experience__primary" href="#career-paths">View Open Applications <span>→</span></Link> : null}
                <Link className="join-experience__secondary" href="/training-recruitment">Training & Recruitment</Link>
              </div>
            </div>

            <aside className="join-experience__intake" aria-label="Current recruitment availability">
              <div className="join-experience__intake-head">
                <span>Current openings</span>
                <b>{recruitment.isOpen ? "OPEN" : "CLOSED"}</b>
              </div>
              <div className="join-experience__intake-seal">
                <Image src="/images/lscso-patch-color.png" alt="" width={132} height={132} aria-hidden="true" />
                <div><small>Recruitment</small><strong>{recruitment.isOpen ? "Applications currently open" : "Applications currently closed"}</strong></div>
              </div>
              <div className="join-experience__intake-tracks">
                <article className={swornOpen ? "is-open" : "is-closed"}><span>01</span><div><strong>Sworn Personnel</strong><small>{swornOpen ? "Applications open" : "Applications closed"}</small></div><i /></article>
                <article className={forensicsOpen ? "is-open" : "is-closed"}><span>02</span><div><strong>Forensics Specialist</strong><small>{forensicsOpen ? "Applications open" : "Applications closed"}</small></div><i /></article>
                <article className={attorneyOpen ? "is-open" : "is-closed"}><span>03</span><div><strong>Department Attorney</strong><small>{attorneyOpen ? "Applications open" : "Applications closed"}</small></div><i /></article>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="join-experience__paths" id="career-paths" aria-labelledby="career-path-title">
        <div className="site-shell">
          <div className="join-experience__section-heading">
            <div><span>Open applications</span><h2 id="career-path-title">Choose the role you want to apply for.</h2></div>
            <p>Select a position below to open its application. Availability is shown separately for each role.</p>
          </div>

          <div className="join-path-grid">
            <article className={`join-path join-path--sworn ${swornOpen ? "is-open" : "is-closed"}`}>
              <div className="join-path__index"><span>01</span><b>{swornOpen ? "OPEN" : "CLOSED"}</b></div>
              <div className="join-path__glyph" aria-hidden="true"><span>S</span></div>
              <div className="join-path__copy">
                <small>Sworn Service</small>
                <h3>Sworn Personnel</h3>
                <p>Apply for a sworn Deputy position with the Los Santos County Sheriff&apos;s Office.</p>
              </div>
              {swornOpen ? <Link href="/join/application?role=sworn">Apply for Sworn Personnel <span>→</span></Link> : <strong>Applications currently closed</strong>}
            </article>

            <article className={`join-path join-path--forensics ${forensicsOpen ? "is-open" : "is-closed"}`}>
              <div className="join-path__index"><span>02</span><b>{forensicsOpen ? "OPEN" : "CLOSED"}</b></div>
              <div className="join-path__glyph" aria-hidden="true"><span>F</span></div>
              <div className="join-path__copy">
                <small>Forensic Services</small>
                <h3>Forensics Specialist</h3>
                <p>Apply to Forensic Services as a Forensics Specialist supporting scene processing, evidence handling, and investigations.</p>
              </div>
              {forensicsOpen ? <Link href="/join/application?role=forensics">Apply for Forensics Specialist <span>→</span></Link> : <strong>Applications currently closed</strong>}
            </article>

            <article className={`join-path join-path--attorney ${attorneyOpen ? "is-open" : "is-closed"}`}>
              <div className="join-path__index"><span>03</span><b>{attorneyOpen ? "OPEN" : "CLOSED"}</b></div>
              <div className="join-path__glyph" aria-hidden="true"><span>A</span></div>
              <div className="join-path__copy">
                <small>Department Counsel</small>
                <h3>Department Attorney</h3>
                <p>Apply to serve as Department Attorney and provide legal counsel and policy guidance to the Sheriff&apos;s Office.</p>
              </div>
              {attorneyOpen ? <Link href="/join/application?role=attorney">Apply for Department Attorney <span>→</span></Link> : <strong>Applications currently closed</strong>}
            </article>
          </div>
        </div>
      </section>

      <section className="join-experience__standard" aria-labelledby="join-standard-title">
        <div className="site-shell">
          <div className="join-experience__standard-intro">
            <span>Applicant expectations</span>
            <h2 id="join-standard-title">What LSCSO expects from applicants.</h2>
            <p>Every position carries different responsibilities, but all applicants are expected to demonstrate the same basic professional standards.</p>
          </div>
          <div className="join-standard-grid">
            {standards.map(([number, title, text]) => (
              <article key={title}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>
            ))}
          </div>
        </div>
      </section>

      <section className="join-experience__process" aria-labelledby="join-process-title">
        <div className="site-shell">
          <div className="join-experience__section-heading join-experience__section-heading--process">
            <div><span>Application process</span><h2 id="join-process-title">What happens after you apply.</h2></div>
            <p>The exact hiring steps vary by position, but applicants can review their current status throughout the process.</p>
          </div>
          <div className="join-process-rail">
            {selectionSteps.map(([number, title, text]) => (
              <article key={number}><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></article>
            ))}
          </div>
        </div>
      </section>

      <section className="join-experience__close">
        <div className="site-shell join-experience__close-shell">
          <div>
            <span>Applications</span>
            <h2>Ready to apply?</h2>
            <p>Choose an open position to begin the correct application.</p>
          </div>
          {recruitment.isOpen ? <Link className="join-experience__primary" href="#career-paths">View Applications <span>→</span></Link> : <strong className="join-experience__standby">Applications are currently closed</strong>}
        </div>
      </section>
    </main>
  );
}
