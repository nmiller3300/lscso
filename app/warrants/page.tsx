import type { Metadata } from "next";
import { PageHero } from "../_components/PageHero";
import { WarrantDirectory } from "./WarrantDirectory";
import { publicWarrants } from "./_data";

export const metadata: Metadata = {
  title: "Warrant Information",
  description: "Search public warrant information and view the Los Santos County Sheriff's Office Most Wanted list.",
};

export default function WarrantsPage() {
  const mostWanted = publicWarrants.filter((warrant) => warrant.mostWanted);

  return (
    <>
      <PageHero
        eyebrow="Courts & Civil Services"
        title="Warrant Information"
        description="Public warrant information maintained by the Los Santos County Sheriff's Office."
        image="/images/deputy-brown-uniform.png"
        imageAlt="LSCSO deputy in patrol uniform"
        imagePosition="center 34%"
      />

      <section className="status-ribbon status-ribbon--gold">
        <div className="site-shell">
          <span className="status-dot" />
          <strong>Public Information</strong>
          <span>Current records shown here are fictional demonstration data while LSCSO prepares for operational launch.</span>
        </div>
      </section>

      <section className="content-section content-section--light">
        <div className="site-shell two-column-editorial">
          <div>
            <p className="section-kicker section-kicker--dark">Warrant Information</p>
            <h2>Verify public warrant status.</h2>
          </div>
          <div className="reading-column">
            <p className="intro-serif">This page is intended to provide limited public information regarding warrants assigned to Los Santos County.</p>
            <p>A listed warrant should not be interpreted as a complete criminal history, and the absence of a record does not guarantee that no warrant exists. Sensitive, sealed, investigative, or otherwise non-public records will not appear here.</p>
            <p>If a person appears on this page, do not attempt to detain, confront, or investigate them yourself.</p>
          </div>
        </div>
      </section>

      <section className="content-section content-section--dark">
        <div className="site-shell">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Most Wanted</p>
              <h2>Priority apprehension notices.</h2>
            </div>
            <p>These demonstration entries represent how LSCSO can highlight public priority warrants once real server data is available.</p>
          </div>
          <div className="most-wanted-grid">
            {mostWanted.map((warrant, index) => (
              <article className="most-wanted-card" key={warrant.warrantNumber}>
                <div className="most-wanted-index">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <span className="most-wanted-label">Most Wanted</span>
                  <h3>{warrant.name}</h3>
                  <p>{warrant.charge}</p>
                </div>
                <dl>
                  <div><dt>Warrant</dt><dd>{warrant.warrantNumber}</dd></div>
                  <div><dt>Age</dt><dd>{warrant.age}</dd></div>
                  <div><dt>Status</dt><dd>{warrant.status}</dd></div>
                </dl>
                {warrant.caution ? <div className="most-wanted-caution">{warrant.caution}</div> : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section content-section--sand">
        <div className="site-shell">
          <div className="section-heading-row section-heading-row--dark">
            <div>
              <p className="section-kicker section-kicker--dark">Public Warrant Search</p>
              <h2>Search current public records.</h2>
            </div>
            <p>Search by subject name, warrant number, charge, classification, or status.</p>
          </div>
          <WarrantDirectory warrants={publicWarrants} />
        </div>
      </section>

      <section className="content-section content-section--light">
        <div className="site-shell two-column-editorial">
          <div>
            <p className="section-kicker section-kicker--dark">Future Integration</p>
            <h2>Managed from Command Portal.</h2>
          </div>
          <div className="reading-column">
            <p>When LSCSO becomes operational, authorized Command personnel will manage warrant publication, Most Wanted designation, status updates, and public visibility from the Command Portal.</p>
            <p>The public website will then display approved records directly from the department system instead of relying on manually maintained website content.</p>
          </div>
        </div>
      </section>
    </>
  );
}
