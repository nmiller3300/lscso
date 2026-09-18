import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getRecruitmentStatus } from "@/lib/recruitment/status";
import "./join-experience.css";

export const metadata: Metadata = {
  title: "Join LSCSO",
  description: "Enter the LSCSO candidate selection experience for sworn service or Department Attorney.",
};

export const revalidate = 0;

const standards = [
  ["01", "Judgment", "Slow the moment down. Read what matters. Make decisions you can explain and defend."],
  ["02", "Accountability", "Own the outcome, accept correction, and understand that authority always leaves a record."],
  ["03", "Communication", "Be clear on the radio, in writing, with partners, supervisors, and the people you serve."],
  ["04", "Professionalism", "Carry the Office with intention — especially when nobody is making it easy."],
  ["05", "Teamwork", "Know when to lead, when to support, and how to operate inside a real chain of command."],
  ["06", "Development", "Training does not end at appointment. Good personnel keep sharpening the edge."],
];

const selectionSteps = [
  ["01", "Candidate Intake", "Choose your track and transmit a signed candidate record."],
  ["02", "Command Review", "Your written packet is reviewed as a complete record, not a checkbox exercise."],
  ["03", "Interview", "Selected applicants advance to a scheduled, documented LSCSO interview."],
  ["04", "Decision", "The interview is completed and Command records whether the candidate advances."],
  ["05", "Offer / Selection", "Sworn candidates may receive an employment offer; Attorney candidates advance to final selection."],
  ["06", "Appointment", "The process ends only when LSCSO records the personnel appointment and onboarding begins."],
];

export default async function JoinPage() {
  const recruitment = await getRecruitmentStatus();
  const swornOpen = recruitment.swornApplicationsOpen;
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
          <header className="join-experience__agency">
            <div className="join-experience__agency-mark">
              <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={74} height={74} priority />
            </div>
            <div>
              <span>Los Santos County</span>
              <strong>Sheriff&apos;s Office</strong>
              <small>Candidate Selection · State of San Andreas</small>
            </div>
          </header>

          <div className="join-experience__hero-grid">
            <div className="join-experience__hero-copy">
              <div className="join-experience__signal"><i /> Candidate intake system {recruitment.isOpen ? "online" : "standby"}</div>
              <h1 id="join-hero-title">Your record <em>starts here.</em></h1>
              <p>Before the uniform, the title, or the first radio call, there is a record of how you think, communicate, and carry responsibility. This is where LSCSO starts learning who you are.</p>
              <div className="join-experience__hero-actions">
                {recruitment.isOpen ? <Link className="join-experience__primary" href="#career-paths">Enter Candidate Selection <span>→</span></Link> : null}
                <Link className="join-experience__secondary" href="/training-recruitment">Explore Training & Recruitment</Link>
              </div>
            </div>

            <aside className="join-experience__intake" aria-label="Current recruitment availability">
              <div className="join-experience__intake-head">
                <span>LSCSO / Candidate Intake</span>
                <b>{recruitment.isOpen ? "LIVE" : "STANDBY"}</b>
              </div>
              <div className="join-experience__intake-seal">
                <Image src="/images/lscso-patch-color.png" alt="" width={132} height={132} aria-hidden="true" />
                <div><small>Recruitment channel</small><strong>{recruitment.isOpen ? "Accepting candidate records" : "Candidate intake paused"}</strong></div>
              </div>
              <div className="join-experience__intake-tracks">
                <article className={swornOpen ? "is-open" : "is-closed"}><span>01</span><div><strong>Sworn Personnel</strong><small>{swornOpen ? "Applications open" : "Applications closed"}</small></div><i /></article>
                <article className={attorneyOpen ? "is-open" : "is-closed"}><span>02</span><div><strong>Department Attorney</strong><small>{attorneyOpen ? "Applications open" : "Applications closed"}</small></div><i /></article>
              </div>
              <p>Role availability is controlled independently by LSCSO Command.</p>
            </aside>
          </div>

          <div className="join-experience__hero-footer">
            <span><i /> Structured selection</span>
            <span><i /> Private candidate tracking</span>
            <span><i /> Documented decisions</span>
          </div>
        </div>
      </section>

      <section className="join-experience__paths" id="career-paths" aria-labelledby="career-path-title">
        <div className="site-shell">
          <div className="join-experience__section-heading">
            <div><span>Choose your path</span><h2 id="career-path-title">Two roles. One standard.</h2></div>
            <p>The work is different. The expectation is not. Choose the track you actually intend to serve in and enter the correct candidate process.</p>
          </div>

          <div className="join-path-grid">
            <article className={`join-path join-path--sworn ${swornOpen ? "is-open" : "is-closed"}`}>
              <div className="join-path__index"><span>01</span><b>{swornOpen ? "OPEN" : "CLOSED"}</b></div>
              <div className="join-path__glyph" aria-hidden="true"><span>S</span></div>
              <div className="join-path__copy">
                <small>Operational Service</small>
                <h3>Sworn Personnel</h3>
                <p>Enter the Deputy candidate process: written application, Command review, interview, employment offer, appointment, and field development.</p>
              </div>
              <div className="join-path__details"><span>Patrol foundation</span><span>Training pipeline</span><span>Field development</span></div>
              {swornOpen ? <Link href="/join/application?role=sworn">Begin Sworn Candidate Record <span>→</span></Link> : <strong>Candidate intake currently closed</strong>}
            </article>

            <article className={`join-path join-path--attorney ${attorneyOpen ? "is-open" : "is-closed"}`}>
              <div className="join-path__index"><span>02</span><b>{attorneyOpen ? "OPEN" : "CLOSED"}</b></div>
              <div className="join-path__glyph" aria-hidden="true"><span>A</span></div>
              <div className="join-path__copy">
                <small>Department Counsel</small>
                <h3>Department Attorney</h3>
                <p>Enter the legal-counsel selection process: written application, Command review, interview, selection decision, appointment, and department onboarding.</p>
              </div>
              <div className="join-path__details"><span>Legal counsel</span><span>Records guidance</span><span>Policy review</span></div>
              {attorneyOpen ? <Link href="/join/application?role=attorney">Begin Attorney Candidate Record <span>→</span></Link> : <strong>Candidate intake currently closed</strong>}
            </article>
          </div>
        </div>
      </section>

      <section className="join-experience__standard" aria-labelledby="join-standard-title">
        <div className="site-shell">
          <div className="join-experience__standard-intro">
            <span>The standard</span>
            <h2 id="join-standard-title">Skill gets noticed. Character gets trusted.</h2>
            <p>LSCSO can teach systems, policy, procedure, and tactics. The harder question is how somebody behaves when responsibility becomes inconvenient.</p>
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
            <div><span>Candidate lifecycle</span><h2 id="join-process-title">You always know where you stand.</h2></div>
            <p>Every meaningful stage is recorded. Applicants receive a private tracking experience that changes with the process instead of leaving them guessing.</p>
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
            <span>Candidate intake</span>
            <h2>Ready to put your name on the record?</h2>
            <p>Choose the role that fits the work you intend to do. The rest of the process will meet you one stage at a time.</p>
          </div>
          {recruitment.isOpen ? <Link className="join-experience__primary" href="#career-paths">Choose Your Path <span>→</span></Link> : <strong className="join-experience__standby">Applications are currently closed</strong>}
        </div>
      </section>
    </main>
  );
}
