import type { Metadata } from "next";
import { PageHero } from "../_components/PageHero";
import { RouteLink } from "../_components/RouteLink";

export const metadata: Metadata = {
  title: "Forensic Services Division",
  description: "Learn about Forensic Services and the Forensics Specialist role within the Los Santos County Sheriff’s Office.",
};

const responsibilities = [
  "Documenting and processing crime scenes with a focus on preserving the integrity of the record",
  "Collecting, packaging, labeling, and transferring evidence using department procedures",
  "Photographing and documenting relevant scene conditions and evidentiary items",
  "Supporting deputies and investigators with technical scene-processing needs",
  "Maintaining clear notes, chain-of-custody records, and forensic documentation",
  "Providing objective findings without exceeding the specialist’s training or role",
];

export default function ForensicServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Specialized Operations"
        title="Forensic Services Division"
        description="Careful scene work, reliable documentation, and evidence integrity in support of LSCSO investigations."
        image="/images/lscso-patch-subdued.png"
        imageAlt="Los Santos County Sheriff’s Office subdued patch"
        imagePosition="center"
      />

      <section className="content-section content-section--light">
        <div className="site-shell two-column-editorial">
          <div>
            <p className="section-kicker section-kicker--dark">Division Mission</p>
            <h2>Preserve the scene. Protect the record.</h2>
          </div>
          <div className="reading-column">
            <p className="intro-serif">
              Forensic Services supports the Sheriff’s Office by documenting scenes, handling evidence, and preserving the details investigators rely on later.
            </p>
            <p>
              Forensics Specialists are civilian specialist personnel assigned to Forensic Services. They work alongside operational personnel while maintaining an objective, methodical approach to scene processing and evidence documentation.
            </p>
            <p>
              The role is built around accuracy, restraint, communication, and chain-of-custody discipline. Specialists are expected to document what is present, preserve what matters, and avoid turning technical support into investigative guesswork.
            </p>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="site-shell two-column-editorial">
          <div>
            <p className="section-kicker">Forensics Specialist</p>
            <h2>Technical support without losing objectivity.</h2>
          </div>
          <div className="reading-column">
            <ul>
              {responsibilities.map((responsibility) => (
                <li key={responsibility}>{responsibility}</li>
              ))}
            </ul>
            <div className="page-actions">
              <RouteLink href="/join/application?role=forensics">Apply for Forensics Specialist</RouteLink>
              <RouteLink href="/join" variant="outline">Careers at LSCSO</RouteLink>
            </div>
          </div>
        </div>
      </section>

      <section className="content-section content-section--light">
        <div className="site-shell two-column-editorial">
          <div>
            <p className="section-kicker section-kicker--dark">Personnel Portal</p>
            <h2>One department workspace.</h2>
          </div>
          <div className="reading-column">
            <p>
              Once appointed, Forensics Specialists use the standard LSCSO personnel portal for their own department record, assignments, certifications, requests, and other personnel functions available to their access level.
            </p>
            <p>
              The specialist title remains separate from the sworn Deputy rank structure. Portal access is shared where the workflow is appropriate; the position itself remains a Forensic Services assignment.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
