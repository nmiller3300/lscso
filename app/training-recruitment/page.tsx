import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "../_components/PageHero";
import { RouteLink } from "../_components/RouteLink";

export const metadata: Metadata = {
  title: "Training & Recruitment",
  description:
    "Explore Patrol Division recruitment and personnel-development standards within the Los Santos County Sheriff’s Office.",
};

const qualities = [
  ["Sound Judgment", "The ability to assess changing circumstances, apply policy, and make proportionate decisions."],
  ["Professional Communication", "Clear, respectful communication with the public, fellow personnel, and partner agencies."],
  ["Personal Accountability", "Ownership of decisions, conduct, performance, and continued professional development."],
  ["Service Mindset", "A genuine willingness to protect the community and contribute to the success of the Office."],
];

export default function TrainingRecruitmentPage() {
  return (
    <>
      <PageHero
        eyebrow="Standards & Development"
        title="Training & Recruitment"
        description="Selecting people with the character to serve and preparing them to meet the standard expected of an LSCSO deputy."
        image="https://raw.githubusercontent.com/nmiller3300/lscso/main/public/images/deputy-gray-uniform.png"
        imageAlt="LSCSO deputy in uniform"
        imagePosition="center 30%"
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
            <p className="section-kicker section-kicker--dark">Earn the Badge</p>
            <h2>The standard starts with character.</h2>
          </div>
          <div className="reading-column">
            <p className="intro-serif">
              LSCSO seeks disciplined, thoughtful, and community-minded people
              prepared to accept the responsibility of public service.
            </p>
            <p>
              Recruitment evaluates more than technical ability. Candidates must
              demonstrate maturity, communication, integrity, accountability,
              and the judgment necessary to represent the Sheriff’s Office.
            </p>
            <p>
              Training continues beyond initial selection through structured
              instruction, practical evaluation, certification, supervised field
              development, and continued professional growth.
            </p>
          </div>
        </div>
      </section>

      <section className="content-section content-section--sand">
        <div className="site-shell">
          <div className="section-heading-row section-heading-row--dark">
            <div>
              <p className="section-kicker section-kicker--dark">What We Look For</p>
              <h2>People prepared to carry the responsibility.</h2>
            </div>
            <p>
              The strongest candidates consistently demonstrate the values and
              decision-making expected after appointment.
            </p>
          </div>
          <div className="quality-grid">
            {qualities.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="training-feature">
        <div className="training-feature-media">
          <Image
            src="https://raw.githubusercontent.com/nmiller3300/lscso/main/public/images/deputy-brown-uniform.png"
            alt="LSCSO deputy in patrol uniform"
            fill
            sizes="(max-width: 850px) 100vw, 50vw"
          />
        </div>
        <div className="training-feature-copy">
          <p className="section-kicker">Current Opportunity</p>
          <h2>Begin with Patrol.</h2>
          <p>
            Patrol is the Office’s active operational division and the current
            route for candidates seeking a sworn deputy position.
          </p>
          <RouteLink href="/patrol">Explore Patrol Division</RouteLink>
        </div>
      </section>
    </>
  );
}
