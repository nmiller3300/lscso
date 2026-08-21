import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "../_components/PageHero";

export const metadata: Metadata = {
  title: "Join LSCSO",
  description: "Learn about joining the Los Santos County Sheriff’s Office and the path into Patrol Division.",
};

const steps = [
  ["01", "Apply", "Submit an application when recruitment is open. The application system will be connected here as recruitment tooling is finalized."],
  ["02", "Review", "Training & Recruitment reviews applicants for eligibility, professionalism, and overall suitability for appointment."],
  ["03", "Selection", "Qualified applicants advance through the department’s selection process and any required interviews or evaluations."],
  ["04", "Training", "Selected recruits enter structured training and supervised development before independent service."],
];

export default function JoinPage() {
  return (
    <>
      <PageHero
        eyebrow="Careers & Recruitment"
        title="Join LSCSO"
        description="Service starts with character, judgment, and the willingness to accept responsibility for the community you represent."
        image="/images/deputy-gray-uniform.png"
        imageAlt="LSCSO deputy in uniform"
        imagePosition="center 28%"
      />

      <section className="status-ribbon status-ribbon--gold">
        <div className="site-shell">
          <span className="status-dot" />
          <strong>Applications Open</strong>
          <span>Current sworn recruitment is for the Patrol Division.</span>
        </div>
      </section>

      <section className="content-section content-section--light">
        <div className="site-shell two-column-editorial">
          <div>
            <p className="section-kicker section-kicker--dark">Serve Los Santos County</p>
            <h2>Start your career with Patrol.</h2>
          </div>
          <div className="reading-column">
            <p className="intro-serif">LSCSO is looking for people who can be trusted with responsibility, authority, and the expectations that come with wearing the badge.</p>
            <p>Patrol Division is the current entry point for sworn personnel. Applicants should be prepared to communicate professionally, learn department policy, accept coaching, exercise sound judgment, and work as part of a structured chain of command.</p>
            <p>This page is the permanent home for LSCSO recruitment. The department application will be integrated here when it is ready, so applicants will not need to hunt through Discord or unrelated pages to begin the process.</p>
          </div>
        </div>
      </section>

      <section className="content-section content-section--sand">
        <div className="site-shell">
          <div className="section-heading-row section-heading-row--dark">
            <div><p className="section-kicker section-kicker--dark">The Process</p><h2>What to expect.</h2></div>
            <p>A straightforward path from application to supervised field development.</p>
          </div>
          <div className="quality-grid">
            {steps.map(([number, title, description]) => (
              <article key={title}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section content-section--dark">
        <div className="site-shell two-column-editorial">
          <div><p className="section-kicker">Application</p><h2>Ready when recruitment is.</h2></div>
          <div className="reading-column">
            <p>The online application portal is being prepared for integration. Once connected, this section will become the direct application entry point and can later support department notification workflows without changing the public recruitment URL.</p>
            <div className="button-row">
              <span className="button button--muted" aria-disabled="true">Application integration coming soon</span>
              <Link className="button button--outline" href="/patrol">Explore Patrol Division</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
