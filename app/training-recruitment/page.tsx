import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getRecruitmentStatus } from "@/lib/recruitment/status";
import "./training-recruitment-experience.css";

export const metadata: Metadata = {
  title: "Training & Recruitment",
  description: "Explore LSCSO candidate selection, sworn development, and the standards carried from application through field service.",
};

export const revalidate = 0;

const qualities = [
  ["01", "Judgment", "Read the whole moment before acting. Authority means very little without disciplined decision-making."],
  ["02", "Communication", "Explain yourself clearly, listen well, and keep the people around you oriented when a scene gets complicated."],
  ["03", "Accountability", "Own the call, accept correction, document what matters, and keep moving forward without excuses."],
  ["04", "Composure", "Stay useful when the pace changes. LSCSO is looking for people who can think without becoming the problem."],
];

const development = [
  ["01", "Selection", "Written candidate record, Command review, and documented interview decision."],
  ["02", "Appointment", "Personnel record, credentials, department access, and formal onboarding."],
  ["03", "Academy Foundation", "Policy, law, communication, officer safety, procedure, and core department expectations."],
  ["04", "Field Development", "Supervised application of training through the FTO process and structured performance review."],
  ["05", "Certification", "Role-specific qualifications are awarded, tracked, renewed, and retained in the personnel record."],
  ["06", "Continued Growth", "Development continues through experience, specialty opportunities, supervision, and advanced responsibility."],
];

export default async function TrainingRecruitmentPage() {
  const recruitment = await getRecruitmentStatus();

  return (
    <main className="training-recruitment-experience">
      <section className="training-recruitment-hero">
        <div className="training-recruitment-hero__ambient" aria-hidden="true"><span /><span /><span /></div>
        <Image className="training-recruitment-hero__watermark" src="/images/lscso-patch-color.png" alt="" width={820} height={820} priority aria-hidden="true" />
        <div className="site-shell training-recruitment-hero__shell">
          <div className="training-recruitment-hero__copy">
            <div className="training-recruitment-hero__signal"><i /> Selection & Development System</div>
            <span className="training-recruitment-hero__eyebrow">Training / Recruitment</span>
            <h1>We do not just select deputies. <em>We build them.</em></h1>
            <p>The candidate process identifies the person. Training reveals whether that person can carry the standard when the work becomes real.</p>
            <div className="training-recruitment-hero__actions">
              {recruitment.isOpen ? <Link className="training-recruitment-primary" href="/join">Enter Candidate Selection <span>→</span></Link> : null}
              <Link className="training-recruitment-secondary" href="/patrol">Explore Patrol Division</Link>
            </div>
          </div>

          <div className="training-recruitment-hero__figure" aria-label="LSCSO sworn development">
            <div className="training-recruitment-hero__ring" />
            <Image src="/images/deputy-gray-uniform.png" alt="LSCSO deputy in uniform" fill priority sizes="(max-width: 900px) 85vw, 36vw" />
            <div className="training-recruitment-hero__figure-label"><span>Sworn Development</span><strong>Selection → Field Readiness</strong><small>Los Santos County Sheriff&apos;s Office</small></div>
          </div>
        </div>
        <div className="site-shell training-recruitment-hero__footer"><span>Candidate record</span><i /><span>Interview</span><i /><span>Appointment</span><i /><span>Training</span><i /><span>Field development</span></div>
      </section>

      <section className="training-recruitment-standard">
        <div className="site-shell training-recruitment-standard__shell">
          <div className="training-recruitment-standard__intro">
            <span>The selection standard</span>
            <h2>We can teach procedure. We cannot manufacture character.</h2>
            <p>The strongest candidates are not necessarily the loudest, most experienced, or most decorated. They are the people Command can trust to make the next decision for the right reason.</p>
          </div>
          <div className="training-recruitment-standard__grid">
            {qualities.map(([number, title, description]) => (
              <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>
            ))}
          </div>
        </div>
      </section>

      <section className="training-recruitment-pathway">
        <div className="site-shell">
          <div className="training-recruitment-heading">
            <div><span>After selection</span><h2>The badge is the beginning, not the finish line.</h2></div>
            <p>Appointment creates the personnel record. Development is what turns that appointment into a capable deputy.</p>
          </div>
          <div className="training-recruitment-pathway__rail">
            {development.map(([number, title, description]) => (
              <article key={number}><span>{number}</span><div><strong>{title}</strong><p>{description}</p></div></article>
            ))}
          </div>
        </div>
      </section>

      <section className="training-recruitment-field">
        <div className="training-recruitment-field__media">
          <Image src="/images/deputy-brown-uniform.png" alt="LSCSO deputy in patrol uniform" fill sizes="(max-width: 900px) 100vw, 48vw" />
          <div className="training-recruitment-field__shade" />
          <div className="training-recruitment-field__label"><span>Field Development</span><strong>Learn it. Apply it. Defend it.</strong></div>
        </div>
        <div className="training-recruitment-field__copy">
          <span>Patrol foundation</span>
          <h2>Training has to survive contact with the street.</h2>
          <p>Policy and classroom instruction matter. Field development is where candidates learn to apply that knowledge while communicating, prioritizing, documenting, and operating inside the department’s chain of command.</p>
          <div className="training-recruitment-field__points">
            <article><strong>Structured evaluation</strong><small>Progress is documented instead of left to memory or opinion.</small></article>
            <article><strong>Supervised application</strong><small>New personnel build judgment with experienced personnel beside them.</small></article>
            <article><strong>Recorded qualifications</strong><small>Certifications and milestones stay attached to the personnel record.</small></article>
          </div>
          <Link href="/patrol">See where sworn service begins <span>→</span></Link>
        </div>
      </section>

      <section className="training-recruitment-close">
        <div className="site-shell training-recruitment-close__shell">
          <div>
            <span>Candidate Selection</span>
            <h2>Think you can carry the standard?</h2>
            <p>Put your name on a candidate record and let the process answer the rest.</p>
          </div>
          <div className="training-recruitment-close__actions">
            {recruitment.swornApplicationsOpen ? <Link className="training-recruitment-primary" href="/join/application?role=sworn">Sworn Candidate Record <span>→</span></Link> : null}
            {recruitment.departmentAttorneyApplicationsOpen ? <Link className="training-recruitment-secondary" href="/join/application?role=attorney">Department Attorney</Link> : null}
            {!recruitment.isOpen ? <strong>Candidate intake is currently closed.</strong> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
