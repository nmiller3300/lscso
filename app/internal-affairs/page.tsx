import type { Metadata } from "next";
import { PageHero } from "../_components/PageHero";
import { RouteLink } from "../_components/RouteLink";

export const metadata: Metadata = {
  title: "Internal Affairs",
  description:
    "Professional standards, impartial review, and accountability within the Los Santos County Sheriff’s Office.",
};

const process = [
  ["Intake", "A concern or alleged policy violation is documented with the information available at the time of submission."],
  ["Impartial Review", "Facts, records, and relevant circumstances are reviewed consistently without regard to rank or assignment."],
  ["Findings", "The review is concluded through documented findings and any action authorized by department policy."],
];

export default function InternalAffairsPage() {
  return (
    <>
      <PageHero
        eyebrow="Professional Standards"
        title="Internal Affairs"
        description="Protecting the integrity of the Office through fair, consistent, and impartial review."
        image="/images/lscso-patch-subdued.png"
        imageAlt="Subdued LSCSO shoulder patch"
        containedImage
      />

      <section className="content-section content-section--light">
        <div className="site-shell two-column-editorial">
          <div>
            <p className="section-kicker section-kicker--dark">Our Mandate</p>
            <h2>Accountability without exception.</h2>
          </div>
          <div className="reading-column">
            <p className="intro-serif">
              Public trust depends on the willingness of an agency to examine its
              own conduct honestly and consistently.
            </p>
            <p>
              Internal Affairs reviews allegations of misconduct, serious policy
              violations, and professional-standards concerns involving LSCSO
              personnel. Reviews are expected to be factual, impartial, and
              appropriately documented.
            </p>
            <p>
              Rank, seniority, and assignment do not alter the standards applied
              to department members or the responsibility to cooperate with an
              authorized review.
            </p>
          </div>
        </div>
      </section>

      <section className="content-section process-section">
        <div className="site-shell">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Review Framework</p>
              <h2>Fair process. Documented findings.</h2>
            </div>
            <p>
              The specific handling of any matter remains governed by department
              policy and the circumstances of the review.
            </p>
          </div>
          <div className="process-grid">
            {process.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <div className="page-actions">
            <RouteLink href="/join/application">Begin with Patrol</RouteLink>
            <RouteLink href="/about#core-values" variant="outline">Review Our Core Values</RouteLink>
            <RouteLink href="/office-of-the-sheriff" variant="outline">Office Leadership</RouteLink>
          </div>
        </div>
      </section>
    </>
  );
}
