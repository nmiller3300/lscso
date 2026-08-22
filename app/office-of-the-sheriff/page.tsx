import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "../_components/PageHero";
import { RouteLink } from "../_components/RouteLink";

export const metadata: Metadata = {
  title: "Office of the Sheriff",
  description:
    "Executive leadership, authority, command structure, and organizational direction of the Los Santos County Sheriff’s Office.",
};

const executiveLeadership = [
  {
    order: "01",
    rank: "Sheriff",
    name: "Nicholas Miller",
    callSign: "S-401",
    title: "Executive head of the Sheriff’s Office",
    summary:
      "The Sheriff establishes department-wide direction, sets the standard expected of the organization, and holds final executive authority over LSCSO operations, personnel, policy, and command decisions.",
    duties: [
      "Sets agency priorities, executive policy, and organizational standards",
      "Exercises final authority on command appointments and major personnel decisions",
      "Directs department-wide operations, structure, and long-term development",
      "Represents the Sheriff’s Office in executive and interagency matters",
    ],
  },
  {
    order: "02",
    rank: "Undersheriff",
    name: "Michael White",
    callSign: "S-402",
    title: "Second in command",
    summary:
      "The Undersheriff turns executive direction into coordinated action, maintains continuity across command functions, and acts with the authority of the Sheriff when assigned or required.",
    duties: [
      "Coordinates command staff and department-wide implementation",
      "Maintains executive oversight of readiness, staffing, and accountability",
      "Resolves cross-division issues that require senior command action",
      "Assumes executive authority when acting on behalf of the Sheriff",
    ],
  },
];

const responsibilities = [
  {
    number: "01",
    title: "Executive Direction",
    description:
      "Defines the priorities, standards, and operating expectations that guide every division and level of command within LSCSO.",
  },
  {
    number: "02",
    title: "Command Accountability",
    description:
      "Ensures authority is exercised responsibly, supervisors remain accountable for their decisions, and command actions support the long-term health of the Office.",
  },
  {
    number: "03",
    title: "Personnel Stewardship",
    description:
      "Oversees senior appointments, organizational placement, leadership development, and major personnel decisions affecting the department.",
  },
  {
    number: "04",
    title: "Operational Readiness",
    description:
      "Maintains department-wide readiness through clear command relationships, coordinated resources, policy oversight, and practical supervision.",
  },
  {
    number: "05",
    title: "Agency Integrity",
    description:
      "Protects the credibility of the Sheriff’s Office by setting expectations for ethics, documentation, professional conduct, and transparent internal accountability.",
  },
  {
    number: "06",
    title: "External Coordination",
    description:
      "Represents LSCSO in matters requiring executive-level coordination with county partners, public-safety agencies, and other authorized organizations.",
  },
];

