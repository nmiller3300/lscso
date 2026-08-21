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

const executiveLeadership = [
  {
    order: "01",
    rank: "Sheriff",
    name: "Nicholas Miller",
    role: "Chief law-enforcement officer",
    callSign: "S-401",
    summary: "Sets the Office’s direction, standards, and final executive decisions.",
  },
  {
    order: "02",
    rank: "Undersheriff",
    name: "Michael White",
    role: "Second in command",
    callSign: "S-402",
    summary: "Directs executive coordination, readiness, and command implementation.",
  },
];

export default function OfficeOfTheSheriffPage() {
  return (
    <>
      <PageHero
        eyebrow="Executive Leadership"
        title="Office of the Sheriff"
        description="Purposeful leadership, clear standards, and direct accountability for the service LSCSO provides to Los Santos County."
        image="/images/command-uniform.png"
        imageAlt="LSCSO command staff member"
        imagePosition="center 42%"
      />

      <section className="content-section content-section--light">
        <div className="site-shell office-leadership-layout">
          <div>
            <p className="section-kicker section-kicker--dark">Command Direction</p>
            <h2>Leadership that keeps the mission clear.</h2>
          </div>
          <div className="reading-column">
            <p className="intro-serif">
              Executive command carries final responsibility for the direction,
              readiness, and professional standards of the Office.
            </p>
            <p>
              Department-wide priorities, policy oversight, personnel development,
              and operational decisions are coordinated through a clear executive
              chain of command.
            </p>
            <p>
              Authority within LSCSO is inseparable from accountability. Command
              decisions are expected to reflect department values, operational
              realities, and the long-term health of the Office.
            </p>
          </div>
          <div className="executive-command-roster" aria-label="LSCSO executive leadership">
            {executiveLeadership.map((leader) => (
              <article key={leader.rank}>
                <span className="executive-command-index">{leader.order}</span>
                <div className="executive-command-identity">
                  <span>{leader.rank}</span>
                  <h3>{leader.name}</h3>
                </div>
                <div className="executive-command-role">
                  <strong>{leader.role}</strong>
                  <p>{leader.summary}</p>
                </div>
                <div className="executive-command-call">
                  <span>Call sign</span>
                  <strong>{leader.callSign}</strong>
                </div>
              </article>
            ))}
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
