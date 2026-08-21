import type { Metadata } from "next";
import { PageHero } from "../_components/PageHero";
import { RouteLink } from "../_components/RouteLink";

export const metadata: Metadata = {
  title: "Office of the Sheriff",
  description:
    "Executive leadership, organizational direction, and command responsibilities of the Los Santos County Sheriff’s Office.",
};

const responsibilities = [
  ["Organizational Direction", "Establishing priorities, policy expectations, and the standards applied throughout LSCSO."],
  ["Operational Oversight", "Maintaining readiness, consistent supervision, and accountability across agency functions."],
  ["Personnel Stewardship", "Supporting professional development, fair administration, and responsible command decisions."],
  ["Interagency Coordination", "Representing LSCSO and maintaining effective cooperation with public-safety partners."],
];

export default function OfficeOfTheSheriffPage() {
  return (
    <>
      <PageHero
        eyebrow="Executive Leadership"
        title="Office of the Sheriff"
        description="Purposeful leadership, clear standards, and direct accountability for the service LSCSO provides to Los Santos County."
        image="https://raw.githubusercontent.com/nmiller3300/lscso/main/public/images/command-uniform.png"
        imageAlt="LSCSO command staff member"
        imagePosition="center 42%"
      />

      <section className="content-section content-section--light">
        <div className="site-shell two-column-editorial">
          <div>
            <p className="section-kicker section-kicker--dark">Command Direction</p>
            <h2>Leadership that keeps the mission clear.</h2>
          </div>
          <div className="reading-column">
            <p className="intro-serif">
              Sheriff Nicholas Miller leads the Los Santos County Sheriff’s
              Office alongside Undersheriff Michael White.
            </p>
            <p>
              Together, the Sheriff and Undersheriff carry final responsibility
              for LSCSO’s direction, readiness, and professional standards.
              Executive leadership establishes department-wide priorities,
              maintains policy oversight, develops personnel, and ensures every
              function serves a defined public-safety purpose.
            </p>
            <p>
              Authority within LSCSO is inseparable from accountability. Command
              decisions are expected to reflect department values, operational
              realities, and the long-term health of the Office.
            </p>
            <div className="executive-leadership-grid" aria-label="LSCSO executive leadership">
              <article>
                <span>Sheriff</span>
                <strong>Nicholas Miller</strong>
                <small>Chief law-enforcement officer · Call sign S-401</small>
              </article>
              <article>
                <span>Undersheriff</span>
                <strong>Michael White</strong>
                <small>Executive command · Call sign S-402</small>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="content-section responsibility-section">
        <div className="site-shell">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Executive Responsibilities</p>
              <h2>Direction, readiness, and trust.</h2>
            </div>
            <p>
              The Office of the Sheriff provides the structure required for
              consistent operations and responsible leadership.
            </p>
          </div>
          <div className="responsibility-grid">
            {responsibilities.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <div className="page-actions">
            <RouteLink href="/internal-affairs" variant="outline">Professional Standards</RouteLink>
            <RouteLink href="/training-recruitment" variant="outline">Personnel Development</RouteLink>
          </div>
        </div>
      </section>
    </>
  );
}