export default function OfficeOfTheSheriffPage() {
  return (
    <>
      <PageHero
        eyebrow="Executive Leadership"
        title="Office of the Sheriff"
        description="The executive office responsible for the direction, accountability, readiness, and professional standard of the Los Santos County Sheriff’s Office."
        image="/images/command-uniform.png"
        imageAlt="LSCSO command staff member"
        imagePosition="center 42%"
      />

      <section className="sheriff-office-intro">
        <div className="site-shell sheriff-office-intro-grid">
          <div className="sheriff-office-seal" aria-hidden="true">
            <Image
              src="/images/lscso-patch-color.png"
              alt=""
              width={250}
              height={250}
              priority
            />
          </div>
          <div className="sheriff-office-intro-copy">
            <p className="section-kicker">Executive Office</p>
            <h2>The Office sets the standard for the entire agency.</h2>
            <p className="sheriff-office-lead">
              The Office of the Sheriff is more than a leadership title. It is the
              executive center of LSCSO and carries responsibility for how the
              department is organized, supervised, developed, and held accountable.
            </p>
            <p>
              The Sheriff and Undersheriff establish department-wide priorities,
              resolve issues that cross normal divisional boundaries, oversee the
              command structure, and ensure that policy and operational decisions
              remain practical, defensible, and consistent with the mission of the
              Office.
            </p>
          </div>
        </div>
      </section>

      <section className="executive-administration-section">
        <div className="site-shell">
          <div className="executive-section-heading">
            <div>
              <p className="section-kicker section-kicker--dark">Current Administration</p>
              <h2>Executive command.</h2>
            </div>
            <p>
              The Sheriff and Undersheriff operate as a unified executive office,
              with clearly defined authority and shared responsibility for the
              department’s direction and performance.
            </p>
          </div>

          <div className="executive-leadership-grid" aria-label="LSCSO executive leadership">
            {executiveLeadership.map((leader) => (
              <article className="executive-leader-card" key={leader.rank}>
                <div className="executive-leader-card-top">
                  <span className="executive-leader-order">{leader.order}</span>
                  <div className="executive-leader-call">
                    <span>Call sign</span>
                    <strong>{leader.callSign}</strong>
                  </div>
                </div>

                <div className="executive-leader-identity">
                  <span>{leader.rank}</span>
                  <h3>{leader.name}</h3>
                  <p>{leader.title}</p>
                </div>

                <p className="executive-leader-summary">{leader.summary}</p>

                <div className="executive-leader-duties">
                  <span>Executive responsibilities</span>
                  <ul>
                    {leader.duties.map((duty) => (
                      <li key={duty}>{duty}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="command-framework-section">
        <div className="site-shell command-framework-grid">
          <div className="command-framework-heading">
            <p className="section-kicker">Command Framework</p>
            <h2>Authority should always have a clear purpose.</h2>
          </div>

          <div className="command-framework-copy">
            <p className="command-framework-lead">
              Executive command exists to make the department easier to lead, not
              harder to operate.
            </p>
            <p>
              The Sheriff retains final executive authority. The Undersheriff
              serves as second in command and may exercise executive authority when
              acting for the Sheriff. Majors and other command personnel carry that
              direction into their assigned operational areas while remaining
              accountable to the executive office.
            </p>
            <p>
              LSCSO is intentionally structured so legitimate command action is not
              trapped by unnecessary administrative barriers. Senior command may
              address cross-division matters when the needs of the Office require it,
              while lower supervisory authority remains tied more closely to actual
              assignments, responsibilities, and established scope.
            </p>
          </div>
        </div>
      </section>

      <section className="executive-responsibilities-section">
        <div className="site-shell">
          <div className="executive-section-heading executive-section-heading--dark">
            <div>
              <p className="section-kicker">Office Responsibilities</p>
              <h2>What executive leadership is responsible for.</h2>
            </div>
            <p>
              These functions sit above individual divisions and help keep the
              Sheriff’s Office working as one organization rather than a collection
              of disconnected units.
            </p>
          </div>

          <div className="executive-responsibility-grid">
            {responsibilities.map((item) => (
              <article key={item.title}>
                <span>{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="executive-closing-section">
        <div className="site-shell executive-closing-grid">
          <div>
            <p className="section-kicker">Leadership Standard</p>
            <h2>Rank carries responsibility before privilege.</h2>
          </div>
          <div>
            <p>
              The Office of the Sheriff expects leaders to make decisions that are
              fair, practical, documented when necessary, and consistent with the
              standards expected from every other member of LSCSO.
            </p>
            <div className="page-actions">
              <RouteLink href="/about#history" variant="outline">Department History</RouteLink>
              <RouteLink href="/internal-affairs" variant="outline">Internal Affairs</RouteLink>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .sheriff-office-intro {
          padding: 108px 0;
          background: #11110f;
        }

        .sheriff-office-intro-grid {
          display: grid;
          grid-template-columns: minmax(250px, 0.72fr) minmax(0, 1.45fr);
          gap: clamp(70px, 9vw, 128px);
          align-items: center;
        }

        .sheriff-office-seal {
          min-height: 350px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(212, 190, 121, 0.2);
          background:
            radial-gradient(circle at center, rgba(187, 164, 95, 0.1), transparent 58%),
            #0d0d0b;
        }

        .sheriff-office-seal img {
          width: min(250px, 72%);
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 20px 38px rgba(0, 0, 0, 0.48));
        }

        .sheriff-office-intro-copy h2,
        .command-framework-heading h2,
        .executive-closing-grid h2 {
          max-width: 760px;
          margin: 0 0 30px;
          font-size: clamp(46px, 5.4vw, 74px);
          font-weight: 690;
          letter-spacing: -0.052em;
          line-height: 1;
          text-transform: uppercase;
        }

        .sheriff-office-intro-copy > p:not(.section-kicker) {
          max-width: 760px;
          margin-bottom: 20px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 17px;
          line-height: 1.78;
        }

        .sheriff-office-intro-copy .sheriff-office-lead {
          color: #f2eee3;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 23px;
          line-height: 1.55;
        }

        .executive-administration-section {
          padding: 112px 0 124px;
          background: #f3f0e8;
          color: #11110f;
        }

        .executive-section-heading {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.65fr);
          gap: 72px;
          align-items: end;
          margin-bottom: 58px;
        }

        .executive-section-heading h2 {
          margin: 0;
          font-size: clamp(48px, 5.8vw, 78px);
          font-weight: 690;
          letter-spacing: -0.052em;
          line-height: 1;
          text-transform: uppercase;
        }

        .executive-section-heading > p {
          margin: 0;
          color: #5c574e;
          font-size: 16px;
          line-height: 1.72;
        }

        .executive-leadership-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
        }

        .executive-leader-card {
          min-height: 610px;
          display: flex;
          flex-direction: column;
          padding: 36px;
          border: 1px solid #cbc2ae;
          background: #ebe5d8;
        }

        .executive-leader-card:first-child {
          border-top: 4px solid #9a833f;
        }

        .executive-leader-card:last-child {
          border-top: 4px solid #554c38;
        }

        .executive-leader-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 26px;
          border-bottom: 1px solid #c9bfaa;
        }

        .executive-leader-order {
          color: #8d7840;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .executive-leader-call {
          display: grid;
          justify-items: end;
          gap: 2px;
        }

        .executive-leader-call span {
          color: #746b5c;
          font-size: 9px;
          font-weight: 760;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .executive-leader-call strong {
          font-size: 18px;
          letter-spacing: 0.04em;
        }

        .executive-leader-identity {
          padding: 30px 0 24px;
        }

        .executive-leader-identity > span {
          display: block;
          margin-bottom: 8px;
          color: #806c35;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .executive-leader-identity h3 {
          margin: 0 0 10px;
          font-size: clamp(34px, 4vw, 52px);
          font-weight: 690;
          letter-spacing: -0.045em;
          line-height: 1;
        }

        .executive-leader-identity p {
          margin: 0;
          color: #655f55;
          font-size: 14px;
          font-weight: 650;
          text-transform: uppercase;
        }

        .executive-leader-summary {
          margin: 0 0 28px;
          color: #514c44;
          font-size: 16px;
          line-height: 1.7;
        }

        .executive-leader-duties {
          margin-top: auto;
          padding-top: 24px;
          border-top: 1px solid #c9bfaa;
        }

        .executive-leader-duties > span {
          display: block;
          margin-bottom: 13px;
          color: #766736;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .executive-leader-duties ul {
          display: grid;
          gap: 9px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .executive-leader-duties li {
          position: relative;
          padding-left: 18px;
          color: #554f46;
          font-size: 14px;
          line-height: 1.5;
        }

        .executive-leader-duties li::before {
          position: absolute;
          top: 8px;
          left: 0;
          width: 6px;
          height: 6px;
          border: 1px solid #9a833f;
          transform: rotate(45deg);
          content: "";
        }

        .command-framework-section {
          padding: 118px 0;
          background: #2b261f;
        }

        .command-framework-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
          gap: clamp(72px, 10vw, 145px);
          align-items: start;
        }

        .command-framework-copy {
          max-width: 700px;
        }

        .command-framework-copy p {
          margin-bottom: 22px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 17px;
          line-height: 1.8;
        }

        .command-framework-copy .command-framework-lead {
          color: #f2eee3;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 24px;
          line-height: 1.5;
        }

        .executive-responsibilities-section {
          padding: 118px 0 128px;
          background: #12120f;
        }

        .executive-section-heading--dark h2 {
          color: #fcfbf8;
        }

        .executive-section-heading--dark > p {
          color: rgba(255, 255, 255, 0.66);
        }

        .executive-responsibility-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          border-top: 1px solid rgba(255, 255, 255, 0.16);
          border-left: 1px solid rgba(255, 255, 255, 0.12);
        }

        .executive-responsibility-grid article {
          min-height: 300px;
          padding: 34px;
          border-right: 1px solid rgba(255, 255, 255, 0.12);
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }

        .executive-responsibility-grid article > span {
          display: block;
          margin-bottom: 52px;
          color: rgba(212, 190, 121, 0.72);
          font-size: 12px;
          font-weight: 780;
          letter-spacing: 0.14em;
        }

        .executive-responsibility-grid h3 {
          margin: 0 0 14px;
          color: #fcfbf8;
          font-size: 24px;
          font-weight: 660;
          letter-spacing: -0.025em;
          text-transform: uppercase;
        }

        .executive-responsibility-grid p {
          margin: 0;
          color: rgba(255, 255, 255, 0.66);
          font-size: 15px;
          line-height: 1.68;
        }

        .executive-closing-section {
          padding: 108px 0 116px;
          background: #9d8748;
          color: #11110f;
        }

        .executive-closing-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
          gap: 86px;
          align-items: end;
        }

        .executive-closing-grid .section-kicker {
          color: #29251d;
        }

        .executive-closing-grid h2 {
          margin-bottom: 0;
        }

        .executive-closing-grid > div:last-child > p {
          margin: 0;
          color: rgba(17, 17, 15, 0.78);
          font-size: 17px;
          line-height: 1.75;
        }

        .executive-closing-section .route-link--outline {
          border-color: rgba(17, 17, 15, 0.46);
          background: rgba(17, 17, 15, 0.06);
          color: #11110f;
        }

        .executive-closing-section .route-link--outline:hover,
        .executive-closing-section .route-link--outline:focus-visible {
          border-color: #11110f;
          background: #11110f;
          color: #fcfbf8;
        }

        @media (max-width: 900px) {
          .sheriff-office-intro-grid,
          .command-framework-grid,
          .executive-closing-grid,
          .executive-section-heading {
            grid-template-columns: 1fr;
            gap: 38px;
          }

          .sheriff-office-seal {
            min-height: 280px;
          }

          .executive-leadership-grid {
            grid-template-columns: 1fr;
          }

          .executive-responsibility-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 620px) {
          .sheriff-office-intro,
          .executive-administration-section,
          .command-framework-section,
          .executive-responsibilities-section,
          .executive-closing-section {
            padding: 78px 0;
          }

          .sheriff-office-intro-copy h2,
          .command-framework-heading h2,
          .executive-section-heading h2,
          .executive-closing-grid h2 {
            font-size: 42px;
          }

          .executive-leader-card {
            min-height: 0;
            padding: 28px 24px;
          }

          .executive-responsibility-grid {
            grid-template-columns: 1fr;
          }

          .executive-responsibility-grid article {
            min-height: 0;
          }
        }
      `}</style>
    </>
  );
}
