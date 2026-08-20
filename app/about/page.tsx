import type { Metadata } from "next";
import { PageHero } from "../_components/PageHero";
import { RouteLink } from "../_components/RouteLink";

export const metadata: Metadata = {
  title: "About the Office",
  description:
    "Learn about the scope, mission, history, and core values of the Los Santos County Sheriff’s Office.",
};

const values = [
  ["Integrity", "We act honestly and ethically regardless of rank, circumstance, or supervision. Our personnel are expected to do what is right, even when it is difficult."],
  ["Service", "Our authority exists to serve the community. Every interaction should strengthen public safety, community confidence, and the overall function of the Office."],
  ["Professionalism", "We carry ourselves with maturity, competence, and composure. Professionalism is demonstrated through judgment, communication, and conduct."],
  ["Accountability", "Every member of LSCSO is accountable for their decisions and conduct. Rank, seniority, or position places no one above department standards."],
  ["Judgment", "Policy guides decision-making, but it does not replace thinking. Deputies must consider circumstances, use reasonable discretion, and act proportionally."],
  ["Respect", "Residents, victims, witnesses, suspects, partner agencies, and fellow personnel will be treated with dignity and respect in every encounter."],
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About LSCSO"
        title="A tradition of service. A modern standard."
        description="Established in 1963, the Los Santos County Sheriff’s Office is built around public trust, professional service, and accountable leadership."
        image="https://raw.githubusercontent.com/nmiller3300/lscso/main/public/images/deputy-brown-uniform.png"
        imageAlt="Los Santos County sheriff’s deputy"
        imagePosition="center 26%"
      />

      <section className="content-section content-section--light">
        <div className="site-shell scope-grid">
          <div className="sticky-heading">
            <p className="section-kicker section-kicker--dark">Scope</p>
            <h2>Serving the whole of Los Santos County.</h2>
          </div>
          <div className="reading-column reading-column--wide">
            <p className="intro-serif">
              The Los Santos County Sheriff’s Office is a county law enforcement
              agency serving the residents, visitors, and communities of Los
              Santos County.
            </p>
            <p>
              The Sheriff’s Office is responsible for maintaining public safety
              through patrol operations, calls for service, traffic enforcement,
              criminal investigations, emergency response, and other law
              enforcement functions necessary to protect life, property, and
              public order within its established jurisdiction.
            </p>
            <p>
              LSCSO may provide assistance to partner agencies when requested or
              when circumstances require a coordinated response. The Office
              maintains clearly established jurisdictional boundaries while
              recognizing that cooperation between agencies is essential to
              effective public safety.
            </p>
          </div>
        </div>
      </section>

      <section className="content-section mission-statement-section">
        <div className="site-shell statement-grid">
          <p className="section-kicker">Mission Statement</p>
          <blockquote>
            To provide professional, fair, and accountable law enforcement
            services while building meaningful trust with the communities we
            serve.
          </blockquote>
          <p>
            We are committed to protecting life and property, exercising sound
            judgment, developing our personnel, and maintaining an environment
            where integrity and professionalism strengthen public confidence.
          </p>
        </div>
      </section>

      <section className="content-section content-section--sand" id="core-values">
        <div className="site-shell">
          <div className="section-heading-row section-heading-row--dark">
            <div>
              <p className="section-kicker section-kicker--dark">Core Values</p>
              <h2>Character is the foundation of service.</h2>
            </div>
            <p>
              These standards define how LSCSO personnel are expected to operate,
              lead, and contribute to the community.
            </p>
          </div>
          <div className="value-grid">
            {values.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <div className="page-actions page-actions--dark">
            <RouteLink href="/office-of-the-sheriff" variant="text">Office Leadership</RouteLink>
            <RouteLink href="/patrol" variant="text">Patrol Operations</RouteLink>
          </div>
        </div>
      </section>
    </>
  );
}
