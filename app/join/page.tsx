import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "../_components/PageHero";
import { getRecruitmentStatus } from "@/lib/recruitment/status";

export const metadata: Metadata = {
  title: "Join LSCSO",
  description: "Learn about service, expectations, training, and the path to joining LSCSO.",
};

export const revalidate = 0;

const expectations = [
  ["Professionalism", "Represent the department professionally in public interactions, radio traffic, reports, and conduct."],
  ["Judgment", "Slow situations down, make defensible decisions, and understand discretion carries responsibility."],
  ["Accountability", "Own mistakes, accept correction, and follow policy regardless of rank or assignment."],
  ["Communication", "Communicate clearly with partners, supervisors, other agencies, and the public."],
  ["Teamwork", "Work within the chain of command and support the department rather than treating patrol as a solo experience."],
  ["Continued development", "Be willing to learn. Training and improvement continue throughout service."],
];

const steps = [
  ["01", "Application", "Submit the official LSCSO application while recruitment is open."],
  ["02", "Review", "Training & Recruitment reviews your qualifications and answers."],
  ["03", "Selection", "Qualified candidates may advance to an interview or other evaluation."],
  ["04", "Initial Training", "Learn policy, procedures, communications, documentation, and the fundamentals of service."],
  ["05", "Field Development", "Develop under designated trainers and supervisors while demonstrating safe, consistent performance."],
  ["06", "Independent Service", "Transition to regular Patrol duties while remaining accountable to continuing training and supervision."],
];

export default async function JoinPage() {
  const recruitment = await getRecruitmentStatus();

  return (
    <>
      <PageHero
        eyebrow="Careers & Recruitment"
        title="Join LSCSO"
        description="Service starts with character, judgment, and the willingness to accept responsibility for the community and the people beside you."
        image="/images/deputy-gray-uniform.png"
        imageAlt="LSCSO deputy in uniform"
        imagePosition="center 28%"
      />

      <section className={`recruitment-status-panel recruitment-status-panel--${recruitment.isOpen ? "open" : "closed"}`} aria-labelledby="recruitment-status-title">
        <div className="site-shell recruitment-status-panel__layout">
          <div className="recruitment-status-panel__mark" aria-hidden="true">
            <span>{recruitment.isOpen ? "OPEN" : "CLOSED"}</span>
            <small>Recruitment</small>
          </div>
          <div className="recruitment-status-panel__copy">
            <p className="section-kicker section-kicker--dark">Current Recruitment Status</p>
            <div className="recruitment-status-panel__heading">
              <span className="status-dot" />
              <h2 id="recruitment-status-title">Applications are currently {recruitment.isOpen ? "open" : "closed"}.</h2>
            </div>
            <p>
              {recruitment.isOpen
                ? "LSCSO is accepting applications for entry into the Patrol Division. Review the expectations and recruitment process below, then submit the official application when you are ready."
                : "LSCSO is not accepting new applications at this time. You may still review our standards, Patrol Division, and selection process while recruitment remains closed."}
            </p>
            <div className="button-row">
              {recruitment.isOpen ? <Link className="button" href="/join/application">Begin Application</Link> : <span className="recruitment-status-panel__unavailable">Application form unavailable</span>}
              <Link className="button button--outline-dark" href="/patrol">Explore Patrol Division</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="content-section content-section--light">
        <div className="site-shell two-column-editorial">
          <div><p className="section-kicker section-kicker--dark">Service with LSCSO</p><h2>More than putting on a uniform.</h2></div>
          <div className="reading-column">
            <p className="intro-serif">LSCSO is built around people who can be trusted with responsibility, authority, and the expectations that come with wearing the badge.</p>
            <p>Patrol is the foundation of sworn service. Deputies answer calls, conduct proactive patrol, investigate incidents, document actions, work with supervisors and specialty personnel, and make decisions that affect other people.</p>
            <p>We are not looking for perfection on day one. We are looking for maturity, willingness to learn, good communication, sound judgment, and people who can take both initiative and direction.</p>
          </div>
        </div>
      </section>

      <section className="content-section content-section--sand">
        <div className="site-shell">
          <div className="section-heading-row section-heading-row--dark">
            <div><p className="section-kicker section-kicker--dark">What We Expect</p><h2>The standard starts with how you carry yourself.</h2></div>
            <p>Technical skills can be taught. Character and the way someone treats other people matter just as much.</p>
          </div>
          <div className="quality-grid">
            {expectations.map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="content-section content-section--dark join-dark-section">
        <div className="site-shell two-column-editorial">
          <div><p className="section-kicker">Patrol Division</p><h2>Where sworn service begins.</h2></div>
          <div className="reading-column">
            <p className="intro-serif">Patrol deputies are expected to be capable generalists before chasing specialty titles.</p>
            <p>Specialty assignments become available as personnel develop, department needs change, and qualifications are met. Joining LSCSO is not an automatic path into a specialty unit.</p>
            <div className="button-row"><Link className="button button--outline" href="/patrol">Explore Patrol Division</Link></div>
          </div>
        </div>
      </section>

      <section className="content-section content-section--light">
        <div className="site-shell">
          <div className="section-heading-row section-heading-row--dark">
            <div><p className="section-kicker section-kicker--dark">Recruitment Process</p><h2>From applicant to deputy.</h2></div>
            <p>Every applicant is reviewed through a documented, professional process.</p>
          </div>
          <div className="quality-grid">
            {steps.map(([number, title, text]) => <article key={title}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="content-section content-section--dark join-dark-section">
        <div className="site-shell two-column-editorial">
          <div><p className="section-kicker">Before You Apply</p><h2>Prepared to serve?</h2></div>
          <div className="reading-column">
            <p>Applicants should be prepared for a structured department with policies, supervision, documentation, training standards, and accountability.</p>
            <p className="intro-serif">Application access follows the current recruitment status shown at the top of this page.</p>
            <div className="button-row">
              {recruitment.isOpen ? <Link className="button" href="/join/application">Begin Application</Link> : null}
              <Link className="button button--outline" href="/training-recruitment">Training & Recruitment</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
