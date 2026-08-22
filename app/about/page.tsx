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

const administrations = [
  {
    years: "1963–1978",
    sheriff: "Sheriff Warren McCall",
    summary:
      "Founding administration. McCall organized the county’s first unified sheriff’s patrol structure, established the Office’s permanent headquarters, and set the initial standards for countywide service.",
  },
  {
    years: "1978–1994",
    sheriff: "Sheriff Elena Vance",
    summary:
      "Vance oversaw the Office through a period of major county growth, expanding patrol coverage, formalizing supervisory ranks, and creating dedicated training and professional-standards functions.",
  },
  {
    years: "1994–2009",
    sheriff: "Sheriff Robert Hale",
    summary:
      "Hale modernized communications, fleet operations, and investigative coordination while strengthening relationships between LSCSO and municipal public-safety agencies across the county.",
  },
  {
    years: "2009–2021",
    sheriff: "Sheriff Daniel Mercer",
    summary:
      "Mercer emphasized organizational accountability, standardized internal documentation, and expanded leadership development as the Office moved toward a more modern command structure.",
  },
  {
    years: "2021–2026",
    sheriff: "Sheriff Thomas Rourke",
    summary:
      "Rourke’s administration focused on operational consistency, field supervision, and rebuilding department-wide standards during a period of transition and changing service demands.",
  },
  {
    years: "2026–Present",
    sheriff: "Sheriff Nicholas Miller",
    deputy: "Undersheriff Michael White",
    summary:
      "The Miller–White administration is centered on professional accountability, practical leadership, personnel development, and building an Office capable of supporting modern county operations without losing sight of service, judgment, and trust.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About LSCSO"
        title="A tradition of service. A modern standard."
        description="Established in 1963, the Los Santos County Sheriff’s Office is built around public trust, professional service, and accountable leadership."
        image="/images/deputy-brown-uniform.png"
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

      <section className="content-section department-history-section" id="history">
        <div className="site-shell">
          <div className="history-heading">
            <div>
              <p className="section-kicker">Department History</p>
              <h2>Six decades of county service.</h2>
            </div>
            <p>
              Since 1963, each administration has shaped the Office around the
              needs of its time while carrying forward the same responsibility:
              serve Los Santos County with professionalism, judgment, and accountability.
            </p>
          </div>

          <div className="history-list">
            {administrations.map((administration, index) => (
              <article className={index === administrations.length - 1 ? "history-entry history-entry--current" : "history-entry"} key={administration.years}>
                <div className="history-years">{administration.years}</div>
                <div className="history-administration">
                  <span>{index === 0 ? "Founding Administration" : index === administrations.length - 1 ? "Current Administration" : "Administration"}</span>
                  <h3>{administration.sheriff}</h3>
                  {administration.deputy ? <strong>{administration.deputy}</strong> : null}
                </div>
                <p>{administration.summary}</p>
              </article>
            ))}
          </div>
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

      <style>{`
        .department-history-section {
          background: #12120f;
        }

        .history-heading {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.7fr);
          gap: 76px;
          align-items: end;
          margin-bottom: 58px;
        }

        .history-heading h2 {
          max-width: 760px;
          margin: 0;
          font-size: clamp(48px, 5.8vw, 76px);
          font-weight: 690;
          letter-spacing: -0.052em;
          line-height: 1;
          text-transform: uppercase;
        }

        .history-heading > p {
          margin: 0;
          color: rgba(255, 255, 255, 0.58);
          font-size: 16px;
          line-height: 1.72;
        }

        .history-list {
          border-top: 1px solid rgba(255, 255, 255, 0.15);
        }

        .history-entry {
          display: grid;
          grid-template-columns: 150px minmax(260px, 0.8fr) minmax(340px, 1.2fr);
          gap: 36px;
          align-items: start;
          padding: 34px 0 36px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }

        .history-years {
          color: #d4be79;
          font-size: 13px;
          font-weight: 760;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .history-administration {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .history-administration span {
          color: rgba(255, 255, 255, 0.38);
          font-size: 9px;
          font-weight: 760;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .history-administration h3 {
          margin: 0;
          font-size: 25px;
          font-weight: 660;
          letter-spacing: -0.025em;
        }

        .history-administration strong {
          color: #d4be79;
          font-size: 12px;
          font-weight: 720;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .history-entry > p {
          margin: 0;
          color: rgba(255, 255, 255, 0.59);
          font-size: 15px;
          line-height: 1.68;
        }

        .history-entry--current {
          position: relative;
          background: linear-gradient(90deg, rgba(187, 164, 95, 0.08), transparent 70%);
        }

        .history-entry--current::before {
          position: absolute;
          top: 0;
          bottom: 0;
          left: -18px;
          width: 2px;
          background: #d4be79;
          content: "";
        }

        @media (max-width: 820px) {
          .history-heading {
            grid-template-columns: 1fr;
            gap: 28px;
            margin-bottom: 38px;
          }

          .history-heading h2 {
            font-size: 44px;
          }

          .history-entry {
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 28px 0 30px;
          }

          .history-entry--current::before {
            left: -10px;
          }
        }
      `}</style>
    </>
  );
}
